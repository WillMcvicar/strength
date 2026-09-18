import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { DatabaseProvider, useOpenDatabase } from '@/features/database';

// DESIGN §4.6, §7.1: open, migrate and seed before any screen renders. Build-plan step 7 adds
// the design tokens, the disclaimer gate (FR-5) and the "Export raw database" option to the
// failure screen.
export default function RootLayout() {
  const database = useOpenDatabase();

  if (database.status === 'opening') return null;
  if (database.status === 'failed') return <DatabaseFailed message={database.error.message} />;

  return (
    <DatabaseProvider value={database.db}>
      <Stack />
    </DatabaseProvider>
  );
}

/** Blocking error: the app never deletes data to recover (DESIGN §4.6). */
function DatabaseFailed({ message }: { message: string }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Your data couldn&apos;t be opened
      </Text>
      <Text accessibilityRole="alert">
        Nothing has been deleted. Close the app and open it again. If this keeps happening, contact
        support with the details below.
      </Text>
      <Text selectable>{message}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '600' },
});
