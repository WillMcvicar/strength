// DESIGN §3.9 "Inserting a deload in the builder" (FR-2.12, FR-2.11, D-1, D-23, C-1).
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { count } from '../../test/db/rows';
import { idSequence } from '../../test/fixtures/ids';
import { aPlan, FULL_BODY_AB, sets, strength, topSet } from '../../test/fixtures/plans';
import type { ServiceContext } from './context';
import { insertDeload } from './insertDeload';

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

const draft = (id = 'plan') =>
  aPlan(id)
    .withPhase(strength({ weeks: 12, cycle: 2 }))
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      {
        skill: 'skill_back_squat',
        sets: sets(4, {
          repsMin: 8,
          repsMax: 8,
          loadPercent: 0.7,
          targetRpeMin: 8,
          targetRpeMax: 8,
        }),
      },
    ])
    .withExercises('Full body B', [
      { skill: 'skill_bench_press', sets: [topSet(), ...sets(4, { loadPercent: 0.8 })] },
    ])
    .withSchedule(FULL_BODY_AB)
    .build(db);

describe('insertDeload (FR-2.12)', () => {
  it('D-1: splits the phase after week 6 into Block 1, a generated deload and a continuation', async () => {
    const built = await draft();
    const result = await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);
    expect(result).toEqual({ ok: true, deloadPhaseId: 'id-1', continuationPhaseId: 'id-2' });

    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    expect(
      phases.map((p) => [p.id, p.sortOrder, p.type, p.lengthWeeks, p.cycleLengthWeeks]),
    ).toEqual([
      [built.phaseId, 1, 'training', 6, 2],
      ['id-1', 2, 'deload', 1, 1],
      ['id-2', 3, 'training', 6, 2],
    ]);
    expect(phases[1]).toMatchObject({
      reviewMode: 'none',
      volumeFactor: 0.5,
      loadFactor: 0.9,
      rpeCap: 7,
      generatedFromPhaseId: built.phaseId,
    });
    expect(phases[2]).toMatchObject({ continuesPhaseId: built.phaseId, continuesOffsetWeeks: 6 });
    expect(await repos.plans.get(built.planId)).toMatchObject({ updatedAt: ctx.now });
  });

  it('copies cycle week 1 as the deload’s own workouts, with set counts halved and RPE capped', async () => {
    const built = await draft();
    await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);

    const deload = (await repos.blueprints.loadBlueprint('id-1'))!;
    expect(deload.workouts.map((w) => w.workout.name)).toEqual(['Full body A', 'Full body B']);
    expect(deload.slots.map((s) => [s.weekday, s.cycleWeekIndex])).toEqual([
      [1, 1],
      [3, 1],
      [5, 1],
    ]);

    // D-30: each copy is linked to the week-A slot it came from.
    expect(deload.slots.map((s) => s.sourceCycleSlotId)).toEqual([
      built.slotIds.A!.Mon,
      built.slotIds.A!.Wed,
      built.slotIds.A!.Fri,
    ]);

    const squat = deload.workouts[0].exercises[0];
    expect(squat.exercise.sourceCycleExerciseId).toBe(built.exerciseIds['Full body A'][0]);
    // AC-30 figures: 4 × 8 @ 70% TM, RPE 8 → 2 × 8 with an RPE cap of 7.
    expect(squat.sets.map((s) => [s.repsMax, s.loadPercent, s.targetRpeMax])).toEqual([
      [8, 0.7, 7],
      [8, 0.7, 7],
    ]);

    // D-19: the top set is kept first and becomes a normal %-of-TM set.
    const bench = deload.workouts[1].exercises[0];
    expect(bench.sets.map((s) => [s.loadType, s.loadPercent])).toEqual([
      ['percent_tm', 0.975],
      ['percent_tm', 0.8],
      ['percent_tm', 0.8],
    ]);

    // The original blueprint is untouched, and the continuation has none of its own.
    const original = (await repos.blueprints.loadBlueprint(built.phaseId))!;
    expect(original.workouts[0].exercises[0].sets).toHaveLength(4);
    expect((await repos.blueprints.loadBlueprint('id-2'))!.workouts).toEqual([]);
  });

  it('inserts a 2-week deload at the end of the phase without a split', async () => {
    const built = await draft();
    const result = await insertDeload(
      db,
      { planId: built.planId, afterWeek: 12, lengthWeeks: 2 },
      ctx,
    );
    expect(result).toEqual({ ok: true, deloadPhaseId: 'id-1', continuationPhaseId: null });
    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    expect(phases.map((p) => [p.type, p.lengthWeeks])).toEqual([
      ['training', 12],
      ['deload', 2],
    ]);
  });

  it('splits a continuation again, keeping the original’s cycle group', async () => {
    const built = await draft();
    await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx);
    const second = await insertDeload(db, { planId: built.planId, afterWeek: 10 }, ctx);
    if (!second.ok) throw new Error(second.reason);

    const phases = await repos.blueprints.phasesOfPlan(built.planId);
    expect(
      phases.map((p) => [p.type, p.lengthWeeks, p.continuesPhaseId, p.continuesOffsetWeeks]),
    ).toEqual([
      ['training', 6, null, null],
      ['deload', 1, null, null],
      ['training', 3, built.phaseId, 6],
      ['deload', 1, null, null],
      ['training', 3, built.phaseId, 9],
    ]);
    // Both deloads are generated from the original's cycle week 1.
    const second_ = (await repos.blueprints.loadBlueprint(second.deloadPhaseId))!;
    expect(second_.workouts[0].exercises[0].exercise.sourceCycleExerciseId).toBe(
      built.exerciseIds['Full body A'][0],
    );
  });
});

