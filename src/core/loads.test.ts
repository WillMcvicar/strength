// DESIGN §3.3 (FR-3.2, FR-3.5, FR-3.12).
import { prescribedLoadKg, tmKg } from './loads';
import type { LoadContext, PrescribedSet } from './types';

const ctx = (over: Partial<LoadContext> = {}): LoadContext => ({
  tmKg: 99,
  unit: 'kg',
  increment: 2.5,
  phase: { type: 'training', loadFactor: null },
  dpState: null,
  lastLoadKg: null,
  ...over,
});

const pset = (over: Partial<PrescribedSet> = {}): PrescribedSet => ({
  loadType: 'percent_tm',
  loadPercent: 0.8,
  fixedLoadKg: null,
  ...over,
});

describe('tmKg', () => {
  it('is 1RM × TM%, never rounded (FR-3.2)', () => {
    expect(tmKg(110, 0.9)).toBeCloseTo(99, 10);
    expect(tmKg(100, 0.9)).toBeCloseTo(90, 10);
    expect(tmKg(142.5, 0.9)).toBeCloseTo(128.25, 10);
  });

  it('defaults to 90% when no override is given', () => {
    expect(tmKg(110)).toBeCloseTo(99, 10);
  });

  it('rejects a TM% outside a sane range', () => {
    expect(() => tmKg(110, 0)).toThrow(/tm percent/i);
    expect(() => tmKg(110, 1.5)).toThrow(/tm percent/i);
  });
});

describe('prescribedLoadKg', () => {
  it('computes percent_tm as TM × set%, rounded', () => {
    expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), ctx())).toBe(80); // 79.2 → 80
  });

  it('computes a top set the same way (pre-fill only)', () => {
    expect(prescribedLoadKg(pset({ loadType: 'top_set', loadPercent: 0.975 }), ctx())).toBe(97.5);
  });

  it('uses the double-progression working load, then last time', () => {
    const set = pset({ loadType: 'double_progression', loadPercent: null });
    expect(prescribedLoadKg(set, ctx({ dpState: { workingLoadKg: 42.5 } }))).toBe(42.5);
    expect(prescribedLoadKg(set, ctx({ dpState: null, lastLoadKg: 40 }))).toBe(40);
    expect(prescribedLoadKg(set, ctx({ dpState: null, lastLoadKg: null }))).toBeNull();
  });

  it('uses the stored load for a fixed set', () => {
    expect(prescribedLoadKg(pset({ loadType: 'fixed', fixedLoadKg: 24 }), ctx())).toBe(25);
  });

  it('returns null for bodyweight sets', () => {
    expect(prescribedLoadKg(pset({ loadType: 'bodyweight' }), ctx())).toBeNull();
  });

  it('applies the deload load factor before rounding (D-9)', () => {
    const deload = ctx({ phase: { type: 'deload', loadFactor: 0.9 } });
    // 99 × 0.8 = 79.2, × 0.9 = 71.28, which rounds up to 72.5 on a 2.5 kg increment.
    expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), deload)).toBe(72.5);
  });

  it('leaves the load alone in a deload phase with no load factor', () => {
    const deload = ctx({ phase: { type: 'deload', loadFactor: null } });
    expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), deload)).toBe(80);
  });

  it('ignores a load factor outside a deload phase', () => {
    const taper = ctx({ phase: { type: 'taper', loadFactor: 0.9 } });
    expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), taper)).toBe(80);
  });

  it('rounds in the display unit (FR-3.6)', () => {
    const lb = ctx({ tmKg: 100, unit: 'lb', increment: 5 });
    const kg = prescribedLoadKg(pset({ loadPercent: 0.8 }), lb);
    expect(kg).not.toBeNull();
    expect((kg as number) / 0.45359237).toBeCloseTo(175, 6);
  });

  it('throws when a percent_tm set has no percentage (the DDL forbids it)', () => {
    expect(() => prescribedLoadKg(pset({ loadPercent: null }), ctx())).toThrow(/load_percent/i);
  });

  it('throws when a fixed set has no load (the DDL forbids it)', () => {
    expect(() => prescribedLoadKg(pset({ loadType: 'fixed', fixedLoadKg: null }), ctx())).toThrow(
      /fixed_load_kg/i,
    );
  });
});

describe('AC-10 No automatic step-up', () => {
  // Maths only: "until a higher 1RM is confirmed" is proven across cycles at service level.
  it('prescribes 80 kg every cycle for a 110 kg 1RM at 80% of TM', () => {
    const tm = tmKg(110, 0.9); // 99
    expect(tm).toBeCloseTo(99, 10);
    for (let cycle = 1; cycle <= 6; cycle++) {
      expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), ctx({ tmKg: tm }))).toBe(80);
    }
  });
});

describe('AC-62 Top set in a session', () => {
  // Maths only: the "Top set" label and the RPE gate are proven at component/service level.
  it('pre-fills a 97.5% top set on a 99 kg TM at 97.5 kg (96.5, rounded)', () => {
    const set = pset({ loadType: 'top_set', loadPercent: 0.975 });
    expect(99 * 0.975).toBeCloseTo(96.525, 10);
    expect(prescribedLoadKg(set, ctx({ tmKg: 99 }))).toBe(97.5);
  });

  it('leaves back-off sets on their own calculated loads', () => {
    expect(prescribedLoadKg(pset({ loadPercent: 0.8 }), ctx({ tmKg: 99 }))).toBe(80);
  });
});

describe('AC-63 Top sets in deloads', () => {
  // Maths only: dropping the top-set flag and the RPE cap are proven in deload generation.
  it('turns a 97.5% top set on a 100 kg TM into 87.5 kg in a deload (97.75 → 87.5)', () => {
    const deload = ctx({ tmKg: 100, phase: { type: 'deload', loadFactor: 0.9 } });
    expect(100 * 0.975 * 0.9).toBeCloseTo(87.75, 10);
    expect(prescribedLoadKg(pset({ loadType: 'top_set', loadPercent: 0.975 }), deload)).toBe(87.5);
  });
});
