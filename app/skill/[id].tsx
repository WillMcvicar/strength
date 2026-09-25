import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatLoad } from '@/core';
import { useExerciseDetail, type ExerciseDetailView } from '@/features/progress';
import { spokenLoad } from '@/ui/components/LoadText';
import { BackHeader } from '@/ui/components/BackHeader';
import { formatDay, localDayOf, spokenDay } from '@/ui/format';
import { prText } from '@/ui/prText';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Exercise detail (FR-10.3, DESIGN §7.11, v1.0 scope): the current PRs, the 1RM's history and
// recent sessions. Update 1RM between plans arrives with Slice 11 (FR-3.11); PR history charts
// and manual PRs are v1.2 (FR-10.4, FR-10.6).
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useExerciseDetail(id);
  const c = useColors();
  const type = useTypography();

  if (view.status === 'loading') return null;
  const detail = view.status === 'ready' ? view.detail : null;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title={detail?.name ?? 'Exercise'} />
        {detail ? (
          <Detail detail={detail} />
        ) : (
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            {view.status === 'failed'
              ? 'Couldn’t load this exercise. Close the app and open it again.'
              : 'This exercise isn’t available.'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SOURCE: Record<ExerciseDetailView['oneRmHistory'][number]['source'], string> = {
  plan_setup: 'Plan setup',
  setup_estimate: 'Estimated',
  cycle_review: 'Cycle Review',
  manual: 'Entered',
};

function Detail({ detail }: { detail: ExerciseDetailView }) {
  const c = useColors();
  const type = useTypography();
  const { unit } = detail;
  return (
    <>
      <Section title="Personal records">
        {detail.prs.length === 0 ? (
          <Text style={[type.body, { color: c.inkMuted }]}>No records yet.</Text>
        ) : (
          detail.prs.map((pr) => {
            const text = prText(pr, unit);
            const day = pr.day ?? localDayOf(pr.achievedAt);
            return (
              <View
                key={pr.id}
                accessible
                accessibilityLabel={`${text.spoken}, set ${spokenDay(day)}`}
                style={styles.line}
              >
                <Text style={[type.body, styles.grow, { color: c.ink }]}>{text.label}</Text>
                <Text style={[type.label, { color: c.ink }]}>{text.value}</Text>
                <Text style={[type.caption, { color: c.inkMuted }]}>{formatDay(day)}</Text>
              </View>
            );
          })
        )}
      </Section>

      {detail.oneRmHistory.length > 0 && (
        <Section title="1RM history">
          {detail.oneRmHistory.map((row) => {
            const day = localDayOf(row.setAt);
            return (
              <View
                key={row.id}
                accessible
                accessibilityLabel={`${spokenLoad(row.oneRmKg, unit)}, ${SOURCE[row.source]}, ${spokenDay(day)}${row.note ? `, ${row.note}` : ''}`}
                style={styles.line}
              >
                <Text style={[type.label, { color: c.ink }]}>{formatLoad(row.oneRmKg, unit)}</Text>
                <Text style={[type.body, styles.grow, { color: c.inkMuted }]}>
                  {SOURCE[row.source]}
                  {row.note ? ` · ${row.note}` : ''}
                </Text>
                <Text style={[type.caption, { color: c.inkMuted }]}>{formatDay(day)}</Text>
              </View>
            );
          })}
        </Section>
      )}

      {detail.recent.length > 0 && (
        <Section title="Recent workouts">
          {detail.recent.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${spokenDay(s.localDate)}`}
              onPress={() => router.push(`/history/${s.id}`)}
              style={[styles.line, styles.tappable]}
            >
              <Text style={[type.body, styles.grow, { color: c.ink }]}>{s.name}</Text>
              <Text style={[type.caption, { color: c.inkMuted }]}>{formatDay(s.localDate)}</Text>
              <Text style={[type.title, { color: c.inkMuted }]}>›</Text>
            </Pressable>
          ))}
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  tappable: { minHeight: touch.min, alignItems: 'center' },
  grow: { flexGrow: 1, flexShrink: 1 },
});
