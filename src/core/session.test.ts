// DESIGN §8.2 and §7.6: pre-filling a session's sets and deciding when a set may complete
// (FR-3.12, FR-9.2, FR-9.2a, FR-9.2b, FR-9.3, FR-9.14).
import {
  completionError,
  isValidSetRpe,
  newSet,
  nextSetId,
  restsAfter,
  prefillSets,
  rpePrompt,
  rpeRequired,
  valuesForTracking,
} from './session';
import type { CycleSet, SetLog } from './types';

const set = (over: Partial<CycleSet> = {}): CycleSet => ({
  id: 's',
  cycleExerciseId: 'e',
  setIndex: 1,
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
});

const ctx = {
  tmKg: 112.5 as number | null,
  unit: 'kg' as const,
  increment: 2.5,
  phase: { type: 'training' as const },
};

describe('prefillSets (FR-3.12, FR-9.2)', () => {
  it('snapshots the §7.6 squat: 80% of TM 112.5 kg is 90 kg × 5', () => {
    const [row] = prefillSets([set()], 'weight_reps', ctx);
    expect(row).toEqual({
      setIndex: 1,
      isWarmup: false,
      isAmrap: false,
      isTopSet: false,
      prescribedRepsMin: 5,
      prescribedRepsMax: 5,
      prescribedLoadKg: 90,
      prescribedTimeSec: null,
      targetRpeMin: 7,
      targetRpeMax: 8,
      reps: 5,
      loadKg: 90,
      timeSec: null,
    });
  });

  it('pre-fills a rep range at its bottom, and leaves AMRAP reps empty', () => {
    const [range, amrap] = prefillSets(
      [set({ repsMin: 4, repsMax: 6 }), set({ setIndex: 2, isAmrap: true, repsMax: null })],
      'weight_reps',
      ctx,
    );
    expect(range!.reps).toBe(4);
    expect(amrap!.reps).toBeNull();
    expect(amrap!.isAmrap).toBe(true);
  });

  it('leaves %-based loads empty when there is no 1RM', () => {
    const [row] = prefillSets([set()], 'weight_reps', { ...ctx, tmKg: null });
    expect(row!.loadKg).toBeNull();
    expect(row!.prescribedLoadKg).toBeNull();
  });

  it('still pre-fills fixed loads without a 1RM', () => {
    const [row] = prefillSets(
      [set({ loadType: 'fixed', loadPercent: null, fixedLoadKg: 20 })],
      'weight_reps',
      { ...ctx, tmKg: null },
    );
    expect(row!.loadKg).toBe(20);
  });

  it('uses the last logged load for double progression with no state yet (§3.12)', () => {
    const dp = set({ loadType: 'double_progression', loadPercent: null, repsMin: 8, repsMax: 12 });
    expect(prefillSets([dp], 'weight_reps', { ...ctx, lastLoadKg: 15 })[0]!.loadKg).toBe(15);
    expect(prefillSets([dp], 'weight_reps', ctx)[0]!.loadKg).toBeNull();
  });

  it('applies the deload load factor', () => {
    const [row] = prefillSets([set()], 'weight_reps', {
      ...ctx,
      phase: { type: 'deload', loadFactor: 0.9 },
    });
    // 90 × 0.9 = 81 → 80 on the 2.5 kg grid
    expect(row!.loadKg).toBe(80);
  });

  it('pre-fills time targets, and nothing for completion-only items', () => {
    const plank = set({ repsMin: null, repsMax: null, loadType: 'bodyweight', targetTimeSec: 60 });
    expect(prefillSets([plank], 'time', ctx)[0]).toMatchObject({
      reps: null,
      loadKg: null,
      timeSec: 60,
      prescribedTimeSec: 60,
    });
    const run = set({ repsMin: null, repsMax: null, loadType: 'bodyweight' });
    expect(prefillSets([run], 'completion_only', ctx)[0]).toMatchObject({
      reps: null,
      loadKg: null,
      timeSec: null,
    });
  });

  it('gives no load to skills tracked without one', () => {
    expect(prefillSets([set()], 'reps_only', ctx)[0]!.loadKg).toBeNull();
  });

  it('keeps warm-ups and their order', () => {
    const rows = prefillSets(
      [
        set({ setIndex: 2 }),
        set({ setIndex: 1, isWarmup: true, loadType: 'fixed', fixedLoadKg: 60 }),
      ],
      'weight_reps',
      ctx,
    );
    expect(rows.map((r) => [r.setIndex, r.isWarmup, r.loadKg])).toEqual([
      [1, true, 60],
      [2, false, 90],
    ]);
  });
});

