// DESIGN §3.4 — estimated 1RM and which sets may inform a suggestion (FR-3.5, FR-10.1).
import type { LoggedSet } from './types';

/**
 * Epley, extended with reps in reserve: load × (1 + n/30) where n = reps + RIR.
 * A missing RPE means RIR 0, which is the AMRAP rule and D-10 for PRs.
 */
export function e1rm(loadKg: number, reps: number, rpe: number | null): number {
  const rir = rpe != null ? 10 - rpe : 0;
  const n = reps + rir;
  return n <= 1 ? loadKg : loadKg * (1 + n / 30);
}

/**
 * Whether a set may inform a suggested 1RM increase (FR-3.5, D-19). Only heavy top sets and
 * AMRAPs qualify: RIR ratings on moderate sets estimate well below the real max and would
 * block every increase (AC-61).
 */
export function isQualifyingSet(s: LoggedSet): boolean {
  if (s.status !== 'completed' || s.isWarmup) return false;
  if (s.reps == null || s.reps < 1 || s.reps > 5) return false;
  return (s.isTopSet && s.rpe != null && s.rpe >= 7) || s.isAmrap;
}

/** Whether a set may set an estimated-1RM personal record — a wider net than suggestions (D-10). */
export function isPrEligibleE1rm(s: Pick<LoggedSet, 'status' | 'isWarmup' | 'reps'>): boolean {
  return s.status === 'completed' && !s.isWarmup && s.reps != null && s.reps >= 1 && s.reps <= 10;
}
