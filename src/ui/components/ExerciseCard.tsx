// ExerciseCard (DESIGN §6.5, §7.2): an exercise in a list, "Squat  5 × 5  90 kg", with its target
// RPE on a second line (D-36). It is read as one element, e.g. "Squat, 5 sets of 5 reps, at RPE 7
// to 8, 90 kilograms". A superset shows a bracket.
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { useTypography } from '../typography';
import { LoadText, spokenLoad, type LoadTextProps } from './LoadText';

export type SetTarget =
  { reps: readonly [number] | readonly [number, number] } | { seconds: number };

export interface ExerciseCardProps {
  name: string;
  sets: number;
  /** null for an exercise with no reps or time, e.g. completion only. */
  target: SetTarget | null;
  load?: LoadTextProps;
  /** The target RPE, if the set has one (D-36). */
  rpe?: { min: number; max: number } | null;
  /** A top set reads "Work up to 1–3 @ RPE 8" (D-19, D-36). */
  topSet?: boolean;
  inSuperset?: boolean;
}

export function targetEffort(
  rpe: { min: number; max: number },
  target: SetTarget | null,
  topSet: boolean,
): { shown: string; spoken: string } {
  const shownRpe = rpe.min === rpe.max ? `${rpe.min}` : `${rpe.min}–${rpe.max}`;
  const spokenRpe = rpe.min === rpe.max ? `${rpe.min}` : `${rpe.min} to ${rpe.max}`;
  if (topSet && target) {
    const { shown, spoken } = prescription(target);
    return {
      shown: `Work up to ${shown} @ RPE ${shownRpe}`,
      spoken: `work up to ${spoken} at RPE ${spokenRpe}`,
    };
  }
  return { shown: `@ RPE ${shownRpe}`, spoken: `at RPE ${spokenRpe}` };
}

/** "1 rep", "5 reps": the spoken summary follows the number (§7.17). */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function prescription(target: SetTarget): { shown: string; spoken: string } {
  if ('seconds' in target) {
    return { shown: `${target.seconds} s`, spoken: count(target.seconds, 'second', 'seconds') };
  }
  const [min, max] = target.reps;
  return max === undefined
    ? { shown: `${min}`, spoken: count(min, 'rep', 'reps') }
    : { shown: `${min}–${max}`, spoken: `${min} to ${max} reps` };
}

export function ExerciseCard({
  name,
  sets,
  target,
  load,
  rpe = null,
  topSet = false,
  inSuperset = false,
}: ExerciseCardProps) {
  const c = useColors();
  const type = useTypography();
  const shown = target ? `${sets} × ${prescription(target).shown}` : null;
  const rpeLine = rpe ? targetEffort(rpe, target, topSet) : null;
  const summary = [
    `${inSuperset ? 'Superset: ' : ''}${name}`,
    ...(target ? [`${count(sets, 'set', 'sets')} of ${prescription(target).spoken}`] : []),
    ...(rpeLine ? [rpeLine.spoken] : []),
    ...(load ? [spokenLoad(load.kg, load.unit, load.perSide, load.added)] : []),
  ].join(', ');

  return (
    <View
      accessible
      accessibilityLabel={summary}
      style={[styles.card, inSuperset && [styles.superset, { borderLeftColor: c.plateBlue }]]}
    >
      <View style={styles.row}>
        <Text style={[type.body, styles.name, { color: c.ink }]}>{name}</Text>
        {shown && <Text style={[type.body, { color: c.inkMuted }]}>{shown}</Text>}
        {load && <LoadText {...load} />}
      </View>
      {rpeLine && (
        <Text style={[type.caption, { color: topSet ? c.plateBlue : c.inkMuted }]}>
          {rpeLine.shown}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs / 2 },
  // Wraps rather than truncating at 200% text (§6.3).
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  name: { flexGrow: 1, flexShrink: 1, minWidth: '40%' },
  superset: { borderLeftWidth: 3, paddingLeft: spacing.sm },
});
