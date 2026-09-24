// DESIGN §8.2 and §7.6 — pre-filling a session's sets when it starts, and deciding when a set may
// be marked complete (FR-3.12, FR-9.2, FR-9.2a, FR-9.2b, FR-9.3, FR-9.14).
import { prescribedLoadKg } from './loads';
import type { CycleSet, LoadContext, SetLog, TrackingType } from './types';

/** A `set_log` row as it is written at session start, before any ids or results. */
export type SetPrefill = Omit<
  SetLog,
  'id' | 'sessionExerciseId' | 'rpe' | 'status' | 'completedAt'
>;

/** `LoadContext`, except that the TM is null when the skill has no 1RM yet. */
export type PrefillContext = Omit<LoadContext, 'tmKg'> & { tmKg: number | null };

const LOADED: ReadonlySet<TrackingType> = new Set(['weight_reps', 'bodyweight_plus_load']);
const REPS: ReadonlySet<TrackingType> = new Set([
  'weight_reps',
  'reps_only',
  'bodyweight_plus_load',
]);

/**
 * The sets of one exercise, in set order, with the prescription snapshotted and the values that
 * "done as planned" will log (FR-9.2). Reps start at the bottom of the range (D-39); an AMRAP set's reps
 * stay empty until the lifter enters them (§7.6). A top set's load is its starting-% pre-fill
 * (FR-3.12). %-based loads are empty while the skill has no 1RM.
 */
export function prefillSets(
  sets: readonly CycleSet[],
  trackingType: TrackingType,
  ctx: PrefillContext,
): SetPrefill[] {
  return [...sets]
    .sort((a, b) => a.setIndex - b.setIndex)
    .map((s) => {
      const needsTm = s.loadType === 'percent_tm' || s.loadType === 'top_set';
      const load =
        !LOADED.has(trackingType) || (needsTm && ctx.tmKg === null)
          ? null
          : prescribedLoadKg(s, { ...ctx, tmKg: ctx.tmKg ?? 0 });
      const reps = REPS.has(trackingType);
      const time = trackingType === 'time' ? s.targetTimeSec : null;
      return {
        setIndex: s.setIndex,
        isWarmup: s.isWarmup,
        isAmrap: s.isAmrap,
        isTopSet: s.loadType === 'top_set',
        prescribedRepsMin: reps ? s.repsMin : null,
        prescribedRepsMax: reps ? s.repsMax : null,
        prescribedLoadKg: load,
        prescribedTimeSec: time,
        targetRpeMin: s.targetRpeMin,
        targetRpeMax: s.targetRpeMax,
        reps: reps && !s.isAmrap ? s.repsMin : null,
        loadKg: load,
        timeSec: time,
      };
    });
}

/** FR-9.2a: main lifts and every top set need an RPE; warm-ups never do (FR-9.14). */
export function rpeRequired(
  exercise: { isMainLift: boolean },
  set: { isWarmup: boolean; isTopSet: boolean },
): boolean {
  return !set.isWarmup && (exercise.isMainLift || set.isTopSet);
}

/**
 * Which RPE picker a set gets once it is ticked (FR-9.2a, §7.6): required on main lifts and top
 * sets, optional and dismissible otherwise, and none on warm-ups (FR-9.14) or on timed and
 * completion-only items, which have no reps to rate.
 */
export function rpePrompt(
  exercise: { isMainLift: boolean; trackingType?: TrackingType },
  set: { isWarmup: boolean; isTopSet: boolean },
): 'required' | 'optional' | 'none' {
  if (rpeRequired(exercise, set)) return 'required';
  if (set.isWarmup) return 'none';
  if (exercise.trackingType === 'time' || exercise.trackingType === 'completion_only') {
    return 'none';
  }
  return 'optional';
}

/** 6–10 in half steps (FR-9.2a). */
export function isValidSetRpe(rpe: number): boolean {
  return rpe >= 6 && rpe <= 10 && Number.isInteger(rpe * 2);
}

export type CompletionError =
  'rpe_required' | 'bad_rpe' | 'missing_reps' | 'missing_load' | 'missing_time';

export interface SetValues {
  reps: number | null;
  loadKg: number | null;
  timeSec: number | null;
  rpe: number | null;
}

/**
 * Why a set can't be marked complete with these values, or null when it can. A weight × reps set
 * with no load to pre-fill waits for one (§3.12); a weighted bodyweight skill may log none, or a
 * negative load when assisted. Completion-only items need nothing (FR-9.3).
 */
