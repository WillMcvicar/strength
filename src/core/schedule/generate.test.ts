// DESIGN §3.6 (FR-2.5, FR-2.11, FR-4.3, D-1, D-14, C-1, C-5).
import type { CycleSlot, Phase } from '../types';
import {
  builderSections,
  generatePlannedWorkouts,
  phaseGroups,
  phaseStartWeeks,
  rootOf,
  totalWeeks,
  weekPosition,
} from './generate';

const phase = (id: string, over: Partial<Phase> = {}): Phase => ({
  id,
  templateId: null,
  planId: 'plan',
  sortOrder: 1,
  name: id,
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
  defaultIncreaseType: 'percent',
  defaultIncreaseValue: 0.025,
  defaultIncreaseValueLb: null,
  fallbackIncreaseType: null,
  fallbackIncreaseValue: null,
  fallbackIncreaseValueLb: null,
  ...over,
});

const deload = (id: string, over: Partial<Phase> = {}): Phase =>
  phase(id, {
    type: 'deload',
    reviewMode: 'none',
    lengthWeeks: 1,
    cycleLengthWeeks: 1,
    volumeFactor: 0.5,
    loadFactor: 0.9,
    rpeCap: 7,
    generatedFromPhaseId: 'block1',
    defaultIncreaseType: 'none',
    ...over,
  });

const slot = (
  id: string,
  phaseId: string,
  cycleWorkoutId: string,
  cycleWeekIndex: number,
  weekday: number,
  over: Partial<CycleSlot> = {},
): CycleSlot => ({
  id,
  phaseId,
  cycleWorkoutId,
  cycleWeekIndex,
  weekday,
  sortOrder: weekday,
  retiredFromGroupWeek: null,
  ...over,
});

// The Beginner Strength shape (FR-2.1): Block 1 (6 wk) → Deload (1 wk) → Block 2 (continuation).
const block1 = phase('block1', { sortOrder: 1 });
const dl = deload('deload', { sortOrder: 2 });
const block2 = phase('block2', {
  sortOrder: 3,
  continuesPhaseId: 'block1',
  continuesOffsetWeeks: 6,
});
const beginner = [block1, dl, block2];

// Week A: Mon A, Wed B, Fri A. Week B: Mon B, Wed A, Fri B.
const trainingSlots = [
  slot('a-mon', 'block1', 'A', 1, 1),
  slot('a-wed', 'block1', 'B', 1, 3),
  slot('a-fri', 'block1', 'A', 1, 5),
  slot('b-mon', 'block1', 'B', 2, 1),
  slot('b-wed', 'block1', 'A', 2, 3),
  slot('b-fri', 'block1', 'B', 2, 5),
];
const deloadSlots = [
  slot('d-mon', 'deload', 'DA', 1, 1),
  slot('d-wed', 'deload', 'DB', 1, 3),
  slot('d-fri', 'deload', 'DA', 1, 5),
];

const counter = () => {
  let n = 0;
  return () => `pw${++n}`;
};

describe('phase groups (D-1, D-14)', () => {
  it('keys a phase by its own id, and a continuation by its original', () => {
    expect(rootOf(block1)).toBe('block1');
    expect(rootOf(block2)).toBe('block1');
  });

  it('groups a phase with its continuations, in order', () => {
    expect(phaseGroups(beginner).map((g) => [g.rootId, g.phases.map((p) => p.id)])).toEqual([
      ['block1', ['block1', 'block2']],
      ['deload', ['deload']],
    ]);
  });

  it('builder: shows the original and its continuation as one phase with the deload inside (FR-2.11)', () => {
    const sections = builderSections(beginner);
    expect(sections).toHaveLength(1);
    expect(sections[0].phase.id).toBe('block1');
    expect(sections[0].parts.map((p) => p.id)).toEqual(['block1', 'deload', 'block2']);
    expect(sections[0].totalWeeks).toBe(13);
  });

  it('builder: phases that are not inside a group stand alone', () => {
    const peak = phase('peak', { sortOrder: 4, lengthWeeks: 3, cycleLengthWeeks: 1 });
    const sections = builderSections([...beginner, peak]);
    expect(sections.map((s) => s.parts.map((p) => p.id))).toEqual([
      ['block1', 'deload', 'block2'],
      ['peak'],
    ]);
    expect(builderSections([dl])[0].parts.map((p) => p.id)).toEqual(['deload']);
  });
});

