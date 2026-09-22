// Starting a plan from a built-in template (DESIGN §8.1, FR-2.3, FR-3.3, FR-4.1, FR-4.4).
import { progress, weekPosition, type PlannedWorkout } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { count } from '../../test/db/rows';
import { idSequence } from '../../test/fixtures/ids';
import type { ServiceContext } from './context';
import { createPlanFromTemplate } from './createPlanFromTemplate';
import { startPlan } from './startPlan';

const START = '2026-09-14'; // a Monday
const MON_WED_FRI = [1, 3, 5];

const ONE_RMS = {
  skill_back_squat: 110,
  skill_bench_press: 90,
  skill_deadlift: 140,
  skill_overhead_press: 55,
};

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: '2026-09-14', now: '2026-09-12T09:00:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

const draft = async (templateId = 'tpl_beginner_strength'): Promise<string> => {
  const created = await createPlanFromTemplate(db, { templateId }, ctx);
  if (!created.ok) throw new Error(created.reason);
  return created.planId;
};

const week = (rows: PlannedWorkout[], w: number) => rows.filter((r) => r.weekIndex === w);

describe('AC-1 Start from a template', () => {
  it('generates 13 weeks including the week-7 deload, and reads "Week 1 of 13, 0%"', async () => {
    const planId = await draft();
    const slots = await repos.blueprints.slotsOfPlan(planId);
    const pins = Object.fromEntries(
      slots.filter((s) => s.sourceCycleSlotId === null).map((s, i) => [s.id, MON_WED_FRI[i % 3]!]),
    );

    const result = await startPlan(
      db,
      { planId, startDate: START, weekdayPins: pins, oneRms: ONE_RMS },
      ctx,
    );
    expect(result).toEqual({ ok: true, plannedCount: 39 });

    const rows = await repos.plannedWorkouts.listByPlan(planId);
    const phases = await repos.blueprints.phasesOfPlan(planId);
    // 13 weeks × 3 sessions, on the pinned Mon/Wed/Fri of every week.
    expect(Math.max(...rows.map((r) => r.weekIndex))).toBe(13);
    for (let w = 1; w <= 13; w++) expect(week(rows, w)).toHaveLength(3);
    expect(week(rows, 1).map((r) => r.scheduledDate)).toEqual([
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ]);
    // Week 7 is the deload, six weeks on from the start (FR-2.12, FR-4.3).
    expect(weekPosition(phases, 7).phase.type).toBe('deload');
    expect(week(rows, 7).map((r) => r.scheduledDate)).toEqual([
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
    expect(week(rows, 13).map((r) => r.scheduledDate)).toEqual([
      '2026-12-07',
      '2026-12-09',
      '2026-12-11',
    ]);

    const plan = (await repos.plans.get(planId))!;
    expect(plan).toMatchObject({ status: 'active', startDate: START });
    expect(progress(phases, rows, ctx.today, plan)).toMatchObject({
      currentWeek: 1,
      totalWeeks: 13,
      completed: 0,
      pctSessions: 0,
    });
  });
});

describe('FR-2.3 a plan is an editable copy', () => {
  it('copies the blueprint and never writes to the template', async () => {
    const TPL = "template_id = 'tpl_beginner_strength'";
    const setsOf = (owner: string) =>
      count(
        db,
        'cycle_set',
        `cycle_exercise_id IN (SELECT ce.id FROM cycle_exercise ce
         JOIN cycle_workout cw ON cw.id = ce.cycle_workout_id
         JOIN phase p ON p.id = cw.phase_id WHERE ${owner})`,
      );
    const before = { phases: await count(db, 'phase', TPL), sets: await setsOf(TPL) };
    const planId = await draft();

    // The template is untouched, and the plan holds an identical copy.
    expect(await count(db, 'phase', TPL)).toBe(before.phases);
    expect(await setsOf(TPL)).toBe(before.sets);
    expect(await count(db, 'phase', `plan_id = '${planId}'`)).toBe(before.phases);
    expect(await setsOf(`p.plan_id = '${planId}'`)).toBe(before.sets);
    expect(await repos.plans.get(planId)).toMatchObject({
      name: 'Beginner Strength',
      status: 'draft',
      sourceTemplateId: 'tpl_beginner_strength',
      defaultTmPercent: 0.9,
      startDate: null,
    });
  });

  it('shares no rows with the template, so editing the plan cannot reach back', async () => {
    const planId = await draft();
    const templatePhases = await repos.blueprints.phasesOfTemplate('tpl_beginner_strength');
    const planPhases = await repos.blueprints.phasesOfPlan(planId);

    expect(planPhases.map((p) => p.name)).toEqual(templatePhases.map((p) => p.name));
    expect(planPhases.some((p) => templatePhases.some((t) => t.id === p.id))).toBe(false);
    expect(planPhases.every((p) => p.templateId === null && p.planId === planId)).toBe(true);

    const planSlots = await repos.blueprints.slotsOfPlan(planId);
    const templateSlotIds = new Set(
      (await Promise.all(templatePhases.map((p) => repos.blueprints.loadBlueprint(p.id))))
        .flatMap((b) => b?.slots ?? [])
        .map((s) => s.id),
    );
    expect(planSlots.some((s) => templateSlotIds.has(s.id))).toBe(false);
  });

  it('FR-2.11 re-points the continuation and the deload at the copied phases (D-1, D-14)', async () => {
    const planId = await draft();
    const [block1, deload, block2] = await repos.blueprints.phasesOfPlan(planId);

    expect(deload).toMatchObject({ generatedFromPhaseId: block1!.id });
    expect(block2).toMatchObject({ continuesPhaseId: block1!.id, continuesOffsetWeeks: 6 });
    // Block 2 carries on Block 1's numbering, so week 8 opens cycle 4.
    expect(weekPosition(await repos.blueprints.phasesOfPlan(planId), 8).phaseCycleIndex).toBe(4);

    // D-30: each deload slot still points at its source slot, now the copy.
    const slots = await repos.blueprints.slotsOfPlan(planId);
    const own = new Set(slots.map((s) => s.id));
    const sources = slots.map((s) => s.sourceCycleSlotId).filter((id): id is string => id !== null);
    expect(sources).toHaveLength(3);
    expect(sources.every((id) => own.has(id))).toBe(true);
  });

  it('rejects an unknown template', async () => {
    expect(await createPlanFromTemplate(db, { templateId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(await count(db, 'plan')).toBe(0);
  });
});

describe('FR-3.3 starting 1RMs', () => {
  it('pre-fills each %-based skill from its current 1RM, and only those skills', async () => {
    await repos.oneRepMax.insert({
      id: 'orm1',
      skillId: 'skill_back_squat',
      oneRmKg: 100,
      source: 'manual',
      planId: null,
      effectiveFromWeekIndex: null,
      cycleReviewId: null,
      estimateSessionId: null,
      note: null,
      setAt: '2026-08-01T09:00:00.000Z',
    });
    const planId = await draft();

    const skills = await repos.plans.skills(planId);
    expect(Object.fromEntries(skills.map((s) => [s.skillId, s.startingOneRmKg]))).toEqual({
      skill_back_squat: 100,
      skill_bench_press: null,
      skill_deadlift: null,
      skill_overhead_press: null,
    });
  });

  it('refuses to start while a %-based skill has no 1RM (DESIGN §4.4)', async () => {
    const planId = await draft();
    const result = await startPlan(
      db,
      { planId, startDate: START, oneRms: { skill_back_squat: 110 } },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: 'missing_one_rm' });
    expect(await count(db, 'planned_workout')).toBe(0);
    expect((await repos.plans.get(planId))?.status).toBe('draft');
  });

  it('rejects a 1RM of zero or less, writing nothing', async () => {
    const planId = await draft();
    expect(
      await startPlan(
        db,
        { planId, startDate: START, oneRms: { ...ONE_RMS, skill_deadlift: 0 } },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'bad_one_rm' });
    expect(await count(db, 'planned_workout')).toBe(0);
  });

  it('C-13 writes a plan_setup row only where setup changed the current 1RM', async () => {
    await repos.oneRepMax.insert({
      id: 'orm1',
      skillId: 'skill_back_squat',
      oneRmKg: 110,
      source: 'manual',
      planId: null,
      effectiveFromWeekIndex: null,
      cycleReviewId: null,
      estimateSessionId: null,
      note: null,
      setAt: '2026-08-01T09:00:00.000Z',
    });
    const planId = await draft();
    // The squat is entered unchanged at 110; the other three are new.
    const result = await startPlan(db, { planId, startDate: START, oneRms: ONE_RMS }, ctx);
    expect(result.ok).toBe(true);

    const rows = await repos.oneRepMax.listByPlan(planId);
    expect(rows.map((r) => [r.skillId, r.oneRmKg, r.source, r.effectiveFromWeekIndex])).toEqual([
      ['skill_bench_press', 90, 'plan_setup', 1],
      ['skill_deadlift', 140, 'plan_setup', 1],
      ['skill_overhead_press', 55, 'plan_setup', 1],
    ]);
    // starting_one_rm_kg always holds the starting value, changed or not (C-13).
    const skills = await repos.plans.skills(planId);
    expect(Object.fromEntries(skills.map((s) => [s.skillId, s.startingOneRmKg]))).toEqual(ONE_RMS);
  });
});

describe('FR-4.1 one plan at a time', () => {
  it('refuses to start a second plan while one is active', async () => {
    const first = await draft();
    expect(
      (await startPlan(db, { planId: first, startDate: START, oneRms: ONE_RMS }, ctx)).ok,
    ).toBe(true);

    const second = await draft('tpl_beginner_hypertrophy');
    expect(await startPlan(db, { planId: second, startDate: START, oneRms: ONE_RMS }, ctx)).toEqual(
      {
        ok: false,
        reason: 'plan_already_current',
      },
    );
  });

  it('allows a second draft to exist alongside an active plan', async () => {
    const first = await draft();
    await startPlan(db, { planId: first, startDate: START, oneRms: ONE_RMS }, ctx);
    await draft('tpl_beginner_hypertrophy');
    expect(await count(db, 'plan')).toBe(2);
    expect((await repos.plans.current())?.id).toBe(first);
  });
});
