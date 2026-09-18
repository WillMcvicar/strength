// The clock is the one impure module (DESIGN §3.15), so it is tested with a fixed system time.
import { isLocalDate } from '@/core/dates';
import { now, today } from '@/services/clock';

afterEach(() => {
  jest.useRealTimers();
});

describe('clock (NFR-12)', () => {
  it('today is the local calendar date, even when UTC has moved on or not yet arrived', () => {
    // Local 23:30 and 00:30: in Auckland or New York the UTC date differs from one of these.
    jest.useFakeTimers({ now: new Date(2026, 8, 14, 23, 30) });
    expect(today()).toBe('2026-09-14');
    jest.setSystemTime(new Date(2026, 8, 15, 0, 30));
    expect(today()).toBe('2026-09-15');
    expect(isLocalDate(today())).toBe(true);
  });

  it('pads single-digit months and days', () => {
    jest.useFakeTimers({ now: new Date(2027, 0, 5, 12, 0) });
    expect(today()).toBe('2027-01-05');
  });

  it('now is an ISO-8601 UTC timestamp', () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 8, 14, 8, 0) });
    expect(now()).toBe('2026-09-14T08:00:00.000Z');
  });
});