describe('week indexing (FR-4.3, SRS §4 Indexes)', () => {
  it('sums phase lengths and finds each phase start week', () => {
    expect(totalWeeks(beginner)).toBe(13);
    expect(phaseStartWeeks(beginner)).toEqual(
      new Map([
        ['block1', 1],
        ['deload', 7],
        ['block2', 8],
      ]),
    );
  });

  it.each`
    week  | phaseId     | group       | into  | cycle | cycleWeek
    ${1}  | ${'block1'} | ${'block1'} | ${1}  | ${1}  | ${1}
    ${2}  | ${'block1'} | ${'block1'} | ${2}  | ${1}  | ${2}
    ${6}  | ${'block1'} | ${'block1'} | ${6}  | ${3}  | ${2}
    ${7}  | ${'deload'} | ${'deload'} | ${1}  | ${1}  | ${1}
    ${8}  | ${'block2'} | ${'block1'} | ${7}  | ${4}  | ${1}
    ${13} | ${'block2'} | ${'block1'} | ${12} | ${6}  | ${2}
  `('week $week is $phaseId, cycle $cycle week $cycleWeek', (row) => {
    expect(weekPosition(beginner, row.week)).toEqual({
      weekIndex: row.week,
      phase: beginner.find((p) => p.id === row.phaseId),
      cycleGroupId: row.group,
      weeksIntoGroup: row.into,
      phaseCycleIndex: row.cycle,
      cycleWeekIndex: row.cycleWeek,
      totalWeeks: 13,
    });
  });

  it('FR-2.5: 13 weeks with a 2-week cycle ends on a partial cycle 7, week A', () => {
    const single = [phase('p', { lengthWeeks: 13 })];
    expect(weekPosition(single, 13)).toMatchObject({ phaseCycleIndex: 7, cycleWeekIndex: 1 });
  });

  it('a continuation uses its original cycle length, not its own copy', () => {
    const odd = [
      phase('root', { lengthWeeks: 3, cycleLengthWeeks: 3 }),
      phase('cont', {
        sortOrder: 2,
        lengthWeeks: 3,
        cycleLengthWeeks: 2,
        continuesPhaseId: 'root',
        continuesOffsetWeeks: 3,
      }),
    ];
    expect(weekPosition(odd, 4)).toMatchObject({ phaseCycleIndex: 2, cycleWeekIndex: 1 });
    expect(weekPosition(odd, 6)).toMatchObject({ phaseCycleIndex: 2, cycleWeekIndex: 3 });
  });

  it('rejects a week outside the plan', () => {
    expect(() => weekPosition(beginner, 0)).toThrow(/week/i);
    expect(() => weekPosition(beginner, 14)).toThrow(/week/i);
    expect(() => weekPosition(beginner, 1.5)).toThrow(/week/i);
  });

  it('rejects phases that break the cycle-group rules', () => {
    const orphan = phase('x', { continuesPhaseId: 'missing', continuesOffsetWeeks: 6 });
    expect(() => totalWeeks([orphan])).toThrow(/original phase/i);

    const early = [
      phase('cont', { continuesPhaseId: 'root', continuesOffsetWeeks: 6 }),
      phase('root', { sortOrder: 2 }),
    ];
    expect(() => totalWeeks(early)).toThrow(/original phase/i);

    const chained = [
      block1,
      phase('c1', { sortOrder: 2, continuesPhaseId: 'block1', continuesOffsetWeeks: 6 }),
      phase('c2', { sortOrder: 3, continuesPhaseId: 'c1', continuesOffsetWeeks: 12 }),
    ];
    expect(() => totalWeeks(chained)).toThrow(/original phase/i);

    const wrongOffset = [block1, dl, { ...block2, continuesOffsetWeeks: 5 }];
    expect(() => totalWeeks(wrongOffset)).toThrow(/offset/i);

    expect(() =>
      totalWeeks([
        phase('long', { lengthWeeks: 52 }),
        phase('more', { sortOrder: 2, lengthWeeks: 1 }),
      ]),
    ).toThrow(/52/);
  });
});

