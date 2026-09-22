// Create a draft plan from a template (DESIGN §8.1, FR-2.3). The template is never modified: the
// plan gets its own copy of every blueprint row, so editing the plan can't reach back (§4.1).
//
// The draft exists before Plan setup runs, so the setup screens and the estimate flow have a plan
// id to write to (§8.1). `startPlan` turns it into an active plan.
import type {
  CycleExercise,
  CycleSet,
  CycleSlot,
  CycleWorkout,
  IncreaseRule,
  Phase,
} from '@/core/types';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface CreatePlanFromTemplateInput {
  templateId: string;
  /** Defaults to the template's name. */
  name?: string;
}

export type CreatePlanFromTemplateError = 'not_found' | 'empty_template';

export type CreatePlanFromTemplateResult = ServiceResult<
  CreatePlanFromTemplateError,
  { planId: string }
>;

/** The load types that need a 1RM before the plan can start (FR-3.3, DESIGN §4.4). */
const NEEDS_ONE_RM = new Set(['percent_tm', 'top_set']);

export function createPlanFromTemplate(
  db: Db,
  input: CreatePlanFromTemplateInput,
  ctx: ServiceContext,
): Promise<CreatePlanFromTemplateResult> {
  return exclusive(db, (tx) => createPlanFromTemplateTx(tx, input, ctx));
}

export async function createPlanFromTemplateTx(
  tx: Db,
  input: CreatePlanFromTemplateInput,
  ctx: ServiceContext,
): Promise<CreatePlanFromTemplateResult> {
  const r = repositories(tx);
  const template = await r.templates.get(input.templateId);
  if (!template) return { ok: false, reason: 'not_found' };

  const phases = await r.blueprints.phasesOfTemplate(template.id);
  if (phases.length === 0) return { ok: false, reason: 'empty_template' };

  const planId = ctx.newId();
  const copy = copyBlueprint(planId, phases, await loadContent(r, phases), ctx.newId);

  await r.plans.insert({
    id: planId,
    name: input.name ?? template.name,
    description: template.description,
    sourceTemplateId: template.id,
    status: 'draft',
    startDate: null,
    defaultTmPercent: template.defaultTmPercent,
    pausedOn: null,
    endedAt: null,
    endedOn: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });

  for (const p of copy.phases) await r.blueprints.insertPhase(p);
  for (const rule of copy.increaseRules) await r.blueprints.insertIncreaseRule(rule);
  for (const w of copy.workouts) await r.blueprints.insertWorkout(w);
  for (const e of copy.exercises) await r.blueprints.insertExercise(e);
  for (const s of copy.sets) await r.blueprints.insertSet(s);
  for (const s of copy.slots) await r.blueprints.insertSlot(s);

  // Pre-fill each %-based skill with its current 1RM (FR-3.3). Setup can still change it.
  const needsOneRm = new Set(
    copy.exercises
      .filter((e) =>
        copy.sets.some((s) => s.cycleExerciseId === e.id && NEEDS_ONE_RM.has(s.loadType)),
      )
      .map((e) => e.skillId),
  );
  const current = await r.oneRepMax.latestBySkill([...needsOneRm]);
  for (const skillId of [...needsOneRm].sort()) {
    await r.plans.insertSkill({
      id: ctx.newId(),
      planId,
      skillId,
      tmPercent: null,
      startingOneRmKg: current.get(skillId)?.oneRmKg ?? null,
    });
  }

  return { ok: true, planId };
}

interface Content {
  increaseRules: IncreaseRule[];
  workouts: CycleWorkout[];
  exercises: CycleExercise[];
  sets: CycleSet[];
  slots: CycleSlot[];
}

async function loadContent(r: Repositories, phases: readonly Phase[]): Promise<Content> {
  const content: Content = {
    increaseRules: [],
    workouts: [],
    exercises: [],
    sets: [],
    slots: [],
  };
  for (const phase of phases) {
    // A continuation has no blueprint of its own; it reads the original's (DESIGN §4.4).
    const blueprint = await r.blueprints.loadBlueprint(phase.id);
    if (!blueprint) continue;
    content.increaseRules.push(...blueprint.increaseRules);
    content.slots.push(...blueprint.slots);
    for (const w of blueprint.workouts) {
      content.workouts.push(w.workout);
      for (const e of w.exercises) {
        content.exercises.push(e.exercise);
        content.sets.push(...e.sets);
      }
    }
  }
  return content;
}

/**
 * Every row again under new IDs, with each reference pointed at its copy: continuations and
 * generated deloads (D-1, D-14), deload slots and exercises (D-30), and slot workouts (D-20).
 */
function copyBlueprint(
  planId: string,
  phases: readonly Phase[],
  content: Content,
  newId: () => string,
): Content & { phases: Phase[] } {
  const ids = new Map<string, string>();
  const idFor = (old: string): string => {
    const known = ids.get(old);
    if (known) return known;
    const fresh = newId();
    ids.set(old, fresh);
    return fresh;
  };
  const mapped = (old: string | null): string | null => (old === null ? null : idFor(old));

  // Phases first, so a continuation's reference resolves to a copy that exists.
  for (const p of phases) idFor(p.id);

  return {
    phases: phases.map((p) => ({
      ...p,
      id: idFor(p.id),
      templateId: null,
      planId,
      generatedFromPhaseId: mapped(p.generatedFromPhaseId),
      continuesPhaseId: mapped(p.continuesPhaseId),
    })),
    increaseRules: content.increaseRules.map((rule) => ({
      ...rule,
      id: newId(),
      phaseId: idFor(rule.phaseId),
    })),
    workouts: content.workouts.map((w) => ({ ...w, id: idFor(w.id), phaseId: idFor(w.phaseId) })),
    exercises: content.exercises.map((e) => ({
      ...e,
      id: idFor(e.id),
      cycleWorkoutId: idFor(e.cycleWorkoutId),
      sourceCycleExerciseId: mapped(e.sourceCycleExerciseId),
    })),
    sets: content.sets.map((s) => ({
      ...s,
      id: newId(),
      cycleExerciseId: idFor(s.cycleExerciseId),
    })),
    slots: content.slots.map((s) => ({
      ...s,
      id: idFor(s.id),
      phaseId: idFor(s.phaseId),
      cycleWorkoutId: idFor(s.cycleWorkoutId),
      sourceCycleSlotId: mapped(s.sourceCycleSlotId),
    })),
  };
}
