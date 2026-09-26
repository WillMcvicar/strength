// DESIGN §3.12 double progression (FR-3.15, FR-9.5, D-12, D-13, C-10).
import {
  NEW_PROGRESSION,
  increaseKg,
  lastTimeGroups,
  modeLoad,
  progressionKey,
  progressionReps,
  replayProgression,
  revertIncrease,
  showReduceHint,
  updateProgression,
  type LoggedProgression,
  type ProgressionRules,
  type ProgressionSet,
} from './doubleProgression';
import { toKg } from './units';

/** A curl at 3 × 8–12 @ RPE 8–9 (AC-28, AC-29, AC-56). */
const curl: ProgressionRules = { workingSetCount: 3, increment: 1, unit: 'kg' };
const range = { repsMin: 8, repsMax: 12 };

const aSet = (
  reps: number | null,
  loadKg: number | null = 15,
  over: Partial<ProgressionSet> = {},
): ProgressionSet => ({
  status: 'completed',
  isWarmup: false,
  reps,
  loadKg,
  rpe: 8,
  prescribedRepsMin: 8,
  prescribedRepsMax: 12,
  targetRpeMax: 9,
  ...over,
});

const logged = (
  sets: ProgressionSet[],
  over: Partial<LoggedProgression> = {},
): LoggedProgression => ({
  sessionId: 's1',
  endedAt: '2026-09-14T18:00:00.000Z',
  phaseType: 'training',
  wasSubstituted: false,
  sets,
  ...over,
});

const at15 = { ...NEW_PROGRESSION, workingLoadKg: 15 };

describe('AC-28 Double progression increase', () => {
  const after = updateProgression(at15, logged([aSet(12), aSet(12), aSet(12)]), curl);

  it('pre-fills 16 kg × 8 with a "↑ +1 kg" badge after 3 × 12 at 15 kg', () => {
    expect(after.workingLoadKg).toBe(16);
    expect(increaseKg(after)).toBe(1);
    expect(progressionReps(after, [range, range, range], { paused: false })).toEqual([8, 8, 8]);
    expect(after).toMatchObject({
      previousWorkingLoadKg: 15,
      lastIncreasedAt: '2026-09-14T18:00:00.000Z',
      lastIncreaseSessionId: 's1',
      lastReps: [12, 12, 12],
      consecutiveBelowMin: 0,
    });
  });

  it("reverts with one tap to 15 kg and last session's reps, with no badge", () => {
    const reverted = revertIncrease(after);
    expect(reverted.workingLoadKg).toBe(15);
    expect(increaseKg(reverted)).toBeNull();
    expect(progressionReps(reverted, [range, range, range], { paused: false })).toEqual([
      12, 12, 12,
    ]);
  });
});

describe('AC-29 Double progression hold', () => {
  it('keeps 15 kg and pre-fills 12, 11 and 10 reps', () => {
    const after = updateProgression(at15, logged([aSet(12), aSet(11), aSet(10)]), curl);
    expect(after.workingLoadKg).toBe(15);
    expect(increaseKg(after)).toBeNull();
    expect(progressionReps(after, [range, range, range], { paused: false })).toEqual([12, 11, 10]);
  });
});

describe('AC-56 Double progression after an edited session', () => {
  it('carries 16 kg forward from 10 @ 15, 9 @ 16, 9 @ 16, with reps 10, 9, 9 and no badge', () => {
    const after = updateProgression(at15, logged([aSet(10, 15), aSet(9, 16), aSet(9, 16)]), curl);
    expect(after.workingLoadKg).toBe(16);
    expect(increaseKg(after)).toBeNull();
    expect(progressionReps(after, [range, range, range], { paused: false })).toEqual([10, 9, 9]);
  });
});

