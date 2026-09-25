import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Unit } from '@/core';
import { usePrBoard, type PrBoardRowView } from '@/features/progress';
import { EmptyState } from '@/ui/components/EmptyState';
import { formatDay, localDayOf, spokenDay } from '@/ui/format';
import { prText } from '@/ui/prText';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Progress (FR-10.3, DESIGN §7.11): the PR board. One row per skill with logged sets, showing its
// headline record and the day it was set, and opening the exercise detail. Charts are v1.2.
export default function ProgressScreen() {
  const c = useColors();
  const type = useTypography();
  const [query, setQuery] = useState('');
  const view = usePrBoard(query);

  if (view.status === 'loading') return null;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          Progress
        </Text>
        <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
          Personal records
        </Text>
        {view.status === 'failed' ? (
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            Couldn’t load your records. Close the app and open it again.
          </Text>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Search exercises"
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={c.inkMuted}
              autoCorrect={false}
              style={[
                type.body,
                styles.search,
                { color: c.ink, backgroundColor: c.surfaceSunk, borderColor: c.line },
              ]}
            />
            {view.rows.length === 0 ? (
              <EmptyState
                message={
                  query.trim()
                    ? 'No logged exercise matches that.'
                    : 'No records yet. Finish a workout to set your first.'
                }
                actions={[]}
              />
            ) : (
              view.rows.map((row) => <BoardRow key={row.skillId} row={row} unit={view.unit} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BoardRow({ row, unit }: { row: PrBoardRowView; unit: Unit }) {
  const c = useColors();
  const type = useTypography();
  const text = row.headline ? prText(row.headline, unit) : null;
  const day = row.headline ? localDayOf(row.headline.achievedAt) : null;
  const spoken = text && day ? `${text.spoken}, set ${spokenDay(day)}` : `${row.name}, no records`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={() => router.push(`/skill/${row.skillId}`)}
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <View style={styles.rowText}>
        <Text style={[type.body, { color: c.ink }]}>{row.name}</Text>
        {text && day && (
          <Text style={[type.caption, { color: c.inkMuted }]}>
            {text.label} · {formatDay(day)}
          </Text>
        )}
      </View>
      {text && <Text style={[type.label, { color: c.ink }]}>{text.value}</Text>}
      <Text style={[type.title, { color: c.inkMuted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  search: {
    minHeight: touch.min,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm,
  },
  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  rowText: { flexGrow: 1, flexShrink: 1, gap: spacing.xs },
});
