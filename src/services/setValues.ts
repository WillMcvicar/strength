// The values a set edit logs (FR-9.3): what was given, or what the set already holds.
import type { SetLog, SetValues } from '@/core';

/** Values to log. A value left out keeps what the set holds: its pre-fill, or an earlier edit. */
export interface SetInput {
  setLogId: string;
  reps?: number | null;
  loadKg?: number | null;
  timeSec?: number | null;
  rpe?: number | null;
}

/** The merged values, or null when one isn't a number a set can hold. */
export function mergeSetValues(set: SetLog, input: SetInput): SetValues | null {
  const values: SetValues = {
    reps: input.reps !== undefined ? input.reps : set.reps,
    loadKg: input.loadKg !== undefined ? input.loadKg : set.loadKg,
    timeSec: input.timeSec !== undefined ? input.timeSec : set.timeSec,
    rpe: input.rpe !== undefined ? input.rpe : set.rpe,
  };
  const count = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0);
  const valid =
    count(values.reps) &&
    count(values.timeSec) &&
    (values.loadKg === null || Number.isFinite(values.loadKg));
  return valid ? values : null;
}
