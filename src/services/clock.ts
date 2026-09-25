// The only place that reads the device clock (DESIGN §3.15). Everything else takes `today` and
// `now` as arguments, so it stays deterministic and testable.
import { localDateFrom } from '@/core/dates';
import type { LocalDate } from '@/core/types';

/** The device's local calendar date: the date a lifter would say it is. */
export function today(): LocalDate {
  const d = new Date();
  return localDateFrom(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** The current instant as an ISO-8601 UTC timestamp, for event times. */
export function now(): string {
  return new Date().toISOString();
}