describe('insertDeload rejections', () => {
  const nothingWritten = async (planId: string) => {
    expect(await count(db, 'phase', `plan_id = '${planId}'`)).toBe(1);
    expect(await count(db, 'cycle_workout')).toBe(2);
    expect((await repos.blueprints.phasesOfPlan(planId))[0].lengthWeeks).toBe(12);
  };

  it('not_found for an unknown plan', async () => {
    expect(await insertDeload(db, { planId: 'nope', afterWeek: 6 }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it.each(['active', 'paused', 'completed', 'abandoned'] as const)(
    'D-23: not_draft for a %s plan',
    async (status) => {
      const built = await aPlan()
        .withStatus(status)
        .startingOn('2026-09-14')
        .withWorkouts('Full body A', 'Full body B')
        .withSchedule(FULL_BODY_AB)
        .build(db);
      expect(await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx)).toEqual({
        ok: false,
        reason: 'not_draft',
      });
      await nothingWritten(built.planId);
    },
  );

  it.each`
    afterWeek | lengthWeeks | reason
    ${0}      | ${1}        | ${'bad_week'}
    ${13}     | ${1}        | ${'bad_week'}
    ${6}      | ${3}        | ${'length_out_of_range'}
  `(
    '$reason (after week $afterWeek, $lengthWeeks weeks)',
    async ({ afterWeek, lengthWeeks, reason }) => {
      const built = await draft();
      expect(await insertDeload(db, { planId: built.planId, afterWeek, lengthWeeks }, ctx)).toEqual(
        {
          ok: false,
          reason,
        },
      );
      await nothingWritten(built.planId);
    },
  );

  it('no_training_phase_before after a deload, and next_to_deload before one', async () => {
    const built = await draft();
    await insertDeload(db, { planId: built.planId, afterWeek: 12 }, ctx);
    expect(await insertDeload(db, { planId: built.planId, afterWeek: 13 }, ctx)).toEqual({
      ok: false,
      reason: 'no_training_phase_before',
    });
    // D-30: nor directly before one; the existing deload is lengthened instead.
    expect(await insertDeload(db, { planId: built.planId, afterWeek: 12 }, ctx)).toEqual({
      ok: false,
      reason: 'next_to_deload',
    });
    expect(await count(db, 'phase', `plan_id = '${built.planId}'`)).toBe(2);
  });

  it('too_long past 52 weeks (FR-2.4)', async () => {
    const built = await aPlan()
      .withPhase(strength({ weeks: 52, cycle: 2 }))
      .withWorkouts('Full body A', 'Full body B')
      .withSchedule(FULL_BODY_AB)
      .build(db);
    expect(await insertDeload(db, { planId: built.planId, afterWeek: 6 }, ctx)).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });
});
