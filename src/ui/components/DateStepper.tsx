// DateStepper (DESIGN §7.5 step 1, D-38): the plan's start date, stepped a week or a day at a
// time. The default is the next week-start day, so plan weeks line up with calendar weeks
// (FR-2.3); the week arrows keep that alignment and the day arrows break it deliberately.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, type LocalDate } from '@/core';

import { spokenDay } from '../format';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export interface DateStepperProps {
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  /** Steps that would land before this date are disabled. */
  min?: LocalDate;
  label: string;
}

export function DateStepper({ value, onChange, min, label }: DateStepperProps) {
  const c = useColors();
  const type = useTypography();

  const step = (days: number, name: string) => {
    const next = addDays(value, days);
    const disabled = min !== undefined && next < min;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(next)}
        style={[
          styles.step,
          { borderColor: c.line, backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        <Text style={[type.label, { color: c.ink }]}>{days < 0 ? '−' : '+'}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.group}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${label}: ${spokenDay(value)}`}
        style={[type.title, { color: c.ink }]}
      >
        {spokenDay(value)}
      </Text>
      <View style={styles.row}>
        {step(-7, 'A week earlier')}
        <Text style={[type.label, styles.unit, { color: c.inkMuted }]}>week</Text>
        {step(7, 'A week later')}
        {step(-1, 'A day earlier')}
        <Text style={[type.label, styles.unit, { color: c.inkMuted }]}>day</Text>
        {step(1, 'A day later')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  unit: { minWidth: 40, textAlign: 'center' },
  step: {
    borderWidth: 1,
    borderRadius: radius.button,
    minHeight: touch.min,
    minWidth: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
