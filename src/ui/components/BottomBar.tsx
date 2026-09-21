// BottomBar (DESIGN §6.1, §6.5): a screen's one or two main actions, fixed in the thumb zone.
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../theme';
import { spacing } from '../tokens';

export function BottomBar({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.line }]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.cardGap,
    paddingBottom: spacing.cardGap,
    gap: spacing.sm,
  },
});
