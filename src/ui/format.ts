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
