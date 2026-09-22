// WeekdayPicker (DESIGN §7.5): the seven days as a row of toggles, one chosen. Days are numbered
// like `cycle_slot.weekday` (0 Sunday), and the row starts on the user's week-start day (FR-12.3).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface WeekdayPickerProps {
  /** 0 Sunday … 6 Saturday. */
  value: number;
  onChange: (weekday: number) => void;
  weekStart?: 0 | 1;
  /** Named for screen readers, e.g. "Week A · Full body A". */
  label: string;
}

export function WeekdayPicker({ value, onChange, weekStart = 1, label }: WeekdayPickerProps) {
  const c = useColors();
  const type = useTypography();
  const days = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {days.map((day) => {
        const selected = day === value;
        return (
          <Pressable
            key={day}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={LONG[day]}
            onPress={() => onChange(day)}
            style={[
              styles.day,
              {
                backgroundColor: selected ? c.plateBlue : c.surface,
                borderColor: selected ? c.plateBlue : c.line,
              },
            ]}
          >
            <Text style={[type.label, { color: selected ? c.onPlate : c.ink }]}>{SHORT[day]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  day: {
    borderWidth: 1,
    borderRadius: radius.button,
    minHeight: touch.min,
    minWidth: touch.min,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