describe('AC-62 Top set in a session', () => {
  it('is marked as a top set and pre-filled at 97.5 kg (TM 99 × 97.5% = 96.5, rounded)', () => {
    const top = set({
      loadType: 'top_set',
      loadPercent: 0.975,
      repsMin: 1,
      repsMax: 3,
      targetRpeMin: 8,
      targetRpeMax: 8,
    });
    const [row] = prefillSets([top], 'weight_reps', { ...ctx, tmKg: 99 });
    expect(row).toMatchObject({ isTopSet: true, prescribedLoadKg: 97.5, loadKg: 97.5, reps: 1 });
  });

  it('completes only after an RPE is chosen, even on a skill that is not a main lift', () => {
    const exercise = { trackingType: 'weight_reps' as const, isMainLift: false };
    const top = { isWarmup: false, isTopSet: true };
    expect(completionError(exercise, top, { reps: 3, loadKg: 100, timeSec: null, rpe: null })).toBe(
      'rpe_required',
    );
    expect(completionError(exercise, top, { reps: 3, loadKg: 100, timeSec: null, rpe: 8 })).toBe(
      null,
    );
  });
});

describe('AC-31 Per-set RPE', () => {
  const values = { reps: 5, loadKg: 90, timeSec: null, rpe: null };
  const working = { isWarmup: false, isTopSet: false };

  it('requires an RPE on main-lift sets', () => {
    const squat = { trackingType: 'weight_reps' as const, isMainLift: true };
    expect(rpeRequired(squat, working)).toBe(true);
    expect(completionError(squat, working, values)).toBe('rpe_required');
    expect(completionError(squat, working, { ...values, rpe: 8 })).toBeNull();
  });

  it('lets accessory sets complete with the RPE left empty', () => {
    const row = { trackingType: 'weight_reps' as const, isMainLift: false };
    expect(rpeRequired(row, working)).toBe(false);
    expect(completionError(row, working, values)).toBeNull();
  });
});

describe('AC-38 Warm-ups and failed sets', () => {
  it('asks no RPE for warm-ups, even on a main lift', () => {
    const squat = { trackingType: 'weight_reps' as const, isMainLift: true };
    const warmup = { isWarmup: true, isTopSet: false };
    expect(rpeRequired(squat, warmup)).toBe(false);
    expect(
      completionError(squat, warmup, { reps: 5, loadKg: 60, timeSec: null, rpe: null }),
    ).toBeNull();
  });
});

describe('AC-37 Cardio completion', () => {
  it('completes a completion-only item with no values at all', () => {
    const run = { trackingType: 'completion_only' as const, isMainLift: false };
    expect(
      completionError(
        run,
        { isWarmup: false, isTopSet: false },
        { reps: null, loadKg: null, timeSec: null, rpe: null },
      ),
    ).toBeNull();
  });
});

describe('completionError (FR-9.3)', () => {
  const working = { isWarmup: false, isTopSet: false };
  const none = { reps: null, loadKg: null, timeSec: null, rpe: null };

  it('needs reps and a load for weight × reps sets', () => {
    const ex = { trackingType: 'weight_reps' as const, isMainLift: false };
    expect(completionError(ex, working, { ...none, loadKg: 90 })).toBe('missing_reps');
    expect(completionError(ex, working, { ...none, reps: 0, loadKg: 90 })).toBe('missing_reps');
    // §3.12: with no load to pre-fill, "done as planned" waits for one.
    expect(completionError(ex, working, { ...none, reps: 5 })).toBe('missing_load');
    expect(completionError(ex, working, { ...none, reps: 5, loadKg: 0 })).toBe('missing_load');
  });

  it('needs reps only for reps-only and weighted bodyweight skills', () => {
    for (const trackingType of ['reps_only', 'bodyweight_plus_load'] as const) {
      const ex = { trackingType, isMainLift: false };
      expect(completionError(ex, working, none)).toBe('missing_reps');
      expect(completionError(ex, working, { ...none, reps: 8 })).toBeNull();
    }
    // Assisted pull-ups log a negative added load (FR-1.2).
    const pullUp = { trackingType: 'bodyweight_plus_load' as const, isMainLift: false };
    expect(completionError(pullUp, working, { ...none, reps: 5, loadKg: -10 })).toBeNull();
  });

  it('needs a time for timed sets', () => {
    const ex = { trackingType: 'time' as const, isMainLift: false };
    expect(completionError(ex, working, none)).toBe('missing_time');
    expect(completionError(ex, working, { ...none, timeSec: 45 })).toBeNull();
  });

  it('rejects an RPE outside 6–10 in half steps', () => {
    const ex = { trackingType: 'reps_only' as const, isMainLift: false };
    expect(completionError(ex, working, { ...none, reps: 8, rpe: 8.3 })).toBe('bad_rpe');
    expect(completionError(ex, working, { ...none, reps: 8, rpe: 5.5 })).toBe('bad_rpe');
  });
});

