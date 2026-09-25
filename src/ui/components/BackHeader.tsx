// BackHeader (DESIGN §7.1, §7.17): a pushed screen's title with a labelled Back control, since
// the stack hides the native header. The control is 48 dp and says where it goes.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export function BackHeader({ title, backLabel = 'Back' }: { title: string; backLabel?: string }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={[type.label, { color: c.plateBlue }]}>‹ {backLabel}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  back: { minHeight: touch.min, minWidth: touch.min, justifyContent: 'center' },
});
