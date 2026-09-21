// ProgressMeter (DESIGN §6.5, FR-8.3): "Week 9 of 13", a sessions bar, and adherence. The values
// come from `progress()` in src/core; this only formats them.
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing } from '../tokens';
import { useTypography } from '../typography';

export interface ProgressMeterProps {
  progress: {
    currentWeek: number;
    totalWeeks: number;
    /** 0–1. */
    pctSessions: number;
    /** 0–1, or null before anything could be missed. */
    adherence: number | null;
    completed?: number;
    total?: number;
  };
  variant?: 'compact' | 'full';
}

const pct = (fraction: number) => Math.round(fraction * 100);

export function ProgressMeter({ progress, variant = 'compact' }: ProgressMeterProps) {
  const c = useColors();
  const type = useTypography();
  const { currentWeek, totalWeeks, pctSessions, adherence, completed, total } = progress;
  const week = `Week ${currentWeek} of ${totalWeeks}`;
  const sessions = pct(pctSessions);
  const line = adherence === null ? `${sessions}%` : `${sessions}% · adherence ${pct(adherence)}%`;
  const spoken = [
    `${week}.`,
    `${sessions}% of workouts done.`,
    ...(adherence === null ? [] : [`Adherence ${pct(adherence)}%.`]),
  ].join(' ');

  return (
    <View style={styles.meter}>
      <Text style={[type.label, { color: c.ink }]}>{week}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={spoken}
        accessibilityValue={{ min: 0, max: 100, now: sessions }}
        style={[styles.track, { backgroundColor: c.surfaceSunk, borderColor: c.line }]}
      >
        <View style={[styles.fill, { width: `${sessions}%`, backgroundColor: c.plateBlue }]} />
      </View>
      <Text style={[type.caption, { color: c.inkMuted }]}>{line}</Text>
      {variant === 'full' && completed !== undefined && total !== undefined && (
        <Text style={[type.caption, { color: c.inkMuted }]}>
          {completed} of {total} workouts done
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { gap: spacing.xs },
  track: { height: 8, borderRadius: radius.chip, borderWidth: 1, overflow: 'hidden' },
  fill: { height: '100%' },
});
