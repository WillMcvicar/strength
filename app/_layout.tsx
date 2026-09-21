import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { DatabaseProvider, useOpenDatabase } from '@/features/database';
import { fontSources } from '@/ui/fonts';
import { useColors } from '@/ui/theme';
import { spacing, typography } from '@/ui/tokens';

// DESIGN §4.6, §7.1: open, migrate and seed before any screen renders, and load the §6.3 fonts.
// Slice 4 (docs/BUILD_PLAN.md) adds the disclaimer gate (FR-5); Slice 14 adds the "Export raw
// database" option to the failure screen (§4.6).
export default function RootLayout() {
  const database = useOpenDatabase();
  const [fontsLoaded, fontError] = useFonts(fontSources);

  // A font that fails to load falls back to the system font; it never blocks the app.
  if (database.status === 'opening' || (!fontsLoaded && !fontError)) return null;
  if (database.status === 'failed') return <DatabaseFailed message={database.error.message} />;

  return (
    <DatabaseProvider value={database.db}>
      <Stack />
    </DatabaseProvider>
  );
}

/** Blocking error: the app never deletes data to recover (DESIGN §4.6). */
function DatabaseFailed({ message }: { message: string }) {
  const c = useColors();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={[typography.display, { color: c.ink }]}>
        Your data couldn&apos;t be opened
      </Text>
      <Text accessibilityRole="alert" style={[typography.body, { color: c.ink }]}>
        Nothing has been deleted. Close the app and open it again. If this keeps happening, contact
        support with the details below.
      </Text>
      <Text selectable style={[typography.caption, { color: c.inkMuted }]}>
        {message}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
});
