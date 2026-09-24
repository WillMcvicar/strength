// SetRow (DESIGN §6.5, §7.6): one set in the logging screen, a square-cornered well reading
// "1 | 90 kg | 5 | ✓". Tapping the load or reps opens NumberSheet (FR-9.3), tapping ✓ logs the
// set as planned, and a long press opens the set menu. Warm-ups are muted (FR-9.14), a top set is
// labelled "TOP" with its target underneath (FR-9.2b), and a completion-only item is one large
// checkbox (AC-37). Screen readers get the row as one element with custom actions (§7.17).
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import type { Unit } from '@/core';

import {
  loadText,
  repsText,
  spokenSet,
  spokenSetName,
  type RowExercise,
  type RowSet,
} from '../setText';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export interface SetRowProps {
  /** The working-set number; warm-ups and top sets are labelled instead. */
  number: number;
  set: RowSet;
  exercise: RowExercise;
  unit: Unit;
  /** The exercise: in labels, and beside the checkbox of a completion-only item. */
  name?: string;
  /** A top set's target, "Work up to 1–3 @ RPE 8". */
  target?: string | null;
  /** Ticked, but a required RPE hasn't been picked yet (§7.6 "Pick RPE"). */
  awaitingRpe?: boolean;
  /** The next set to do, emphasised. */
  next?: boolean;
  onDone: () => void;
  onEditLoad?: () => void;
  onEditReps?: () => void;
  onMenu?: () => void;
}

export function SetRow(props: SetRowProps) {
  const { number, set, exercise, unit, name, target, awaitingRpe = false, next = false } = props;
  const c = useColors();
  const type = useTypography();
  const done = set.status === 'completed';
  const ink = set.isWarmup ? c.inkMuted : c.ink;
  const load = loadText(set, exercise, unit);
  const reps = repsText(set, exercise);
  // "Back squat set 2", so two exercises' set 2s aren't read alike (§7.17).
  const setName = name
    ? `${name} ${spokenSetName(number, set).toLowerCase()}`
    : spokenSetName(number, set);
  const completionOnly = exercise.trackingType === 'completion_only';

  const actions = [
    ...(done ? [] : [{ name: 'markDone', label: 'Mark done' }]),
    ...(props.onEditLoad && load ? [{ name: 'editLoad', label: 'Edit load' }] : []),
    ...(props.onEditReps && reps
      ? [{ name: 'editReps', label: exercise.trackingType === 'time' ? 'Edit time' : 'Edit reps' }]
      : []),
    ...(props.onMenu ? [{ name: 'menu', label: 'More options' }] : []),
  ];
  const onAction = (e: AccessibilityActionEvent) => {
    switch (e.nativeEvent.actionName) {
      case 'markDone':
        return props.onDone();
      case 'editLoad':
        return props.onEditLoad?.();
      case 'editReps':
        return props.onEditReps?.();
      case 'menu':
        return props.onMenu?.();
    }
  };

  return (
    <View
      accessible
      accessibilityLabel={spokenSet({ number, set, exercise, unit, awaitingRpe, name })}
      accessibilityActions={actions}
      onAccessibilityAction={onAction}
    >
      <Pressable
        onLongPress={props.onMenu}
        style={[
          styles.row,
          { backgroundColor: c.surfaceSunk, borderColor: next ? c.plateBlue : c.line },
          next && styles.next,
        ]}
      >
        {completionOnly ? (
          <Text style={[type.title, styles.name, { color: ink }]}>{name ?? 'Done'}</Text>
        ) : (
          <>
            <Text
              style={[type.label, styles.label, { color: set.isTopSet ? c.plateBlue : c.inkMuted }]}
            >
              {set.isWarmup ? 'W' : set.isTopSet ? 'TOP' : String(number)}
            </Text>
            {load && (
              <Cell
                text={load.shown}
                color={ink}
                spoken={`Edit ${setName.toLowerCase()} load`}
                onPress={props.onEditLoad}
              />
            )}
            {reps && (
              <Cell
                text={reps.shown}
                color={ink}
                spoken={`Edit ${setName.toLowerCase()} ${exercise.trackingType === 'time' ? 'time' : 'reps'}`}
                onPress={props.onEditReps}
              />
            )}
          </>
        )}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={
            completionOnly ? `Mark ${name ?? 'item'} done` : `Mark ${setName.toLowerCase()} done`
          }
          accessibilityState={{ checked: done, disabled: done }}
          disabled={done}
          onPress={props.onDone}
          style={[
            styles.check,
            done
              ? { backgroundColor: c.plateGreen, borderColor: c.plateGreen }
              : { borderColor: awaitingRpe ? c.plateBlue : c.line },
          ]}
        >
          <Text style={[type.label, { color: done ? c.onPlate : c.plateBlue }]}>
            {done ? '✓' : set.status === 'failed' ? '✕' : awaitingRpe ? 'RPE?' : ''}
          </Text>
        </Pressable>
      </Pressable>
      {set.isTopSet && target ? (
        <Text style={[type.caption, styles.target, { color: c.plateBlue }]}>{target}</Text>
      ) : null}
      {set.status === 'failed' ? (
        <Text style={[type.caption, styles.target, { color: c.inkMuted }]}>Failed</Text>
      ) : null}
    </View>
  );
}

function Cell({
  text,
  color,
  spoken,
  onPress,
}: {
  text: string;
  color: string;
  spoken: string;
  onPress?: () => void;
}) {
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      disabled={!onPress}
      onPress={onPress}
      style={styles.cell}
    >
      <Text style={[type.title, { color }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.setRow,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  next: { borderLeftWidth: 4 },
  label: { minWidth: 36 },
  name: { flex: 1 },
  cell: { flex: 1, minHeight: touch.min, justifyContent: 'center' },
  check: {
    width: touch.setDone,
    height: touch.setDone,
    borderWidth: 2,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  target: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
});
