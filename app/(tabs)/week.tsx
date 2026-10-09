import { router } from 'expo-router';
import { useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWeek, type WeekScreenView, type WeekWorkoutView } from '@/features/week';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { STATUS_LOOK, StatusChip } from '@/ui/components/StatusChip';
import { formatDayOfMonth, formatWeekRange, spokenDay, spokenWeekRange } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Week (FR-8.1, FR-8.2, D-7, DESIGN §7.3): the calendar week from the week-start setting, with each
// day's workouts and statuses. ‹ › or a swipe changes week; tapping the dates comes back to this
// one. A workout opens Workout detail; the footer opens the plan overview (FR-8.4).

/** How far a horizontal swipe must travel to change week (dp). */
const SWIPE = 48;

export default function WeekScreen() {
  const c = useColors();
  const type = useTypography();
  const [offset, setOffset] = useState(0);
  const view = useWeek(offset);
  // Created once; it only calls the state setter, so it never reads stale state.
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
      // Once a swipe is under way, the scroll view can't take it over and swallow the release.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE) setOffset((o) => o + 1);
        else if (g.dx >= SWIPE) setOffset((o) => o - 1);
      },
    }),
  );

  // The week last read stays on screen while the next one loads, so stepping doesn't blank the
  // screen or drop screen-reader focus from ‹ ›. Undefined until the first read.
  const [shown, setShown] = useState<WeekScreenView | null | undefined>(undefined);
  if (view.status === 'ready' && view.week !== shown) setShown(view.week);

  if (view.status === 'loading' && shown === undefined) return null;
  if (view.status === 'failed') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="alert" style={[type.body, styles.padded, { color: c.ink }]}>
          Couldn&apos;t load this week. Close the app and open it again.
        </Text>
      </SafeAreaView>
    );
  }

  const week = view.status === 'ready' ? view.week : (shown ?? null);
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          Week
        </Text>
        {week ? (
          <>
            <WeekHeader
              week={week}
              onPrevious={() => setOffset((o) => o - 1)}
              onNext={() => setOffset((o) => o + 1)}
              onThisWeek={() => setOffset(0)}
            />
            <View
              {...swipe.panHandlers}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
            >
              {week.days.map((day, i) => (
                <View
                  key={day.date}
                  style={[styles.day, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
                >
                  {/* Each row below reads its own date, so this one stays silent. */}
                  <Text
                    importantForAccessibility="no"
                    accessibilityElementsHidden
                    style={[type.label, styles.date, { color: c.inkMuted }]}
                  >
                    {formatDayOfMonth(day.date)}
                  </Text>
                  <View style={styles.workouts}>
                    {day.workouts.length === 0 ? (
                      <Text
                        accessibilityLabel={`${spokenDay(day.date)}, rest`}
                        style={[type.body, styles.rest, { color: c.inkMuted }]}
                      >
                        Rest
                      </Text>
                    ) : (
                      day.workouts.map((w) => (
                        <WorkoutRow key={w.workoutId} date={day.date} workout={w} />
                      ))
                    )}
                  </View>
                </View>
              ))}
            </View>
            {week.footer && <Text style={[type.label, { color: c.ink }]}>{week.footer}</Text>}
            <Button
              label="View whole plan"
              variant="secondary"
              onPress={() => router.push(`/plan/${week.planId}/overview`)}
            />
          </>
        ) : (
          <EmptyState
            message="No plan yet. Pick a ready-made plan to see your weeks here."
            actions={[{ label: 'Browse templates', onPress: () => router.push('/plans') }]}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekHeader({
  week,
  onPrevious,
  onNext,
  onThisWeek,
}: {
  week: WeekScreenView;
  onPrevious: () => void;
  onNext: () => void;
  onThisWeek: () => void;
}) {
  const c = useColors();
  const type = useTypography();
  const { start, end } = week.range;
  const spoken = spokenWeekRange(start, end);
  return (
    <View style={styles.header}>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={onPrevious}
          style={styles.arrow}
        >
          <Text style={[type.title, { color: c.plateBlue }]}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={week.isThisWeek ? `${spoken}, this week` : spoken}
          accessibilityHint={week.isThisWeek ? undefined : 'Goes back to this week'}
          disabled={week.isThisWeek}
          onPress={onThisWeek}
          style={styles.range}
        >
          <Text style={[type.title, { color: c.ink }]}>{formatWeekRange(start, end)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          onPress={onNext}
          style={styles.arrow}
        >
          <Text style={[type.title, { color: c.plateBlue }]}>›</Text>
        </Pressable>
      </View>
      {week.header && <Text style={[type.label, { color: c.inkMuted }]}>{week.header}</Text>}
    </View>
  );
}

function WorkoutRow({ date, workout }: { date: string; workout: WeekWorkoutView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spokenDay(date)}, ${workout.name}, ${STATUS_LOOK[workout.status].label}`}
      accessibilityHint="Opens the workout"
      onPress={() => router.push(`/workout/${workout.workoutId}`)}
      style={styles.workout}
    >
      <Text style={[type.body, styles.name, { color: c.ink }]}>{workout.name}</Text>
      <StatusChip status={workout.status} />
      <Text importantForAccessibility="no" style={[type.title, { color: c.inkMuted }]}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  header: { gap: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  arrow: {
    minWidth: touch.min,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  range: { flex: 1, minHeight: touch.min, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: radius.card, paddingHorizontal: spacing.card },
  day: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  date: { minWidth: 64 },
  workouts: { flex: 1, minWidth: 160 },
  rest: { paddingVertical: spacing.cardGap },
  workout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.min,
    paddingVertical: spacing.xs,
  },
  name: { flexGrow: 1, flexShrink: 1 },
});
