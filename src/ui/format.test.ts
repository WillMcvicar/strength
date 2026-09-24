// Plan dates as the §7 sketches show them: "Wed 16 Sep".
import { formatClock, formatDay, formatTime, formatVolume, spokenClock, spokenDay } from './format';

describe('formatDay', () => {
  it.each([
    ['2026-09-16', 'Wed 16 Sep'],
    ['2026-09-13', 'Sun 13 Sep'],
    ['2027-01-01', 'Fri 1 Jan'],
    ['2028-02-29', 'Tue 29 Feb'],
  ])('%s → %s', (date, shown) => {
    expect(formatDay(date)).toBe(shown);
  });

  it('spells it out for screen readers', () => {
    expect(spokenDay('2026-09-16')).toBe('Wednesday 16 September');
  });
});

describe('formatClock and spokenClock (§7.6)', () => {
  it.each([
    [0, '0:00', '0 seconds'],
    [45, '0:45', '45 seconds'],
    [60, '1:00', '1 minute'],
    [102, '1:42', '1 minute 42 seconds'],
    [1453, '24:13', '24 minutes 13 seconds'],
    [3725, '1:02:05', '1 hour 2 minutes 5 seconds'],
    [-3, '0:00', '0 seconds'],
  ])('%s s → %s, "%s"', (sec, shown, spoken) => {
    expect(formatClock(sec)).toBe(shown);
    expect(spokenClock(sec)).toBe(spoken);
  });
});

describe('formatVolume (§7.7)', () => {
  it('rounds the §7.7 example, 6,062.5 kg, to "6,063 kg"', () => {
    expect(formatVolume(6062.5, 'kg')).toEqual({ shown: '6,063 kg', spoken: '6063 kilograms' });
  });

  it('shows lb users pounds', () => {
    // 1,000 kg = 2,204.62 lb
    expect(formatVolume(1000, 'lb')).toEqual({ shown: '2,205 lb', spoken: '2205 pounds' });
    expect(formatVolume(0, 'kg').shown).toBe('0 kg');
  });
});

describe('formatTime (§7.2)', () => {
  it('shows an event time in the local zone, 24-hour', () => {
    // Built in local time, so the test holds in every CI time zone (§9.4).
    expect(formatTime(new Date(2026, 8, 14, 18, 2).toISOString())).toBe('18:02');
    expect(formatTime(new Date(2026, 8, 14, 7, 30).toISOString())).toBe('07:30');
  });
});
