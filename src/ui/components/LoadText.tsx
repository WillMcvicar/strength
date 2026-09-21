// LoadText (DESIGN §6.5): a stored kg load in the display unit, as "82.5 kg", "22.5 kg × 2",
// "+20 kg" or "BW", with a spoken form that screen readers can say (§7.17).
import { Text } from 'react-native';

import { formatLoad, toDisplay, type Unit } from '@/core';

import { useColors } from '../theme';
import { useTypography } from '../typography';

export interface LoadTextProps {
  /** Stored kilograms; null for bodyweight with no added load. */
  kg: number | null;
  unit: Unit;
  /** Per-side loads read "× 2" (FR-1.8). */
  perSide?: boolean;
  /** Added load on a bodyweight skill: "+20 kg" or "−10 kg". */
  added?: boolean;
  variant?: 'scoreboard' | 'title' | 'body';
}

const UNIT_WORDS: Record<Unit, [string, string]> = {
  kg: ['kilogram', 'kilograms'],
  lb: ['pound', 'pounds'],
};

/** The load as a screen reader says it: "22.5 kilograms each side", "plus 20 kilograms". */
export function spokenLoad(kg: number | null, unit: Unit, perSide = false, added = false): string {
  if (kg === null) return 'bodyweight';
  const value = Math.round(Math.abs(toDisplay(kg, unit)) * 100) / 100;
  const sign = added ? (kg < 0 ? 'minus ' : 'plus ') : '';
  const word = UNIT_WORDS[unit][value === 1 ? 0 : 1];
  return `${sign}${value} ${word}${perSide ? ' each side' : ''}`;
}

export function LoadText({
  kg,
  unit,
  perSide = false,
  added = false,
  variant = 'body',
}: LoadTextProps) {
  const c = useColors();
  const type = useTypography();
  const text = kg === null ? 'BW' : formatLoad(kg, unit, { perSide, signed: added });
  return (
    <Text
      accessibilityLabel={spokenLoad(kg, unit, perSide, added)}
      style={[type[variant], { color: c.ink }]}
    >
      {text}
    </Text>
  );
}
