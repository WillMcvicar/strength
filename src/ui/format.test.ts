// Plan dates as the §7 sketches show them: "Wed 16 Sep".
import { formatDay, spokenDay } from './format';

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
