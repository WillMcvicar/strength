// DESIGN §3.13 personal records (FR-10.1, FR-10.2, FR-10.5, C-7, D-10).
import {
  bestsOf,
  currentBests,
  detectPrs,
  firstLogSessions,
  headlinePr,
  prScores,
  replayPrs,
  sessionHighlights,
  type PrSet,
} from './prs';
import type { PersonalRecord } from './types';

let n = 0;
const aSet = (over: Partial<PrSet> = {}): PrSet => {
  n += 1;
  return {
    skillId: 'bench',
    sessionId: 's1',
    setLogId: `set${n}`,
    trackingType: 'weight_reps',
    status: 'completed',
    isWarmup: false,
    reps: 5,
    loadKg: 80,
    timeSec: null,
    rpe: null,
    completedAt: `2026-09-14T17:${String(n % 60).padStart(2, '0')}:00.000Z`,
    ...over,
  };
};

const aRecord = (over: Partial<PersonalRecord> = {}): PersonalRecord => ({
  id: 'pr',
  skillId: 'bench',
  type: 'heaviest',
  value: 80,
  contextWeightKg: null,
  sessionId: 's1',
  setLogId: 'set',
  achievedAt: '2026-09-14T17:00:00.000Z',
  isManual: false,
  note: null,
  ...over,
});

const typesOf = (rows: readonly { type: string }[]) => rows.map((r) => r.type);

describe('prScores (§3.13 table)', () => {
  it('scores weight × reps as heaviest, e1RM and reps at that exact weight', () => {
    const scores = prScores(aSet({ loadKg: 82.5, reps: 5, rpe: 9 }));
    expect(scores).toEqual([
      { type: 'heaviest', value: 82.5, contextWeightKg: null },
      { type: 'e1rm', value: expect.closeTo(99, 6), contextWeightKg: null },
      { type: 'reps_at_weight', value: 5, contextWeightKg: 82.5 },
    ]);
  });

  it('gives no e1RM above 10 reps, but still heaviest and reps at weight', () => {
    expect(typesOf(prScores(aSet({ reps: 12 })))).toEqual(['heaviest', 'reps_at_weight']);
  });

  it('scores reps-only sets as most reps, and timed sets as longest time', () => {
    expect(prScores(aSet({ trackingType: 'reps_only', reps: 15, loadKg: null }))).toEqual([
      { type: 'max_reps', value: 15, contextWeightKg: null },
    ]);
    expect(prScores(aSet({ trackingType: 'time', reps: null, loadKg: null, timeSec: 90 }))).toEqual(
      [{ type: 'longest_time', value: 90, contextWeightKg: null }],
    );
  });

  it('treats a weighted bodyweight set with no load as +0 kg, and keeps assisted loads', () => {
    const plain = aSet({ trackingType: 'bodyweight_plus_load', reps: 8, loadKg: null });
    expect(prScores(plain)).toEqual([
      { type: 'heaviest_added', value: 0, contextWeightKg: null },
      { type: 'reps_at_added', value: 8, contextWeightKg: 0 },
    ]);
    const assisted = aSet({ trackingType: 'bodyweight_plus_load', reps: 5, loadKg: -10 });
    expect(prScores(assisted)[0]).toEqual({
      type: 'heaviest_added',
      value: -10,
      contextWeightKg: null,
    });
  });

  it('scores nothing for completion-only items, warm-ups, failed or unfinished sets', () => {
    expect(prScores(aSet({ trackingType: 'completion_only' }))).toEqual([]);
    expect(prScores(aSet({ isWarmup: true }))).toEqual([]);
    expect(prScores(aSet({ status: 'failed' }))).toEqual([]);
    expect(prScores(aSet({ status: 'pending' }))).toEqual([]);
    expect(prScores(aSet({ completedAt: null }))).toEqual([]);
  });

  it('scores nothing without the values the tracking type needs', () => {
    expect(prScores(aSet({ loadKg: null }))).toEqual([]);
    expect(prScores(aSet({ reps: null }))).toEqual([]);
    expect(prScores(aSet({ reps: 0 }))).toEqual([]);
    expect(prScores(aSet({ trackingType: 'reps_only', reps: null }))).toEqual([]);
    expect(prScores(aSet({ trackingType: 'bodyweight_plus_load', reps: null }))).toEqual([]);
    expect(prScores(aSet({ trackingType: 'time', timeSec: null }))).toEqual([]);
    expect(prScores(aSet({ trackingType: 'time', timeSec: 0 }))).toEqual([]);
  });
});

