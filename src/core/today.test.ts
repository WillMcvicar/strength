// Today's content (DESIGN §3.3, §7.2; FR-7.2, FR-7.4, FR-7.5, FR-7.8; C-9).
import {
  estimatedDurationMin,
  oneRmForCycle,
  todayCard,
  weekDays,
  workoutRows,
  type RowSkill,
  type WorkoutRowsInput,
} from './today';
import { NEW_PROGRESSION } from './doubleProgression';
import type { CycleExercise, CycleSet, DoubleProgressionState, PlannedWorkout } from './types';

describe('oneRmForCycle (§3.3, C-9)', () => {
  const row = (oneRmKg: number, effectiveFromWeekIndex: number | null, setAt: string) => ({
    oneRmKg,
    effectiveFromWeekIndex,
    setAt,
  });

  it('uses the starting 1RM when no history row applies yet', () => {
    expect(oneRmForCycle([], 100, 1)).toBe(100);
    expect(oneRmForCycle([row(110, 5, '2026-10-01T10:00:00Z')], 100, 3)).toBe(100);
  });

  it('takes the row with the highest effective week that has started', () => {
    const rows = [
      row(100, 1, '2026-09-14T08:00:00Z'),
      row(105, 3, '2026-09-27T10:00:00Z'),
      row(110, 5, '2026-10-11T10:00:00Z'),
    ];
    expect(oneRmForCycle(rows, 95, 3)).toBe(105);
    expect(oneRmForCycle(rows, 95, 4)).toBe(105);
    expect(oneRmForCycle(rows, 95, 5)).toBe(110);
  });

  it('breaks a tie on effective week by the latest set_at', () => {
    const rows = [
      row(105, 3, '2026-09-27T10:00:00Z'),
      row(107.5, 3, '2026-09-28T07:00:00Z'),
      row(102.5, 3, '2026-09-26T09:00:00Z'),
    ];
    expect(oneRmForCycle(rows, 100, 3)).toBe(107.5);
  });

  it('ignores rows with no effective week', () => {
    expect(oneRmForCycle([row(120, null, '2026-09-20T10:00:00Z')], 100, 3)).toBe(100);
  });

  it('is null when there is no starting 1RM and no applicable row', () => {
    expect(oneRmForCycle([], null, 1)).toBeNull();
  });
});

describe('estimatedDurationMin (§7.2)', () => {
  it('counts 40 s per set plus rest after every set except each exercise’s last', () => {
    // 5 × 40 + 4 × 180 = 920 s, and 3 × 40 + 2 × 90 = 300 s: 1220 s ≈ 20.3 min → 20.
    expect(
      estimatedDurationMin([
        { sets: 5, restSec: 180 },
        { sets: 3, restSec: 90 },
      ]),
    ).toBe(20);
  });

  it('rounds to the nearest 5 minutes', () => {
    // 3 × 40 + 2 × 120 = 360 s = 6 min → 5; 4 × 40 + 3 × 120 = 520 s ≈ 8.7 min → 10.
    expect(estimatedDurationMin([{ sets: 3, restSec: 120 }])).toBe(5);
    expect(estimatedDurationMin([{ sets: 4, restSec: 120 }])).toBe(10);
  });

  it('is 0 for a workout with no sets', () => {
    expect(estimatedDurationMin([])).toBe(0);
    expect(estimatedDurationMin([{ sets: 0, restSec: 120 }])).toBe(0);
  });
});