describe('isValidSetRpe (FR-9.2a)', () => {
  it('accepts 6 to 10 in half steps', () => {
    expect([6, 6.5, 8, 9.5, 10].every(isValidSetRpe)).toBe(true);
    expect([5.5, 10.5, 7.25, Number.NaN].some(isValidSetRpe)).toBe(false);
  });
});

describe('newSet (FR-9.4, FR-9.14)', () => {
  const logged = (over: Partial<SetLog>): SetLog => ({
    id: 'x',
    sessionExerciseId: 'e',
    setIndex: 1,
    isWarmup: false,
    isAmrap: false,
    isTopSet: false,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedLoadKg: 90,
    prescribedTimeSec: null,
    targetRpeMin: 8,
    targetRpeMax: 8,
    reps: 5,
    loadKg: 90,
    timeSec: null,
    rpe: 8,
    status: 'completed',
    completedAt: '2026-09-14T17:30:00.000Z',
    ...over,
  });

  it('adds a working set after the last one, copying its prescription and values', () => {
    const sets = [
      logged({ id: 'w', setIndex: 1, isWarmup: true, loadKg: 60 }),
      logged({ id: 'a', setIndex: 2, reps: 4, loadKg: 92.5 }),
    ];
    expect(newSet(sets, { warmup: false })).toEqual({
      position: 2,
      prefill: {
        setIndex: 3,
        isWarmup: false,
        isAmrap: false,
        isTopSet: false,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        prescribedLoadKg: 90,
        prescribedTimeSec: null,
        targetRpeMin: 8,
        targetRpeMax: 8,
        reps: 4,
        loadKg: 92.5,
        timeSec: null,
      },
    });
  });

  it('never copies a top set: an extra set after one is a back-off set with no prescription', () => {
    const [prefill] = [
      newSet([logged({ isTopSet: true, isAmrap: true })], { warmup: false }).prefill,
    ];
    expect(prefill).toMatchObject({ isTopSet: false, isAmrap: false, prescribedLoadKg: null });
  });

  it('adds a warm-up after the existing warm-ups, with nothing prescribed', () => {
    const sets = [
      logged({ id: 'w', setIndex: 1, isWarmup: true, loadKg: 60 }),
      logged({ id: 'a', setIndex: 2 }),
      logged({ id: 'b', setIndex: 3 }),
    ];
    const { position, prefill } = newSet(sets, { warmup: true });
    expect(position).toBe(1);
    expect(prefill).toMatchObject({
      setIndex: 2,
      isWarmup: true,
      prescribedLoadKg: null,
      prescribedRepsMin: null,
      targetRpeMin: null,
      reps: null,
      loadKg: null,
    });
  });

  it('starts an empty exercise with one blank working set', () => {
    expect(newSet([], { warmup: false })).toEqual({
      position: 0,
      prefill: {
        setIndex: 1,
        isWarmup: false,
        isAmrap: false,
        isTopSet: false,
        prescribedRepsMin: null,
        prescribedRepsMax: null,
        prescribedLoadKg: null,
        prescribedTimeSec: null,
        targetRpeMin: null,
        targetRpeMax: null,
        reps: null,
        loadKg: null,
        timeSec: null,
      },
    });
  });
});

