// EmptyState (DESIGN §6.5, §6.6): one sentence, plus the action that fixes it. The first action
// is primary; any others are secondary.
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export interface EmptyStateProps {
  message: string;
  actions: readonly { label: string; onPress: () => void }[];
}

export function EmptyState({ message, actions }: EmptyStateProps) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.container}>
      <Text style={[type.body, styles.message, { color: c.ink }]}>{message}</Text>
      {actions.map((action, i) => (
        <Button
          key={action.label}
          label={action.label}
          onPress={action.onPress}
          variant={i === 0 ? 'primary' : 'secondary'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.cardGap },
  message: { textAlign: 'center' },
});
