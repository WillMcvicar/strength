// Plan dates for display (DESIGN §7): "Wed 16 Sep", spoken as "Wednesday 16 September". Dates stay
// YYYY-MM-DD strings; weekday comes from src/core/dates, never from Date in the local zone.
import { toDisplay, weekday, type LocalDate, type Unit } from '@/core';

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

/** A History month heading: "2026-09" → "September 2026" (§7.12). */
export function formatMonth(yearMonth: string): string {
  return `${MONTHS[Number(yearMonth.slice(5, 7)) - 1]} ${yearMonth.slice(0, 4)}`;
}

/** The plan date an event happened on, in the device's zone: "2026-09-16T05:00Z" in Auckland is 16 Sep. */
export function localDayOf(iso: string): LocalDate {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
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

/** Session volume, rounded to a whole number with thousands separators: "6,063 kg" (§7.7). */
export function formatVolume(kg: number, unit: Unit): { shown: string; spoken: string } {
  const value = Math.round(toDisplay(kg, unit));
  const grouped = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const word = unit === 'kg' ? 'kilograms' : 'pounds';
  return {
    shown: `${grouped} ${unit}`,
    spoken: `${value} ${value === 1 ? word.slice(0, -1) : word}`,
  };
}

/** An event time in the device's local zone, 24-hour: "18:02" (§7.2 "started 18:02"). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
