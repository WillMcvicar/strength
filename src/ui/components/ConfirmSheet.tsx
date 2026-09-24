// ConfirmSheet (DESIGN §6.5): a confirmation that states the consequence plainly, e.g. "4 sets
// aren't done. Finish anyway?", with a button that says what happens.
import { Modal, Text, View } from 'react-native';

import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { useTypography } from '../typography';
import { Button } from './Button';
import { sheetStyles as styles } from './MenuSheet';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const c = useColors();
  const type = useTypography();
  const reduceMotion = useReduceMotion();
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      visible
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {title}
          </Text>
          <Text style={[type.body, { color: c.ink }]}>{message}</Text>
          <Button
            label={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            onPress={onConfirm}
          />
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
