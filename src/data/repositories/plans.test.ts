// Plans, blueprints and the generated schedule (FR-2.3, FR-4.1, FR-4.2, D-14, D-20).
import type {
  CycleExercise,
  CycleSet,
  CycleSlot,
  CycleWorkout,
  Phase,
  Plan,
  PlannedWorkout,
} from '@/core/types';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';

const NOW = '2026-09-14T08:00:00.000Z';

const plan: Plan = {
  id: 'plan',
  name: 'Beginner Strength',
  description: '',
  sourceTemplateId: null,
  status: 'draft',
  startDate: '2026-09-14',
  defaultTmPercent: 0.9,
  pausedOn: null,
  endedAt: null,
  endedOn: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const block1: Phase = {
  id: 'block1',
  templateId: null,
  planId: 'plan',
  sortOrder: 1,
  name: 'Block 1',
  type: 'training',
  reviewMode: 'every_cycle',
  lengthWeeks: 6,
  cycleLengthWeeks: 2,
  volumeFactor: null,
  loadFactor: null,
  rpeCap: null,
  restDaysAtEnd: null,
  hasTestDay: false,
  generatedFromPhaseId: null,
  continuesPhaseId: null,
  continuesOffsetWeeks: null,
  defaultIncreaseType: 'fixed',
  defaultIncreaseValue: 2.5,
  defaultIncreaseValueLb: 5,
  fallbackIncreaseType: null,
  fallbackIncreaseValue: null,
  fallbackIncreaseValueLb: null,
};

const workout = (id: string, sortOrder: number): CycleWorkout => ({
  id,
  phaseId: 'block1',
  name: `Full body ${id.toUpperCase()}`,
  sortOrder,
  kind: 'normal',
});

const slot = (id: string, cycleWorkoutId: string, week: number, weekday: number): CycleSlot => ({
  id,
  phaseId: 'block1',
  cycleWorkoutId,
  cycleWeekIndex: week,
  weekday,
  sortOrder: weekday,
  retiredFromGroupWeek: null,
  sourceCycleSlotId: null,
});

const exercise = (id: string, cycleWorkoutId: string, sortOrder: number): CycleExercise => ({
  id,
  cycleWorkoutId,
  skillId: 'skill_back_squat',
  sortOrder,
  supersetGroup: null,
  restSec: null,
  notes: null,
  sourceCycleExerciseId: null,
});

const set = (id: string, cycleExerciseId: string, setIndex: number): CycleSet => ({
  id,
  cycleExerciseId,
  setIndex,
  isWarmup: false,
  repsMin: 5,
  repsMax: 5,
  isAmrap: false,
  targetRpeMin: 7,
  targetRpeMax: 8,
  loadType: 'percent_tm',
  loadPercent: 0.75,
  fixedLoadKg: null,
  targetTimeSec: null,
});

const planned = (
  id: string,
  scheduledDate: string,
  weekIndex: number,
  phaseCycleIndex: number,
): PlannedWorkout => ({
  id,
  planId: 'plan',
  phaseId: 'block1',
  cycleGroupId: 'block1',
  cycleWorkoutId: 'a',
  cycleSlotId: 'mon1',
  phaseCycleIndex,
  weekIndex,
  scheduledDate,
  status: 'upcoming',
  sessionId: null,
  skippedAt: null,
});

let db: Db;
let repos: Repositories;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  await repos.plans.insert(plan);
  await repos.blueprints.insertPhase(block1);
  // Inserted out of order, so the reads have to sort.
  await repos.blueprints.insertWorkout(workout('b', 2));
  await repos.blueprints.insertWorkout(workout('a', 1));
  await repos.blueprints.insertSlot(slot('wed2', 'a', 2, 3));
  await repos.blueprints.insertSlot(slot('mon1', 'a', 1, 1));
  await repos.blueprints.insertSlot(slot('wed1', 'b', 1, 3));
  await repos.blueprints.insertExercise(exercise('a2', 'a', 2));
  await repos.blueprints.insertExercise(exercise('a1', 'a', 1));
  await repos.blueprints.insertSet(set('a1s2', 'a1', 2));
  await repos.blueprints.insertSet(set('a1s1', 'a1', 1));
});

