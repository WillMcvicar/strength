// "How hard was it?" (FR-9.7, D-40): the session's effort rating, a whole number from 1 to 10,
// on the session screen and its summary (DESIGN §7.6, §7.7).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export function EffortPicker({
  value,
  onPick,
}: {
  value: number | null;
  onPick: (rpe: number) => void;
}) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.picker}>
      <Text style={[type.label, { color: c.inkMuted }]}>How hard was it? (1–10)</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`Effort ${n} of 10`}
            accessibilityState={{ checked: value === n }}
            onPress={() => onPick(n)}
            style={[
              styles.chip,
              value === n
                ? { backgroundColor: c.plateBlue, borderColor: c.plateBlue }
                : { borderColor: c.line },
            ]}
          >
            <Text style={[type.label, { color: value === n ? c.onPlate : c.ink }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: touch.min,
    minHeight: touch.min,
    borderWidth: 1,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
