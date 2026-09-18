// DESIGN §3.2 (FR-3.6, FR-1.6). Round in the display unit, ties down.
import { incrementFor, roundLoadKg, roundToIncrement } from './rounding';
import { formatLoad, toDisplay, toKg } from './units';

describe('roundToIncrement', () => {
  it.each([
    [79.2, 2.5, 80],
    [82.8, 2.5, 82.5],
    [63, 2.5, 62.5],
    [108, 2.5, 107.5],
    [116.667, 2.5, 117.5],
    [96.525, 2.5, 97.5],
    [87.75, 2.5, 87.5],
  ])('rounds %p to the nearest %p as %p', (value, inc, expected) => {
    expect(roundToIncrement(value, inc)).toBe(expected);
  });

  it.each([
    [81.25, 2.5, 80],
    [1.25, 2.5, 0],
    [7.5, 5, 5],
    [2.5, 5, 0],
  ])('rounds the tie %p down to %p (increment %p)', (value, inc, expected) => {
    expect(roundToIncrement(value, inc)).toBe(expected);
  });

  it('is exact for values already on the increment', () => {
    expect(roundToIncrement(80, 2.5)).toBe(80);
    expect(roundToIncrement(0, 2.5)).toBe(0);
  });

  it('strips floating-point noise before deciding (DESIGN §3.2)', () => {
    expect(roundToIncrement(0.1 + 0.2, 0.1)).toBeCloseTo(0.3, 10);
  });

  it('handles negative values', () => {
    expect(roundToIncrement(-7.5, 5)).toBe(-10);
  });

  it('rejects a non-positive increment', () => {
    expect(() => roundToIncrement(80, 0)).toThrow(/increment/i);
    expect(() => roundToIncrement(80, -2.5)).toThrow(/increment/i);
  });
});

describe('roundLoadKg', () => {
  it('rounds in kilograms when the display unit is kg', () => {
    expect(roundLoadKg(79.2, 'kg', 2.5)).toBe(80);
    expect(roundLoadKg(82.8, 'kg', 2.5)).toBe(82.5);
  });

  it('rounds in pounds and converts back to kg for storage (FR-3.6)', () => {
    // 80 kg is 176.37 lb; with a 5 lb increment the lifter sees 175 lb.
    const stored = roundLoadKg(80, 'lb', 5);
    expect(stored).toBeCloseTo(toKg(175, 'lb'), 10);
    expect(roundToIncrement(stored / 0.45359237, 5)).toBe(175);
  });

  it('never shows an lb user a converted value like 185.0 lb (FR-3.6)', () => {
    for (const kg of [60, 72.5, 83.9, 100, 142.7]) {
      const displayed = roundLoadKg(kg, 'lb', 5) / 0.45359237;
      expect((Math.round(displayed * 1e6) / 1e6) % 5).toBe(0);
    }
  });
});

describe('incrementFor', () => {
  const settings = { weightIncrementKg: 2.5, weightIncrementLb: 5 };

  it('uses the global setting when the skill has no override (FR-12.4)', () => {
    const skill = { loadIncrementKg: null, loadIncrementLb: null };
    expect(incrementFor(skill, settings, 'kg')).toBe(2.5);
    expect(incrementFor(skill, settings, 'lb')).toBe(5);
  });

  it("prefers the skill's own increment, per unit (FR-1.6)", () => {
    const dumbbells = { loadIncrementKg: 2, loadIncrementLb: 5 };
    expect(incrementFor(dumbbells, settings, 'kg')).toBe(2);
    expect(incrementFor(dumbbells, settings, 'lb')).toBe(5);
  });

  it('falls back per unit independently', () => {
    const skill = { loadIncrementKg: 1, loadIncrementLb: null };
    expect(incrementFor(skill, settings, 'kg')).toBe(1);
    expect(incrementFor(skill, settings, 'lb')).toBe(5);
  });

  it('treats undefined like null', () => {
    expect(incrementFor({}, settings, 'kg')).toBe(2.5);
  });
});

describe('AC-8 Unit switch', () => {
  // Maths only: the settings flow and "stored values are unchanged" are proven at service level.
  it('shows TM 100 kg × 80% = 176.4 lb as 175 lb with a 5 lb increment', () => {
    const tmKg = 100 * 0.8; // 80 kg
    expect(toDisplay(tmKg, 'lb')).toBeCloseTo(176.4, 1); // the unrounded 176.4 lb from the SRS
    expect(formatLoad(roundLoadKg(tmKg, 'lb', 5), 'lb')).toBe('175 lb');
  });

  it('leaves the stored kilogram value untouched when only the display unit changes', () => {
    const storedKg = 80;
    expect(roundLoadKg(storedKg, 'kg', 2.5)).toBe(80);
    expect(storedKg).toBe(80);
  });
});