describe('generatePlannedWorkouts (DESIGN §3.6, FR-4.3)', () => {
  const generate = (phases: Phase[], slots: CycleSlot[], startDate = '2026-09-14') =>
    generatePlannedWorkouts(
      { planId: 'plan', startDate, phases, slots: [...slots, ...deloadSlots] },
      counter(),
    );

  it('D-1: numbers Block 2 on from Block 1, keyed by the cycle group', () => {
    const rows = generate(beginner, trainingSlots);
    expect(rows).toHaveLength(39);
    const byWeek = (w: number) => rows.filter((r) => r.weekIndex === w);

    expect(byWeek(1).map((r) => [r.scheduledDate, r.cycleWorkoutId, r.cycleSlotId])).toEqual([
      ['2026-09-14', 'A', 'a-mon'],
      ['2026-09-16', 'B', 'a-wed'],
      ['2026-09-18', 'A', 'a-fri'],
    ]);
    expect(
      byWeek(7).map((r) => [r.scheduledDate, r.phaseId, r.cycleGroupId, r.phaseCycleIndex]),
    ).toEqual([
      ['2026-10-26', 'deload', 'deload', 1],
      ['2026-10-28', 'deload', 'deload', 1],
      ['2026-10-30', 'deload', 'deload', 1],
    ]);
    expect(
      byWeek(8).map((r) => [r.phaseId, r.cycleGroupId, r.phaseCycleIndex, r.cycleSlotId]),
    ).toEqual([
      ['block2', 'block1', 4, 'a-mon'],
      ['block2', 'block1', 4, 'a-wed'],
      ['block2', 'block1', 4, 'a-fri'],
    ]);
    expect(byWeek(13).map((r) => [r.scheduledDate, r.phaseCycleIndex, r.cycleSlotId])).toEqual([
      ['2026-12-07', 6, 'b-mon'],
      ['2026-12-09', 6, 'b-wed'],
      ['2026-12-11', 6, 'b-fri'],
    ]);
    expect(
      rows.every((r) => r.status === 'upcoming' && r.sessionId === null && r.skippedAt === null),
    ).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(39);
  });

  it('places each slot on the first matching weekday of its plan week, whatever the start day', () => {
    // A Thursday start: plan week 1 runs Thu 17 – Wed 23 Sep.
    const rows = generate(
      [phase('p', { lengthWeeks: 1 })],
      [slot('mon', 'p', 'A', 1, 1), slot('thu', 'p', 'B', 1, 4)],
      '2026-09-17',
    );
    expect(rows.map((r) => [r.cycleSlotId, r.scheduledDate])).toEqual([
      ['thu', '2026-09-17'],
      ['mon', '2026-09-21'],
    ]);
  });

  it('orders two slots on the same day by slot order', () => {
    const rows = generate(
      [phase('p', { lengthWeeks: 1 })],
      [
        slot('second', 'p', 'B', 1, 1, { sortOrder: 2 }),
        slot('first', 'p', 'A', 1, 1, { sortOrder: 1 }),
      ],
    );
    expect(rows.map((r) => r.cycleSlotId)).toEqual(['first', 'second']);
  });

  it('C-5: a retired slot is not generated from its group week on', () => {
    const rows = generate(beginner, [
      slot('keep', 'block1', 'A', 1, 1),
      slot('gone', 'block1', 'B', 1, 3, { retiredFromGroupWeek: 7 }),
    ]);
    const gone = rows.filter((r) => r.cycleSlotId === 'gone').map((r) => r.weekIndex);
    // Group weeks 1, 3 and 5 are plan weeks 1, 3 and 5; group week 7 is plan week 8.
    expect(gone).toEqual([1, 3, 5]);
  });

  it.each`
    name                        | start           | week | expected
    ${'year end'}               | ${'2026-12-28'} | ${1} | ${['2026-12-28', '2026-12-30', '2027-01-01']}
    ${'leap day 2028'}          | ${'2028-02-28'} | ${1} | ${['2028-02-28', '2028-03-01', '2028-03-03']}
    ${'non-leap Feb 2027'}      | ${'2027-02-22'} | ${2} | ${['2027-03-01', '2027-03-03', '2027-03-05']}
    ${'NZ DST starts 27 Sep'}   | ${'2026-09-21'} | ${2} | ${['2026-09-28', '2026-09-30', '2026-10-02']}
    ${'NZ DST ends 4 Apr 2027'} | ${'2027-03-29'} | ${2} | ${['2027-04-05', '2027-04-07', '2027-04-09']}
    ${'US DST ends 1 Nov'}      | ${'2026-10-26'} | ${2} | ${['2026-11-02', '2026-11-04', '2026-11-06']}
  `('NFR-12: $name', ({ start, week, expected }) => {
    const rows = generate(
      [phase('p', { lengthWeeks: 2 })],
      trainingSlots.map((s) => ({ ...s, phaseId: 'p' })),
      start,
    );
    expect(rows.filter((r) => r.weekIndex === week).map((r) => r.scheduledDate)).toEqual(expected);
  });

  it('rejects a start date that is not a local date', () => {
    expect(() => generate(beginner, trainingSlots, '2026-02-30')).toThrow(/local date/i);
  });

  it('refuses taper phases until v1.1 (FR-2.14)', () => {
    const taper = phase('taper', {
      type: 'taper',
      lengthWeeks: 1,
      cycleLengthWeeks: 1,
      sortOrder: 2,
    });
    expect(() => generate([block1, taper], trainingSlots)).toThrow(/taper/i);
  });
});