describe('todayCard (§7.2)', () => {
  const pw = (id: string, scheduledDate: string, over: Partial<PlannedWorkout> = {}) =>
    ({
      id,
      planId: 'plan',
      phaseId: 'block1',
      cycleGroupId: 'block1',
      cycleWorkoutId: 'full_body_a',
      cycleSlotId: 'slot',
      phaseCycleIndex: 1,
      weekIndex: 1,
      scheduledDate,
      status: 'upcoming',
      sessionId: null,
      skippedAt: null,
      ...over,
    }) satisfies PlannedWorkout;

  const TODAY = '2026-09-16'; // a Wednesday
  const week = [
    pw('mon', '2026-09-14', { status: 'completed' }),
    pw('wed', '2026-09-16'),
    pw('fri', '2026-09-18'),
  ];

  it('shows the no-plan empty state without an active plan (FR-7.8)', () => {
    expect(
      todayCard({ hasPlan: false, workouts: [], today: TODAY, inProgressWorkoutId: null }),
    ).toEqual({ kind: 'no_plan' });
  });

  it("shows today's workout (FR-7.2)", () => {
    expect(
      todayCard({ hasPlan: true, workouts: week, today: TODAY, inProgressWorkoutId: null }),
    ).toEqual({ kind: 'workout', workout: week[1] });
  });

  it('puts a session in progress first, even from another day (FR-9.10)', () => {
    expect(
      todayCard({ hasPlan: true, workouts: week, today: TODAY, inProgressWorkoutId: 'mon' }),
    ).toEqual({ kind: 'in_progress', workout: week[0] });
  });

  it("shows today's workout as completed once it is done (FR-7.5)", () => {
    const done = [week[0]!, pw('wed', TODAY, { status: 'completed' }), week[2]!];
    expect(
      todayCard({ hasPlan: true, workouts: done, today: TODAY, inProgressWorkoutId: null }),
    ).toEqual({ kind: 'completed', workout: done[1] });
  });

  it('prefers an open workout today over one already completed (D-4 moves)', () => {
    const two = [pw('a', TODAY, { status: 'completed' }), pw('b', TODAY)];
    expect(
      todayCard({ hasPlan: true, workouts: two, today: TODAY, inProgressWorkoutId: null }),
    ).toEqual({ kind: 'workout', workout: two[1] });
  });

  it('shows a rest day with the next workout and its date (FR-7.4)', () => {
    expect(
      todayCard({ hasPlan: true, workouts: week, today: '2026-09-15', inProgressWorkoutId: null }),
    ).toEqual({ kind: 'rest', next: week[1] });
  });

  it('treats a workout skipped today as a rest day', () => {
    const skipped = [pw('wed', TODAY, { status: 'skipped' }), week[2]!];
    expect(
      todayCard({ hasPlan: true, workouts: skipped, today: TODAY, inProgressWorkoutId: null }),
    ).toEqual({ kind: 'rest', next: week[2] });
  });

  it('has no next workout on a rest day after the last one', () => {
    expect(
      todayCard({ hasPlan: true, workouts: week, today: '2026-09-20', inProgressWorkoutId: null }),
    ).toEqual({ kind: 'rest', next: null });
  });
});

