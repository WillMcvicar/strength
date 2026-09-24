// SkillPicker (DESIGN §7.1 sheets, FR-9.4): search the Skill Library and pick one exercise, to
// swap or add in a session. Slice 13 adds filters; archived skills are never offered.
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSkillSearch } from '@/features/skillSearch';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export interface SkillPickerProps {
  visible: boolean;
  /** "Swap squat for…", "Add an exercise". */
  title: string;
  onPick: (skillId: string) => void;
  onClose: () => void;
}

export function SkillPicker(props: SkillPickerProps) {
  return props.visible ? <OpenPicker {...props} /> : null;
}

function OpenPicker({ title, onPick, onClose }: SkillPickerProps) {
  const c = useColors();
  const type = useTypography();
  const [query, setQuery] = useState('');
  const skills = useSkillSearch(query);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          {title}
        </Text>
        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search exercises"
          placeholderTextColor={c.inkMuted}
          value={query}
          onChangeText={setQuery}
          style={[
            type.body,
            styles.search,
            { color: c.ink, backgroundColor: c.surfaceSunk, borderColor: c.line },
          ]}
        />
        <FlatList
          data={skills ?? []}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            skills ? (
              <Text style={[type.body, { color: c.inkMuted }]}>No exercises match “{query}”.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => onPick(item.id)}
              style={[styles.row, { borderColor: c.line }]}
            >
              <Text style={[type.body, { color: c.ink }]}>{item.name}</Text>
            </Pressable>
          )}
        />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.screen, gap: spacing.md },
  search: {
    minHeight: touch.min,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
  },
  row: { minHeight: touch.min, justifyContent: 'center', borderBottomWidth: 1 },
});