describe('AC-4 PR detection', () => {
  it('gives 82.5 kg × 5 after a best of 80 kg × 5 a heaviest and an e1RM PR', () => {
    const previous = aSet({ loadKg: 80, reps: 5, sessionId: 's0' });
    const bests = bestsOf(detectPrs(new Map(), [previous]));
    const found = detectPrs(bests, [aSet({ loadKg: 82.5, reps: 5 })]);

    expect(typesOf(found)).toEqual(['heaviest', 'e1rm', 'reps_at_weight']);
    expect(found[0]).toMatchObject({ value: 82.5, sessionId: 's1', isManual: false });
    // 82.5 × (1 + 5/30) = 96.25, above 80 × (1 + 5/30) = 93.33
    expect(found[1]!.value).toBeCloseTo(96.25, 6);
    // The reps-at-weight row is stored but not shown beside the heaviest PR (§3.13).
    expect(typesOf(sessionHighlights(found.map(asRecord), new Set()).prs)).toEqual([
      'heaviest',
      'e1rm',
    ]);
  });
});

describe('AC-54 e1RM PR without RPE', () => {
  it('records an Est. 1RM PR of 106.7 kg for 80 kg × 10 with no RPE (D-10)', () => {
    const [, e1rm] = detectPrs(new Map(), [aSet({ loadKg: 80, reps: 10, rpe: null })]);
    expect(e1rm).toMatchObject({ type: 'e1rm' });
    expect(e1rm!.value).toBeCloseTo(106.6667, 4);
  });
});

describe('AC-40 Weighted pull-up', () => {
  it('records a heaviest added load PR for +20 kg × 5, and no e1RM', () => {
    const found = detectPrs(new Map(), [
      aSet({ trackingType: 'bodyweight_plus_load', loadKg: 20, reps: 5 }),
    ]);
    expect(typesOf(found)).toEqual(['heaviest_added', 'reps_at_added']);
    expect(found[0]!.value).toBe(20);
  });
});

describe('detectPrs (§3.13)', () => {
  it('records only values strictly greater than the best so far', () => {
    const bests = bestsOf(detectPrs(new Map(), [aSet({ loadKg: 80, reps: 5 })]));
    expect(detectPrs(bests, [aSet({ loadKg: 80, reps: 5 })])).toEqual([]);
    expect(typesOf(detectPrs(bests, [aSet({ loadKg: 80, reps: 6 })]))).toEqual([
      'e1rm',
      'reps_at_weight',
    ]);
  });

  it('treats e1RMs equal but for floating-point noise as a tie, not a PR', () => {
    // 87.5 × (1 + 10/30) and 100 × (1 + 5/30) are both 116.67, a hair apart in floating point.
    const bests = bestsOf(detectPrs(new Map(), [aSet({ loadKg: 87.5, reps: 10 })]));
    const found = detectPrs(bests, [aSet({ loadKg: 100, reps: 5 })]);
    expect(typesOf(found)).toEqual(['heaviest', 'reps_at_weight']);
  });

  it('keys reps at weight by the exact weight, so a new weight is its own first record', () => {
    const bests = bestsOf(detectPrs(new Map(), [aSet({ loadKg: 80, reps: 8 })]));
    const found = detectPrs(bests, [aSet({ loadKg: 70, reps: 5 })]);
    expect(found).toEqual([
      expect.objectContaining({ type: 'reps_at_weight', value: 5, contextWeightKg: 70 }),
    ]);
  });

  it('lets later sets in the same session beat earlier ones, as an event log', () => {
    const found = detectPrs(new Map(), [
      aSet({ loadKg: 80, reps: 5 }),
      aSet({ loadKg: 85, reps: 3 }),
    ]);
    expect(found.filter((r) => r.type === 'heaviest').map((r) => r.value)).toEqual([80, 85]);
  });

  it('keeps each skill separate, and does not change the bests it was given', () => {
    const bests = new Map([['bench|heaviest|', 100]]);
    const found = detectPrs(bests, [aSet({ skillId: 'squat', loadKg: 90 })]);
    expect(found[0]).toMatchObject({ skillId: 'squat', type: 'heaviest', value: 90 });
    expect([...bests]).toEqual([['bench|heaviest|', 100]]);
  });

  it('dates each record by its set', () => {
    const set = aSet();
    expect(detectPrs(new Map(), [set])[0]).toMatchObject({
      achievedAt: set.completedAt,
      setLogId: set.setLogId,
      contextWeightKg: null,
      note: null,
    });
  });
});