describe('updateProgression (FR-3.15, §3.12)', () => {
  it('leaves the state alone outside training phases (paused in deloads and tapers)', () => {
    const top = logged([aSet(12), aSet(12), aSet(12)], { phaseType: 'deload' });
    expect(updateProgression(at15, top, curl)).toBe(at15);
    expect(updateProgression(at15, { ...top, phaseType: 'taper' }, curl)).toBe(at15);
  });

  it('leaves the state alone for a substituted exercise (C-10)', () => {
    const top = logged([aSet(12), aSet(12), aSet(12)], { wasSubstituted: true });
    expect(updateProgression(at15, top, curl)).toBe(at15);
  });

  it('leaves the state alone when no working set was completed (C-10)', () => {
    const none = logged([
      aSet(10, 10, { isWarmup: true }),
      aSet(8, 15, { status: 'pending' }),
      aSet(null, 15, { status: 'failed' }),
    ]);
    expect(updateProgression(at15, none, curl)).toBe(at15);
  });

  it('ignores warm-ups entirely (FR-9.14)', () => {
    const after = updateProgression(
      at15,
      logged([aSet(5, 10, { isWarmup: true }), aSet(12), aSet(12), aSet(12)]),
      curl,
    );
    expect(after.workingLoadKg).toBe(16);
    expect(after.lastReps).toEqual([12, 12, 12]);
  });

  it('needs every prescribed working set: a failed, pending or missing set means no increase', () => {
    const failed = logged([aSet(12), aSet(12), aSet(12, 15, { status: 'failed' })]);
    const pending = logged([aSet(12), aSet(12), aSet(12, 15, { status: 'pending' })]);
    const missing = logged([aSet(12), aSet(12)]);
    for (const session of [failed, pending, missing]) {
      expect(increaseKg(updateProgression(at15, session, curl))).toBeNull();
      expect(updateProgression(at15, session, curl).workingLoadKg).toBe(15);
    }
    expect(updateProgression(at15, failed, curl).lastReps).toEqual([12, 12, null]);
  });

  it('counts an extra set only if it reaches the top as well', () => {
    const extra = [aSet(12), aSet(12), aSet(12)];
    expect(increaseKg(updateProgression(at15, logged([...extra, aSet(10)]), curl))).toBeNull();
    expect(increaseKg(updateProgression(at15, logged([...extra, aSet(12)]), curl))).toBe(1);
  });

  it('needs the reps at or below the target RPE, or no RPE logged at all', () => {
    const hard = logged([aSet(12), aSet(12), aSet(12, 15, { rpe: 9.5 })]);
    expect(increaseKg(updateProgression(at15, hard, curl))).toBeNull();
    const atCap = logged([aSet(12), aSet(12), aSet(12, 15, { rpe: 9 })]);
    expect(increaseKg(updateProgression(at15, atCap, curl))).toBe(1);
    const unrated = logged([aSet(12, 15, { rpe: null }), aSet(12), aSet(12)]);
    expect(increaseKg(updateProgression(at15, unrated, curl))).toBe(1);
    const noTarget = logged([aSet(12, 15, { rpe: 10, targetRpeMax: null }), aSet(12), aSet(12)]);
    expect(increaseKg(updateProgression(at15, noTarget, curl))).toBe(1);
  });

  it("reads each set's own range, and a fixed-rep set tops out at its reps", () => {
    const fixed = { prescribedRepsMin: 10, prescribedRepsMax: null };
    const session = logged([aSet(10, 15, fixed), aSet(10, 15, fixed), aSet(10, 15, fixed)]);
    expect(increaseKg(updateProgression(at15, session, curl))).toBe(1);
    const open = { prescribedRepsMin: null, prescribedRepsMax: null };
    const unranged = logged([aSet(20, 15, open), aSet(20, 15, open), aSet(20, 15, open)]);
    expect(increaseKg(updateProgression(at15, unranged, curl))).toBeNull();
  });

  it('rounds the increase in the display unit (FR-3.6)', () => {
    // 15 kg = 33.07 lb, + 5 lb = 38.07 → 40 lb.
    const lb = updateProgression(at15, logged([aSet(12), aSet(12), aSet(12)]), {
      ...curl,
      increment: 5,
      unit: 'lb',
    });
    expect(lb.workingLoadKg).toBeCloseTo(toKg(40, 'lb'), 9);
  });

  it('keeps the working load when no completed set has a load', () => {
    const unloaded = logged([aSet(12, null)]);
    expect(updateProgression(at15, unloaded, curl).workingLoadKg).toBe(15);
  });

  it('clears a waiting increase once the next session is logged', () => {
    const up = updateProgression(at15, logged([aSet(12), aSet(12), aSet(12)]), curl);
    const next = updateProgression(up, logged([aSet(9, 16), aSet(8, 16), aSet(8, 16)]), curl);
    expect(increaseKg(next)).toBeNull();
    expect(next.lastIncreaseSessionId).toBeNull();
    // The date of the last increase stays for reference.
    expect(next.lastIncreasedAt).toBe(up.lastIncreasedAt);
  });
});

