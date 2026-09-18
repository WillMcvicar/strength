// DESIGN §3.15, §9.4 (NFR-12). Every case must hold under TZ=Pacific/Auckland, America/New_York
// and UTC, which CI runs; the functions use Date.UTC only, so local time can never leak in.
import { addDays, daysBetween, firstOnOrAfter, isLocalDate, weekday } from './dates';

describe('addDays', () => {
  it.each([
    ['2026-09-14', 0, '2026-09-14'],
    ['2026-09-14', 1, '2026-09-15'],
    ['2026-09-14', 7, '2026-09-21'],
    ['2026-09-14', -1, '2026-09-13'],
    ['2026-09-14', -14, '2026-08-31'],
  ])('%s + %i days = %s', (from, n, expected) => {
    expect(addDays(from, n)).toBe(expected);
  });

  it.each([
    // Month and year ends (§9.4)
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-04-30', 1, '2026-05-01'],
    // 2027 is not a leap year; 2028 is (§9.4)
    ['2027-02-28', 1, '2027-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2027-03-01', -1, '2027-02-28'],
  ])('crosses a boundary: %s + %i = %s', (from, n, expected) => {
    expect(addDays(from, n)).toBe(expected);
  });

  it.each([
    // DST transitions: NZ, US and EU (§9.4). Calendar arithmetic must ignore them entirely.
    ['NZ DST starts', '2026-09-26', '2026-09-27'],
    ['NZ DST ends', '2027-04-03', '2027-04-04'],
    ['US DST starts', '2026-03-07', '2026-03-08'],
    ['US DST ends', '2026-10-31', '2026-11-01'],
    ['EU DST starts', '2026-03-28', '2026-03-29'],
    ['EU DST ends', '2026-10-24', '2026-10-25'],
  ])('%s: %s + 1 = %s', (_label, from, expected) => {
    expect(addDays(from, 1)).toBe(expected);
    expect(addDays(expected, -1)).toBe(from);
  });

  it('is reversible across a whole DST year', () => {
    let d = '2026-01-01';
    for (let i = 0; i < 365; i++) d = addDays(d, 1);
    expect(d).toBe('2027-01-01');
  });
});

describe('weekday', () => {
  it.each([
    ['2026-09-13', 0], // Sunday — 0 Sun, per the week_start column (DESIGN §4.3)
    ['2026-09-14', 1],
    ['2026-09-18', 5],
    ['2026-09-19', 6],
  ])('%s is weekday %i', (date, expected) => {
    expect(weekday(date)).toBe(expected);
  });

  it.each([
    ['2026-03-08', 0],
    ['2026-11-01', 0],
    ['2026-09-27', 0],
  ])('is unaffected by DST on %s', (date, expected) => {
    expect(weekday(date)).toBe(expected);
  });
});

describe('firstOnOrAfter', () => {
  it('returns the same date when it already falls on that weekday', () => {
    expect(firstOnOrAfter('2026-09-14', 1)).toBe('2026-09-14');
  });

  it.each([
    ['2026-09-14', 3, '2026-09-16'],
    ['2026-09-14', 5, '2026-09-18'],
    ['2026-09-14', 0, '2026-09-20'],
  ])('from %s, next weekday %i is %s', (from, wd, expected) => {
    expect(firstOnOrAfter(from, wd)).toBe(expected);
  });

  it('crosses a month and a year end', () => {
    expect(firstOnOrAfter('2026-12-29', 5)).toBe('2027-01-01');
  });

  it('always lands within the next 7 days, on the right weekday', () => {
    for (let wd = 0; wd <= 6; wd++) {
      const result = firstOnOrAfter('2028-02-26', wd);
      expect(weekday(result)).toBe(wd);
      expect(daysBetween('2028-02-26', result)).toBeGreaterThanOrEqual(0);
      expect(daysBetween('2028-02-26', result)).toBeLessThan(7);
    }
  });

  it('rejects a weekday outside 0–6', () => {
    expect(() => firstOnOrAfter('2026-09-14', 7)).toThrow(/weekday/i);
    expect(() => firstOnOrAfter('2026-09-14', -1)).toThrow(/weekday/i);
  });
});

describe('daysBetween', () => {
  it.each([
    ['2026-09-14', '2026-09-14', 0],
    ['2026-09-14', '2026-09-21', 7],
    ['2026-09-21', '2026-09-14', -7],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2], // leap year: 29 Feb sits between
    ['2027-02-28', '2027-03-01', 1],
  ])('from %s to %s is %i days', (a, b, expected) => {
    expect(daysBetween(a, b)).toBe(expected);
  });

  it.each([
    ['2026-03-07', '2026-03-09'],
    ['2026-10-31', '2026-11-02'],
    ['2026-09-26', '2026-09-28'],
  ])('counts whole days across a DST change (%s → %s)', (a, b) => {
    expect(daysBetween(a, b)).toBe(2);
  });
});

describe('isLocalDate', () => {
  it.each(['2026-09-14', '2028-02-29', '2026-01-01', '2026-12-31'])('accepts %s', (d) => {
    expect(isLocalDate(d)).toBe(true);
  });

  it.each([
    '2026-9-14',
    '26-09-14',
    '2026-09-14T00:00:00Z',
    '2026-13-01',
    '2026-00-10',
    '2026-02-30',
    '2027-02-29',
    '2026-09-31',
    'not-a-date',
    '',
  ])('rejects %s', (d) => {
    expect(isLocalDate(d)).toBe(false);
  });

  it('is enforced by the other functions', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(/local date/i);
    expect(() => weekday('nope')).toThrow(/local date/i);
    expect(() => daysBetween('2026-09-14', '2026-13-01')).toThrow(/local date/i);
  });
});
