// DESIGN §8.1 steps 2, 4 and 6 (FR-2.5, FR-2.11, FR-4.2, FR-4.3, FR-4.11, FR-8.3, D-1, D-14).
import { builderSections, progress, weekPosition, type PlannedWorkout } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { count } from '../../test/db/rows';
import { idSequence } from '../../test/fixtures/ids';
import {
  aPlan,
  FULL_BODY_AB,
  sets,
  strength,
  topSet,
  type BuiltPlan,
} from '../../test/fixtures/plans';
import type { ServiceContext } from './context';
import { insertDeload } from './insertDeload';
import { startPlan } from './startPlan';

const START = '2026-09-14'; // a Monday

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: '2026-09-12', now: '2026-09-12T09:00:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

/** The Beginner Strength shape before its deload: one 12-week, 2-week-cycle training phase. */
const beginnerDraft = (id = 'plan') =>
  aPlan(id)
    .withPhase(strength({ weeks: 12, cycle: 2 }))
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      { skill: 'skill_back_squat', sets: sets(5, { repsMin: 5, repsMax: 5, loadPercent: 0.8 }) },
    ])
    .withExercises('Full body B', [
      { skill: 'skill_bench_press', sets: [topSet(), ...sets(4, { loadPercent: 0.8 })] },
    ])
    .withSchedule(FULL_BODY_AB)
    .build(db);

const week = (rows: PlannedWorkout[], w: number) => rows.filter((r) => r.weekIndex === w);
const dates = (rows: PlannedWorkout[]) => rows.map((r) => r.scheduledDate);

describe('AC-2 Cycle repetition', () => {
  it('weeks 3, 5, 7, 9 and 11 match week 1, and weeks 4, 6, 8, 10 and 12 match week 2', async () => {
    const built = await beginnerDraft();
    const result = await startPlan(db, { planId: built.planId, startDate: START }, ctx);
    expect(result).toEqual({ ok: true, plannedCount: 36 });

    const rows = await repos.plannedWorkouts.listByPlan(built.planId);
    const shape = (w: number) => week(rows, w).map((r) => [r.cycleSlotId, r.cycleWorkoutId]);
    expect(shape(1)).toEqual([
      [built.slotIds.A!.Mon, built.workoutIds['Full body A']],
      [built.slotIds.A!.Wed, built.workoutIds['Full body B']],
      [built.slotIds.A!.Fri, built.workoutIds['Full body A']],
    ]);
    expect(shape(2)).toEqual([
      [built.slotIds.B!.Mon, built.workoutIds['Full body B']],
      [built.slotIds.B!.Wed, built.workoutIds['Full body A']],
      [built.slotIds.B!.Fri, built.workoutIds['Full body B']],
    ]);
    for (const w of [3, 5, 7, 9, 11]) expect(shape(w)).toEqual(shape(1));
    for (const w of [4, 6, 8, 10, 12]) expect(shape(w)).toEqual(shape(2));
    // FR-2.5: a 12-week phase with a 2-week cycle gives 6 cycles.
    expect(week(rows, 12).every((r) => r.phaseCycleIndex === 6)).toBe(true);
  });
});

