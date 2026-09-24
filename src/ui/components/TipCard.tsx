// TipCard (DESIGN §6.5, FR-6.2): a one-time tip with its copy from content/explanations.json.
// Dismissing it is recorded, so it never shows again.
import { StyleSheet, Text, View } from 'react-native';

import { explanation, type TIP_KEYS } from '../explanations';
import { useColors } from '../theme';
import { radius, spacing } from '../tokens';
import { useTypography } from '../typography';
import { Button } from './Button';

export type TipKey = (typeof TIP_KEYS)[number];

export function TipCard({ tip, onDismiss }: { tip: TipKey; onDismiss: () => void }) {
  const c = useColors();
  const type = useTypography();
  const { title, body } = explanation(tip);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.plateBlue }]}>
      <Text accessibilityRole="header" style={[type.label, { color: c.plateBlue }]}>
        Tip: {title}
      </Text>
      <Text style={[type.body, { color: c.ink }]}>{body}</Text>
      <Button label="Got it" variant="ghost" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
});
