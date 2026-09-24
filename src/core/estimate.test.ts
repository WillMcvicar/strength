// The setup estimate's validation (FR-3.3a, DESIGN §3.5).
import { validateEstimateSet, type EstimateRejection } from './estimate';

const toLb = (kg: number) => Math.round(kg * 2.2046226218 * 100) / 100;

const set = (over: Partial<Parameters<typeof validateEstimateSet>[0]> = {}) =>
  validateEstimateSet({ loadKg: 100, reps: 3, rpe: 8, unit: 'kg', increment: 2.5, ...over });

describe('FR-3.3a the estimate a test set gives', () => {
  it('uses the FR-3.5 formula, rounded in the display unit (FR-3.6)', () => {
    // 100 × (1 + (3 + 2) / 30) = 116.67 → 117.5 kg at a 2.5 kg increment.
    expect(set()).toEqual({ ok: true, oneRmKg: 117.5 });
  });

  it('a single at RPE 10 estimates the load itself', () => {
    expect(set({ reps: 1, rpe: 10 })).toEqual({ ok: true, oneRmKg: 100 });
  });

  it('rounds in lb for an lb user, never a converted kg value (FR-3.6)', () => {
    // 100 kg = 220.46 lb; × (1 + 5/30) = 257.2 lb → a clean 255 lb at a 5 lb increment.
    const result = set({ unit: 'lb', increment: 5 });
    expect(result.ok && toLb(result.oneRmKg)).toBe(255);
  });
});

describe('DESIGN §3.5 what the estimate refuses', () => {
  it.each`
    change                  | reason
    ${{ reps: 0 }}          | ${'reps_low'}
    ${{ reps: 6 }}          | ${'reps_high'}
    ${{ rpe: 6.5 }}         | ${'rpe_low'}
    ${{ rpe: 10.5 }}        | ${'rpe_invalid'}
    ${{ loadKg: 0 }}        | ${'load_invalid'}
    ${{ loadKg: -5 }}       | ${'load_invalid'}
    ${{ reps: Number.NaN }} | ${'reps_low'}
    ${{ rpe: Number.NaN }}  | ${'rpe_low'}
  `(
    'refuses $change as $reason',
    ({ change, reason }: { change: object; reason: EstimateRejection }) => {
      expect(set(change)).toEqual({ ok: false, reason });
    },
  );

  it('accepts the edges of both ranges', () => {
    expect(set({ reps: 1, rpe: 7 }).ok).toBe(true);
    expect(set({ reps: 5, rpe: 10 }).ok).toBe(true);
  });
});
