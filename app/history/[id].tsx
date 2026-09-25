import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Unit } from '@/core';
import { secondsBetween } from '@/features/device';
import {
  useSession,
  useSessionActions,
  type SessionExerciseView,
  type SessionSetView,
  type SessionView,
} from '@/features/session';
import { BackHeader } from '@/ui/components/BackHeader';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { ConfirmSheet } from '@/ui/components/ConfirmSheet';
import { PrList } from '@/ui/components/PrList';
import { formatDay, formatVolume, spokenDay } from '@/ui/format';
import { loadText, repsText, spokenSet } from '@/ui/setText';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Session detail (FR-11.3, DESIGN §7.12): every set (warm-ups muted, failed sets struck through
// and labelled "Failed"), the notes, effort and PRs. Edit reopens the logging screen without a
// timer; Delete recalculates the PRs (FR-9.12, FR-10.5).
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useSession(id);
  const c = useColors();
  const type = useTypography();

  if (view.status === 'loading') return null;
  const session = view.status === 'ready' ? view.session : null;
  if (!session || session.status !== 'completed') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <BackHeader title="Workout" />
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            {view.status === 'failed'
              ? 'Couldn’t load this workout. Close the app and open it again.'
              : 'This workout is no longer in your history.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return <Detail session={session} />;
}

function Detail({ session }: { session: SessionView }) {
  const c = useColors();
  const type = useTypography();
  const actions = useSessionActions(session.id);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const minutes = Math.round(secondsBetween(session.startedAt, session.endedAt!) / 60);
  const volume = formatVolume(session.volumeKg, session.unit);
  const sets = `${session.setsCompleted} ${session.setsCompleted === 1 ? 'set' : 'sets'}`;

  const remove = async () => {
    setConfirming(false);
    const result = await actions.remove();
    if (result.ok) router.back();
    else setMessage(result.message);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title={session.name} />
        <Text
          accessibilityLabel={`${spokenDay(session.localDate)}, ${minutes} minutes`}
          style={[type.body, { color: c.inkMuted }]}
        >
          {formatDay(session.localDate)} · {minutes} min
        </Text>
        {message && (
          <Text accessibilityRole="alert" style={[type.body, { color: c.plateRedText }]}>
            {message}
          </Text>
        )}
        <View
          accessible
          accessibilityLabel={`${sets}, ${volume.spoken} lifted`}
          style={[styles.figures, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text style={[type.scoreboard, { color: c.ink }]}>{sets}</Text>
          <Text style={[type.scoreboard, { color: c.ink }]}>{volume.shown}</Text>
        </View>
        <PrList prs={session.prs} unit={session.unit} />
        {session.exercises.map((exercise) => (
          <ExerciseSets key={exercise.id} exercise={exercise} unit={session.unit} />
        ))}
        {session.rpe !== null && (
          <Text style={[type.body, { color: c.ink }]}>How hard it was: {session.rpe} of 10</Text>
        )}
        {session.notes && <Text style={[type.body, { color: c.ink }]}>Note: {session.notes}</Text>}
      </ScrollView>
      <BottomBar>
        <Button
          label="Edit workout"
          variant="secondary"
          onPress={() => router.push(`/session/${session.id}?edit=1`)}
        />
        <Button label="Delete workout" variant="ghost" onPress={() => setConfirming(true)} />
      </BottomBar>
      <ConfirmSheet
        visible={confirming}
        title="Delete this workout?"
        message="Its sets are deleted, and PRs from this workout will be recalculated. A planned workout goes back into your plan."
        confirmLabel="Delete workout"
        cancelLabel="Keep workout"
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </SafeAreaView>
  );
}

function ExerciseSets({ exercise, unit }: { exercise: SessionExerciseView; unit: Unit }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
        {exercise.name}
      </Text>
      {exercise.sets.map((set) => (
        <SetLine key={set.id} set={set} exercise={exercise} unit={unit} />
      ))}
      {exercise.notes && (
        <Text style={[type.caption, { color: c.inkMuted }]}>Note: {exercise.notes}</Text>
      )}
    </View>
  );
}

function SetLine({
  set,
  exercise,
  unit,
}: {
  set: SessionSetView;
  exercise: SessionExerciseView;
  unit: Unit;
}) {
  const c = useColors();
  const type = useTypography();
  const failed = set.status === 'failed';
  const tone = { color: set.isWarmup || set.status === 'pending' ? c.inkMuted : c.ink };
  const struck = failed ? styles.struck : null;
  const load = loadText(set, exercise.exercise, unit);
  const reps = repsText(set, exercise.exercise);
  const label = set.isWarmup ? 'W' : set.isTopSet ? 'TOP' : String(set.number);
  const status = failed
    ? 'Failed'
    : set.status === 'pending'
      ? 'Not done'
      : set.rpe !== null
        ? `RPE ${set.rpe}`
        : '✓';
  return (
    <View
      accessible
      accessibilityLabel={spokenSet({
        number: set.number,
        set,
        exercise: exercise.exercise,
        unit,
        name: exercise.name,
      })}
      style={styles.setLine}
    >
      <Text style={[type.label, styles.setLabel, tone]}>{label}</Text>
      {load && <Text style={[type.body, styles.cell, tone, struck]}>{load.shown}</Text>}
      {reps && <Text style={[type.body, styles.cell, tone, struck]}>{reps.shown}</Text>}
      <Text style={[type.label, { color: failed ? c.ink : c.inkMuted }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.xs },
  setLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  setLabel: { minWidth: 40 },
  cell: { minWidth: 72 },
  struck: { textDecorationLine: 'line-through' },
});
