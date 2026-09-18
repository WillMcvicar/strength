// The only place that reads the device clock (DESIGN §3.15). Everything else takes `today` and
// `now` as arguments, so it stays deterministic and testable.
import type { LocalDate } from '@/core/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local calendar date: the date a lifter would say it is. */
export function today(): LocalDate {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The current instant as an ISO-8601 UTC timestamp, for event times. */
export function now(): string {
  return new Date().toISOString();
}
