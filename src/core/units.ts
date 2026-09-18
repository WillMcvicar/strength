// DESIGN §3.1 — units and conversion (FR-12.1, FR-3.6).
import type { LoadFormatOptions, Unit } from './types';

/** The exact international definition, so kg↔lb never drifts. */
export const KG_PER_LB = 0.45359237;

/** Strips floating-point noise, so a converted 175 lb never shows as 174.99999 (DESIGN §3.1). */
const clean = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Converts a stored kilogram value into the user's display unit. */
export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : clean(kg / KG_PER_LB);
}

/** Converts a display value back to kilograms for storage, with no extra rounding (FR-3.6). */
export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** At most 2 dp, trailing zeros stripped: 82.5 → "82.5", 82 → "82", 106.6666 → "106.67". */
const trim = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * Formats a stored kilogram value for display: "82.5 kg", "175 lb", "22.5 kg × 2",
 * "+20 kg", "−10 kg". The minus is U+2212, not a hyphen (DESIGN §3.1).
 */
export function formatLoad(kg: number, unit: Unit, opts: LoadFormatOptions = {}): string {
  const value = toDisplay(kg, unit);
  const sign = opts.signed ? (value < 0 ? '−' : '+') : '';
  const magnitude = opts.signed ? Math.abs(value) : value;
  const suffix = opts.perSide ? ' × 2' : '';
  return `${sign}${trim(magnitude)} ${unit}${suffix}`;
}