export function completionError(
  exercise: { trackingType: TrackingType; isMainLift: boolean },
  set: { isWarmup: boolean; isTopSet: boolean },
  values: SetValues,
): CompletionError | null {
  const t = exercise.trackingType;
  if (REPS.has(t) && (values.reps == null || values.reps < 1)) return 'missing_reps';
  if (t === 'weight_reps' && (values.loadKg == null || values.loadKg <= 0)) return 'missing_load';
  if (t === 'time' && (values.timeSec == null || values.timeSec < 1)) return 'missing_time';
  if (values.rpe != null && !isValidSetRpe(values.rpe)) return 'bad_rpe';
  if (values.rpe == null && rpeRequired(exercise, set)) return 'rpe_required';
  return null;
}

const BLANK: Omit<SetPrefill, 'setIndex' | 'isWarmup'> = {
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
};

/**
 * A set added during a session (FR-9.4, FR-9.14), and where it goes among the exercise's sets
 * (a 0-based position; the caller renumbers). A warm-up goes after the existing warm-ups with
 * nothing prescribed. A working set goes last and copies the last working set, so "done as
 * planned" logs what the lifter just did, except that a top set or AMRAP is never copied: the
 * extra set is a plain back-off set with only its values carried over.
 */
export function newSet(
  sets: readonly SetLog[],
  { warmup }: { warmup: boolean },
): { position: number; prefill: SetPrefill } {
  if (warmup) {
    const position = sets.filter((s) => s.isWarmup).length;
    return { position, prefill: { ...BLANK, setIndex: position + 1, isWarmup: true } };
  }
  const last = [...sets].reverse().find((s) => !s.isWarmup);
  const position = sets.length;
  if (!last) return { position, prefill: { ...BLANK, setIndex: position + 1, isWarmup: false } };
  const special = last.isTopSet || last.isAmrap;
  return {
    position,
    prefill: {
      ...(special
        ? BLANK
        : {
            isAmrap: false,
            isTopSet: false,
            prescribedRepsMin: last.prescribedRepsMin,
            prescribedRepsMax: last.prescribedRepsMax,
            prescribedLoadKg: last.prescribedLoadKg,
            prescribedTimeSec: last.prescribedTimeSec,
            targetRpeMin: last.targetRpeMin,
            targetRpeMax: last.targetRpeMax,
          }),
      setIndex: position + 1,
      isWarmup: false,
      reps: last.reps,
      loadKg: last.loadKg,
      timeSec: last.timeSec,
    },
  };
}

/** The values a tracking type records; the rest are cleared, e.g. when a swap changes it. */
export function valuesForTracking(
  v: Pick<SetValues, 'reps' | 'loadKg' | 'timeSec'>,
  trackingType: TrackingType,
): Pick<SetValues, 'reps' | 'loadKg' | 'timeSec'> {
  return {
    reps: REPS.has(trackingType) ? v.reps : null,
    loadKg: LOADED.has(trackingType) ? v.loadKg : null,
    timeSec: trackingType === 'time' ? v.timeSec : null,
  };
}

interface OrderExercise {
  id: string;
  supersetGroup: string | null;
  sets: readonly { id: string; status: SetLog['status']; isWarmup: boolean }[];
}

type Step = { id: string; status: SetLog['status']; endsRound: boolean };

/**
 * Sets in the order they're done (§7.6): plain exercises one after another; the exercises of a
 * superset (neighbours sharing a group) round by round, A1 B1 A2 B2. A superset's warm-ups come
 * first, one exercise at a time, so they never throw the working rounds out of step (D-41).
 * `endsRound` marks the set after which the rest timer starts.
 */
function setOrder(exercises: readonly OrderExercise[]): Step[] {
  const order: Step[] = [];
  for (let i = 0; i < exercises.length;) {
    const group = exercises[i]!.supersetGroup;
    let j = i + 1;
    while (group !== null && j < exercises.length && exercises[j]!.supersetGroup === group) j += 1;
    const members = exercises.slice(i, j);
    for (const m of members) {
      for (const s of m.sets)
        if (s.isWarmup) order.push({ id: s.id, status: s.status, endsRound: true });
    }
    const working = members.map((m) => m.sets.filter((s) => !s.isWarmup));
    const rounds = Math.max(...working.map((sets) => sets.length));
    for (let round = 0; round < rounds; round += 1) {
      const inRound = working.flatMap((sets) => (sets[round] ? [sets[round]] : []));
      inRound.forEach((s, k) =>
        order.push({ id: s.id, status: s.status, endsRound: k === inRound.length - 1 }),
      );
    }
    i = j;
  }
  return order;
}

/** The next set to do: the first one still pending, in the §7.6 order. */
export function nextSetId(exercises: readonly OrderExercise[]): string | null {
  return setOrder(exercises).find((s) => s.status === 'pending')?.id ?? null;
}

/** Whether finishing this set starts the rest timer: in a superset, only the round's last. */
export function restsAfter(exercises: readonly OrderExercise[], setId: string): boolean {
  return setOrder(exercises).find((s) => s.id === setId)?.endsRound ?? true;
}
