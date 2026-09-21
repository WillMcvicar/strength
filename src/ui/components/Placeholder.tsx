// A tab whose screen a later build-plan slice builds. Development builds only: no release ships
// with one (docs/BUILD_PLAN.md, Slice 15).
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';

export function Placeholder({ title }: { title: string }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
        {title}
      </Text>
      <Text style={[type.body, { color: c.inkMuted }]}>Not built yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