// TODO(OQ-1): once templates are seeded (DESIGN §11 step 10), also run this against the seeded
// Beginner Strength template. Until then the template's shape is built by inserting its deload.
describe('AC-57 Template continuation numbering', () => {
  let built: BuiltPlan;
  let rows: PlannedWorkout[];
  let deloadPhaseId: string;
  let continuationPhaseId: string;

  beforeEach(async () => {
    built = await beginnerDraft();
    // FR-2.1: Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk, continuation).
    const inserted = await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);
    if (!inserted.ok) throw new Error(inserted.reason);
    deloadPhaseId = inserted.deloadPhaseId;
    continuationPhaseId = inserted.continuationPhaseId!;

    const started = await startPlan(db, { planId: built.planId, startDate: START }, ctx);
    expect(started).toEqual({ ok: true, plannedCount: 39 });
    rows = await repos.plannedWorkouts.listByPlan(built.planId);
  });

  it('generates 13 weeks: Block 1 as cycles 1–3, then the week-7 deload', () => {
    expect(rows).toHaveLength(39);
    expect(new Set(rows.map((r) => r.weekIndex))).toEqual(
      new Set(Array.from({ length: 13 }, (_, i) => i + 1)),
    );
    for (const w of [1, 2, 3, 4, 5, 6]) {
      expect(week(rows, w).every((r) => r.phaseId === built.phaseId)).toBe(true);
      expect(week(rows, w).every((r) => r.cycleGroupId === built.phaseId)).toBe(true);
      expect(week(rows, w).every((r) => r.phaseCycleIndex === Math.ceil(w / 2))).toBe(true);
    }

    const deloadWeek = week(rows, 7);
    expect(dates(deloadWeek)).toEqual(['2026-10-26', '2026-10-28', '2026-10-30']);
    expect(
      deloadWeek.every((r) => r.phaseId === deloadPhaseId && r.cycleGroupId === deloadPhaseId),
    ).toBe(true);
  });

  it('Block 2 continues as cycles 4–6 in Block 1’s cycle group (D-1, D-14)', () => {
    const block2 = rows.filter((r) => r.weekIndex >= 8);
    expect(block2).toHaveLength(18);
    expect(block2.every((r) => r.phaseId === continuationPhaseId)).toBe(true);
    expect(block2.every((r) => r.cycleGroupId === built.phaseId)).toBe(true);
    expect([...new Set(block2.map((r) => r.phaseCycleIndex))]).toEqual([4, 5, 6]);
    // A continuation uses the original's blueprint: week 8 is cycle 4, week A.
    expect(week(rows, 8).map((r) => r.cycleSlotId)).toEqual([
      built.slotIds.A!.Mon,
      built.slotIds.A!.Wed,
      built.slotIds.A!.Fri,
    ]);
    expect(dates(week(rows, 13))).toEqual(['2026-12-07', '2026-12-09', '2026-12-11']);
  });

  it('week 8 shows "Cycle 4 · Week 8 of 13", and the builder shows one training phase with a deload inside it', async () => {
    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    expect(weekPosition(phases, 8)).toMatchObject({
      phaseCycleIndex: 4,
      weekIndex: 8,
      totalWeeks: 13,
    });

    const sections = builderSections(phases);
    expect(sections).toHaveLength(1);
    expect(sections[0].phase.type).toBe('training');
    expect(sections[0].parts.map((p) => [p.id, p.type])).toEqual([
      [built.phaseId, 'training'],
      [deloadPhaseId, 'deload'],
      [continuationPhaseId, 'training'],
    ]);
  });

  it('FR-8.3: the progress meter reads week 1 of 13, 0%, before the start', async () => {
    const plan = (await repos.plans.get(built.planId))!;
    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    expect(plan).toMatchObject({ status: 'active', startDate: START, updatedAt: ctx.now });
    expect(progress(phases, rows, ctx.today, plan)).toMatchObject({
      currentWeek: 1,
      totalWeeks: 13,
      currentPhase: { id: built.phaseId },
      completed: 0,
      pctSessions: 0,
      adherence: null,
    });
  });

  it('FR-4.11: a workout left undone shows as missed and stays on its date', async () => {
    const plan = (await repos.plans.get(built.planId))!;
    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    // Tuesday of week 1: Monday's workout was never started.
    expect(progress(phases, rows, '2026-09-15', plan)).toMatchObject({
      currentWeek: 1,
      completed: 0,
      adherence: 0,
    });
    expect(await repos.plannedWorkouts.listByPlan(built.planId)).toEqual(rows);
    expect(rows[0]).toMatchObject({ scheduledDate: '2026-09-14', status: 'upcoming' });
  });
});