describe('workoutRows (FR-7.2, §3.3)', () => {
  const exercise = (id: string, skillId: string, over: Partial<CycleExercise> = {}) =>
    ({
      id,
      cycleWorkoutId: 'full_body_a',
      skillId,
      sortOrder: 1,
      supersetGroup: null,
      restSec: null,
      notes: null,
      sourceCycleExerciseId: null,
      ...over,
    }) satisfies CycleExercise;
  const set = (setIndex: number, over: Partial<CycleSet> = {}) =>
    ({
      id: `set${setIndex}`,
      cycleExerciseId: 'x',
      setIndex,
      isWarmup: false,
      repsMin: 5,
      repsMax: null,
      isAmrap: false,
      targetRpeMin: null,
      targetRpeMax: null,
      loadType: 'percent_tm',
      loadPercent: 0.8,
      fixedLoadKg: null,
      targetTimeSec: null,
      ...over,
    }) satisfies CycleSet;
  const skill = (name: string, over: Partial<RowSkill> = {}): RowSkill => ({
    name,
    trackingType: 'weight_reps',
    loadConvention: 'total',
    loadIncrementKg: null,
    loadIncrementLb: null,
    ...over,
  });

  const base = (over: Partial<WorkoutRowsInput> = {}): WorkoutRowsInput => ({
    exercises: [
      { exercise: exercise('squat_x', 'squat'), sets: [1, 2, 3, 4, 5].map((i) => set(i)) },
    ],
    skills: new Map([['squat', skill('Back squat')]]),
    planSkills: new Map([['squat', { tmPercent: null, startingOneRmKg: 100 }]]),
    oneRmRows: new Map(),
    defaultTmPercent: 0.9,
    firstWeekOfCycle: 1,
    phase: { type: 'training' },
    unit: 'kg',
    increments: { weightIncrementKg: 2.5, weightIncrementLb: 5 },
    defaultRestSec: 120,
    ...over,
  });

  it('shows 5 × 5 at 80% of a 90 kg TM, rounded to 72.5 kg (FR-3.2, FR-3.6)', () => {
    // TM = 100 × 0.9 = 90; 90 × 0.8 = 72 → nearest 2.5 kg = 72.5.
    expect(workoutRows(base())).toEqual([
      {
        exerciseId: 'squat_x',
        name: 'Back squat',
        sets: 5,
        target: { reps: [5] },
        load: { kg: 72.5, perSide: false, added: false },
        rpe: null,
        topSet: false,
        increased: false,
        restSec: 120,
        inSuperset: false,
      },
    ]);
  });

  it('rounds in the display unit: 72 kg shows as 160 lb', () => {
    // 72 kg = 158.73 lb → nearest 5 lb = 160 lb, stored as 72.57 kg.
    const [row] = workoutRows(base({ unit: 'lb' }));
    expect(row?.load?.kg).toBeCloseTo(160 * 0.45359237, 6);
  });

  it('uses the plan skill TM % and the cycle’s 1RM (C-9)', () => {
    // 1RM 110 from week 3; TM 110 × 0.85 = 93.5; 93.5 × 0.8 = 74.8 → 75.
    const [row] = workoutRows(
      base({
        planSkills: new Map([['squat', { tmPercent: 0.85, startingOneRmKg: 100 }]]),
        oneRmRows: new Map([
          ['squat', [{ oneRmKg: 110, effectiveFromWeekIndex: 3, setAt: '2026-09-27T10:00:00Z' }]],
        ]),
        firstWeekOfCycle: 3,
      }),
    );
    expect(row?.load?.kg).toBe(75);
  });

  it('applies the deload load factor (D-9)', () => {
    // 72 × 0.85 = 61.2 → 60.
    const [row] = workoutRows(base({ phase: { type: 'deload', loadFactor: 0.85 } }));
    expect(row?.load?.kg).toBe(60);
  });

  it('counts working sets only, leaving warm-ups out', () => {
    const [row] = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('squat_x', 'squat'),
            sets: [set(1, { isWarmup: true, loadPercent: 0.4 }), set(2), set(3), set(4)],
          },
        ],
      }),
    );
    expect(row?.sets).toBe(3);
    expect(row?.load?.kg).toBe(72.5);
  });

  it('shows a rep range and the exercise’s own rest', () => {
    const [row] = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('row_x', 'row', { restSec: 90 }),
            sets: [1, 2, 3].map((i) =>
              set(i, {
                repsMin: 8,
                repsMax: 12,
                loadType: 'fixed',
                loadPercent: null,
                fixedLoadKg: 60,
              }),
            ),
          },
        ],
        skills: new Map([['row', skill('Barbell row')]]),
        planSkills: new Map(),
      }),
    );
    expect(row).toMatchObject({
      sets: 3,
      target: { reps: [8, 12] },
      load: { kg: 60 },
      restSec: 90,
    });
  });

  it('has no load, rather than "bodyweight", when there is no 1RM to base it on', () => {
    const [row] = workoutRows(base({ planSkills: new Map() }));
    expect(row?.load).toBeNull();
  });

  describe('double progression (§3.12)', () => {
    const dpSet = set(1, {
      repsMin: 8,
      repsMax: 12,
      loadType: 'double_progression',
      loadPercent: null,
    });
    const rowOf = (over: Partial<WorkoutRowsInput> = {}, ex = exercise('row_x', 'row')) =>
      workoutRows(
        base({
          exercises: [{ exercise: ex, sets: [dpSet] }],
          skills: new Map([['row', skill('Barbell row')]]),
          ...over,
        }),
      )[0];

    it('has no load when the skill has no history yet', () => {
      expect(rowOf()?.load).toBeNull();
    });

    const track = (over: Partial<DoubleProgressionState> = {}) => ({
      ...NEW_PROGRESSION,
      workingLoadKg: 60,
      ...over,
    });
    const waiting = track({
      workingLoadKg: 62.5,
      previousWorkingLoadKg: 60,
      lastIncreaseSessionId: 's1',
    });

    it("shows the working load from the workout's own track", () => {
      const dpStates = new Map([['row_x', track({ workingLoadKg: 62.5 })]]);
      expect(rowOf({ dpStates })).toMatchObject({ load: { kg: 62.5 }, increased: false });
    });

    it('marks a load that went up, as "60 kg ↑" in §7.2', () => {
      const dpStates = new Map([['row_x', waiting]]);
      expect(rowOf({ dpStates })).toMatchObject({ load: { kg: 62.5 }, increased: true });
    });

    it("falls back to the skill's last logged load", () => {
      expect(rowOf({ lastLoads: new Map([['row', 60]]) })?.load?.kg).toBe(60);
    });

    it("reads a deload copy's source track and applies the load factor (D-9)", () => {
      const copy = exercise('row_deload', 'row', { sourceCycleExerciseId: 'row_x' });
      const dpStates = new Map([['row_x', { ...waiting, workingLoadKg: 60 }]]);
      const deload = { type: 'deload' as const, loadFactor: 0.9 };
      // Paused, so no "↑" even while the source's increase waits.
      expect(rowOf({ dpStates, phase: deload }, copy)).toMatchObject({
        load: { kg: 55 },
        increased: false,
      });
    });
  });

  it('keeps a bodyweight set on an added-load skill as bodyweight', () => {
    const [row] = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('dip_x', 'dip'),
            sets: [set(1, { repsMin: 10, loadType: 'bodyweight', loadPercent: null })],
          },
        ],
        skills: new Map([['dip', skill('Dip', { trackingType: 'bodyweight_plus_load' })]]),
      }),
    );
    expect(row?.load).toEqual({ kg: null, perSide: false, added: true });
  });

  it('has no target for a set with neither reps nor time (completion only)', () => {
    const [row] = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('bike_x', 'bike'),
            sets: [set(1, { repsMin: null, loadType: 'bodyweight', loadPercent: null })],
          },
        ],
        skills: new Map([['bike', skill('Bike', { trackingType: 'completion_only' })]]),
      }),
    );
    expect(row).toMatchObject({ name: 'Bike', sets: 1, target: null, load: null });
  });

  it('shows a timed hold with no load', () => {
    const [row] = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('plank_x', 'plank'),
            sets: [1, 2, 3].map((i) =>
              set(i, {
                repsMin: null,
                loadType: 'bodyweight',
                loadPercent: null,
                targetTimeSec: 45,
              }),
            ),
          },
        ],
        skills: new Map([['plank', skill('Plank', { trackingType: 'time' })]]),
      }),
    );
    expect(row).toMatchObject({ name: 'Plank', sets: 3, target: { seconds: 45 }, load: null });
  });

  it('marks per-side, added-load and superset exercises', () => {
    const rows = workoutRows(
      base({
        exercises: [
          {
            exercise: exercise('lunge_x', 'lunge', { supersetGroup: 'a' }),
            sets: [set(1, { loadType: 'fixed', loadPercent: null, fixedLoadKg: 20 })],
          },
          {
            exercise: exercise('dip_x', 'dip', { supersetGroup: 'a' }),
            sets: [set(1, { loadType: 'fixed', loadPercent: null, fixedLoadKg: 10 })],
          },
        ],
        skills: new Map([
          ['lunge', skill('Dumbbell lunge', { loadConvention: 'per_side' })],
          ['dip', skill('Weighted dip', { trackingType: 'bodyweight_plus_load' })],
        ]),
      }),
    );
    expect(rows.map((r) => [r.load, r.inSuperset])).toEqual([
      [{ kg: 20, perSide: true, added: false }, true],
      [{ kg: 10, perSide: false, added: true }, true],
    ]);
  });

  it('uses the skill’s own increment (FR-1.6)', () => {
    // 72 → nearest 5 kg = 70.
    const [row] = workoutRows(
      base({ skills: new Map([['squat', skill('Back squat', { loadIncrementKg: 5 })]]) }),
    );
    expect(row?.load?.kg).toBe(70);
  });

  it('shows an exercise with no working sets as none, and a missing skill as unknown', () => {
    const rows = workoutRows(
      base({
        exercises: [{ exercise: exercise('x', 'gone'), sets: [set(1, { isWarmup: true })] }],
        skills: new Map(),
      }),
    );
    expect(rows[0]).toMatchObject({ name: 'Unknown exercise', sets: 0, target: null });
  });
});

