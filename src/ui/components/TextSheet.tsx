// TextSheet: a bottom sheet for a short piece of text, such as an exercise note (FR-9.7). Rendered
// only while open, so each opening starts from the saved text.
import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';
import { sheetStyles } from './MenuSheet';

export interface TextSheetProps {
  visible: boolean;
  title: string;
  initial: string;
  saveLabel: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function TextSheet(props: TextSheetProps) {
  return props.visible ? <OpenSheet {...props} /> : null;
}

function OpenSheet({ title, initial, saveLabel, onSave, onClose }: TextSheetProps) {
  const c = useColors();
  const type = useTypography();
  const reduceMotion = useReduceMotion();
  const [text, setText] = useState(initial);
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      visible
      onRequestClose={onClose}
    >
      <View style={sheetStyles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[sheetStyles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {title}
          </Text>
          <TextInput
            accessibilityLabel={title}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
            style={[
              type.body,
              styles.input,
              { color: c.ink, backgroundColor: c.surfaceSunk, borderColor: c.line },
            ]}
          />
          <Button label={saveLabel} onPress={() => onSave(text)} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: touch.min * 2,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.sm,
    textAlignVertical: 'top',
  },
});