describe('valuesForTracking (FR-9.4 swap)', () => {
  it('keeps only the values the new tracking type records', () => {
    const v = { reps: 5, loadKg: 90, timeSec: 30 };
    expect(valuesForTracking(v, 'weight_reps')).toEqual({ reps: 5, loadKg: 90, timeSec: null });
    expect(valuesForTracking(v, 'bodyweight_plus_load')).toEqual({
      reps: 5,
      loadKg: 90,
      timeSec: null,
    });
    expect(valuesForTracking(v, 'reps_only')).toEqual({ reps: 5, loadKg: null, timeSec: null });
    expect(valuesForTracking(v, 'time')).toEqual({ reps: null, loadKg: null, timeSec: 30 });
    expect(valuesForTracking(v, 'completion_only')).toEqual({
      reps: null,
      loadKg: null,
      timeSec: null,
    });
  });
});

describe('rpePrompt (FR-9.2a, FR-9.14)', () => {
  it('requires one on main lifts and top sets, offers one on accessories, and never asks on warm-ups', () => {
    const main = { isMainLift: true };
    const accessory = { isMainLift: false };
    expect(rpePrompt(main, { isWarmup: false, isTopSet: false })).toBe('required');
    expect(rpePrompt(accessory, { isWarmup: false, isTopSet: true })).toBe('required');
    expect(rpePrompt(accessory, { isWarmup: false, isTopSet: false })).toBe('optional');
    expect(rpePrompt(main, { isWarmup: true, isTopSet: false })).toBe('none');
  });

  it('never asks on sets tracked without effort: timed and completion-only items', () => {
    const plank = { isMainLift: false, trackingType: 'time' as const };
    const run = { isMainLift: false, trackingType: 'completion_only' as const };
    expect(rpePrompt(plank, { isWarmup: false, isTopSet: false })).toBe('none');
    expect(rpePrompt(run, { isWarmup: false, isTopSet: false })).toBe('none');
  });
});

describe('superset order (§7.6)', () => {
  const ex = (id: string, group: string | null, statuses: string[]) => ({
    id,
    supersetGroup: group,
    sets: statuses.map((status, i) => ({
      id: `${id}${i + 1}`,
      status: status as 'pending',
      isWarmup: false,
    })),
  });

  it('works through plain exercises in order', () => {
    const list = [ex('a', null, ['completed', 'pending']), ex('b', null, ['pending'])];
    expect(nextSetId(list)).toBe('a2');
    expect(nextSetId([ex('a', null, ['completed'])])).toBeNull();
  });

  it('alternates between the exercises of a superset, round by round', () => {
    const list = [
      ex('a', 'g', ['completed', 'pending', 'pending']),
      ex('b', 'g', ['completed', 'pending']),
      ex('c', null, ['pending']),
    ];
    expect(nextSetId(list)).toBe('a2');
    list[0]!.sets[1]!.status = 'completed' as 'pending';
    expect(nextSetId(list)).toBe('b2');
    list[1]!.sets[1]!.status = 'completed' as 'pending';
    expect(nextSetId(list)).toBe('a3');
  });

  it('skips failed sets, which are resolved', () => {
    expect(nextSetId([ex('a', null, ['failed', 'pending'])])).toBe('a2');
  });

  it('rests only after the last exercise of a round', () => {
    const list = [
      ex('a', 'g', ['pending', 'pending', 'pending']),
      ex('b', 'g', ['pending', 'pending']),
      ex('c', null, ['pending']),
    ];
    expect(restsAfter(list, 'a1')).toBe(false);
    expect(restsAfter(list, 'b1')).toBe(true);
    // b has no third set, so a3 ends round 3.
    expect(restsAfter(list, 'a3')).toBe(true);
    expect(restsAfter(list, 'c1')).toBe(true);
    expect(restsAfter(list, 'nope')).toBe(true);
  });

  it('does a superset’s warm-ups first, so its working rounds stay paired (D-41)', () => {
    const a = ex('a', 'g', ['pending', 'pending', 'pending']);
    a.sets[0]!.isWarmup = true;
    const list = [a, ex('b', 'g', ['pending', 'pending'])];
    // A's warm-up, then A1 B1, A2 B2 — not [A warm-up, B1].
    expect(nextSetId(list)).toBe('a1');
    list[0]!.sets[0]!.status = 'completed' as 'pending';
    expect(nextSetId(list)).toBe('a2');
    expect(restsAfter(list, 'a1')).toBe(true);
    expect(restsAfter(list, 'a2')).toBe(false);
    expect(restsAfter(list, 'b1')).toBe(true);
    expect(restsAfter(list, 'a3')).toBe(false);
    expect(restsAfter(list, 'b2')).toBe(true);
  });
});
