// PrList (FR-10.2, DESIGN §7.7): "★ 2 new PRs", then one row per record, and the skills logged
// for the first time named under "First log" rather than celebrated (C-7). Each row is read as
// one phrase (§7.17). Renders nothing when the session set neither.
import { StyleSheet, Text, View } from 'react-native';

import type { Unit } from '@/core';
import type { SessionPrsView } from '@/features/prs';

import { prText } from '../prText';
import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';

export function PrList({ prs, unit }: { prs: SessionPrsView; unit: Unit }) {
  const c = useColors();
  const type = useTypography();
  if (prs.prs.length === 0 && prs.firstLog.length === 0) return null;
  const count = prs.prs.length;

  return (
    <View style={styles.list}>
      {count > 0 && (
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${count} new ${count === 1 ? 'PR' : 'PRs'}`}
          style={[type.title, { color: c.ink }]}
        >
          <Text style={{ color: c.plateYellowText }}>★ </Text>
          {count} new {count === 1 ? 'PR' : 'PRs'}
        </Text>
      )}
      {prs.prs.map((pr) => {
        const text = prText(pr, unit);
        return (
          <View key={pr.id} accessible accessibilityLabel={text.spoken} style={styles.row}>
            <Text style={[type.body, styles.name, { color: c.ink }]}>{pr.skillName}</Text>
            <Text style={[type.body, { color: c.inkMuted }]}>{text.label}</Text>
            <Text style={[type.label, { color: c.ink }]}>{text.value}</Text>
          </View>
        );
      })}
      {prs.firstLog.length > 0 && (
        <Text style={[type.body, { color: c.inkMuted }]}>First log: {prs.firstLog.join(', ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  name: { flexGrow: 1, flexShrink: 1 },
});
