import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { DatabaseProvider, useOpenDatabase } from '@/features/database';
import { useDisclaimer } from '@/features/disclaimer';
import { fontSources } from '@/ui/fonts';
import { useColors } from '@/ui/theme';
import { spacing } from '@/ui/tokens';
import { FontsLoadedProvider, useTypography } from '@/ui/typography';

// DESIGN §4.6, §7.1: open, migrate and seed before any screen renders, and load the §6.3 fonts.
// Then the launch rules: the disclaimer until it is acknowledged (FR-5), then the tabs. Slice 14
// adds the "Export raw database" option to the failure screen (§4.6).
export default function RootLayout() {
  const database = useOpenDatabase();
  const [fontsLoaded, fontError] = useFonts(fontSources);

  if (database.status === 'opening' || (!fontsLoaded && !fontError)) return null;

  // Fonts that fail to load fall back to the system font; they never block the app.
  return (
    <FontsLoadedProvider value={fontsLoaded}>
      {database.status === 'failed' ? (
        <DatabaseFailed message={database.error.message} />
      ) : (
        <DatabaseProvider value={database.db}>
          <AppStack />
        </DatabaseProvider>
      )}
    </FontsLoadedProvider>
  );
}

/** §7.1 launch rules. Each screen exists only while its guard holds, so there is no way back. */
function AppStack() {
  const disclaimer = useDisclaimer();
  if (disclaimer.status === 'loading') return null;
  if (disclaimer.status === 'failed') {
    return <DatabaseFailed message={disclaimer.error?.message ?? 'Unknown error'} />;
  }
  const acknowledged = disclaimer.status === 'acknowledged';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!acknowledged}>
        <Stack.Screen name="disclaimer" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={acknowledged}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

/** Blocking error: the app never deletes data to recover (DESIGN §4.6). */
function DatabaseFailed({ message }: { message: string }) {
  const c = useColors();
  const typography = useTypography();
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