describe('Consider reducing the load (FR-3.15)', () => {
  const below = logged([aSet(7), aSet(6), aSet(null, 15, { status: 'failed' })]);

  it('shows after two sessions in a row that miss the bottom of the range on every set', () => {
    const once = updateProgression(at15, below, curl);
    expect(once.consecutiveBelowMin).toBe(1);
    expect(showReduceHint(once)).toBe(false);
    const twice = updateProgression(once, below, curl);
    expect(twice.consecutiveBelowMin).toBe(2);
    expect(showReduceHint(twice)).toBe(true);
    // Never an automatic decrease.
    expect(twice.workingLoadKg).toBe(15);
  });

  it('resets once any set reaches the bottom of the range', () => {
    const twice = updateProgression(updateProgression(at15, below, curl), below, curl);
    const better = updateProgression(twice, logged([aSet(8), aSet(6), aSet(6)]), curl);
    expect(better.consecutiveBelowMin).toBe(0);
    expect(showReduceHint(better)).toBe(false);
  });

  it('counts a set that was never done as missed', () => {
    const skipped = logged([aSet(7), aSet(8, 15, { status: 'pending' })]);
    expect(updateProgression(at15, skipped, curl).consecutiveBelowMin).toBe(1);
  });

  it('is reset by an increase', () => {
    const once = updateProgression(at15, below, curl);
    const up = updateProgression(once, logged([aSet(12), aSet(12), aSet(12)]), curl);
    expect(up.consecutiveBelowMin).toBe(0);
  });
});

describe('modeLoad (D-13)', () => {
  it('is the most common load, with ties going to the heavier', () => {
    expect(modeLoad([15, 16, 16])).toBe(16);
    expect(modeLoad([15, 15, 16])).toBe(15);
    expect(modeLoad([15, 16])).toBe(16);
    expect(modeLoad([16, 15, 15, 16])).toBe(16);
  });

  it('treats floating-point noise as the same load', () => {
    expect(modeLoad([toKg(35, 'lb'), toKg(35, 'lb') + 1e-9, 20])).toBeCloseTo(toKg(35, 'lb'), 9);
  });

  it('is null for no loads', () => {
    expect(modeLoad([])).toBeNull();
  });
});

describe('progressionReps (D-12)', () => {
  it('starts at the bottom of the range with no history', () => {
    expect(progressionReps(NEW_PROGRESSION, [range, range], { paused: false })).toEqual([8, 8]);
  });

  it("keeps last session's reps within the range, and uses the bottom for a set not done", () => {
    const state = { ...at15, lastReps: [14, 6, null] };
    expect(progressionReps(state, [range, range, range, range], { paused: false })).toEqual([
      12, 8, 8, 8,
    ]);
  });

  it('uses the bottom of the range in a deload, where progression is paused', () => {
    const state = { ...at15, lastReps: [12, 11, 10] };
    expect(progressionReps(state, [range, range, range], { paused: true })).toEqual([8, 8, 8]);
  });

  it('leaves reps empty for a set with no range', () => {
    const state = { ...at15, lastReps: [12] };
    expect(progressionReps(state, [{ repsMin: null, repsMax: null }], { paused: false })).toEqual([
      null,
    ]);
  });

  it('treats a lone minimum as a fixed target', () => {
    const state = { ...at15, lastReps: [12] };
    expect(progressionReps(state, [{ repsMin: 10, repsMax: null }], { paused: false })).toEqual([
      10,
    ]);
  });
});

describe('revertIncrease and increaseKg (FR-3.15 one-tap revert)', () => {
  it('does nothing when no increase is waiting', () => {
    expect(revertIncrease(at15)).toBe(at15);
    expect(increaseKg(at15)).toBeNull();
  });

  it('has no badge without a previous load to compare with', () => {
    expect(increaseKg({ ...at15, lastIncreaseSessionId: 's1' })).toBeNull();
  });
});

