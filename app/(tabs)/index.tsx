import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSamplePlan } from '@/features/samplePlan';
import { useToday, type TodayCardView, type TodayPlanView } from '@/features/today';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { ExerciseCard } from '@/ui/components/ExerciseCard';
import { PlanRibbon } from '@/ui/components/PlanRibbon';
import { ProgressMeter } from '@/ui/components/ProgressMeter';
import { StatusChip } from '@/ui/components/StatusChip';
import { WeekStrip } from '@/ui/components/WeekStrip';
import { formatDay, spokenDay } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Today (FR-7, DESIGN §7.2): one main card, chosen by `todayCard` in src/core, under the plan
// ribbon and progress meter. Banners (reviews, backups), missed workouts and the ⋯ menu arrive
// with the slices that build them; "Start workout" is enabled by Slice 6.
export default function TodayScreen() {
  const c = useColors();
  const type = useTypography();
  const view = useToday();

  if (view.status === 'loading') return null;
  if (view.status === 'failed') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="alert" style={[type.body, styles.padded, { color: c.ink }]}>
          Couldn&apos;t load today&apos;s workout. Close the app and open it again.
        </Text>
      </SafeAreaView>
    );
  }

  const { card, plan, unit } = view;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          Today
        </Text>
        {plan && <PlanSummary plan={plan} />}
        {card.kind === 'no_plan' ? (
          <NoPlan />
        ) : (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <MainCard card={card} unit={unit} />
            {plan && <WeekStrip days={plan.week} />}
          </View>
        )}
      </ScrollView>
      {card.kind === 'workout' && (
        <BottomBar>
          <Button label="Start workout" disabled onPress={() => {}} />
        </BottomBar>
      )}
    </SafeAreaView>
  );
}

function PlanSummary({ plan }: { plan: TodayPlanView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.summary}>
      <PlanRibbon phases={plan.ribbon} currentWeek={plan.currentWeek} />
      <Text style={[type.label, { color: c.ink }]}>{plan.header}</Text>
      <ProgressMeter progress={plan.progress} />
    </View>
  );
}

function MainCard({
  card,
  unit,
}: {
  card: Exclude<TodayCardView, { kind: 'no_plan' }>;
  unit: 'kg' | 'lb';
}) {
  const c = useColors();
  const type = useTypography();

  if (card.kind === 'rest') {
    return (
      <View style={styles.cardBody}>
        <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
          Rest day
        </Text>
        {card.next ? (
          <Text
            accessibilityLabel={`Next: ${card.next.name}, ${spokenDay(card.next.date)}`}
            style={[type.body, { color: c.inkMuted }]}
          >
            Next: {card.next.name}, {formatDay(card.next.date)}
          </Text>
        ) : (
          <Text style={[type.body, { color: c.inkMuted }]}>No more workouts in this plan.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.cardBody}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[type.title, styles.title, { color: c.ink }]}>
          {card.name}
        </Text>
        {card.kind === 'workout' && (
          <Text
            accessibilityLabel={`About ${card.durationMin} minutes`}
            style={[type.label, { color: c.inkMuted }]}
          >
            ~{card.durationMin} min
          </Text>
        )}
        {card.kind === 'completed' && <StatusChip status="completed" />}
        {card.kind === 'in_progress' && <StatusChip status="in_progress" />}
      </View>
      {card.rows.map((row) => (
        <ExerciseCard
          key={row.exerciseId}
          name={row.name}
          sets={row.sets}
          target={row.target}
          load={row.load ? { ...row.load, unit } : undefined}
          rpe={row.rpe}
          topSet={row.topSet}
          inSuperset={row.inSuperset}
        />
      ))}
    </View>
  );
}

function NoPlan() {
  const sample = useSamplePlan();
  return (
    <View>
      <EmptyState
        message="No plan yet. Pick a ready-made plan or build your own."
        actions={[
          // Slice 5 builds the Plans tab and Slice 12 the builder; both start from Plans.
          { label: 'Browse templates', onPress: () => router.push('/plans') },
          { label: 'Build a plan', onPress: () => router.push('/plans') },
        ]}
      />
      {__DEV__ && (
        <Button
          label="Load sample plan (dev)"
          variant="ghost"
          disabled={sample.loading}
          onPress={() => void sample.load()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  summary: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  cardBody: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { flexGrow: 1, flexShrink: 1 },
});
