import { StyleSheet, Text, View } from 'react-native';

// Placeholder for the Today screen (FR-7). Build-plan step 7 (DESIGN §11).
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text>Workout Planner</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