describe('replayProgression (C-4, edits and deletes)', () => {
  it('folds the sessions in order from a new track', () => {
    const sessions = [
      logged([aSet(12), aSet(12), aSet(12)], { sessionId: 'mon' }),
      logged([aSet(9, 16), aSet(9, 16), aSet(8, 16)], { sessionId: 'fri' }),
    ];
    expect(replayProgression([], curl)).toEqual(NEW_PROGRESSION);
    expect(replayProgression(sessions, curl)).toEqual(
      updateProgression(updateProgression(NEW_PROGRESSION, sessions[0]!, curl), sessions[1]!, curl),
    );
    expect(replayProgression(sessions, curl)).toMatchObject({
      workingLoadKg: 16,
      lastReps: [9, 9, 8],
    });
  });

  it('keeps an increase the lifter reverted reverted (D-44)', () => {
    const monday = logged([aSet(12), aSet(12), aSet(12)], { sessionId: 'mon' });
    const reverted = revertIncrease(updateProgression(NEW_PROGRESSION, monday, curl));
    expect(reverted.revertedIncreaseSessionId).toBe('mon');

    const replayed = replayProgression([monday], curl, reverted.revertedIncreaseSessionId);
    expect(replayed).toEqual(reverted);
    expect(increaseKg(replayed)).toBeNull();
  });

  it('lets a later increase through, and remembers the old revert', () => {
    const sessions = [
      logged([aSet(12), aSet(12), aSet(12)], { sessionId: 'mon' }),
      logged([aSet(12), aSet(12), aSet(12)], { sessionId: 'fri' }),
    ];
    const replayed = replayProgression(sessions, curl, 'mon');
    // Friday was lifted at the reverted 15 kg, and earned its own increase to 16 kg.
    expect(replayed).toMatchObject({
      workingLoadKg: 16,
      lastIncreaseSessionId: 'fri',
      revertedIncreaseSessionId: 'mon',
    });
  });

  it("starts a new track from the first session's load", () => {
    const first = replayProgression([logged([aSet(10, 14), aSet(10, 14), aSet(9, 14)])], curl);
    expect(first).toMatchObject({ workingLoadKg: 14, previousWorkingLoadKg: null });
  });
});

describe('lastTimeGroups (FR-9.5)', () => {
  const logSet = (reps: number | null, loadKg: number | null, over = {}) => ({
    status: 'completed' as const,
    isWarmup: false,
    reps,
    loadKg,
    timeSec: null,
    ...over,
  });

  it('groups consecutive completed working sets by load', () => {
    expect(
      lastTimeGroups(
        [logSet(5, 60, { isWarmup: true }), logSet(8, 60), logSet(8, 60), logSet(8, 60)],
        'weight_reps',
      ),
    ).toEqual([{ loadKg: 60, values: [8, 8, 8] }]);
    expect(lastTimeGroups([logSet(10, 15), logSet(9, 16), logSet(9, 16)], 'weight_reps')).toEqual([
      { loadKg: 15, values: [10] },
      { loadKg: 16, values: [9, 9] },
    ]);
  });

  it('leaves out failed and pending sets', () => {
    expect(
      lastTimeGroups(
        [
          logSet(12, 15),
          logSet(5, 15, { status: 'failed' }),
          logSet(12, 15, { status: 'pending' }),
        ],
        'weight_reps',
      ),
    ).toEqual([{ loadKg: 15, values: [12] }]);
  });

  it('keeps added load for weighted bodyweight skills, and bodyweight alone without it', () => {
    expect(lastTimeGroups([logSet(6, 10), logSet(5, 10)], 'bodyweight_plus_load')).toEqual([
      { loadKg: 10, values: [6, 5] },
    ]);
    expect(lastTimeGroups([logSet(8, null), logSet(8, null)], 'bodyweight_plus_load')).toEqual([
      { loadKg: null, values: [8, 8] },
    ]);
  });

  it('reads reps only, or times, for skills without a load', () => {
    expect(lastTimeGroups([logSet(10, null), logSet(8, null)], 'reps_only')).toEqual([
      { loadKg: null, values: [10, 8] },
    ]);
    expect(
      lastTimeGroups(
        [logSet(null, null, { timeSec: 60 }), logSet(null, null, { timeSec: 45 })],
        'time',
      ),
    ).toEqual([{ loadKg: null, values: [60, 45] }]);
  });

  it('has nothing to show for completion-only items or sets without a value', () => {
    expect(lastTimeGroups([logSet(null, null)], 'completion_only')).toEqual([]);
    expect(lastTimeGroups([logSet(null, 60)], 'weight_reps')).toEqual([]);
  });
});

describe('progressionKey (D-20, §3.12)', () => {
  it("is the exercise's own id, or its source's for a deload copy", () => {
    expect(progressionKey({ id: 'curl_a', sourceCycleExerciseId: null })).toBe('curl_a');
    expect(progressionKey({ id: 'curl_deload', sourceCycleExerciseId: 'curl_a' })).toBe('curl_a');
  });
});
