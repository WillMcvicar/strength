// Banner (DESIGN §6.5, §7.2): colour + icon + message + action. At most two stack above Today's
// card: a pending review ("attention", yellow), then the backup reminder ("info").
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export interface BannerProps {
  tone: 'attention' | 'info';
  icon: string;
  message: string;
  action: { label: string; onPress: () => void };
}

export function Banner({ tone, icon, message, action }: BannerProps) {
  const c = useColors();
  const type = useTypography();
  const look =
    tone === 'attention'
      ? {
          fill: c.plateYellow,
          border: c.plateYellow,
          text: c.onPlateYellow,
          accent: c.onPlateYellow,
        }
      : { fill: c.surface, border: c.line, text: c.ink, accent: c.plateBlue };

  return (
    <View
      testID="banner"
      style={[styles.banner, { backgroundColor: look.fill, borderColor: look.border }]}
    >
      <Text
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[type.title, { color: look.accent }]}
      >
        {icon}
      </Text>
      <Text style={[type.body, styles.message, { color: look.text }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={action.onPress}
        style={styles.action}
      >
        <Text style={[type.label, { color: look.accent }]}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.card,
    paddingRight: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  message: { flex: 1, minWidth: 120 },
  action: {
    minHeight: touch.min,
    minWidth: touch.min,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
