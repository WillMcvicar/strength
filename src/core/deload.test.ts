// DESIGN §3.9 (FR-2.12, FR-2.11, D-1, D-9, D-19, C-1).
import {
  DELOAD_DEFAULTS,
  generateDeload,
  planDraftDeloadInsert,
  type DeloadSource,
} from './deload';
import { prescribedLoadKg } from './loads';
import type { CycleExercise, CycleSet, CycleSlot, CycleWorkout, Phase } from './types';

const counter = (prefix = 'new') => {
  let n = 0;
  return () => `${prefix}${++n}`;
};

const workout = (id: string, sortOrder: number): CycleWorkout => ({
  id,
  phaseId: 'block1',
  name: `Full body ${id}`,
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
});

const exercise = (
  id: string,
  cycleWorkoutId: string,
  skillId: string,
  sortOrder = 1,
): CycleExercise => ({
  id,
  cycleWorkoutId,
  skillId,
  sortOrder,
  supersetGroup: null,
  restSec: 180,
  notes: null,
  sourceCycleExerciseId: null,
});

const set = (
  id: string,
  cycleExerciseId: string,
  setIndex: number,
  over: Partial<CycleSet> = {},
): CycleSet => ({
  id,
  cycleExerciseId,
  setIndex,
  isWarmup: false,
  repsMin: 8,
  repsMax: 8,
  isAmrap: false,
  targetRpeMin: 8,
  targetRpeMax: 8,
  loadType: 'percent_tm',
  loadPercent: 0.7,
  fixedLoadKg: null,
  targetTimeSec: null,
  ...over,
});

const factors = { volumeFactor: 0.5, rpeCap: 7 };

