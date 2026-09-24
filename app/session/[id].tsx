// The workout session (FR-9, DESIGN §7.6): a full-screen modal. Each exercise lists its sets;
// ✓ logs a set as planned, the RPE picker follows where one is asked for, and the rest timer
// starts. Rules live in src/core and writes in src/services; this screen only decides which sheet
// is open.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { nextSetId, restsAfter, toDisplay, toKg } from '@/core';
import {
  secondsBetween,
  successHaptic,
  tapHaptic,
  useKeepAwakeWhile,
  useNow,
} from '@/features/device';
import {
  adjustRest,
  restRemainingSec,
  startRest,
  stopRest,
  useRestTimerStore,
} from '@/features/restTimer';
import {
  useSession,
  useSessionActions,
  type ActionResult,
  type SessionExerciseView,
  type SessionSetView,
  type SessionView,
} from '@/features/session';
import { Button } from '@/ui/components/Button';
import { ConfirmSheet } from '@/ui/components/ConfirmSheet';
import { EffortPicker } from '@/ui/components/EffortPicker';
import { InfoTip } from '@/ui/components/InfoTip';
import { MenuSheet, type MenuAction } from '@/ui/components/MenuSheet';
import { NumberSheet } from '@/ui/components/NumberSheet';
import { RestTimerBar } from '@/ui/components/RestTimerBar';
import { RpePicker } from '@/ui/components/RpePicker';
import { SetRow } from '@/ui/components/SetRow';
import { SkillPicker } from '@/ui/components/SkillPicker';
import { TextSheet } from '@/ui/components/TextSheet';
import { TipCard } from '@/ui/components/TipCard';
import { formatClock, spokenClock } from '@/ui/format';
import { spokenSetName } from '@/ui/setText';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

type Editing = { setId: string; field: 'load' | 'reps' | 'time'; thenTick?: boolean } | null;
type Sheet =
  | { kind: 'set'; setId: string }
  | { kind: 'exercise'; exerciseId: string }
  | { kind: 'close' }
  | { kind: 'discard' }
  | { kind: 'finish' }
  | { kind: 'swap'; exerciseId: string }
  | { kind: 'add' }
  | { kind: 'note'; exerciseId: string }
  | null;

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useSession(id);
  const c = useColors();
  const type = useTypography();

  if (view.status === 'loading') return null;
  if (view.status === 'failed' || !view.session || view.session.status !== 'in_progress') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            {view.status === 'failed'
              ? 'Couldn’t load this workout. Close it and open it again.'
              : 'This workout isn’t in progress any more.'}
          </Text>
          <Button label="Back to Today" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }
  return <Session session={view.session} />;
}

