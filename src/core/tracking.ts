// Shared helpers for how skills are tracked (FR-1.2) and for comparing stored numbers (DESIGN
// §3.1, D-42), so the rules that read them can't drift apart.
import type { TrackingType } from './types';

/** Tracking types that log a load: a weight, or added load on bodyweight. */
export const LOADED_TRACKING: ReadonlySet<TrackingType> = new Set([
  'weight_reps',
  'bodyweight_plus_load',
]);

/** Differences below this are floating-point noise, e.g. from kg ↔ lb conversion (D-42). */
export const FLOAT_NOISE = 1e-6;

export const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) < FLOAT_NOISE;
