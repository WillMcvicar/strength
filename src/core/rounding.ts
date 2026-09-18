// DESIGN §3.2 — rounding in the display unit, ties down (FR-3.6, FR-1.6).
import type { IncrementSettings, SkillIncrements, Unit } from './types';
import { toDisplay, toKg } from './units';

/** Rounds to the nearest increment, with exact ties going down (FR-3.6). */
export function roundToIncrement(value: number, inc: number): number {
  if (!(inc > 0)) throw new Error(`Increment must be greater than zero, got ${inc}`);
  const q = Math.round((value / inc) * 1e6) / 1e6; // strip float noise before comparing
  const lower = Math.floor(q);
  return (q - lower > 0.5 ? lower + 1 : lower) * inc;
}

/**
 * Rounds a kilogram load to the increment **in the display unit**, then converts back for
 * storage. An lb user therefore sees clean lb numbers, never a converted 83.9 kg (FR-3.6).
 */
export function roundLoadKg(kg: number, unit: Unit, inc: number): number {
  return toKg(roundToIncrement(toDisplay(kg, unit), inc), unit);
}

/** The skill's own per-unit increment, falling back to the global setting (FR-1.6, FR-12.4). */
export function incrementFor(
  skill: SkillIncrements,
  settings: IncrementSettings,
  unit: Unit,
): number {
  return unit === 'kg'
    ? (skill.loadIncrementKg ?? settings.weightIncrementKg)
    : (skill.loadIncrementLb ?? settings.weightIncrementLb);
}
