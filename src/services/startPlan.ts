// Start a draft plan (DESIGN §8.1, FR-4.2, FR-4.3). This slice covers steps 2, 4 and 6: pin the
// slots, set the start date, generate the schedule and make the plan active.
import { NEW_PROGRESSION } from '@/core/doubleProgression';
import { isLocalDate } from '@/core/dates';
import { generatePlannedWorkouts } from '@/core/schedule/generate';
import type { LocalDate, Phase } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { isTracked } from './doubleProgression';

export interface StartPlanInput {
  planId: string;
  startDate: LocalDate;
  /**
   * Weekday (0 Sunday … 6 Saturday) by slot id (DESIGN §7.5: one row per slot). Slots left out
   * keep their stored weekday. A generated deload slot has no row of its own: it takes its
   * source slot's day (D-30). Continuations have no slots, so pinning the original moves them too.
   */
  weekdayPins?: Readonly<Record<string, number>>;
  /**
   * Starting 1RMs in kg by skill id, from Plan setup (FR-3.3). They replace what the draft was
   * pre-filled with. Every %-based skill needs one before the plan can become active.
   */
  oneRms?: Readonly<Record<string, number>>;
}

export type StartPlanError =
  | 'not_found'
  | 'not_draft'
  | 'plan_already_current'
  | 'bad_date'
  | 'bad_pin'
  | 'bad_one_rm'
  | 'missing_one_rm'
  | 'empty_schedule';

export type StartPlanResult = ServiceResult<StartPlanError, { plannedCount: number }>;

export function startPlan(
  db: Db,
  input: StartPlanInput,
  ctx: ServiceContext,
): Promise<StartPlanResult> {
  return exclusive(db, (tx) => startPlanTx(tx, input, ctx));
}

/** The body of `startPlan`, for a caller that already holds the exclusive transaction. */
export async function startPlanTx(
  tx: Db,
  input: StartPlanInput,
  ctx: ServiceContext,
): Promise<StartPlanResult> {
  if (!isLocalDate(input.startDate)) return { ok: false, reason: 'bad_date' };
  const r = repositories(tx);
  const plan = await r.plans.get(input.planId);
  if (!plan) return { ok: false, reason: 'not_found' };
  if (plan.status !== 'draft') return { ok: false, reason: 'not_draft' };
  // TODO(end-plan slice): §8.1 step 1 ends the current plan once the user confirms (FR-4.1,
  // §8.6). Until endPlan exists, starting a second plan is refused.
  if (await r.plans.current()) return { ok: false, reason: 'plan_already_current' };

  // Step 2: pin the slots. Everything is validated and generated before the first write.
  // Two workouts pinned to one day are allowed here: setup warns about it (DESIGN §7.5).
  const slots = await r.blueprints.slotsOfPlan(plan.id);
  const pins = Object.entries(input.weekdayPins ?? {});
  const valid = pins.every(
    ([slotId, weekday]) =>
      slots.some((s) => s.id === slotId && s.sourceCycleSlotId === null) &&
      Number.isInteger(weekday) &&
      weekday >= 0 &&
      weekday <= 6,
  );
  if (!valid) return { ok: false, reason: 'bad_pin' };
  const dayOf = new Map(slots.map((s) => [s.id, input.weekdayPins?.[s.id] ?? s.weekday]));
  // D-30: a deload copy takes its source slot's day. Once its source is gone it keeps its own.
  const pinned = slots.map((s) => ({
    ...s,
    weekday: dayOf.get(s.sourceCycleSlotId ?? s.id) ?? s.weekday,
  }));

  // Step 4: generate the schedule (FR-4.3).
  const phases = await r.blueprints.phasesOfPlan(plan.id);
  const planned = generatePlannedWorkouts(
    { planId: plan.id, startDate: input.startDate, phases, slots: pinned },
    ctx.newId,
  );
  if (planned.length === 0) return { ok: false, reason: 'empty_schedule' };

  // Step 3: starting 1RMs. Every %-based skill needs one before the plan can become active
  // (FR-3.3, §4.4), so the requirement is read from the blueprint, not from the rows that exist.
  const entered = input.oneRms ?? {};
  if (Object.values(entered).some((kg) => !(kg > 0))) return { ok: false, reason: 'bad_one_rm' };
  const planSkills = await r.plans.skills(plan.id);
  const stored = new Map(planSkills.map((ps) => [ps.skillId, ps]));
  const setup = new Map<string, number>();
  for (const skillId of await percentBasedSkills(r, phases)) {
    const kg = entered[skillId] ?? stored.get(skillId)?.startingOneRmKg ?? null;
    if (kg === null) return { ok: false, reason: 'missing_one_rm' };
    setup.set(skillId, kg);
  }

  for (const s of pinned) {
    if (s.weekday !== slots.find((o) => o.id === s.id)!.weekday) {
      await r.blueprints.updateSlot(s.id, { weekday: s.weekday });
    }
  }

  const current = await r.oneRepMax.latestBySkill([...setup.keys()]);
  for (const [skillId, kg] of setup) {
    const ps = stored.get(skillId);
    if (!ps) {
      await r.plans.insertSkill({
        id: ctx.newId(),
        planId: plan.id,
        skillId,
        tmPercent: null,
        startingOneRmKg: kg,
      });
    } else if (kg !== ps.startingOneRmKg) {
      await r.plans.updateSkill(ps.id, { startingOneRmKg: kg });
    }
    // C-13: a 'plan_setup' row only where setup changed the skill's current 1RM.
    if (kg !== (current.get(skillId)?.oneRmKg ?? null)) {
      await r.oneRepMax.insert({
        id: ctx.newId(),
        skillId,
        oneRmKg: kg,
        source: 'plan_setup',
        planId: plan.id,
        effectiveFromWeekIndex: 1,
        cycleReviewId: null,
        estimateSessionId: null,
        note: null,
        setAt: ctx.now,
      });
    }
  }

  await r.plannedWorkouts.insertMany(planned);

  // Step 5: an empty track per double-progression exercise of a training phase (§3.12). A
  // continuation shares its original's blueprint, and a deload reads its source's track.
  const tracked = new Set<string>();
  for (const phase of phases.filter((p) => p.type === 'training')) {
    const blueprint = await r.blueprints.loadBlueprint(phase.continuesPhaseId ?? phase.id);
    for (const w of blueprint?.workouts ?? []) {
      for (const e of w.exercises) if (isTracked(e.sets)) tracked.add(e.exercise.id);
    }
  }
  await r.progression.insertMany(
    [...tracked].map((cycleExerciseId) => ({
      ...NEW_PROGRESSION,
      cycleExerciseId,
      planId: plan.id,
    })),
  );

  // Step 6.
  await r.plans.update(plan.id, {
    startDate: input.startDate,
    status: 'active',
    updatedAt: ctx.now,
  });
  // TODO(reviews slice): finish with reconcile(ctx.today) once it exists (DESIGN §2.5).

  return { ok: true, plannedCount: planned.length };
}

/** The skills whose loads come from a training max, so a 1RM is required (FR-3.2, FR-3.3). */
async function percentBasedSkills(
  r: ReturnType<typeof repositories>,
  phases: readonly Phase[],
): Promise<Set<string>> {
  const skills = new Set<string>();
  for (const phase of phases) {
    const blueprint = await r.blueprints.loadBlueprint(phase.id);
    for (const w of blueprint?.workouts ?? []) {
      for (const e of w.exercises) {
        if (e.sets.some((s) => s.loadType === 'percent_tm' || s.loadType === 'top_set')) {
          skills.add(e.exercise.skillId);
        }
      }
    }
  }
  return skills;
}
