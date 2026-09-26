// DESIGN §3.12 — double progression (FR-3.15, FR-9.5, D-12, D-13, C-10). State is kept per
// cycle exercise, so every slot of a workout shares one track (D-20). It is only written in
// training phases; a deload reads its source's state and applies the load factor (D-9).
import { roundLoadKg } from './rounding';
import type {
  CycleExercise,
  DoubleProgressionState,
  PhaseType,
  SetLog,
  TrackingType,
  Unit,
} from './types';
import { toKg } from './units';

/** A track that has never been logged: the §3.12 first-session rule applies. */
export const NEW_PROGRESSION: DoubleProgressionState = {
  workingLoadKg: null,
  previousWorkingLoadKg: null,
  lastIncreasedAt: null,
  lastIncreaseSessionId: null,
  lastReps: [],
  consecutiveBelowMin: 0,
};

/** The track an exercise reads: its own, or for a generated deload copy, its source's (§3.12). */
export const progressionKey = (e: Pick<CycleExercise, 'id' | 'sourceCycleExerciseId'>): string =>
  e.sourceCycleExerciseId ?? e.id;

/** A logged set as progression reads it: its result, and the range it was prescribed. */
export type ProgressionSet = Pick<
  SetLog,
  | 'status'
  | 'isWarmup'
  | 'reps'
  | 'loadKg'
  | 'rpe'
  | 'prescribedRepsMin'
  | 'prescribedRepsMax'
  | 'targetRpeMax'
>;

/** One finished session of the exercise. */
export interface LoggedProgression {
  sessionId: string;
  /** When it finished, recorded as the date of an increase. */
  endedAt: string;
  phaseType: PhaseType;
  wasSubstituted: boolean;
  /** In set order. */
  sets: readonly ProgressionSet[];
}

export interface ProgressionRules {
  /** Working sets in the prescription; every one must be completed for an increase. */
  workingSetCount: number;
  /** The skill's increment in the display unit (FR-1.6). */
  increment: number;
  unit: Unit;
}

/** Loads within 10⁻⁶ kg are the same load, so lb conversions don't split a group. */
const sameLoad = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** D-13: the most common load, with ties going to the heavier. */
export function modeLoad(loads: readonly number[]): number | null {
  const counts: { load: number; n: number }[] = [];
  for (const load of loads) {
    const found = counts.find((c) => sameLoad(c.load, load));
    if (found) found.n += 1;
    else counts.push({ load, n: 1 });
  }
  let best: { load: number; n: number } | null = null;
  for (const c of counts) {
    if (!best || c.n > best.n || (c.n === best.n && c.load > best.load)) best = c;
  }
  return best?.load ?? null;
}

/** The top of a set's range; a lone minimum is a fixed target. */
const topOf = (s: ProgressionSet) => s.prescribedRepsMax ?? s.prescribedRepsMin;

const reachedTop = (s: ProgressionSet) => {
  const top = topOf(s);
  return (
    s.status === 'completed' &&
    top !== null &&
    s.reps !== null &&
    s.reps >= top &&
    (s.rpe === null || s.targetRpeMax === null || s.rpe <= s.targetRpeMax)
  );
};

/** Missed the bottom of the range: failed, never done, or short of the minimum. */
const belowMin = (s: ProgressionSet) =>
  s.status !== 'completed' ||
  (s.prescribedRepsMin !== null && (s.reps === null || s.reps < s.prescribedRepsMin));

/**
 * The state after a finished session (§3.12). An increase needs every prescribed working set
 * completed at the top of its range, at or below the target RPE (FR-3.15). Otherwise the load
 * that was mostly lifted carries forward (D-13). Nothing changes outside training phases, for a
 * substituted exercise, or when no working set was completed (C-10).
 */