describe('weekDays (FR-8.1, §7.2 week strip)', () => {
  const plan = { status: 'active' as const, pausedOn: null, endedOn: null };
  const pw = (id: string, scheduledDate: string, status: PlannedWorkout['status'] = 'upcoming') =>
    ({
      id,
      planId: 'plan',
      phaseId: 'p',
      cycleGroupId: 'p',
      cycleWorkoutId: 'w',
      cycleSlotId: 's',
      phaseCycleIndex: 1,
      weekIndex: 1,
      scheduledDate,
      status,
      sessionId: null,
      skippedAt: null,
    }) satisfies PlannedWorkout;
  const workouts = [
    pw('mon', '2026-09-14', 'completed'),
    pw('wed', '2026-09-16'),
    pw('fri', '2026-09-18'),
  ];

  it('gives the §7.2 week: ✓ · ● · ○ · · from a Monday week start', () => {
    expect(weekDays(workouts, '2026-09-16', 1, plan, null)).toEqual([
      { date: '2026-09-14', status: 'completed' },
      { date: '2026-09-15', status: 'rest' },
      { date: '2026-09-16', status: 'today' },
      { date: '2026-09-17', status: 'rest' },
      { date: '2026-09-18', status: 'upcoming' },
      { date: '2026-09-19', status: 'rest' },
      { date: '2026-09-20', status: 'rest' },
    ]);
  });

  it('starts on Sunday when the week start is Sunday (FR-8.1)', () => {
    const days = weekDays(workouts, '2026-09-16', 0, plan, null);
    expect(days[0]).toEqual({ date: '2026-09-13', status: 'rest' });
    expect(days[6]).toEqual({ date: '2026-09-19', status: 'rest' });
  });

  it('shows a past open workout as missed and a session under way as in progress', () => {
    const days = weekDays(
      [pw('mon', '2026-09-14'), pw('wed', '2026-09-16')],
      '2026-09-16',
      1,
      plan,
      'wed',
    );
    expect(days[0]?.status).toBe('missed');
    expect(days[2]?.status).toBe('in_progress');
  });
});

