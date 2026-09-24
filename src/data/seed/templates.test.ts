// The built-in templates (FR-2.1, FR-2.2, FR-2.11, FR-2.12, DESIGN §4.6, D-37).
import { DELOAD_DEFAULTS } from '@/core/deload';
import { totalWeeks } from '@/core/schedule/generate';
import type { Phase } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { runSeed } from '@/data/seed';
import { SEED_TEMPLATES } from '@/data/seed/templates';

import { openMigratedTestDb, SEEDED_AT } from '../../../test/db/betterSqlite3';
import { count } from '../../../test/db/rows';

let db: Db;

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

const phasesOf = (id: string): Promise<Phase[]> => repositories(db).blueprints.phasesOfTemplate(id);

describe('FR-2.2 built-in templates', () => {
  it('seeds Beginner Strength and Beginner Hypertrophy as read-only built-ins', async () => {
    const list = await repositories(db).templates.list();
    expect(list.map((t) => t.name)).toEqual(['Beginner Hypertrophy', 'Beginner Strength']);
    for (const t of list) {
      expect(t).toMatchObject({
        isBuiltIn: true,
        level: 'beginner',
        sessionsPerWeek: 3,
        defaultTmPercent: 0.9,
        createdAt: SEEDED_AT,
      });
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('uses fixed, readable IDs (DESIGN §4.1)', () => {
    expect(SEED_TEMPLATES.map((t) => t.id)).toEqual([
      'tpl_beginner_strength',
      'tpl_beginner_hypertrophy',
    ]);
  });
});

describe('FR-2.1 beginner template structure', () => {
  it.each(SEED_TEMPLATES.map((t) => [t.name, t.id]))(
    '%s is Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk), 13 weeks in all',
    async (_name, id) => {
      const phases = await phasesOf(id);
      expect(phases.map((p) => [p.name, p.type, p.lengthWeeks, p.cycleLengthWeeks])).toEqual([
        ['Block 1', 'training', 6, 2],
        ['Deload', 'deload', 1, 1],
        ['Block 2', 'training', 6, 2],
      ]);
      expect(totalWeeks(phases)).toBe(13);
      expect(phases.every((p) => p.planId === null && p.templateId === id)).toBe(true);
    },
  );

  it.each(SEED_TEMPLATES.map((t) => [t.name, t.id]))(
    '%s: Block 2 continues Block 1, so its cycles are numbered 4–6 (FR-2.11, D-14)',
    async (_name, id) => {
      const [block1, deload, block2] = await phasesOf(id);
      expect(block2).toMatchObject({
        continuesPhaseId: block1!.id,
        continuesOffsetWeeks: 6,
        reviewMode: 'every_cycle',
      });
      // A continuation reads its blueprint from the original phase (DESIGN §4.4).
      expect(await repositories(db).blueprints.loadBlueprint(block2!.id)).toMatchObject({
        workouts: [],
        slots: [],
      });
      expect(deload).toMatchObject({ reviewMode: 'none', generatedFromPhaseId: block1!.id });
    },
  );

  it('Beginner Strength: fixed +2.5 kg upper, +5 kg lower, set per skill (FR-3.5)', async () => {
    const [block1] = await phasesOf('tpl_beginner_strength');
    expect(block1).toMatchObject({
      defaultIncreaseType: 'fixed',
      defaultIncreaseValue: 2.5,
      defaultIncreaseValueLb: 5,
    });
    const { increaseRules } = (await repositories(db).blueprints.loadBlueprint(block1!.id))!;
    expect(
      Object.fromEntries(
        increaseRules.map((r) => [r.skillId, [r.increaseValue, r.increaseValueLb]]),
      ),
    ).toEqual({
      skill_back_squat: [5, 10],
      skill_deadlift: [5, 10],
      skill_bench_press: [2.5, 5],
      skill_overhead_press: [2.5, 5],
    });
    expect(increaseRules.every((r) => r.increaseType === 'fixed')).toBe(true);
  });

  it('Beginner Hypertrophy: +2.5%, since beginners log no qualifying sets (FR-3.5)', async () => {
    const [block1] = await phasesOf('tpl_beginner_hypertrophy');
    expect(block1).toMatchObject({ defaultIncreaseType: 'percent', defaultIncreaseValue: 0.025 });
  });

  it.each(SEED_TEMPLATES.map((t) => [t.name, t.id]))(
    '%s runs full body A/B on Mon/Wed/Fri over a 2-week cycle',
    async (_name, id) => {
      const [block1] = await phasesOf(id);
      const { workouts, slots } = (await repositories(db).blueprints.loadBlueprint(block1!.id))!;
      expect(workouts.map((w) => w.workout.name)).toEqual(['Full body A', 'Full body B']);
      const byId = new Map(workouts.map((w) => [w.workout.id, w.workout.name]));
      expect(slots.map((s) => [s.cycleWeekIndex, s.weekday, byId.get(s.cycleWorkoutId)])).toEqual([
        [1, 1, 'Full body A'],
        [1, 3, 'Full body B'],
        [1, 5, 'Full body A'],
        [2, 1, 'Full body B'],
        [2, 3, 'Full body A'],
        [2, 5, 'Full body B'],
      ]);
    },
  );

  it('main lifts are %-of-TM and accessories use double progression (FR-3.2, FR-3.15)', async () => {
    const [block1] = await phasesOf('tpl_beginner_strength');
    const { workouts } = (await repositories(db).blueprints.loadBlueprint(block1!.id))!;
    const a = workouts[0]!.exercises;
    expect(a.map((e) => [e.exercise.skillId, e.sets.length, e.sets[0]!.loadType])).toEqual([
      ['skill_back_squat', 5, 'percent_tm'],
      ['skill_bench_press', 5, 'percent_tm'],
      ['skill_barbell_row', 3, 'double_progression'],
      ['skill_plank', 3, 'bodyweight'],
    ]);
    // DESIGN §7.6 works this template through at 80% of TM.
    expect(
      a[0]!.sets.every((s) => s.loadPercent === 0.8 && s.repsMin === 5 && s.repsMax === 5),
    ).toBe(true);
    // A double-progression set carries no load: §3.12's first-session rule fills it in.
    expect(a[2]!.sets.every((s) => s.loadPercent === null && s.fixedLoadKg === null)).toBe(true);
  });
});

describe('FR-2.12 the seeded deload', () => {
  it.each(SEED_TEMPLATES.map((t) => [t.name, t.id]))(
    '%s halves the volume of cycle week 1 and caps RPE (D-9)',
    async (_name, id) => {
      const [block1, deload] = await phasesOf(id);
      expect(deload).toMatchObject({
        volumeFactor: DELOAD_DEFAULTS.volumeFactor,
        loadFactor: DELOAD_DEFAULTS.loadFactor,
        rpeCap: DELOAD_DEFAULTS.rpeCap,
      });

      const before = (await repositories(db).blueprints.loadBlueprint(block1!.id))!;
      const after = (await repositories(db).blueprints.loadBlueprint(deload!.id))!;
      expect(after.workouts.map((w) => w.workout.name)).toEqual(
        before.workouts.map((w) => w.workout.name),
      );
      for (const [i, w] of after.workouts.entries()) {
        for (const [j, e] of w.exercises.entries()) {
          const source = before.workouts[i]!.exercises[j]!;
          // ceil(n × 0.5) working sets, and each exercise links back for double progression (D-30).
          expect(e.sets).toHaveLength(Math.ceil(source.sets.length * DELOAD_DEFAULTS.volumeFactor));
          expect(e.exercise.sourceCycleExerciseId).toBe(source.exercise.id);
        }
      }
      expect(after.workouts.flatMap((w) => w.exercises).flatMap((e) => e.sets)).not.toContainEqual(
        expect.objectContaining({ loadType: 'top_set' }),
      );
      const rpes = after.workouts
        .flatMap((w) => w.exercises)
        .flatMap((e) => e.sets)
        .flatMap((s) => [s.targetRpeMin, s.targetRpeMax])
        .filter((r): r is number => r !== null);
      expect(Math.max(...rpes)).toBeLessThanOrEqual(DELOAD_DEFAULTS.rpeCap);
    },
  );

  it.each(SEED_TEMPLATES.map((t) => [t.name, t.id]))(
    '%s: deload slots take their source slot’s weekday (D-30)',
    async (_name, id) => {
      const [block1, deload] = await phasesOf(id);
      const source = (await repositories(db).blueprints.loadBlueprint(block1!.id))!.slots;
      const { slots } = (await repositories(db).blueprints.loadBlueprint(deload!.id))!;
      const week1 = source.filter((s) => s.cycleWeekIndex === 1);
      expect(slots).toHaveLength(week1.length);
      expect(slots.map((s) => s.sourceCycleSlotId)).toEqual(week1.map((s) => s.id));
      expect(slots.map((s) => s.weekday)).toEqual(week1.map((s) => s.weekday));
    },
  );
});

describe('seeding templates is idempotent (DESIGN §4.6)', () => {
  it('re-running the seed at the same version writes nothing new', async () => {
    const before = await count(db, 'cycle_set');
    await runSeed(db, '2027-01-01T00:00:00.000Z');
    expect(await count(db, 'template')).toBe(SEED_TEMPLATES.length);
    expect(await count(db, 'cycle_set')).toBe(before);
  });

  it('re-running it after a seed_version reset re-writes the same rows', async () => {
    const before = {
      templates: await count(db, 'template'),
      phases: await count(db, 'phase'),
      sets: await count(db, 'cycle_set'),
      slots: await count(db, 'cycle_slot'),
    };
    await repositories(db).appMeta.set('seed_version', '0');
    await runSeed(db, '2027-01-01T00:00:00.000Z');

    expect({
      templates: await count(db, 'template'),
      phases: await count(db, 'phase'),
      sets: await count(db, 'cycle_set'),
      slots: await count(db, 'cycle_slot'),
    }).toEqual(before);
  });
});