describe('generateDeload (FR-2.12)', () => {
  // Week A: Mon A, Wed B, Fri A. Week B (not copied): Mon B, Wed A, Fri B.
  const source: DeloadSource = {
    workouts: [workout('A', 1), workout('B', 2)],
    slots: [
      slot('a-mon', 'A', 1, 1),
      slot('a-wed', 'B', 1, 3),
      slot('a-fri', 'A', 1, 5),
      slot('b-mon', 'B', 2, 1),
      slot('b-wed', 'A', 2, 3),
      slot('b-fri', 'B', 2, 5),
    ],
    exercises: [
      exercise('squat', 'A', 'skill_back_squat'),
      exercise('bench', 'B', 'skill_bench_press'),
      exercise('curl', 'B', 'skill_dumbbell_curl', 2),
    ],
    sets: [
      set('sq-w', 'squat', 1, {
        isWarmup: true,
        targetRpeMin: null,
        targetRpeMax: null,
        loadPercent: 0.5,
      }),
      set('sq1', 'squat', 2),
      set('sq2', 'squat', 3),
      set('sq3', 'squat', 4),
      set('sq4', 'squat', 5),
      set('bp-top', 'bench', 1, {
        loadType: 'top_set',
        loadPercent: 0.975,
        repsMin: 1,
        repsMax: 3,
      }),
      ...[2, 3, 4, 5].map((i) =>
        set(`bp${i}`, 'bench', i, { loadPercent: 0.8, repsMin: 4, repsMax: 6 }),
      ),
      set('curl1', 'curl', 1, {
        loadType: 'double_progression',
        loadPercent: null,
        targetRpeMin: null,
        targetRpeMax: null,
      }),
      set('curl2', 'curl', 2, {
        loadType: 'double_progression',
        loadPercent: null,
        targetRpeMin: 6.5,
        targetRpeMax: 9,
      }),
    ],
  };
  const out = generateDeload(source, 'deload', factors, counter());
  const setsOf = (sourceExerciseId: string) => {
    const copy = out.exercises.find((e) => e.sourceCycleExerciseId === sourceExerciseId)!;
    return out.sets.filter((s) => s.cycleExerciseId === copy.id);
  };

  it('copies each distinct workout of cycle week 1 once, with slots on the same weekdays', () => {
    expect(out.workouts.map((w) => [w.name, w.phaseId, w.sortOrder, w.kind])).toEqual([
      ['Full body A', 'deload', 1, 'normal'],
      ['Full body B', 'deload', 2, 'normal'],
    ]);
    const nameOf = (id: string) => out.workouts.find((w) => w.id === id)!.name;
    expect(
      out.slots.map((s) => [s.weekday, nameOf(s.cycleWorkoutId), s.cycleWeekIndex, s.phaseId]),
    ).toEqual([
      [1, 'Full body A', 1, 'deload'],
      [3, 'Full body B', 1, 'deload'],
      [5, 'Full body A', 1, 'deload'],
    ]);
    expect(out.slots.every((s) => s.retiredFromGroupWeek === null)).toBe(true);
  });

  it('links each copied exercise to its source, so double-progression state can be read', () => {
    expect(out.exercises.map((e) => [e.skillId, e.sourceCycleExerciseId, e.restSec])).toEqual([
      ['skill_back_squat', 'squat', 180],
      ['skill_bench_press', 'bench', 180],
      ['skill_dumbbell_curl', 'curl', 180],
    ]);
    const ids = new Set(
      [...out.workouts, ...out.slots, ...out.exercises, ...out.sets].map((r) => r.id),
    );
    expect(ids.size).toBe(2 + 3 + 3 + 3 + 3 + 1);
  });

  it('AC-30 figures: 4 × 8 @ 70% TM, RPE 8 → 2 × 8 @ 62.5 kg with an RPE cap of 7', () => {
    const squat = setsOf('squat');
    expect(squat.map((s) => [s.setIndex, s.isWarmup, s.targetRpeMin, s.targetRpeMax])).toEqual([
      [1, true, null, null],
      [2, false, 7, 7],
      [3, false, 7, 7],
    ]);
    const load = prescribedLoadKg(squat[1], {
      tmKg: 100,
      unit: 'kg',
      increment: 2.5,
      phase: { type: 'deload', loadFactor: DELOAD_DEFAULTS.loadFactor },
    });
    expect(load).toBe(62.5);
  });

  it('AC-63 figures: a top set becomes a normal set at 97.5% → 87.5 kg, kept first (D-19)', () => {
    const bench = setsOf('bench');
    // 5 working sets × 0.5 → 3: the top set plus two back-off sets.
    expect(bench.map((s) => [s.setIndex, s.loadType, s.loadPercent, s.targetRpeMax])).toEqual([
      [1, 'percent_tm', 0.975, 7],
      [2, 'percent_tm', 0.8, 7],
      [3, 'percent_tm', 0.8, 7],
    ]);
    const load = prescribedLoadKg(bench[0], {
      tmKg: 100,
      unit: 'kg',
      increment: 2.5,
      phase: { type: 'deload', loadFactor: 0.9 },
    });
    expect(load).toBe(87.5);
  });

  it('keeps at least one set, and caps an RPE with no target at the cap (D-9)', () => {
    // 2 sets × 0.5 → 1. A missing target becomes the cap; a lower minimum is kept.
    expect(setsOf('curl').map((s) => [s.loadType, s.targetRpeMin, s.targetRpeMax])).toEqual([
      ['double_progression', null, 7],
    ]);
    const low = generateDeload(
      { ...source, sets: [set('one', 'squat', 1, { targetRpeMin: 6.5, targetRpeMax: 7.5 })] },
      'deload',
      { volumeFactor: 0.1, rpeCap: 7 },
      counter(),
    );
    expect(low.sets.map((s) => [s.targetRpeMin, s.targetRpeMax])).toEqual([[6.5, 7]]);
  });

  it('moves a top set that is not first to the front of what is kept', () => {
    const late = generateDeload(
      {
        ...source,
        sets: [
          set('s1', 'squat', 1),
          set('s2', 'squat', 2),
          set('top', 'squat', 3, { loadType: 'top_set', loadPercent: 0.95, repsMax: 3 }),
        ],
      },
      'deload',
      { volumeFactor: 0.34, rpeCap: 7 },
      counter(),
    );
    // 3 × 0.34 → 2: the top set and the first back-off set, still in their original order.
    expect(late.sets.map((s) => [s.setIndex, s.loadPercent])).toEqual([
      [1, 0.7],
      [2, 0.95],
    ]);
  });

  it('copies nothing from retired slots, and an exercise with only warm-ups keeps them', () => {
    const out2 = generateDeload(
      {
        ...source,
        slots: [slot('a-mon', 'A', 1, 1), { ...slot('a-wed', 'B', 1, 3), retiredFromGroupWeek: 3 }],
        sets: [set('w', 'squat', 1, { isWarmup: true })],
      },
      'deload',
      factors,
      counter(),
    );
    expect(out2.workouts.map((w) => w.name)).toEqual(['Full body A']);
    expect(out2.sets.map((s) => [s.isWarmup, s.targetRpeMax])).toEqual([[true, 8]]);
  });
});

