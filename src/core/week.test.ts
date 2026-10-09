import type { CycleSlot, Phase, PlannedWorkout } from './types';
import { calendarWeek, calendarWeekStart, planOverview, slotRanks } from './week';

const plan = { status: 'active' as const, pausedOn: null, endedOn: null };

const pw = (
  id: string,
  scheduledDate: string,
  weekIndex: number,
  over: Partial<PlannedWorkout> = {},
): PlannedWorkout => ({
  id,
  planId: 'plan',
  phaseId: 'p1',
  cycleGroupId: 'p1',
  cycleWorkoutId: 'w',
  cycleSlotId: 's',
  phaseCycleIndex: 1,
  weekIndex,
  scheduledDate,
  status: 'upcoming',
  sessionId: null,
  skippedAt: null,
  ...over,
});

const phase = (id: string, sortOrder: number, lengthWeeks: number, over: Partial<Phase> = {}) =>
  ({
    id,
    templateId: null,
    planId: 'plan',
    sortOrder,
    name: id,
    type: 'training',
    reviewMode: 'every_cycle',
    lengthWeeks,
    cycleLengthWeeks: 1,
    volumeFactor: null,
    loadFactor: null,
    rpeCap: null,
    restDaysAtEnd: null,
    hasTestDay: false,
    generatedFromPhaseId: null,
    continuesPhaseId: null,
    continuesOffsetWeeks: null,
    defaultIncreaseType: 'fixed',
    defaultIncreaseValue: null,
    defaultIncreaseValueLb: null,
    fallbackIncreaseType: null,
    fallbackIncreaseValue: null,
    fallbackIncreaseValueLb: null,
    ...over,
  }) satisfies Phase;

describe('calendarWeekStart (FR-8.1, FR-12.3)', () => {
  it.each([
    ['Wed 16 Sep, Monday start', '2026-09-16', 1, '2026-09-14'],
    ['Mon 14 Sep, Monday start', '2026-09-14', 1, '2026-09-14'],
    ['Sun 20 Sep, Monday start', '2026-09-20', 1, '2026-09-14'],
    ['Wed 16 Sep, Sunday start', '2026-09-16', 0, '2026-09-13'],
    ['Sun 13 Sep, Sunday start', '2026-09-13', 0, '2026-09-13'],
    ['Thu 1 Oct across a month, Monday start', '2026-10-01', 1, '2026-09-28'],
  ] as const)('%s', (_, date, weekStart, start) => {
    expect(calendarWeekStart(date, weekStart)).toBe(start);
  });
});

describe('AC-51 Week view uses calendar weeks', () => {
  // Mon/Wed/Fri from Wednesday 16 September 2026: plan week 1 is Wed 16 – Tue 22, so its Monday
  // workout falls on the 21st, in the second calendar week.
  const workouts = [
    pw('w1-wed', '2026-09-16', 1),
    pw('w1-fri', '2026-09-18', 1),
    pw('w1-mon', '2026-09-21', 1),
    pw('w2-wed', '2026-09-23', 2),
    pw('w2-fri', '2026-09-25', 2),
    pw('w2-mon', '2026-09-28', 2),
  ];
  const week = (date: string) =>
    calendarWeek({
      workouts,
      date,
      weekStart: 1,
      today: '2026-09-16',
      plan,
      inProgressWorkoutId: null,
    });

  it('shows Monday to Sunday with workouts on their scheduled dates', () => {
    const second = week('2026-09-21');
    expect(second.start).toBe('2026-09-21');
    expect(second.end).toBe('2026-09-27');
    expect(second.days.map((d) => [d.date, d.workouts.map((w) => w.workout.id)])).toEqual([
      ['2026-09-21', ['w1-mon']],
      ['2026-09-22', []],
      ['2026-09-23', ['w2-wed']],
      ['2026-09-24', []],
      ['2026-09-25', ['w2-fri']],
      ['2026-09-26', []],
      ['2026-09-27', []],
    ]);
  });

  it('spans plan weeks 1–2 in the second calendar week', () => {
    expect(week('2026-09-21').planWeeks).toEqual({ first: 1, last: 2 });
  });

  it('has only plan week 1 in the first calendar week, which starts before the plan', () => {
    const first = week('2026-09-16');
    expect(first.start).toBe('2026-09-14');
    expect(first.days[0]?.workouts).toEqual([]);
    expect(first.planWeeks).toEqual({ first: 1, last: 1 });
  });
});

