// DESIGN §3.14 — session tonnage and set counts (FR-1.8, FR-9.8, FR-9.14, FR-9.15, D-11).
import type { LoadConvention, SetStatus, TrackingType } from './types';

/** The skill fields a logged exercise snapshots (FR-1.10), as far as volume needs them. */
export interface VolumeExercise {
  trackingType: TrackingType;
  loadConvention: LoadConvention;
  isUnilateral: boolean;
}

export interface VolumeSet {
  status: SetStatus;
  isWarmup: boolean;
  reps: number | null;
  loadKg: number | null;
}

/** × 2 for per-side or unilateral skills, and still × 2 when both (D-11). */
export function volumeMultiplier(e: Omit<VolumeExercise, 'trackingType'>): number {
  return e.loadConvention === 'per_side' || e.isUnilateral ? 2 : 1;
}

/** Completed working sets count; warm-ups, failed and unfinished sets don't (FR-9.14, FR-9.15). */
export function countsAsSet(s: Pick<VolumeSet, 'status' | 'isWarmup'>): boolean {
  return s.status === 'completed' && !s.isWarmup;
}

/** reps × load × multiplier, for `weight_reps` skills only. Other tracking types add no volume. */
export function setVolumeKg(s: VolumeSet, e: VolumeExercise): number {
  if (e.trackingType !== 'weight_reps' || !countsAsSet(s)) return 0;
  if (s.reps == null || s.loadKg == null) return 0;
  return s.reps * s.loadKg * volumeMultiplier(e);
}

/** The FR-9.8 summary figures for a whole session. */
export function sessionTotals(
  exercises: readonly { exercise: VolumeExercise; sets: readonly VolumeSet[] }[],
): { volumeKg: number; setsCompleted: number } {
  let volumeKg = 0;
  let setsCompleted = 0;
  for (const { exercise, sets } of exercises) {
    for (const s of sets) {
      volumeKg += setVolumeKg(s, exercise);
      if (countsAsSet(s)) setsCompleted += 1;
    }
  }
  return { volumeKg, setsCompleted };
}