describe('AC-71 Today RPE targets', () => {
  const exercise = {
    id: 'squat_x',
    cycleWorkoutId: 'w',
    skillId: 'squat',
    sortOrder: 1,
    supersetGroup: null,
    restSec: null,
    notes: null,
    sourceCycleExerciseId: null,
  } satisfies CycleExercise;
  const set = (setIndex: number, over: Partial<CycleSet> = {}) =>
    ({
      id: `s${setIndex}`,
      cycleExerciseId: 'squat_x',
      setIndex,
      isWarmup: false,
      repsMin: 5,
      repsMax: 5,
      isAmrap: false,
      targetRpeMin: 7,
      targetRpeMax: 8,
      loadType: 'percent_tm',
      loadPercent: 0.8,
      fixedLoadKg: null,
      targetTimeSec: null,
      ...over,
    }) satisfies CycleSet;
  const rows = (sets: CycleSet[]) =>
    workoutRows({
      exercises: [{ exercise, sets }],
      skills: new Map([
        [
          'squat',
          {
            name: 'Back squat',
            trackingType: 'weight_reps',
            loadConvention: 'total',
            loadIncrementKg: null,
            loadIncrementLb: null,
          },
        ],
      ]),
      planSkills: new Map([['squat', { tmPercent: null, startingOneRmKg: 100 }]]),
      oneRmRows: new Map(),
      defaultTmPercent: 0.9,
      firstWeekOfCycle: 1,
      phase: { type: 'training' },
      unit: 'kg',
      increments: { weightIncrementKg: 2.5, weightIncrementLb: 5 },
      defaultRestSec: 120,
    });

  it('carries the 5 × 5 squat’s RPE 7–8 target', () => {
    expect(rows([1, 2, 3, 4, 5].map((i) => set(i)))[0]).toMatchObject({
      sets: 5,
      target: { reps: [5] },
      rpe: { min: 7, max: 8 },
      topSet: false,
    });
  });

  it('marks a 1–3 @ RPE 8 top set', () => {
    const [row] = rows([
      set(1, {
        loadType: 'top_set',
        loadPercent: 0.975,
        repsMin: 1,
        repsMax: 3,
        targetRpeMin: 8,
        targetRpeMax: 8,
      }),
    ]);
    expect(row).toMatchObject({ target: { reps: [1, 3] }, rpe: { min: 8, max: 8 }, topSet: true });
  });

  it('has no RPE when the set sets no target', () => {
    const [row] = rows([set(1, { targetRpeMin: null, targetRpeMax: null })]);
    expect(row?.rpe).toBeNull();
  });

  it('uses a lone bound as both ends', () => {
    expect(rows([set(1, { targetRpeMin: null, targetRpeMax: 9 })])[0]?.rpe).toEqual({
      min: 9,
      max: 9,
    });
    expect(rows([set(1, { targetRpeMin: 7, targetRpeMax: null })])[0]?.rpe).toEqual({
      min: 7,
      max: 7,
    });
  });
});
