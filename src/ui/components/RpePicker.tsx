// RpePicker (DESIGN §6.5, §7.6; FR-9.2a): nine chips, RPE 6–10 in half steps, shown inline once a
// set is ticked. The target is pre-highlighted, so logging it is one tap. On main lifts and top
// sets the RPE is required and there is no Skip; elsewhere "Skip" dismisses the picker.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export interface RpePickerProps {
  /** Pre-highlighted: the set's target RPE, if it has one. */
  target: number | null;
  required: boolean;
  onPick: (rpe: number) => void;
  /** Only offered when the RPE is optional. */
  onSkip?: () => void;
}

export function RpePicker({ target, required, onPick, onSkip }: RpePickerProps) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.picker}>
      <Text style={[type.label, { color: c.inkMuted }]}>
        {required ? 'How hard was that? Pick an RPE to finish the set' : 'How hard was that? (RPE)'}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {RPE_VALUES.map((rpe) => {
          const isTarget = rpe === target;
          return (
            <Pressable
              key={rpe}
              accessibilityRole="radio"
              accessibilityLabel={isTarget ? `RPE ${rpe}, your target` : `RPE ${rpe}`}
              accessibilityState={{ checked: isTarget }}
              onPress={() => onPick(rpe)}
              style={[
                styles.chip,
                isTarget
                  ? { backgroundColor: c.plateBlue, borderColor: c.plateBlue }
                  : { backgroundColor: c.surface, borderColor: c.line },
              ]}
            >
              <Text style={[type.label, { color: isTarget ? c.onPlate : c.ink }]}>{rpe}</Text>
            </Pressable>
          );
        })}
        {!required && onSkip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip RPE"
            onPress={onSkip}
            style={[styles.chip, { borderColor: c.line }]}
          >
            <Text style={[type.label, { color: c.plateBlue }]}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: spacing.xs, paddingVertical: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: touch.min,
    minHeight: touch.min,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
