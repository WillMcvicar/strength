import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResetAppData } from '@/features/devTools';
import { lateBySec, useRestTimerSpike } from '@/features/restTimerSpike';
import { Button } from '@/ui/components/Button';
import { Placeholder } from '@/ui/components/Placeholder';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// More (DESIGN §7.1). History, the Skill Library and Settings arrive in Slices 7, 13 and 14; until
// then this is a placeholder with the development tools that make testing the launch flow bearable.
export default function MoreScreen() {
  const c = useColors();
  if (!__DEV__) return <Placeholder title="More" />;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Placeholder title="More" />
        <DevTools />
        <RestTimerSpike />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Only rendered when `__DEV__` is true, which includes Expo Go but never a release build. */
function DevTools() {
  const c = useColors();
  const type = useTypography();
  const { reset, resetting } = useResetAppData();

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
        Development
      </Text>
      <Text style={[type.body, { color: c.ink }]}>
        Reset app data clears your plans, sessions and settings, then puts the disclaimer and
        onboarding back so first launch runs again. Built-in exercises and templates stay.
      </Text>
      <Button
        label="Reset app data (dev)"
        variant="secondary"
        disabled={resetting}
        onPress={() => void reset()}
      />
    </View>
  );
}

/**
 * DESIGN §2.6 spike: schedule a rest-timer notification, lock the phone, and come back after it
 * fires. The card then shows how late the OS delivered it.
 */
function RestTimerSpike() {
  const c = useColors();
  const type = useTypography();
  const { runs, error, schedule, clear } = useRestTimerSpike();

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
        Rest timer spike
      </Text>
      <Text style={[type.body, { color: c.ink }]}>
        Schedule a notification, lock the phone straight away, and unlock it after the notification
        arrives. Open this tab again to see how late it was.
      </Text>
      {[60, 120, 180].map((sec) => (
        <Button
          key={sec}
          label={`Notify in ${sec} s`}
          variant="secondary"
          onPress={() => void schedule(sec)}
        />
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
          {error}
        </Text>
      ) : null}
      {runs.map((run) => {
        const late = lateBySec(run);
        return (
          <Text key={run.id} style={[type.body, { color: c.ink }]}>
            {run.delaySec} s, due {run.dueAt.slice(11, 19)} UTC:{' '}
            {late === null ? 'not delivered yet' : `${late.toFixed(1)} s late`}
          </Text>
        );
      })}
      {runs.length > 0 ? <Button label="Clear runs" variant="secondary" onPress={clear} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
});
