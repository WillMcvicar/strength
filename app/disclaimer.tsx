import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDisclaimer } from '@/features/disclaimer';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { DisclaimerText } from '@/ui/components/DisclaimerText';
import { useColors } from '@/ui/theme';
import { spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// First launch only (FR-5, DESIGN §7.15 step 1): the four FR-5.1 points and a single
// "I understand". There's no back or skip; the root stack drops this screen once acknowledged.
export default function DisclaimerScreen() {
  const c = useColors();
  const type = useTypography();
  const { acknowledge, saving, saveFailed } = useDisclaimer();
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <DisclaimerText />
      </ScrollView>
      <BottomBar>
        {saveFailed && (
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            Your answer couldn&apos;t be saved. Try again.
          </Text>
        )}
        <Button label="I understand" disabled={saving} onPress={() => void acknowledge()} />
      </BottomBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, paddingTop: spacing.xl },
});
