// DESIGN §3.5 — the setup estimate's validation (FR-3.3a). Pure: the caller passes the load, the
// unit and the increment, and gets back either a rounded estimated 1RM or the reason it can't.
import { e1rm } from './e1rm';
import { roundLoadKg } from './rounding';
import type { Unit } from './types';

export type EstimateRejection =
  'load_invalid' | 'reps_low' | 'reps_high' | 'rpe_low' | 'rpe_invalid';

export interface EstimateSet {
  loadKg: number;
  /** 1–5: the estimate is only accurate from low-rep sets (FR-3.5). */
  reps: number;
  /** 7–10: a set further from failure estimates well below the real max. */
  rpe: number;
  unit: Unit;
  increment: number;
}

export type EstimateResult =
  { ok: true; oneRmKg: number } | { ok: false; reason: EstimateRejection };

/**
 * The estimate a test set gives, rounded in the display unit (FR-3.6). The bounds are the point
 * of the flow: a lifter who can do six reps, or who stops at RPE 6, hasn't tested anything, so
 * the answer is to change the load rather than to record a bad number (DESIGN §3.5).
 */
export function validateEstimateSet(set: EstimateSet): EstimateResult {
  if (!(set.loadKg > 0)) return { ok: false, reason: 'load_invalid' };
  if (!Number.isFinite(set.reps) || set.reps < 1) return { ok: false, reason: 'reps_low' };
  if (set.reps > 5) return { ok: false, reason: 'reps_high' };
  if (!Number.isFinite(set.rpe) || set.rpe < 7) return { ok: false, reason: 'rpe_low' };
  if (set.rpe > 10) return { ok: false, reason: 'rpe_invalid' };
  return {
    ok: true,
    oneRmKg: roundLoadKg(e1rm(set.loadKg, set.reps, set.rpe), set.unit, set.increment),
  };
}