afterEach(async () => {
  await db.closeAsync();
});

describe('plan repository', () => {
  it('round-trips a plan and finds the current one (FR-4.1)', async () => {
    expect(await repos.plans.get('plan')).toEqual(plan);
    expect(await repos.plans.current()).toBeNull();

    await repos.plans.update('plan', { status: 'active', updatedAt: '2026-09-15T08:00:00.000Z' });
    expect(await repos.plans.current()).toMatchObject({ id: 'plan', status: 'active' });
    expect(await repos.plans.list()).toHaveLength(1);
  });

  it('keeps per-skill TM and starting 1RM (FR-3.3)', async () => {
    await repos.plans.insertSkill({
      id: 'ps',
      planId: 'plan',
      skillId: 'skill_back_squat',
      tmPercent: null,
      startingOneRmKg: 110,
    });
    await repos.plans.updateSkill('ps', { tmPercent: 0.85 });

    expect(await repos.plans.skills('plan')).toEqual([
      {
        id: 'ps',
        planId: 'plan',
        skillId: 'skill_back_squat',
        tmPercent: 0.85,
        startingOneRmKg: 110,
      },
    ]);
  });
});

describe('blueprint repository (D-20)', () => {
  it('loads a phase with every level in sort order', async () => {
    const blueprint = await repos.blueprints.loadBlueprint('block1');

    expect(blueprint?.phase).toEqual(block1);
    expect(blueprint?.workouts.map((w) => w.workout.id)).toEqual(['a', 'b']);
    expect(blueprint?.workouts[0].exercises.map((e) => e.exercise.id)).toEqual(['a1', 'a2']);
    expect(blueprint?.workouts[0].exercises[0].sets.map((s) => s.id)).toEqual(['a1s1', 'a1s2']);
    expect(blueprint?.workouts[0].exercises[0].sets[0]).toEqual(set('a1s1', 'a1', 1));
    expect(blueprint?.workouts[1].exercises).toEqual([]);
    expect(blueprint?.slots.map((s) => s.id)).toEqual(['mon1', 'wed1', 'wed2']);
  });

  it('returns null for an unknown phase, and an empty tree for a bare one', async () => {
    expect(await repos.blueprints.loadBlueprint('nope')).toBeNull();

    await repos.blueprints.insertPhase({ ...block1, id: 'bare', sortOrder: 2 });
    expect(await repos.blueprints.loadBlueprint('bare')).toMatchObject({
      workouts: [],
      slots: [],
      increaseRules: [],
    });
  });

  it('lists phases in order, and D-1: records a continuation', async () => {
    await repos.blueprints.insertPhase({
      ...block1,
      id: 'deload',
      sortOrder: 2,
      name: 'Deload',
      type: 'deload',
      reviewMode: 'none',
      lengthWeeks: 1,
      cycleLengthWeeks: 1,
      loadFactor: 0.9,
      generatedFromPhaseId: 'block1',
    });
    await repos.blueprints.insertPhase({
      ...block1,
      id: 'block2',
      sortOrder: 3,
      name: 'Block 2',
      continuesPhaseId: 'block1',
      continuesOffsetWeeks: 6,
    });
    await repos.blueprints.updatePhase('block1', { name: 'Block 1 (edited)' });

    expect((await repos.blueprints.phasesOfPlan('plan')).map((p) => p.name)).toEqual([
      'Block 1 (edited)',
      'Deload',
      'Block 2',
    ]);
    expect(await repos.blueprints.phase('block2')).toMatchObject({
      continuesPhaseId: 'block1',
      continuesOffsetWeeks: 6,
    });
    expect(await repos.blueprints.phasesOfTemplate('tpl')).toEqual([]);
  });

  it('FR-4.2: lists every slot of a plan across phases, and pins one to a weekday', async () => {
    await repos.plans.insert({ ...plan, id: 'other' });
    await repos.blueprints.insertPhase({ ...block1, id: 'otherPhase', planId: 'other' });
    await repos.blueprints.insertWorkout({ ...workout('x', 1), phaseId: 'otherPhase' });
    await repos.blueprints.insertSlot({ ...slot('elsewhere', 'x', 1, 1), phaseId: 'otherPhase' });
    await repos.blueprints.insertPhase({ ...block1, id: 'later', sortOrder: 2 });
    await repos.blueprints.insertWorkout({ ...workout('c', 1), phaseId: 'later' });
    await repos.blueprints.insertSlot({ ...slot('later1', 'c', 1, 0), phaseId: 'later' });

    await repos.blueprints.updateSlot('mon1', { weekday: 2 });

    const slots = await repos.blueprints.slotsOfPlan('plan');
    expect(slots.map((s) => s.id)).toEqual(['mon1', 'wed1', 'wed2', 'later1']);
    expect(slots[0]).toEqual({ ...slot('mon1', 'a', 1, 1), weekday: 2 });
  });

  it('keeps a per-skill increase rule (FR-3.5)', async () => {
    await repos.blueprints.insertIncreaseRule({
      id: 'ir',
      phaseId: 'block1',
      skillId: 'skill_back_squat',
      increaseType: 'fixed',
      increaseValue: 5,
      increaseValueLb: 10,
      fallbackType: null,
      fallbackValue: null,
      fallbackValueLb: null,
    });
    expect((await repos.blueprints.loadBlueprint('block1'))?.increaseRules).toHaveLength(1);
  });
});