describe('calendarWeek (FR-8.1, FR-8.2)', () => {
  const base = {
    weekStart: 1 as const,
    today: '2026-09-16',
    plan,
    inProgressWorkoutId: null,
  };

  it('gives each workout its derived status (§3.7)', () => {
    const { days } = calendarWeek({
      ...base,
      date: '2026-09-16',
      workouts: [
        pw('mon', '2026-09-14', 1, { status: 'completed' }),
        pw('tue', '2026-09-15', 1),
        pw('wed', '2026-09-16', 1),
        pw('thu', '2026-09-17', 1, { status: 'skipped' }),
        pw('fri', '2026-09-18', 1),
      ],
    });
    expect(days.map((d) => d.workouts.map((w) => w.status))).toEqual([
      ['completed'],
      ['missed'],
      ['today'],
      ['skipped'],
      ['upcoming'],
      [],
      [],
    ]);
  });

  it('shows both workouts on a day with two (FR-4.7, D-4), in schedule order', () => {
    const { days } = calendarWeek({
      ...base,
      date: '2026-09-16',
      workouts: [pw('moved', '2026-09-16', 1), pw('own', '2026-09-16', 1)],
    });
    expect(days[2]?.workouts.map((w) => w.workout.id)).toEqual(['moved', 'own']);
  });

  it('marks the workout with a session under way as in progress', () => {
    const { days } = calendarWeek({
      ...base,
      inProgressWorkoutId: 'wed',
      date: '2026-09-16',
      workouts: [pw('wed', '2026-09-16', 1)],
    });
    expect(days[2]?.workouts[0]?.status).toBe('in_progress');
  });

  it('steps to any week, past or future, and has no plan weeks where nothing is scheduled', () => {
    const later = calendarWeek({
      ...base,
      date: '2027-01-06',
      workouts: [pw('wed', '2026-09-16', 1)],
    });
    expect(later.start).toBe('2027-01-04');
    expect(later.end).toBe('2027-01-10');
    expect(later.days.every((d) => d.workouts.length === 0)).toBe(true);
    expect(later.planWeeks).toBeNull();
  });

  it('places a shifted workout on the day it now falls on, keeping its plan week (FR-4.9)', () => {
    const { days, planWeeks } = calendarWeek({
      ...base,
      date: '2026-09-21',
      workouts: [pw('fri-shifted', '2026-09-22', 1), pw('mon', '2026-09-21', 2)],
    });
    expect(days[1]?.workouts.map((w) => w.workout.id)).toEqual(['fri-shifted']);
    expect(planWeeks).toEqual({ first: 1, last: 2 });
  });
});

