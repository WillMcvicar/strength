import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStartWorkout } from '@/features/today';
import { useWorkoutDetail, type WorkoutDetailView } from '@/features/week';
import { BackHeader } from '@/ui/components/BackHeader';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { ExerciseCard } from '@/ui/components/ExerciseCard';
import { StatusChip } from '@/ui/components/StatusChip';
import { formatDay, spokenDay } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Workout detail (DESIGN §7.3): a planned workout's exercises and loads, opened from the Week tab or
// the plan overview. Today's workout starts from here (FR-9.1); one under way resumes and a
// finished one opens its session. Move, Skip and shifting arrive with Slice 10 (FR-4.5–4.7).
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useWorkoutDetail(id);
  const c = useColors();
  const type = useTypography();

  if (view.status === 'loading') return null;
  const detail = view.status === 'ready' ? view.detail : null;
  if (!detail) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <BackHeader title="Workout" backLabel="Close" />
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            {view.status === 'failed'
              ? 'Couldn’t load this workout. Close the app and open it again.'
              : 'This workout is no longer in your plan.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return <Detail detail={detail} />;
}

function Detail({ detail }: { detail: WorkoutDetailView }) {
  const c = useColors();
  const type = useTypography();
  const { start, starting } = useStartWorkout();
  const [message, setMessage] = useState<string | null>(null);

  const onStart = async () => {
    const result = await start(detail.workoutId);
    if (result.ok) router.replace(`/session/${result.sessionId}`);
    else setMessage(result.message);
  };

  const action =
    detail.status === 'in_progress' && detail.sessionId ? (
      <Button label="Resume" onPress={() => router.replace(`/session/${detail.sessionId}`)} />
    ) : detail.status === 'completed' && detail.sessionId ? (
      <Button
        label="View session"
        variant="secondary"
        onPress={() => router.replace(`/history/${detail.sessionId}`)}
      />
    ) : detail.canStart ? (
      <Button label="Start workout" disabled={starting} onPress={() => void onStart()} />
    ) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title={detail.name} backLabel="Close" />
        <View style={styles.meta}>
          <Text accessibilityLabel={spokenDay(detail.date)} style={[type.body, { color: c.ink }]}>
            {formatDay(detail.date)}
          </Text>
          <StatusChip status={detail.status} />
          {detail.rows.length > 0 && (
            <Text
              accessibilityLabel={`About ${detail.durationMin} minutes`}
              style={[type.label, { color: c.inkMuted }]}
            >
              ~{detail.durationMin} min
            </Text>
          )}
        </View>
        <Text style={[type.label, { color: c.inkMuted }]}>{detail.context}</Text>
        {message && (
          <Text accessibilityRole="alert" style={[type.body, { color: c.plateRedText }]}>
            {message}
          </Text>
        )}
        {detail.status === 'completed' && (
          <Text style={[type.body, { color: c.ink }]}>
            Done. The session shows what you lifted.
          </Text>
        )}
        {detail.rows.map((row) => (
          <ExerciseCard
            key={row.exerciseId}
            name={row.name}
            sets={row.sets}
            target={row.target}
            load={row.load ? { ...row.load, unit: detail.unit } : undefined}
            rpe={row.rpe}
            topSet={row.topSet}
            increased={row.increased}
            inSuperset={row.inSuperset}
          />
        ))}
      </ScrollView>
      {action && <BottomBar>{action}</BottomBar>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
