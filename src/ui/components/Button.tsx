// Button (DESIGN §6.5): primary, secondary, ghost or destructive. The label names the action
// ("Start workout", "Increase all"), and it wraps rather than truncating at large text sizes.
import { Pressable, StyleSheet, Text } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, type ColorTokens } from '../tokens';
import { useTypography } from '../typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}

function look(variant: ButtonVariant, c: ColorTokens) {
  switch (variant) {
    case 'primary':
      return { fill: c.plateBlue, text: c.onPlate, border: c.plateBlue };
    case 'destructive':
      return { fill: c.plateRed, text: c.onPlate, border: c.plateRed };
    case 'secondary':
      return { fill: c.surface, text: c.ink, border: c.line };
    case 'ghost':
      return { fill: 'transparent', text: c.plateBlue, border: 'transparent' };
  }
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const { fill, text, border } = look(variant, useColors());
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill, borderColor: border },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
      ]}
    >
      <Text style={[type.label, styles.label, { color: text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, textAlign: 'center' },
});
