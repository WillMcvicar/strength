// DESIGN §3.3 — training max and prescribed loads (FR-3.2, FR-3.5, FR-3.12).
import { roundLoadKg } from './rounding';
import type { LoadContext, PrescribedSet } from './types';

/** The SRS default when a plan or skill sets no override (FR-3.2). */
export const DEFAULT_TM_PERCENT = 0.9;

/** TM = 1RM × TM%. Never rounded; the display layer shows it to 2 dp (FR-3.2). */
export function tmKg(oneRmKg: number, tmPercent: number = DEFAULT_TM_PERCENT): number {
  if (!(tmPercent > 0 && tmPercent <= 1)) {
    throw new Error(`TM percent must be greater than 0 and at most 1, got ${tmPercent}`);
  }
  return oneRmKg * tmPercent;
}

/**
 * The load prescribed for a set, or null when there is nothing to prescribe (bodyweight, or a
 * double-progression set with no history yet). Loads are calculated, never stored, until a
 * session snapshots them (FR-3.12).
 */
export function prescribedLoadKg(set: PrescribedSet, ctx: LoadContext): number | null {
  let raw: number | null = null;

  switch (set.loadType) {
    case 'percent_tm':
    case 'top_set':
      // A top set is a pre-fill only; the lifter adjusts it on the day.
      if (set.loadPercent == null) {
        throw new Error(`load_percent is required for ${set.loadType} sets`);
      }
      raw = ctx.tmKg * set.loadPercent;
      break;
    case 'double_progression':
      raw = ctx.dpState?.workingLoadKg ?? ctx.lastLoadKg ?? null;
      break;
    case 'fixed':
      if (set.fixedLoadKg == null) throw new Error('fixed_load_kg is required for fixed sets');
      raw = set.fixedLoadKg;
      break;
    case 'bodyweight':
      return null;
  }

  if (raw == null) return null;
  // Deloads contain no top sets, so the factor never applies to one (D-9).
  if (ctx.phase.type === 'deload' && ctx.phase.loadFactor != null) raw *= ctx.phase.loadFactor;
  return roundLoadKg(raw, ctx.unit, ctx.increment);
}
