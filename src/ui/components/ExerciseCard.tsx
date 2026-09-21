// ExerciseCard (DESIGN §6.5, §7.2): an exercise in a list, "Squat  5 × 5  90 kg". It is read as
// one element, e.g. "Squat, 5 sets of 5 reps, 90 kilograms". A superset shows a bracket.
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
  inSuperset?: boolean;
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

export function ExerciseCard({ name, sets, target, load, inSuperset = false }: ExerciseCardProps) {
  const c = useColors();
  const type = useTypography();
  const shown = target ? `${sets} × ${prescription(target).shown}` : null;
  const summary = [
    `${inSuperset ? 'Superset: ' : ''}${name}`,
    ...(target ? [`${count(sets, 'set', 'sets')} of ${prescription(target).spoken}`] : []),
    ...(load ? [spokenLoad(load.kg, load.unit, load.perSide, load.added)] : []),
  ].join(', ');

  return (
    <View
      accessible
      accessibilityLabel={summary}
      style={[styles.row, inSuperset && [styles.superset, { borderLeftColor: c.plateBlue }]]}
    >
      <Text style={[type.body, styles.name, { color: c.ink }]}>{name}</Text>
      {shown && <Text style={[type.body, { color: c.inkMuted }]}>{shown}</Text>}
      {load && <LoadText {...load} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps rather than truncating at 200% text (§6.3).
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  name: { flexGrow: 1, flexShrink: 1, minWidth: '40%' },
  superset: { borderLeftWidth: 3, paddingLeft: spacing.sm },
});
