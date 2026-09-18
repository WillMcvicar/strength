// DESIGN §3.15 — plan dates (NFR-12).
//
// Every function works on 'YYYY-MM-DD' strings through Date.UTC, so a device's local time zone
// and its daylight-saving changes can never shift a plan date. Nothing here reads the clock;
// `todayLocal()` lives in src/services/clock.ts.
import type { LocalDate } from './types';

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const parts = (value: string): [number, number, number] => {
  const [y, m, d] = value.split('-').map(Number);
  return [y, m, d];
};

/** True when `value` is a real calendar date in 'YYYY-MM-DD' form (so 2027-02-29 is not). */
export function isLocalDate(value: string): boolean {
  if (!PATTERN.test(value)) return false;
  const [y, m, d] = parts(value);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const toUtc = (value: LocalDate): number => {
  if (!isLocalDate(value)) throw new Error(`Not a local date: ${JSON.stringify(value)}`);
  const [y, m, d] = parts(value);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): LocalDate => new Date(ms).toISOString().slice(0, 10);

/** Calendar arithmetic: `n` may be negative. */
export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

/** 0 Sunday to 6 Saturday, matching the `week_start` and `cycle_slot.weekday` columns (§4.3). */
export function weekday(d: LocalDate): number {
  return new Date(toUtc(d)).getUTCDay();
}

/** The first date on or after `d` that falls on `targetWeekday`; `d` itself if it already does. */
export function firstOnOrAfter(d: LocalDate, targetWeekday: number): LocalDate {
  if (!Number.isInteger(targetWeekday) || targetWeekday < 0 || targetWeekday > 6) {
    throw new Error(`Target weekday must be an integer 0-6, got ${targetWeekday}`);
  }
  return addDays(d, (targetWeekday - weekday(d) + 7) % 7);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}
