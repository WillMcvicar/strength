// The health and safety disclaimer (FR-5.1): shown at first launch, and readable again later under
// Settings → About (FR-5.3), so the wording lives in one place.
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';

export const DISCLAIMER_TITLE = 'Before you start';

export const DISCLAIMER_POINTS = [
  "This app gives general training information. It isn't medical advice.",
  'Talk to a doctor or another qualified professional before starting a new program, especially if you have an injury or a health condition.',
  'You train at your own risk.',
  'If you feel pain, dizziness or unwell, stop and get help.',
] as const;

export function DisclaimerText() {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
        {DISCLAIMER_TITLE}
      </Text>
      {DISCLAIMER_POINTS.map((point) => (
        <Text key={point} style={[type.body, { color: c.ink }]}>
          {point}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: spacing.md } });