function Session({ session }: { session: SessionView }) {
  const c = useColors();
  const type = useTypography();
  const actions = useSessionActions(session.id);
  const now = useNow();
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const [awaitingRpe, setAwaitingRpe] = useState<ReadonlySet<string>>(new Set());
  const [optionalPicker, setOptionalPicker] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [message, setMessage] = useState<string | null>(null);
  useKeepAwakeWhile(session.keepAwake);

  const allSets = session.exercises.flatMap((e) => e.sets.map((s) => ({ exercise: e, set: s })));
  const find = (setId: string) => allSets.find((x) => x.set.id === setId);
  const next = nextSetId(session.exercises);
  const remaining = restRemainingSec(endsAt, now);
  const elapsed = secondsBetween(session.startedAt, now);

  const report = (result: ActionResult) => {
    setMessage(result.ok ? null : result.message);
    return result.ok;
  };

  const rest = (exercise: SessionExerciseView, setId: string) => {
    if (restsAfter(session.exercises, setId)) {
      void startRest(exercise.restSec, session.restTimerAlerts);
    }
  };

  /** ✓ on a set (§7.6 set row table). */
  const tick = async (exercise: SessionExerciseView, set: SessionSetView) => {
    if (set.status === 'completed') return;
    if (set.isAmrap && set.reps === null)
      return setEditing({ setId: set.id, field: 'reps', thenTick: true });
    tapHaptic();
    if (set.prompt === 'required') {
      // The rest starts now; the set counts as done once an RPE is picked.
      setAwaitingRpe((s) => new Set(s).add(set.id));
      rest(exercise, set.id);
      return;
    }
    if (report(await actions.completeSet({ setLogId: set.id }))) {
      rest(exercise, set.id);
      if (set.prompt === 'optional') setOptionalPicker(set.id);
    }
  };

  const pickRpe = async (set: SessionSetView, rpe: number) => {
    if (awaitingRpe.has(set.id)) {
      if (report(await actions.completeSet({ setLogId: set.id, rpe }))) {
        setAwaitingRpe((s) => {
          const copy = new Set(s);
          copy.delete(set.id);
          return copy;
        });
      }
    } else if (report(await actions.updateSet({ setLogId: set.id, rpe }))) {
      setOptionalPicker(null);
    }
    if (session.tips.rpePicker) void actions.dismissTip('tip_rpe_picker');
  };

  const saveEdit = async (value: number | null) => {
    if (!editing) return;
    const target = find(editing.setId);
    setEditing(null);
    if (!target) return;
    const input =
      editing.field === 'load'
        ? { setLogId: editing.setId, loadKg: value === null ? null : toKg(value, session.unit) }
        : editing.field === 'reps'
          ? { setLogId: editing.setId, reps: value }
          : { setLogId: editing.setId, timeSec: value };
    if (report(await actions.updateSet(input)) && editing.thenTick) {
      await tick(target.exercise, { ...target.set, reps: value });
    }
  };

  const finish = async () => {
    setSheet(null);
    const result = await actions.finish();
    if (!result.ok) return setMessage(result.message);
    successHaptic();
    await stopRest();
    router.replace(`/session/summary/${session.id}`);
  };

  const unfinished = session.setsIncomplete;
  const needingRpe = allSets.filter((x) => awaitingRpe.has(x.set.id));
  const firstTopSetId = allSets.find((x) => x.set.isTopSet && x.set.status === 'pending')?.set.id;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderColor: c.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close workout"
          onPress={() => setSheet({ kind: 'close' })}
          style={styles.iconButton}
        >
          <Text style={[type.title, { color: c.ink }]}>✕</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[type.title, styles.title, { color: c.ink }]}>
          {session.name}
        </Text>
        <Text
          accessibilityLabel={`${spokenClock(elapsed)} so far`}
          style={[type.label, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}
        >
          {formatClock(elapsed)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          onPress={() =>
            unfinished > 0 || needingRpe.length > 0 ? setSheet({ kind: 'finish' }) : void finish()
          }
          style={styles.iconButton}
        >
          <Text style={[type.label, { color: c.plateBlue }]}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {message && (
          <Text accessibilityRole="alert" style={[type.body, { color: c.plateRedText }]}>
            {message}
          </Text>
        )}
        {session.exercises.length === 0 && (
          <Text style={[type.body, { color: c.inkMuted }]}>
            No exercises yet. Add one to start logging.
          </Text>
        )}
        {session.exercises.map((exercise) => (
          <View
            key={exercise.id}
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.line },
              exercise.supersetGroup !== null && {
                borderLeftWidth: 4,
                borderLeftColor: c.plateBlue,
              },
            ]}
          >
            <View style={styles.exerciseHeader}>
              <Text accessibilityRole="header" style={[type.title, styles.title, { color: c.ink }]}>
                {exercise.name}
              </Text>
              {exercise.tmKg !== null && (
                <>
                  <Text style={[type.label, { color: c.inkMuted }]}>
                    TM {Math.round(toDisplay(exercise.tmKg, session.unit) * 100) / 100}{' '}
                    {session.unit}
                  </Text>
                  <InfoTip term="tm" />
                </>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More for ${exercise.name}`}
                onPress={() => setSheet({ kind: 'exercise', exerciseId: exercise.id })}
                style={styles.iconButton}
              >
                <Text style={[type.title, { color: c.ink }]}>⋯</Text>
              </Pressable>
            </View>
            {exercise.supersetGroup !== null && (
              <Text style={[type.caption, { color: c.plateBlue }]}>Superset</Text>
            )}
            {exercise.notes && (
              <Text style={[type.caption, { color: c.inkMuted }]}>Note: {exercise.notes}</Text>
            )}
            {exercise.sets.map((set) => (
              <View key={set.id} style={styles.setBlock}>
                {set.id === firstTopSetId && session.tips.topSet && (
                  <TipCard
                    tip="tip_top_set"
                    onDismiss={() => void actions.dismissTip('tip_top_set')}
                  />
                )}
                <SetRow
                  number={set.number}
                  set={set}
                  exercise={exercise.exercise}
                  unit={session.unit}
                  name={exercise.name}
                  target={set.target}
                  awaitingRpe={awaitingRpe.has(set.id)}
                  next={set.id === next}
                  onDone={() => void tick(exercise, set)}
                  onEditLoad={() => setEditing({ setId: set.id, field: 'load' })}
                  onEditReps={() =>
                    setEditing({
                      setId: set.id,
                      field: exercise.exercise.trackingType === 'time' ? 'time' : 'reps',
                    })
                  }
                  onMenu={() => setSheet({ kind: 'set', setId: set.id })}
                />
                {(awaitingRpe.has(set.id) || optionalPicker === set.id) && (
                  <>
                    {session.tips.rpePicker && (
                      <TipCard
                        tip="tip_rpe_picker"
                        onDismiss={() => void actions.dismissTip('tip_rpe_picker')}
                      />
                    )}
                    <RpePicker
                      target={set.targetRpe}
                      required={awaitingRpe.has(set.id)}
                      onPick={(rpe) => void pickRpe(set, rpe)}
                      onSkip={() => {
                        setOptionalPicker(null);
                        if (session.tips.rpePicker) void actions.dismissTip('tip_rpe_picker');
                      }}
                    />
                  </>
                )}
              </View>
            ))}
            <Button
              label="+ Add set"
              variant="ghost"
              onPress={() => void actions.addSet(exercise.id).then(report)}
            />
          </View>
        ))}

        <Button
          label="+ Add exercise"
          variant="secondary"
          onPress={() => setSheet({ kind: 'add' })}
        />
        <SessionDetails
          session={session}
          onSave={(input) => void actions.details(input).then(report)}
        />
      </ScrollView>

      {remaining !== null && remaining > -3 && (
        <RestTimerBar
          remainingSec={Math.max(0, remaining)}
          onAdjust={(delta) => void adjustRest(delta)}
          onSkip={() => void stopRest()}
        />
      )}

      <EditSheet
        editing={editing}
        session={session}
        find={find}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />
      <Menus
        sheet={sheet}
        session={session}
        find={find}
        needingRpe={needingRpe.map(
          (x) => `${x.exercise.name} ${spokenSetName(x.set.number, x.set).toLowerCase()}`,
        )}
        unfinished={unfinished}
        setSheet={setSheet}
        report={report}
        onFinish={() => void finish()}
      />
    </SafeAreaView>
  );
}

/** The load, reps or time editor for one set (FR-9.3). Loads are edited in the display unit. */
function EditSheet({
  editing,
  session,
  find,
  onSave,
  onClose,
}: {
  editing: Editing;
  session: SessionView;
  find: (setId: string) => { exercise: SessionExerciseView; set: SessionSetView } | undefined;
  onSave: (value: number | null) => void;
  onClose: () => void;
}) {
  const target = editing ? find(editing.setId) : undefined;
  if (!editing || !target) return null;
  const { exercise, set } = target;
  const setName = spokenSetName(set.number, set).toLowerCase();
  if (editing.field === 'load') {
    return (
      <NumberSheet
        visible
        title={`${exercise.name}, ${setName} load`}
        value={
          set.loadKg === null ? null : Math.round(toDisplay(set.loadKg, session.unit) * 100) / 100
        }
        suffix={session.unit}
        step={exercise.increment}
        allowNegative={exercise.exercise.trackingType === 'bodyweight_plus_load'}
        note={set.isTopSet ? (exercise.lastTopSet ?? undefined) : undefined}
        onDone={onSave}
        onClose={onClose}
      />
    );
  }
  return (
    <NumberSheet
      visible
      title={`${exercise.name}, ${setName} ${editing.field === 'time' ? 'time' : 'reps'}`}
      value={editing.field === 'time' ? set.timeSec : set.reps}
      suffix={editing.field === 'time' ? 's' : 'reps'}
      step={editing.field === 'time' ? 5 : 1}
      integer
      onDone={onSave}
      onClose={onClose}
    />
  );
}

function Menus({
  sheet,
  session,
  find,
  needingRpe,
  unfinished,
  setSheet,
  report,
  onFinish,
}: {
  sheet: Sheet;
  session: SessionView;
  find: (setId: string) => { exercise: SessionExerciseView; set: SessionSetView } | undefined;
  needingRpe: string[];
  unfinished: number;
  setSheet: (sheet: Sheet) => void;
  report: (result: ActionResult) => boolean;
  onFinish: () => void;
}) {
  const actions = useSessionActions(session.id);
  const close = () => setSheet(null);
  const exerciseOf = (id: string) => session.exercises.find((e) => e.id === id);

  if (sheet?.kind === 'set') {
    const target = find(sheet.setId);
    if (!target) return null;
    const { set, exercise } = target;
    const items: MenuAction[] = [
      {
        label: set.isWarmup ? 'Mark as working set' : 'Mark as warm-up',
        onPress: () => void actions.markWarmup(set.id, !set.isWarmup).then(report),
      },
      {
        label: set.status === 'failed' ? 'Mark as not failed' : 'Mark as failed',
        onPress: () => void actions.markFailed(set.id, set.status !== 'failed').then(report),
      },
      {
        label: 'Delete set',
        destructive: true,
        onPress: () => void actions.deleteSet(set.id).then(report),
      },
    ];
    return (
      <MenuSheet
        visible
        title={`${exercise.name}, ${spokenSetName(set.number, set).toLowerCase()}`}
        actions={items}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'exercise') {
    const exercise = exerciseOf(sheet.exerciseId);
    if (!exercise) return null;
    return (
      <MenuSheet
        visible
        title={exercise.name}
        actions={[
          {
            label: 'Swap exercise',
            onPress: () => setSheet({ kind: 'swap', exerciseId: exercise.id }),
          },
          {
            label: exercise.notes ? 'Edit note' : 'Add note',
            onPress: () => setSheet({ kind: 'note', exerciseId: exercise.id }),
          },
          {
            label: 'Add warm-up set',
            onPress: () => void actions.addSet(exercise.id, true).then(report),
          },
          {
            label: 'Remove exercise',
            destructive: true,
            onPress: () => void actions.removeExercise(exercise.id).then(report),
          },
        ]}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'swap') {
    const exercise = exerciseOf(sheet.exerciseId);
    return (
      <SkillPicker
        visible
        title={`Swap ${exercise?.name.toLowerCase() ?? 'exercise'} for…`}
        onPick={(skillId) => {
          close();
          void actions.swapExercise(sheet.exerciseId, skillId).then(report);
        }}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'add') {
    return (
      <SkillPicker
        visible
        title="Add an exercise"
        onPick={(skillId) => {
          close();
          void actions.addExercise(skillId).then(report);
        }}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'note') {
    const exercise = exerciseOf(sheet.exerciseId);
    if (!exercise) return null;
    return (
      <TextSheet
        visible
        title={`Note for ${exercise.name}`}
        initial={exercise.notes ?? ''}
        saveLabel="Save note"
        onSave={(notes) => {
          close();
          void actions.exerciseNote(exercise.id, notes).then(report);
        }}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'close') {
    return (
      <MenuSheet
        visible
        title="Leave this workout?"
        closeLabel="Keep going"
        actions={[
          { label: 'Save and exit', onPress: () => router.back() },
          {
            label: 'Discard workout',
            destructive: true,
            onPress: () => setSheet({ kind: 'discard' }),
          },
        ]}
        onClose={close}
      />
    );
  }
  if (sheet?.kind === 'discard') {
    return (
      <ConfirmSheet
        visible
        title="Discard this workout?"
        message="Every set you logged in it will be deleted. The workout stays in your plan to do."
        confirmLabel="Discard workout"
        cancelLabel="Keep workout"
        destructive
        onConfirm={() => {
          close();
          void stopRest();
          void actions.discard().then((result) => report(result) && router.back());
        }}
        onCancel={close}
      />
    );
  }
  if (sheet?.kind === 'finish') {
    const parts = [
      unfinished > 0
        ? `${unfinished} ${unfinished === 1 ? 'set isn’t' : 'sets aren’t'} done.`
        : null,
      needingRpe.length > 0 ? `Still waiting for an RPE: ${needingRpe.join(', ')}.` : null,
    ];
    return (
      <ConfirmSheet
        visible
        title="Finish anyway?"
        message={parts.filter(Boolean).join(' ')}
        confirmLabel="Finish workout"
        cancelLabel="Keep going"
        onConfirm={onFinish}
        onCancel={close}
      />
    );
  }
  return null;
}

/** The session note and effort rating at the bottom of the list (FR-9.7). */
function SessionDetails({
  session,
  onSave,
}: {
  session: SessionView;
  onSave: (input: { notes?: string | null; rpe?: number | null }) => void;
}) {
  const c = useColors();
  const type = useTypography();
  const [notes, setNotes] = useState(session.notes ?? '');
  return (
    <View style={styles.details}>
      <EffortPicker value={session.rpe} onPick={(rpe) => onSave({ rpe })} />
      <Text style={[type.label, { color: c.inkMuted }]}>Session note</Text>
      <TextInput
        accessibilityLabel="Session note"
        multiline
        value={notes}
        onChangeText={setNotes}
        onBlur={() => onSave({ notes })}
        placeholder="How did it go?"
        placeholderTextColor={c.inkMuted}
        style={[
          type.body,
          styles.input,
          { color: c.ink, backgroundColor: c.surfaceSunk, borderColor: c.line },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1, flexShrink: 1 },
  iconButton: {
    minWidth: touch.min,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  exerciseHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  setBlock: { gap: spacing.xs },
  details: { gap: spacing.sm },
  input: {
    minHeight: touch.min * 2,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.sm,
  },
});