describe('planOverview (FR-8.4, §7.3)', () => {
  const phases = [
    phase('block1', 0, 2, { name: 'Block 1' }),
    phase('deload', 1, 1, { name: 'Deload', type: 'deload' }),
    phase('block2', 2, 1, { name: 'Block 2' }),
  ];

  it('has a row for every plan week, with its phase and its workouts in order', () => {
    const rows = planOverview({
      phases,
      workouts: [
        pw('a1', '2026-09-14', 1, { status: 'completed' }),
        pw('b1', '2026-09-16', 1),
        pw('a2', '2026-09-21', 2),
        pw('d1', '2026-09-28', 3, { phaseId: 'deload' }),
        pw('a4', '2026-10-05', 4, { phaseId: 'block2' }),
      ],
      today: '2026-09-21',
      plan,
      inProgressWorkoutId: null,
    });
    expect(
      rows.map((r) => ({
        week: r.weekIndex,
        phase: r.phase.name,
        cells: r.cells.map((c) => [c.workout.id, c.status]),
      })),
    ).toEqual([
      {
        week: 1,
        phase: 'Block 1',
        cells: [
          ['a1', 'completed'],
          ['b1', 'missed'],
        ],
      },
      { week: 2, phase: 'Block 1', cells: [['a2', 'today']] },
      { week: 3, phase: 'Deload', cells: [['d1', 'upcoming']] },
      { week: 4, phase: 'Block 2', cells: [['a4', 'upcoming']] },
    ]);
  });

  it('keeps an empty row for a week with no workouts', () => {
    const rows = planOverview({
      phases: [phase('only', 0, 2)],
      workouts: [pw('a1', '2026-09-14', 1)],
      today: '2026-09-14',
      plan,
      inProgressWorkoutId: 'a1',
    });
    expect(rows.map((r) => r.cells.map((c) => c.status))).toEqual([['in_progress'], []]);
  });

  it('keeps each workout in its column when one is moved earlier in its week (D-4)', () => {
    // Slots Mon (A) and Wed (B); week 2's Wednesday workout was moved to its Monday.
    const ranks = new Map([
      ['mon', 0],
      ['wed', 1],
    ]);
    const rows = planOverview({
      phases: [phase('only', 0, 2)],
      workouts: [
        pw('a1', '2026-09-14', 1, { cycleSlotId: 'mon' }),
        pw('b1', '2026-09-16', 1, { cycleSlotId: 'wed' }),
        pw('b2', '2026-09-21', 2, { cycleSlotId: 'wed' }),
        pw('a2', '2026-09-21', 2, { cycleSlotId: 'mon' }),
        pw('test', '2026-09-22', 2, { cycleSlotId: null }),
      ],
      today: '2026-09-14',
      plan,
      inProgressWorkoutId: null,
      slotRanks: ranks,
    });
    expect(rows.map((r) => r.cells.map((c) => c.workout.id))).toEqual([
      ['a1', 'b1'],
      // A Test Day has no slot, so it comes last.
      ['a2', 'b2', 'test'],
    ]);
  });
});

describe('slotRanks (§7.3 overview columns)', () => {
  const slot = (id: string, weekday: number, sortOrder: number, over: Partial<CycleSlot> = {}) =>
    ({
      id,
      phaseId: 'p1',
      cycleWorkoutId: 'w',
      cycleWeekIndex: 1,
      weekday,
      sortOrder,
      retiredFromGroupWeek: null,
      sourceCycleSlotId: null,
      ...over,
    }) satisfies CycleSlot;

  it('orders by the day within a plan week counted from the start day, then sort order', () => {
    // A Wednesday start: Wed, Fri, then Mon.
    const ranks = slotRanks(
      [slot('mon', 1, 1), slot('wed', 3, 2), slot('fri', 5, 3), slot('fri2', 5, 4)],
      '2026-09-16',
    );
    const order = [...ranks.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    expect(order).toEqual(['wed', 'fri', 'fri2', 'mon']);
  });

  it("gives a generated deload slot its source slot's day (D-30)", () => {
    const ranks = slotRanks(
      [
        slot('mon', 1, 1),
        slot('wed', 3, 2),
        slot('d-wed', 0, 1, { phaseId: 'deload', sourceCycleSlotId: 'wed' }),
        slot('d-mon', 0, 2, { phaseId: 'deload', sourceCycleSlotId: 'mon' }),
        slot('orphan', 2, 3, { sourceCycleSlotId: 'gone' }),
      ],
      '2026-09-14',
    );
    expect(ranks.get('d-mon')!).toBeLessThan(ranks.get('d-wed')!);
    // A slot whose source has gone keeps its own day, Tuesday.
    expect(ranks.get('d-mon')!).toBeLessThan(ranks.get('orphan')!);
    expect(ranks.get('orphan')!).toBeLessThan(ranks.get('d-wed')!);
  });
});
