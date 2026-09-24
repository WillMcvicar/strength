// Plan dates as the §7 sketches show them: "Wed 16 Sep".
import { formatClock, formatDay, spokenClock, spokenDay } from './format';

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
