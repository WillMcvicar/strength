// Plan dates for display (DESIGN §7): "Wed 16 Sep", spoken as "Wednesday 16 September". Dates stay
// YYYY-MM-DD strings; weekday comes from src/core/dates, never from Date in the local zone.
import { weekday, type LocalDate } from '@/core';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const parts = (date: LocalDate) => ({
  day: DAYS[weekday(date)] as string,
  date: Number(date.slice(8, 10)),
  month: MONTHS[Number(date.slice(5, 7)) - 1] as string,
});

export function formatDay(date: LocalDate): string {
  const p = parts(date);
  return `${p.day.slice(0, 3)} ${p.date} ${p.month.slice(0, 3)}`;
}

export function spokenDay(date: LocalDate): string {
  const p = parts(date);
  return `${p.day} ${p.date} ${p.month}`;
}

/** Elapsed or remaining time: "0:45", "1:42", "24:13", "1:02:05". */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The same time as a screen reader says it: "1 minute 42 seconds". */
export function spokenClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const parts = [
    Math.floor(sec / 3600) && unit(Math.floor(sec / 3600), 'hour'),
    Math.floor((sec % 3600) / 60) && unit(Math.floor((sec % 3600) / 60), 'minute'),
    sec % 60 && unit(sec % 60, 'second'),
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : '0 seconds';
}
