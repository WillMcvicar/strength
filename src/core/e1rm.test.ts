// DESIGN §3.4 (FR-3.5, FR-10.1, D-10, D-19).
import { e1rm, isPrEligibleE1rm, isQualifyingSet } from './e1rm';
import type { LoggedSet } from './types';

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  status: 'completed',
  isWarmup: false,
  isTopSet: false,
  isAmrap: false,
  reps: 5,
  rpe: 8,
  loadKg: 100,
  ...over,
});

describe('e1rm', () => {
  it('uses load × (1 + n/30), where n = reps + RIR', () => {
    expect(e1rm(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30), 10); // RIR 2
    expect(e1rm(100, 3, 9)).toBeCloseTo(100 * (1 + 4 / 30), 10); // RIR 1
  });

  it('treats a missing RPE as RIR 0 (AMRAP rule, D-10)', () => {
    expect(e1rm(80, 10, null)).toBeCloseTo(80 * (1 + 10 / 30), 10);
    expect(e1rm(80, 10, null)).toBeCloseTo(106.6667, 4);
  });

  it('returns the load itself when n <= 1', () => {
    expect(e1rm(140, 1, 10)).toBe(140); // a true single: RIR 0, n = 1
    expect(e1rm(140, 1, null)).toBe(140);
  });

  it('is monotonic in reps and in RIR', () => {
    expect(e1rm(100, 5, 8)).toBeGreaterThan(e1rm(100, 4, 8));
    expect(e1rm(100, 5, 7)).toBeGreaterThan(e1rm(100, 5, 8));
  });

  it('works per side, so per_side skills estimate from the per-hand load', () => {
    expect(e1rm(22.5, 5, 8)).toBeCloseTo(22.5 * (1 + 7 / 30), 10);
  });
});

describe('isQualifyingSet', () => {
  it('accepts a top set of 1–5 reps with RPE >= 7', () => {
    expect(isQualifyingSet(set({ isTopSet: true, reps: 3, rpe: 8 }))).toBe(true);
    expect(isQualifyingSet(set({ isTopSet: true, reps: 1, rpe: 7 }))).toBe(true);
    expect(isQualifyingSet(set({ isTopSet: true, reps: 5, rpe: 10 }))).toBe(true);
  });

  it('accepts an AMRAP set with or without an RPE', () => {
    expect(isQualifyingSet(set({ isAmrap: true, reps: 3, rpe: null }))).toBe(true);
    expect(isQualifyingSet(set({ isAmrap: true, reps: 3, rpe: 9 }))).toBe(true);
  });

  it('rejects a top set with no RPE, or RPE below 7', () => {
    expect(isQualifyingSet(set({ isTopSet: true, reps: 3, rpe: null }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, reps: 3, rpe: 6.5 }))).toBe(false);
  });

  it('rejects straight and back-off sets whatever their RPE (FR-3.5)', () => {
    expect(isQualifyingSet(set({ reps: 5, rpe: 8 }))).toBe(false);
    expect(isQualifyingSet(set({ reps: 5, rpe: 10 }))).toBe(false);
  });

  it('rejects warm-ups, non-completed sets and reps outside 1–5', () => {
    expect(isQualifyingSet(set({ isTopSet: true, isWarmup: true }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, status: 'failed' }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, status: 'pending' }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, reps: 6 }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, reps: 0 }))).toBe(false);
    expect(isQualifyingSet(set({ isTopSet: true, reps: null }))).toBe(false);
  });
});

describe('isPrEligibleE1rm', () => {
  it('accepts any completed, non-warm-up set of 1–10 reps', () => {
    expect(isPrEligibleE1rm(set({ reps: 10, rpe: null }))).toBe(true);
    expect(isPrEligibleE1rm(set({ reps: 1 }))).toBe(true);
  });

  it('rejects warm-ups, non-completed sets and reps outside 1–10', () => {
    expect(isPrEligibleE1rm(set({ isWarmup: true }))).toBe(false);
    expect(isPrEligibleE1rm(set({ status: 'failed' }))).toBe(false);
    expect(isPrEligibleE1rm(set({ reps: 11 }))).toBe(false);
    expect(isPrEligibleE1rm(set({ reps: null }))).toBe(false);
  });
});

describe('AC-54 e1RM PR without RPE', () => {
  // Maths only: recording the PR row is proven at service level.
  it('estimates 80 kg × 10 with no RPE as 106.7 kg, and does not let it qualify', () => {
    const logged = set({ loadKg: 80, reps: 10, rpe: null });
    expect(e1rm(80, 10, null)).toBeCloseTo(106.6667, 4);
    expect(isPrEligibleE1rm(logged)).toBe(true);
    expect(isQualifyingSet(logged)).toBe(false);
  });
});

describe("AC-61 Back-off sets don't qualify", () => {
  // Maths only: the fallback +2.5% rule and its label are proven at service level.
  it('gives back-off 100 kg × 5 @ RPE 8 an e1RM of 123.3 kg but no qualification', () => {
    const backOff = set({ loadKg: 100, reps: 5, rpe: 8, isTopSet: false });
    expect(e1rm(100, 5, 8)).toBeCloseTo(123.3333, 4);
    expect(isQualifyingSet(backOff)).toBe(false);
  });
});
