// StatusChip (DESIGN §6.2, §6.5): a workout status as icon + label, so colour never carries the
// meaning alone (NFR-7). Only the label is read aloud.
import { StyleSheet, Text, View } from 'react-native';

import type { EffectiveStatus } from '@/core';

import { useColors } from '../theme';
import { radius, spacing, type ColorTokens } from '../tokens';
import { useTypography } from '../typography';

/** Every status core derives has a chip (§6.2, D-34). */
export type ChipStatus = EffectiveStatus;

export const STATUS_LOOK: Record<
  ChipStatus,
  { icon: string; label: string; color: keyof ColorTokens }
> = {
  completed: { icon: '✓', label: 'Done', color: 'plateGreen' },
  missed: { icon: '!', label: 'Missed', color: 'plateRedText' },
  skipped: { icon: '↷', label: 'Skipped', color: 'inkMuted' },
  today: { icon: '●', label: 'Today', color: 'plateBlue' },
  upcoming: { icon: '○', label: 'Upcoming', color: 'ink' },
  // D-24: a workout left when a plan was ended early.
  not_done: { icon: '–', label: 'Not done', color: 'inkMuted' },
  // D-34: ▸ and ‖ rather than ▶ and ⏸, which iOS draws as colour emoji.
  in_progress: { icon: '▸', label: 'In progress', color: 'plateBlue' },
  // Shown only once pause and resume ships (FR-4.10, v1.1).
  paused: { icon: '‖', label: 'Paused', color: 'inkMuted' },
};

export function StatusChip({ status }: { status: ChipStatus }) {
  const c = useColors();
  const type = useTypography();
  const { icon, label, color } = STATUS_LOOK[status];
  const tone = { color: c[color] };
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.chip, { borderColor: status === 'upcoming' ? c.line : c[color] }]}
    >
      <Text style={[type.label, tone]}>
        <Text importantForAccessibility="no" accessibilityElementsHidden style={tone}>
          {icon}
        </Text>{' '}
        <Text style={tone}>{label}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: spacing.xs / 2,
  },
});