describe('planned workout repository (FR-4.2)', () => {
  beforeEach(async () => {
    await repos.plannedWorkouts.insertMany([
      planned('w2', '2026-09-21', 2, 1),
      planned('w1', '2026-09-14', 1, 1),
      planned('w3', '2026-09-28', 3, 2),
    ]);
  });

  it('lists a plan in schedule order', async () => {
    expect((await repos.plannedWorkouts.listByPlan('plan')).map((w) => w.id)).toEqual([
      'w1',
      'w2',
      'w3',
    ]);
  });

  it('lists a date range, inclusive at both ends', async () => {
    const found = await repos.plannedWorkouts.listBetween('plan', '2026-09-14', '2026-09-21');
    expect(found.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('D-14: lists one cycle of a cycle group', async () => {
    const found = await repos.plannedWorkouts.listByCycle('plan', 'block1', 1);
    expect(found.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('updates status and date, and reads one back whole', async () => {
    await repos.plannedWorkouts.update('w1', {
      status: 'skipped',
      skippedAt: NOW,
      scheduledDate: '2026-09-15',
    });
    expect(await repos.plannedWorkouts.get('w1')).toEqual({
      ...planned('w1', '2026-09-15', 1, 1),
      status: 'skipped',
      skippedAt: NOW,
    });
    expect(await repos.plannedWorkouts.get('nope')).toBeNull();
  });
});

describe('template repository (FR-2.1)', () => {
  it('reads templates by id and in name order', async () => {
    for (const [id, name] of [
      ['tpl_b', 'Custom B'],
      ['tpl_a', 'Custom A'],
    ]) {
      await db.runAsync(
        `INSERT INTO template (id, name, sessions_per_week, level, is_built_in, created_at)
         VALUES (?, ?, 3, 'beginner', 1, ?)`,
        [id, name, NOW],
      );
    }

    expect(await repos.templates.get('tpl_b')).toEqual({
      id: 'tpl_b',
      name: 'Custom B',
      description: '',
      defaultTmPercent: 0.9,
      sessionsPerWeek: 3,
      level: 'beginner',
      isBuiltIn: true,
      createdAt: NOW,
    });
    expect(await repos.templates.get('nope')).toBeNull();
    // The two seeded built-ins sort first by name (FR-2.1).
    expect((await repos.templates.list()).map((t) => t.id)).toEqual([
      'tpl_beginner_hypertrophy',
      'tpl_beginner_strength',
      'tpl_a',
      'tpl_b',
    ]);
  });
});