describe('planDraftDeloadInsert (FR-2.12, FR-2.11, D-1, C-1)', () => {
  const phase = (id: string, over: Partial<Phase> = {}): Phase => ({
    id,
    templateId: null,
    planId: 'plan',
    sortOrder: 1,
    name: 'Block 1',
    type: 'training',
    reviewMode: 'every_cycle',
    lengthWeeks: 12,
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
    ...over,
  });
  const block1 = phase('block1');

  it('D-1: splits a 12-week phase after week 6 into Block 1, a deload and a continuation', () => {
    const result = planDraftDeloadInsert([block1], 6, 1, counter());
    if (!result.ok) throw new Error(result.reason);

    expect(result.sourcePhaseId).toBe('block1');
    expect(result.deload).toEqual({
      ...block1,
      id: 'new1',
      sortOrder: 2,
      name: 'Deload',
      type: 'deload',
      reviewMode: 'none',
      lengthWeeks: 1,
      cycleLengthWeeks: 1,
      volumeFactor: 0.5,
      loadFactor: 0.9,
      rpeCap: 7,
      generatedFromPhaseId: 'block1',
      defaultIncreaseType: 'none',
      defaultIncreaseValue: null,
      defaultIncreaseValueLb: null,
    });
    expect(result.continuation).toEqual({
      ...block1,
      id: 'new2',
      sortOrder: 3,
      lengthWeeks: 6,
      continuesPhaseId: 'block1',
      continuesOffsetWeeks: 6,
    });
    expect(result.updates).toEqual([{ id: 'block1', patch: { lengthWeeks: 6 } }]);
    expect(result.phases.map((p) => [p.id, p.sortOrder, p.lengthWeeks])).toEqual([
      ['block1', 1, 6],
      ['new1', 2, 1],
      ['new2', 3, 6],
    ]);
  });

  it('continues the cycle in progress when the split is mid-cycle (FR-4.6a)', () => {
    const result = planDraftDeloadInsert([block1], 5, 2, counter());
    if (!result.ok) throw new Error(result.reason);
    expect(result.continuation).toMatchObject({ lengthWeeks: 7, continuesOffsetWeeks: 5 });
    expect(result.deload.lengthWeeks).toBe(2);
  });

  it('splits a continuation again, keyed to the original, and renumbers later phases', () => {
    const first = planDraftDeloadInsert([block1], 6, 1, counter('a'));
    if (!first.ok) throw new Error(first.reason);
    // Plan weeks 8–13 are the continuation; insert after week 10 (its 3rd week).
    const second = planDraftDeloadInsert(first.phases, 10, 1, counter('b'));
    if (!second.ok) throw new Error(second.reason);
    expect(second.sourcePhaseId).toBe('block1');
    expect(second.deload.generatedFromPhaseId).toBe('a2');
    expect(second.continuation).toMatchObject({
      continuesPhaseId: 'block1',
      continuesOffsetWeeks: 9,
      lengthWeeks: 3,
    });
    expect(second.updates).toEqual([{ id: 'a2', patch: { lengthWeeks: 3 } }]);
    expect(second.phases.map((p) => [p.id, p.sortOrder, p.lengthWeeks])).toEqual([
      ['block1', 1, 6],
      ['a1', 2, 1],
      ['a2', 3, 3],
      ['b1', 4, 1],
      ['b2', 5, 3],
    ]);
  });

  it('at a phase boundary, inserts without a split and moves later phases down', () => {
    const phases = [block1, phase('next', { sortOrder: 2, lengthWeeks: 4 })];
    const result = planDraftDeloadInsert(phases, 12, 1, counter());
    if (!result.ok) throw new Error(result.reason);
    expect(result.continuation).toBeNull();
    expect(result.updates).toEqual([{ id: 'next', patch: { sortOrder: 3 } }]);
    expect(result.phases.map((p) => p.id)).toEqual(['block1', 'new1', 'next']);
  });

  it('can insert after the last week', () => {
    const result = planDraftDeloadInsert([block1], 12, 1, counter());
    expect(result.ok && result.phases.map((p) => p.id)).toEqual(['block1', 'new1']);
    expect(result.ok && result.updates).toEqual([]);
  });

  it.each`
    afterWeek | length | phases                                                                                         | reason
    ${6}      | ${0}   | ${[block1]}                                                                                    | ${'length_out_of_range'}
    ${6}      | ${3}   | ${[block1]}                                                                                    | ${'length_out_of_range'}
    ${0}      | ${1}   | ${[block1]}                                                                                    | ${'bad_week'}
    ${13}     | ${1}   | ${[block1]}                                                                                    | ${'bad_week'}
    ${2.5}    | ${1}   | ${[block1]}                                                                                    | ${'bad_week'}
    ${6}      | ${1}   | ${[{ ...block1, lengthWeeks: 52 }]}                                                            | ${'too_long'}
    ${13}     | ${1}   | ${[block1, phase('d', { sortOrder: 2, type: 'deload', lengthWeeks: 1, cycleLengthWeeks: 1 })]} | ${'no_training_phase_before'}
  `(
    'rejects: $reason (after week $afterWeek, $length weeks)',
    ({ afterWeek, length, phases, reason }) => {
      expect(planDraftDeloadInsert(phases, afterWeek, length, counter())).toEqual({
        ok: false,
        reason,
      });
    },
  );
});
