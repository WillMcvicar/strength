// NumberField (DESIGN §6.5, §7.5): a number typed into an input well, with its unit beside it.
// The value stays a string while it is being typed, so a half-typed "10." isn't thrown away.
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export interface NumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Shown inside the field, e.g. "kg". */
  suffix?: string;
  placeholder?: string;
}

export function NumberField({ value, onChange, label, suffix, placeholder }: NumberFieldProps) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.well, { backgroundColor: c.surfaceSunk, borderColor: c.line }]}>
      <TextInput
        accessibilityLabel={label}
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        style={[type.body, styles.input, { color: c.ink }]}
      />
      {suffix !== undefined && (
        <Text style={[type.label, { color: c.inkMuted }]} accessibilityElementsHidden>
          {suffix}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    minHeight: touch.min,
  },
  input: { flexGrow: 1, flexShrink: 1, minHeight: touch.min },
});
