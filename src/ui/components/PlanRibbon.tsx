// PlanRibbon (DESIGN §6.1, §6.5): the program as phase-coloured segments sized by weeks, a tick per
// week and a "you are here" marker. Its text alternative is "Phase 3 of 5, Strength, week 9 of 17"
// (§7.17). Tapping it opens Plan Detail.
import { Pressable, StyleSheet, View } from 'react-native';

import type { PhaseType } from '@/core';

import { useColors } from '../theme';
import { touch, type ColorTokens } from '../tokens';

export interface RibbonPhase {
  name: string;
  type: PhaseType;
  weeks: number;
}

export interface PlanRibbonProps {
  phases: readonly RibbonPhase[];
  /** 1-based plan week, or null before the plan starts. */
  currentWeek: number | null;
  onPress?: () => void;
}

const FILL: Record<PhaseType, keyof ColorTokens> = {
  training: 'plateBlue',
  deload: 'plateGreen',
  taper: 'plateYellow',
};

function ribbonLabel(phases: readonly RibbonPhase[], currentWeek: number | null): string {
  const totalWeeks = phases.reduce((sum, p) => sum + p.weeks, 0);
  let end = 0;
  const index = phases.findIndex((p) => currentWeek !== null && currentWeek <= (end += p.weeks));
  const phase = phases[index];
  if (currentWeek === null || !phase) return `${phases.length} phases, ${totalWeeks} weeks`;
  return `Phase ${index + 1} of ${phases.length}, ${phase.name}, week ${currentWeek} of ${totalWeeks}`;
}

/** §6.2: consecutive training phases alternate full and 70% tint, so the boundary still shows. */
function tints(phases: readonly RibbonPhase[]): number[] {
  const out: number[] = [];
  phases.forEach((p, i) => {
    const prev = phases[i - 1];
    const alternate = p.type === 'training' && prev?.type === 'training' && out[i - 1] === 1;
    out.push(alternate ? 0.7 : 1);
  });
  return out;
}

export function PlanRibbon({ phases, currentWeek, onPress }: PlanRibbonProps) {
  const c = useColors();
  const label = ribbonLabel(phases, currentWeek);
  const totalWeeks = phases.reduce((sum, p) => sum + p.weeks, 0);
  const opacity = tints(phases);

  const strip = (
    <View style={styles.strip}>
      {phases.map((p, i) => (
        <View
          key={i}
          testID="ribbon-segment"
          style={[
            styles.segment,
            { flexGrow: p.weeks, backgroundColor: c[FILL[p.type]], opacity: opacity[i] },
          ]}
        >
          {Array.from({ length: p.weeks - 1 }, (_, w) => (
            <View
              key={w}
              style={[
                styles.tick,
                { left: `${((w + 1) / p.weeks) * 100}%`, backgroundColor: c.surface },
              ]}
            />
          ))}
        </View>
      ))}
      {currentWeek !== null && (
        <View
          testID="ribbon-marker"
          style={[
            styles.marker,
            {
              left: `${((currentWeek - 0.5) / totalWeeks) * 100}%`,
              backgroundColor: c.ink,
              borderColor: c.surface,
            },
          ]}
        />
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={styles.container}>
        {strip}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the plan"
      onPress={onPress}
      style={[styles.container, styles.pressable]}
    >
      {strip}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  pressable: { minHeight: touch.min },
  strip: { flexDirection: 'row', height: 14, gap: 2 },
  segment: { flexBasis: 0, borderRadius: 2, overflow: 'hidden' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  marker: {
    position: 'absolute',
    top: -4,
    width: 6,
    height: 22,
    marginLeft: -3,
    borderRadius: 3,
    borderWidth: 1,
  },
});
