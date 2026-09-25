import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHistory, type HistoryItemView } from '@/features/history';
import { BackHeader } from '@/ui/components/BackHeader';
import { EmptyState } from '@/ui/components/EmptyState';
import { formatDay, formatMonth, spokenDay } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// History (FR-11.1, DESIGN §7.12): completed sessions, newest first, grouped by month. Each row
// shows the date, workout name, duration and ★ when it set a PR, and opens the session detail.
// Filters by plan and exercise are v1.2 (FR-11.2).
export default function HistoryScreen() {
  const c = useColors();
  const type = useTypography();
  const view = useHistory();

  if (view.status === 'loading') return null;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title="History" />
        {view.status === 'failed' ? (
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            Couldn’t load your history. Close the app and open it again.
          </Text>
        ) : view.months.length === 0 ? (
          <EmptyState message="No workouts yet. Finished workouts appear here." actions={[]} />
        ) : (
          view.months.map((month) => (
            <View key={month.month} style={styles.month}>
              <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
                {formatMonth(month.month)}
              </Text>
              {month.sessions.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryRow({ item }: { item: HistoryItemView }) {
  const c = useColors();
  const type = useTypography();
  const spoken = [
    spokenDay(item.localDate),
    item.name,
    `${item.durationMin} minutes`,
    item.hasPrs ? 'new PRs' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={() => router.push(`/history/${item.id}`)}
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <Text style={[type.label, styles.date, { color: c.inkMuted }]}>
        {formatDay(item.localDate)}
      </Text>
      <Text style={[type.body, styles.name, { color: c.ink }]}>
        {item.name}
        {item.hasPrs && <Text style={{ color: c.plateYellowText }}> ★</Text>}
      </Text>
      <Text style={[type.body, { color: c.inkMuted }]}>{item.durationMin} min</Text>
      <Text style={[type.title, { color: c.inkMuted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  month: { gap: spacing.sm },
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
  date: { minWidth: 88 },
  name: { flexGrow: 1, flexShrink: 1 },
});
