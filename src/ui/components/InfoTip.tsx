// InfoTip (DESIGN §6.5, FR-6.1): the ⓘ beside a term. It opens a TermSheet with the term's
// plain-language explanation from content/explanations.json.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { explanation, type TermKey } from '../explanations';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export function InfoTip({ term }: { term: TermKey }) {
  const c = useColors();
  const type = useTypography();
  const [open, setOpen] = useState(false);
  const { title } = explanation(term);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`What is ${title}?`}
        onPress={() => setOpen(true)}
        style={styles.tip}
      >
        <Text style={[type.title, { color: c.plateBlue }]}>ⓘ</Text>
      </Pressable>
      <TermSheet term={term} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** A bottom sheet with one explanation. It traps screen-reader focus while open (§7.17). */
export function TermSheet({
  term,
  visible,
  onClose,
}: {
  term: TermKey;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const type = useTypography();
  const { title, body } = explanation(term);
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {title}
          </Text>
          <Text style={[type.body, { color: c.ink }]}>{body}</Text>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tip: {
    minWidth: touch.min,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
