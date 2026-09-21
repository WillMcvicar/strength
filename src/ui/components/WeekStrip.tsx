// WeekStrip (DESIGN §6.5, §7.2): seven day cells, a letter over a status symbol. The caller orders
// the days from the week-start setting (FR-8.1). Each cell is read as "Wednesday 16, today".
import { StyleSheet, Text, View } from 'react-native';

import { weekday, type LocalDate } from '@/core';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';
import { STATUS_LOOK, type ChipStatus } from './StatusChip';

export type DayStatus = ChipStatus | 'rest';

export interface WeekStripProps {
  days: readonly { date: LocalDate; status: DayStatus }[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeekStrip({ days }: WeekStripProps) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.strip}>
      {days.map(({ date, status }) => {
        const name = DAY_NAMES[weekday(date)] as string;
        const look = status === 'rest' ? null : STATUS_LOOK[status];
        const spoken = look
          ? status === 'completed'
            ? 'done'
            : look.label.toLowerCase()
          : 'rest day';
        const tone = { color: look ? c[look.color] : c.inkMuted };
        return (
          <View
            key={date}
            testID="week-strip-day"
            accessible
            accessibilityLabel={`${name} ${Number(date.slice(8))}, ${spoken}`}
            style={styles.day}
          >
            <Text style={[type.label, { color: c.inkMuted }]}>{name[0]}</Text>
            <Text style={[type.title, tone]}>{look ? look.icon : '·'}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: spacing.xs },
});
