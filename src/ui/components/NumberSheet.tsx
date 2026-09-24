// NumberSheet (DESIGN §6.5, §7.6; FR-9.3): numeric entry for a set's load, reps or time. A large
// keypad avoids the OS keyboard, and ± buttons step by the skill's increment. The value is kept as
// typed text, so a half-typed "92." isn't thrown away. Values are in the display unit; the caller
// converts to kg.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export interface NumberSheetProps {
  visible: boolean;
  /** "Squat, set 2 load". */
  title: string;
  value: number | null;
  /** "kg", "lb", "reps", "s". */
  suffix: string;
  /** The ± step, e.g. the skill's increment in the display unit. */
  step: number;
  /** Whole numbers only (reps, seconds). */
  integer?: boolean;
  /** Assisted bodyweight skills log a negative added load (FR-1.2). */
  allowNegative?: boolean;
  /** Reference shown under the value, e.g. "Last: 100 kg × 2 @ RPE 8" (FR-9.2b). */
  note?: string;
  onDone: (value: number | null) => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

/** To 2 dp, so 92.5 + 2.5 is 95 and not 94.99999. */
const tidy = (n: number) => Math.round(n * 100) / 100;

/** Rendered only while open, so each opening starts from the set's current value. */
export function NumberSheet(props: NumberSheetProps) {
  return props.visible ? <OpenSheet {...props} /> : null;
}

function OpenSheet({
  title,
  value,
  suffix,
  step,
  integer = false,
  allowNegative = false,
  note,
  onDone,
  onClose,
}: NumberSheetProps) {
  const c = useColors();
  const type = useTypography();
  const reduceMotion = useReduceMotion();
  const [text, setText] = useState(value === null ? '' : String(value));

  const current = text === '' || text === '-' ? null : Number(text);
  const press = (key: (typeof KEYS)[number]) => {
    if (key === '⌫') return setText((t) => t.slice(0, -1));
    if (key === '.' && (integer || text.includes('.'))) return;
    setText((t) => (t === '0' && key !== '.' ? key : t + key));
  };
  const nudge = (delta: number) => {
    const next = tidy((current ?? 0) + delta);
    setText(String(allowNegative ? next : Math.max(0, next)));
  };
  const valid = current === null || Number.isFinite(current);

  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      visible
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {title}
          </Text>
          <View style={styles.valueRow}>
            <StepButton
              label={`−${step}`}
              spoken={`Decrease by ${step} ${suffix}`}
              onPress={() => nudge(-step)}
            />
            <Text
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${text === '' ? 'empty' : text} ${suffix}`}
              style={[type.scoreboard, styles.value, { color: c.ink }]}
            >
              {text === '' ? '—' : text}
              <Text style={[type.title, { color: c.inkMuted }]}> {suffix}</Text>
            </Text>
            <StepButton
              label={`+${step}`}
              spoken={`Increase by ${step} ${suffix}`}
              onPress={() => nudge(step)}
            />
          </View>
          {note !== undefined && <Text style={[type.body, { color: c.inkMuted }]}>{note}</Text>}
          <View style={styles.keys}>
            {KEYS.map((key) => {
              const disabled = key === '.' && integer;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key}
                  disabled={disabled}
                  onPress={() => press(key)}
                  style={[
                    styles.key,
                    { backgroundColor: c.surfaceSunk, opacity: disabled ? 0.4 : 1 },
                  ]}
                >
                  <Text style={[type.title, { color: c.ink }]}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
          {allowNegative && (
            <Button
              label="Switch between added and assisted"
              variant="secondary"
              onPress={() => setText((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`))}
            />
          )}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View style={styles.action}>
              <Button label="Save" disabled={!valid} onPress={() => onDone(current)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StepButton({
  label,
  spoken,
  onPress,
}: {
  label: string;
  spoken: string;
  onPress: () => void;
}) {
  const c = useColors();
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.step, { borderColor: c.line }]}
    >
      <Text style={[type.label, { color: c.plateBlue }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { flex: 1, textAlign: 'center' },
  step: {
    minWidth: touch.min,
    minHeight: touch.min,
    borderWidth: 1,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  key: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: touch.setDone,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