describe('AC-5 PR recalculation', () => {
  it('replays to the previous best once the PR-setting session is gone', () => {
    const before = aSet({ loadKg: 80, reps: 5, sessionId: 's0' });
    const record = aSet({ loadKg: 82.5, reps: 5, sessionId: 's1' });
    const withIt = currentBests(replayPrs([], [before, record]).map(asRecord));
    expect(withIt.find((r) => r.type === 'heaviest')!.value).toBe(82.5);

    const without = currentBests(replayPrs([], [before]).map(asRecord));
    expect(without.find((r) => r.type === 'heaviest')).toMatchObject({
      value: 80,
      sessionId: 's0',
    });
  });
});

describe('replayPrs (FR-10.5)', () => {
  it('replays manual PRs in time order with the sets, without re-creating them', () => {
    const manual = aRecord({
      id: 'm1',
      value: 100,
      isManual: true,
      sessionId: null,
      setLogId: null,
      achievedAt: '2026-01-01T00:00:00.000Z',
    });
    const found = replayPrs([manual], [aSet({ loadKg: 90, reps: 1 })]);
    expect(found.some((r) => r.type === 'heaviest')).toBe(false);

    // A manual record logged after the set doesn't stop the set being a PR at the time.
    const later = { ...manual, achievedAt: '2027-01-01T00:00:00.000Z' };
    expect(typesOf(replayPrs([later], [aSet({ loadKg: 90, reps: 1 })]))).toContain('heaviest');
  });

  it('takes the higher of several manual PRs, whatever order they were entered in', () => {
    const manual = [
      aRecord({ value: 110, isManual: true, achievedAt: '2026-02-01T00:00:00.000Z' }),
      aRecord({ value: 95, isManual: true, achievedAt: '2026-01-01T00:00:00.000Z' }),
      aRecord({ value: 90, isManual: true, achievedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    const found = replayPrs(manual, [aSet({ loadKg: 105, reps: 1 }), aSet({ status: 'pending' })]);
    expect(typesOf(found)).not.toContain('heaviest');
    expect(bestsOf(manual).get('bench|heaviest|')).toBe(110);
    expect(currentBests(manual)).toEqual([manual[0]]);
  });

  it('skips a set with no completion time, which can set no PR', () => {
    const unfinished = aSet({ completedAt: null });
    expect(replayPrs([aRecord({ isManual: true })], [unfinished])).toEqual([]);
  });

  it('replays from part-way through, starting from the bests before that point', () => {
    // Everything up to the edited session is kept; only the sets from it onward are replayed.
    const kept = new Map([['bench|heaviest|', 90]]);
    const found = replayPrs(
      [],
      [aSet({ loadKg: 85, reps: 1 }), aSet({ loadKg: 95, reps: 1 })],
      kept,
    );
    expect(found.filter((r) => r.type === 'heaviest').map((r) => r.value)).toEqual([95]);
    expect([...kept]).toEqual([['bench|heaviest|', 90]]);
  });

  it('puts a manual PR before a set logged at the same moment', () => {
    const set = aSet({ loadKg: 100, reps: 1 });
    const manual = aRecord({ value: 100, isManual: true, achievedAt: set.completedAt! });
    expect(typesOf(replayPrs([manual], [set]))).not.toContain('heaviest');
  });
});

describe('sessionHighlights (FR-10.2, §7.7, C-7)', () => {
  it('shows the best record per type from the session, not every step up', () => {
    const rows = detectPrs(new Map([['bench|heaviest|', 70]]), [
      aSet({ loadKg: 80, reps: 5 }),
      aSet({ loadKg: 82.5, reps: 5 }),
    ]).map(asRecord);
    const { prs } = sessionHighlights(rows, new Set());
    expect(prs.filter((r) => r.type === 'heaviest').map((r) => r.value)).toEqual([82.5]);
    const reversed = sessionHighlights([...rows].reverse(), new Set()).prs;
    expect(reversed.filter((r) => r.type === 'heaviest').map((r) => r.value)).toEqual([82.5]);
  });

  it('keeps a reps-at-weight record when its set was not also the heaviest', () => {
    const bests = bestsOf(detectPrs(new Map(), [aSet({ loadKg: 100, reps: 1 })]));
    const rows = detectPrs(bests, [aSet({ loadKg: 80, reps: 8 })]).map(asRecord);
    expect(typesOf(sessionHighlights(rows, new Set()).prs)).toEqual(['e1rm', 'reps_at_weight']);
  });

  it('hides reps at an added load beside a heaviest added load from the same set', () => {
    const rows = detectPrs(new Map([['pullup|heaviest_added|', 10]]), [
      aSet({ skillId: 'pullup', trackingType: 'bodyweight_plus_load', loadKg: 20, reps: 5 }),
    ]).map(asRecord);
    expect(typesOf(sessionHighlights(rows, new Set()).prs)).toEqual(['heaviest_added']);
  });

  it('labels a first-ever log as "First log" instead of listing its baseline PRs (C-7)', () => {
    const rows = detectPrs(new Map(), [
      aSet({ skillId: 'squat', loadKg: 100 }),
      aSet({ skillId: 'squat', loadKg: 105 }),
      aSet({ skillId: 'bench', loadKg: 80 }),
    ]).map(asRecord);
    expect(sessionHighlights(rows, new Set(['squat', 'bench']))).toEqual({
      prs: [],
      firstLog: ['squat', 'bench'],
    });
    // Bench has been logged before, so its records are new PRs; squat is still a first log.
    const mixed = sessionHighlights(rows, new Set(['squat']));
    expect(mixed.firstLog).toEqual(['squat']);
    expect(mixed.prs.map((r) => r.skillId)).toEqual(['bench', 'bench']);
  });
});

describe('firstLogSessions (C-7)', () => {
  it("maps each skill to the session of its oldest record, or null when that's manual", () => {
    const rows = [
      aRecord({ skillId: 'squat', sessionId: 's1' }),
      aRecord({ skillId: 'bench', isManual: true, sessionId: null }),
      aRecord({ skillId: 'squat', sessionId: 's2' }),
      aRecord({ skillId: 'bench', sessionId: 's2' }),
    ];
    expect(firstLogSessions(rows)).toEqual(
      new Map([
        ['squat', 's1'],
        ['bench', null],
      ]),
    );
  });
});

describe('currentBests and headlinePr (FR-10.3)', () => {
  const log = detectPrs(new Map(), [
    aSet({ loadKg: 80, reps: 5 }),
    aSet({ loadKg: 70, reps: 10 }),
    aSet({ loadKg: 85, reps: 2 }),
  ]).map(asRecord);

  it('keeps the best of each type and weight', () => {
    const bests = currentBests(log);
    expect(bests.map((r) => [r.type, r.contextWeightKg, r.value])).toEqual([
      ['heaviest', null, 85],
      ['e1rm', null, expect.closeTo(93.3333, 4)],
      ['reps_at_weight', 80, 5],
      ['reps_at_weight', 70, 10],
      ['reps_at_weight', 85, 2],
    ]);
  });

  it('headlines the heaviest weight, else most reps, time or added load', () => {
    expect(headlinePr(currentBests(log))).toMatchObject({ type: 'heaviest', value: 85 });
    const reps = aRecord({ type: 'max_reps', value: 20 });
    expect(headlinePr([reps])).toBe(reps);
    const time = aRecord({ type: 'longest_time', value: 90 });
    expect(headlinePr([time])).toBe(time);
    const added = aRecord({ type: 'heaviest_added', value: 20 });
    expect(headlinePr([aRecord({ type: 'reps_at_added', value: 5 }), added])).toBe(added);
    expect(headlinePr([])).toBeNull();
  });
});

function asRecord(row: Omit<PersonalRecord, 'id'>, i: number): PersonalRecord {
  return { ...row, id: `pr${i}` };
}
