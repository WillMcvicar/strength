// DESIGN §3.1 (FR-12.1, FR-3.6).
import { formatLoad, KG_PER_LB, toDisplay, toKg } from './units';

describe('KG_PER_LB', () => {
  it('is the exact international definition', () => {
    expect(KG_PER_LB).toBe(0.45359237);
  });
});

describe('toDisplay', () => {
  it('returns kilograms unchanged', () => {
    expect(toDisplay(82.5, 'kg')).toBe(82.5);
    expect(toDisplay(0, 'kg')).toBe(0);
  });

  it('converts to pounds, cleaned to 6 dp', () => {
    // 80 / 0.45359237 = 176.36980974..., which cleans to exactly 6 decimal places.
    expect(toDisplay(80, 'lb')).toBe(176.36981);
    expect(toDisplay(100, 'lb')).toBe(220.462262);
  });

  it('cleans floating-point noise to 6 dp, so 174.99999 never happens (DESIGN §3.1)', () => {
    // 79.37866475 kg is exactly 175 lb; the naive division drifts below it.
    expect(toDisplay(79.37866475, 'lb')).toBe(175);
  });

  it('round-trips through toKg', () => {
    for (const lb of [45, 135, 175, 225, 315]) {
      expect(toDisplay(toKg(lb, 'lb'), 'lb')).toBe(lb);
    }
  });
});

describe('toKg', () => {
  it('returns kilograms unchanged', () => {
    expect(toKg(82.5, 'kg')).toBe(82.5);
  });

  it('converts pounds to kilograms without extra rounding', () => {
    expect(toKg(175, 'lb')).toBe(175 * KG_PER_LB);
    expect(toKg(45, 'lb')).toBe(20.41165665);
  });

  it('handles negative added load (bodyweight_plus_load)', () => {
    expect(toKg(-10, 'kg')).toBe(-10);
  });
});

describe('formatLoad', () => {
  it.each([
    [82.5, 'kg' as const, '82.5 kg'],
    [100, 'kg' as const, '100 kg'],
    [20, 'kg' as const, '20 kg'],
  ])('formats %p kg as %s', (kg, unit, expected) => {
    expect(formatLoad(kg, unit)).toBe(expected);
  });

  it('formats in pounds, converting first', () => {
    expect(formatLoad(toKg(175, 'lb'), 'lb')).toBe('175 lb');
  });

  it('strips trailing zeros and shows at most 2 dp', () => {
    expect(formatLoad(82.5, 'kg')).toBe('82.5 kg');
    expect(formatLoad(82.0, 'kg')).toBe('82 kg');
    expect(formatLoad(106.6666, 'kg')).toBe('106.67 kg');
  });

  it('shows per-side loads as "× 2" (FR-1.8)', () => {
    expect(formatLoad(22.5, 'kg', { perSide: true })).toBe('22.5 kg × 2');
  });

  it('signs added load with a real minus sign (DESIGN §3.1)', () => {
    expect(formatLoad(20, 'kg', { signed: true })).toBe('+20 kg');
    expect(formatLoad(-10, 'kg', { signed: true })).toBe('−10 kg');
    expect(formatLoad(0, 'kg', { signed: true })).toBe('+0 kg');
  });

  it('combines per-side and signed', () => {
    expect(formatLoad(-5, 'kg', { signed: true, perSide: true })).toBe('−5 kg × 2');
  });
});
