// Session summary (FR-9.8, DESIGN §7.7): duration, sets completed and total volume, then the
// effort rating and a note. PRs join it in Slice 7, and a finished cycle leads into its Cycle
// Review in Slice 11.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { secondsBetween } from '@/features/device';
import { useSession, useSessionActions } from '@/features/session';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { EffortPicker } from '@/ui/components/EffortPicker';
import { formatVolume } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

/**
 * The summary replaced the session modal, so going back reaches the Today that opened it. A new
 * Today is pushed only if there's nothing behind (e.g. opened from a notification).
 */
function backToToday() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useSession(id);
  const actions = useSessionActions(id);
  const c = useColors();
  const type = useTypography();
  const [notes, setNotes] = useState<string | null>(null);

  if (view.status === 'loading') return null;
  const session = view.status === 'ready' ? view.session : null;
  if (!session || !session.endedAt) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            Couldn’t show this workout’s summary.
          </Text>
          <Button label="Back to Today" onPress={backToToday} />
        </View>
      </SafeAreaView>
    );
  }

  const minutes = Math.round(secondsBetween(session.startedAt, session.endedAt) / 60);
  const volume = formatVolume(session.volumeKg, session.unit);
  const done = async () => {
    if (notes !== null) await actions.details({ notes });
    backToToday();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          Workout finished
        </Text>
        <Text style={[type.title, { color: c.ink }]}>
          {session.name} · {minutes} min
        </Text>
        <View
          accessible
          accessibilityLabel={`${session.setsCompleted} sets, ${volume.spoken} lifted`}
          style={[styles.figures, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text style={[type.scoreboard, { color: c.ink }]}>{session.setsCompleted} sets</Text>
          <Text style={[type.scoreboard, { color: c.ink }]}>{volume.shown}</Text>
        </View>
        <EffortPicker value={session.rpe} onPick={(rpe) => void actions.details({ rpe })} />
        <Text style={[type.label, { color: c.inkMuted }]}>Note</Text>
        <TextInput
          accessibilityLabel="Session note"
          multiline
          value={notes ?? session.notes ?? ''}
          onChangeText={setNotes}
          placeholder="How did it go?"
          placeholderTextColor={c.inkMuted}
          style={[
            type.body,
            styles.input,
            { color: c.ink, backgroundColor: c.surfaceSunk, borderColor: c.line },
          ]}
        />
      </ScrollView>
      <BottomBar>
        <Button label="Done" onPress={() => void done()} />
      </BottomBar>
    </SafeAreaView>
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
  input: {
    minHeight: touch.min * 2,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.sm,
    textAlignVertical: 'top',
  },
});