describe('FR-4.2 weekday pins', () => {
  const tueThuSat = (b: BuiltPlan) => ({
    [b.slotIds.A!.Mon!]: 2,
    [b.slotIds.A!.Wed!]: 4,
    [b.slotIds.A!.Fri!]: 6,
    [b.slotIds.B!.Mon!]: 2,
    [b.slotIds.B!.Wed!]: 4,
    [b.slotIds.B!.Fri!]: 6,
  });

  it('AC-70 Deload follows training days: pinning Tue/Thu/Sat moves Block 1, the deload and Block 2', async () => {
    const built = await beginnerDraft();
    await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);
    const result = await startPlan(
      db,
      { planId: built.planId, startDate: START, weekdayPins: tueThuSat(built) },
      ctx,
    );
    expect(result.ok).toBe(true);

    const rows = await repos.plannedWorkouts.listByPlan(built.planId);
    expect(dates(week(rows, 1))).toEqual(['2026-09-15', '2026-09-17', '2026-09-19']);
    // The deload's slots have no rows of their own: they take their source slots' days (D-30).
    expect(dates(week(rows, 7))).toEqual(['2026-10-27', '2026-10-29', '2026-10-31']);
    expect(dates(week(rows, 8))).toEqual(['2026-11-03', '2026-11-05', '2026-11-07']);
    expect((await repos.blueprints.slotsOfPlan(built.planId)).map((s) => s.weekday)).toEqual([
      2, 4, 6, 2, 4, 6, 2, 4, 6,
    ]);
  });

  it('D-30: a generated deload slot cannot be pinned on its own', async () => {
    const built = await beginnerDraft();
    const inserted = await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);
    if (!inserted.ok) throw new Error(inserted.reason);
    const deloadSlot = (await repos.blueprints.slotsOfPlan(built.planId)).find(
      (s) => s.phaseId === inserted.deloadPhaseId,
    )!;

    const result = await startPlan(
      db,
      { planId: built.planId, startDate: START, weekdayPins: { [deloadSlot.id]: 2 } },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: 'bad_pin' });
    expect(await count(db, 'planned_workout')).toBe(0);
    expect((await repos.blueprints.slotsOfPlan(built.planId)).map((s) => s.weekday)).toEqual([
      1, 3, 5, 1, 3, 5, 1, 3, 5,
    ]);
  });

  it.each`
    case                        | pins
    ${'a slot of another plan'} | ${{ 'other:A-Mon': 2 }}
    ${'an unknown slot'}        | ${{ nope: 2 }}
    ${'a weekday above 6'}      | ${{ 'plan:A-Mon': 7 }}
    ${'a negative weekday'}     | ${{ 'plan:A-Mon': -1 }}
    ${'a fractional weekday'}   | ${{ 'plan:A-Mon': 1.5 }}
  `('rejects $case as bad_pin, writing nothing', async ({ pins }) => {
    await aPlan('other')
      .withWorkouts('X')
      .withSchedule({ A: { Mon: 'X' } })
      .build(db);
    const built = await beginnerDraft();
    const result = await startPlan(
      db,
      { planId: built.planId, startDate: START, weekdayPins: pins },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: 'bad_pin' });
    await expectUntouched(built.planId);
  });
});

async function expectUntouched(planId: string) {
  expect(await count(db, 'planned_workout')).toBe(0);
  expect(await repos.plans.get(planId)).toMatchObject({ status: 'draft', startDate: null });
  expect((await repos.blueprints.slotsOfPlan(planId)).map((s) => s.weekday)).toEqual([
    1, 3, 5, 1, 3, 5,
  ]);
}

describe('startPlan rejections (DESIGN §8.1)', () => {
  it('not_found for an unknown plan', async () => {
    expect(await startPlan(db, { planId: 'nope', startDate: START }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('not_draft for a plan that has already started', async () => {
    const built = await beginnerDraft();
    await startPlan(db, { planId: built.planId, startDate: START }, ctx);
    expect(await startPlan(db, { planId: built.planId, startDate: START }, ctx)).toEqual({
      ok: false,
      reason: 'not_draft',
    });
    expect(await count(db, 'planned_workout')).toBe(36);
  });

  it('FR-4.1: plan_already_current while another plan is active or paused', async () => {
    await aPlan('current').withStatus('paused').startingOn('2026-08-03').build(db);
    const built = await beginnerDraft();
    expect(await startPlan(db, { planId: built.planId, startDate: START }, ctx)).toEqual({
      ok: false,
      reason: 'plan_already_current',
    });
    await expectUntouched(built.planId);
  });

  it('bad_date for a start date that is not a calendar date', async () => {
    const built = await beginnerDraft();
    expect(await startPlan(db, { planId: built.planId, startDate: '2026-02-29' }, ctx)).toEqual({
      ok: false,
      reason: 'bad_date',
    });
    await expectUntouched(built.planId);
  });

  it('empty_schedule when no workout is placed on any day', async () => {
    const built = await aPlan().withWorkouts('Full body A').build(db);
    expect(await startPlan(db, { planId: built.planId, startDate: START }, ctx)).toEqual({
      ok: false,
      reason: 'empty_schedule',
    });
    expect(await repos.plans.get(built.planId)).toMatchObject({ status: 'draft' });
  });

  it('an unexpected generation error writes nothing', async () => {
    const built = await beginnerDraft();
    // A taper phase makes generation throw (v1.1, FR-2.14) after the pins pass validation.
    await repos.blueprints.insertPhase({
      ...(await repos.blueprints.phase(built.phaseId))!,
      id: 'taper',
      sortOrder: 2,
      type: 'taper',
      reviewMode: 'none',
      lengthWeeks: 1,
      cycleLengthWeeks: 1,
    });
    await expect(
      startPlan(
        db,
        { planId: built.planId, startDate: START, weekdayPins: { [built.slotIds.A!.Mon!]: 2 } },
        ctx,
      ),
    ).rejects.toThrow(/taper/i);
    await expectUntouched(built.planId);
  });
});
