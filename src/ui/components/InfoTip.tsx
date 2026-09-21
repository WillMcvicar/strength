// InfoTip (DESIGN §6.5, FR-6.1): the ⓘ beside a term. It opens a TermSheet with the term's
// plain-language explanation from content/explanations.json, and returns screen-reader focus to
// the ⓘ when the sheet closes (§7.17).
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { explanation, type TermKey } from '../explanations';
import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export function InfoTip({ term }: { term: TermKey }) {
  const c = useColors();
  const type = useTypography();
  const [open, setOpen] = useState(false);
  const tip = useRef<View>(null);
  const wasOpen = useRef(false);
  const { title } = explanation(term);

  useEffect(() => {
    if (wasOpen.current && !open && tip.current) {
      AccessibilityInfo.sendAccessibilityEvent(tip.current, 'focus');
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <Pressable
        ref={tip}
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

/**
 * A bottom sheet with one explanation. It traps screen-reader focus while open (§7.17), and
 * appears without sliding when the OS asks to reduce motion (§6.4).
 */
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
  const reduceMotion = useReduceMotion();
  const { title, body } = explanation(term);
  if (!visible) return null;
  return (
    <Modal
      testID="term-sheet"
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
