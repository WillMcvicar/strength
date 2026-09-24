// MenuSheet: a bottom sheet listing a few actions, for the set and exercise menus and the ✕ menu
// of the workout session (DESIGN §7.6). Each action is a full-width button that says what it
// does; destructive ones are red and need their own confirmation.
import { Modal, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { radius, spacing } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface MenuSheetProps {
  visible: boolean;
  title: string;
  actions: MenuAction[];
  onClose: () => void;
  /** The close button's label, e.g. "Keep going" on the ✕ menu. */
  closeLabel?: string;
}

export function MenuSheet({
  visible,
  title,
  actions,
  onClose,
  closeLabel = 'Cancel',
}: MenuSheetProps) {
  const c = useColors();
  const type = useTypography();
  const reduceMotion = useReduceMotion();
  if (!visible) return null;
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
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              variant={action.destructive ? 'destructive' : 'secondary'}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            />
          ))}
          <Button label={closeLabel} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
const styles = sheetStyles;