export function updateProgression(
  state: DoubleProgressionState,
  session: LoggedProgression,
  rules: ProgressionRules,
): DoubleProgressionState {
  if (session.phaseType !== 'training' || session.wasSubstituted) return state;
  const working = session.sets.filter((s) => !s.isWarmup);
  const done = working.filter((s) => s.status === 'completed');
  if (done.length === 0) return state;

  const used =
    modeLoad(done.flatMap((s) => (s.loadKg === null ? [] : [s.loadKg]))) ?? state.workingLoadKg;
  const lastReps = working.map((s) => (s.status === 'completed' ? s.reps : null));
  const allTop = working.length >= rules.workingSetCount && working.every(reachedTop);

  if (allTop && used !== null) {
    return {
      ...state,
      previousWorkingLoadKg: used,
      workingLoadKg: roundLoadKg(
        used + toKg(rules.increment, rules.unit),
        rules.unit,
        rules.increment,
      ),
      lastIncreasedAt: session.endedAt,
      lastIncreaseSessionId: session.sessionId,
      lastReps,
      consecutiveBelowMin: 0,
    };
  }
  return {
    ...state,
    workingLoadKg: used,
    lastReps,
    lastIncreaseSessionId: null,
    consecutiveBelowMin: working.every(belowMin) ? state.consecutiveBelowMin + 1 : 0,
  };
}

/** Rebuilds a track from its finished sessions in order, after one is edited or deleted (C-4). */
export function replayProgression(
  sessions: readonly LoggedProgression[],
  rules: ProgressionRules,
): DoubleProgressionState {
  return sessions.reduce((state, s) => updateProgression(state, s, rules), NEW_PROGRESSION);
}

/** One-tap revert (FR-3.15): back to the load before the increase, as if it hadn't happened. */
export function revertIncrease(state: DoubleProgressionState): DoubleProgressionState {
  if (state.lastIncreaseSessionId === null) return state;
  return {
    ...state,
    workingLoadKg: state.previousWorkingLoadKg,
    lastIncreaseSessionId: null,
  };
}

/** The "↑ +1 kg" badge, in kg, while an increase is waiting to be lifted; otherwise null. */
export function increaseKg(state: DoubleProgressionState): number | null {
  if (
    state.lastIncreaseSessionId === null ||
    state.workingLoadKg === null ||
    state.previousWorkingLoadKg === null
  ) {
    return null;
  }
  return state.workingLoadKg - state.previousWorkingLoadKg;
}

/** "Consider reducing the load": the bottom of the range missed twice in a row (FR-3.15). */
export function showReduceHint(state: DoubleProgressionState): boolean {
  return state.consecutiveBelowMin >= 2;
}

/**
 * D-12 rep pre-fill for the working sets, in order: the bottom of the range after an increase
 * or while paused, otherwise last session's reps for the same set, kept within the range.
 */
export function progressionReps(
  state: DoubleProgressionState,
  sets: readonly { repsMin: number | null; repsMax: number | null }[],
  { paused }: { paused: boolean },
): (number | null)[] {
  const fresh = paused || state.lastIncreaseSessionId !== null;
  return sets.map(({ repsMin, repsMax }, i) => {
    if (repsMin === null) return null;
    const last = fresh ? null : (state.lastReps[i] ?? null);
    if (last === null) return repsMin;
    return Math.min(Math.max(last, repsMin), repsMax ?? repsMin);
  });
}

/** A run of sets at one load: "3×8 @ 60 kg", or "12, 11, 10 @ 15 kg" (FR-9.5). */
export interface LastTimeGroup {
  /** Null for skills without a load. */
  loadKg: number | null;
  /** Reps, or seconds for timed skills. */
  values: number[];
}

const LOADED: ReadonlySet<TrackingType> = new Set(['weight_reps', 'bodyweight_plus_load']);

/** The completed working sets of a past session, grouped for the "Last:" line (FR-9.5). */
export function lastTimeGroups(
  sets: readonly Pick<SetLog, 'status' | 'isWarmup' | 'reps' | 'loadKg' | 'timeSec'>[],
  trackingType: TrackingType,
): LastTimeGroup[] {
  if (trackingType === 'completion_only') return [];
  const loaded = LOADED.has(trackingType);
  const groups: LastTimeGroup[] = [];
  for (const s of sets) {
    if (s.isWarmup || s.status !== 'completed') continue;
    const value = trackingType === 'time' ? s.timeSec : s.reps;
    const loadKg = loaded ? s.loadKg : null;
    if (value === null || (loaded && loadKg === null)) continue;
    const last = groups[groups.length - 1];
    if (
      last &&
      (last.loadKg === loadKg ||
        (last.loadKg !== null && loadKg !== null && sameLoad(last.loadKg, loadKg)))
    ) {
      last.values.push(value);
    } else {
      groups.push({ loadKg, values: [value] });
    }
  }
  return groups;
}
