// The workout session's view-model (FR-9, DESIGN §7.6): the session with its exercises and sets,
// shaped for SetRow, plus every action the screen can take. Reads go through repositories; every
// write goes through a service, which the screen gets back as plain words (§6.6).
import { useMemo } from 'react';

import {
  formatLoad,
  completionError,
  incrementFor,
  rpePrompt,
  sessionTotals,
  type LocalDate,
  type SessionExercise,
  type SessionKind,
  type SetLog,
  type SessionStatus,
  type Unit,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { addExercise } from '@/services/addExercise';
import { addSet } from '@/services/addSet';
import { completeSet } from '@/services/completeSet';
import type { ServiceContext } from '@/services/context';
import { deleteSession } from '@/services/deleteSession';
import { deleteSet } from '@/services/deleteSet';
import { discardSession } from '@/services/discardSession';
import { dismissTip } from '@/services/dismissTip';
import { finishSession, type SessionSummary } from '@/services/finishSession';
import { markSetFailed } from '@/services/markSetFailed';
import { markSetWarmup } from '@/services/markSetWarmup';
import { removeExercise } from '@/services/removeExercise';
import type { SetInput } from '@/services/setValues';
import { swapExercise } from '@/services/swapExercise';
import { updateExerciseNote } from '@/services/updateExerciseNote';
import { updateSessionDetails } from '@/services/updateSessionDetails';
import { updateSet } from '@/services/updateSet';

import { useDb } from './database';
import { readSessionPrs, type SessionPrsView } from './prs';
import { serviceContext } from './serviceContext';
import { useLiveQuery } from './useLiveQuery';

export interface SessionSetView extends SetLog {
  id: string;
  /** The working-set number; warm-ups aren't counted. */
  number: number;
  prompt: 'required' | 'optional' | 'none';
  /** The pre-highlighted RPE: the top of the target range (D-36). */
  targetRpe: number | null;
  /**
   * A top set's target, shown as "Work up to 1–3 @ RPE 8" by the same formatter as Today
   * (FR-9.2b, D-36).
   */
  topSetTarget: {
    reps: readonly [number] | readonly [number, number];
    rpe: { min: number; max: number };
  } | null;
}

export interface SessionExerciseView {
  id: string;
  skillId: string;
  name: string;
  exercise: SessionExercise;
  restSec: number;
  supersetGroup: string | null;
  notes: string | null;
  /** In stored kilograms, for the TM ⓘ in the header (§7.6). */
  tmKg: number | null;
  /** The ± step for loads, in the display unit (FR-1.6). */
  increment: number;
  /** Last cycle's top set, "Last: 100 kg × 2 @ RPE 8" (FR-9.2b). */
  lastTopSet: string | null;
  sets: SessionSetView[];
}

export interface SessionView {
  id: string;
  name: string;
  kind: SessionKind;
  status: SessionStatus;
  /** The day it was logged (D-39). */
  localDate: LocalDate;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  rpe: number | null;
  /** The FR-9.8 figures, as logged so far (§3.14). */
  volumeKg: number;
  setsCompleted: number;
  /** Sets still to do, warm-ups included (§7.6 "4 sets aren't done"). */
  setsIncomplete: number;
  unit: Unit;
  keepAwake: boolean;
  restTimerAlerts: boolean;
  /** One-time tips still to show (FR-6.2). */
  tips: { rpePicker: boolean; topSet: boolean };
  exercises: SessionExerciseView[];
  /** The PRs it set, once finished (FR-10.2); none while in progress. */
  prs: SessionPrsView;
}

export type SessionScreenView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; session: SessionView | null };

export function useSession(sessionId: string): SessionScreenView {
  const view = useLiveQuery((db) => readSession(db, sessionId), [sessionId]);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', session: view.data };
}

/** The set's target RPE range; a lone bound is both ends (D-36). */
const rpeRange = (min: number | null, max: number | null) => {
  const lo = min ?? max;
  const hi = max ?? min;
  return lo === null || hi === null ? null : { min: lo, max: hi };
};

const repsTarget = (
  min: number | null,
  max: number | null,
): readonly [number] | readonly [number, number] | null =>
  min === null ? null : max === null || max === min ? [min] : [min, max];

/** "20 kg × 2" per side, "BW +20 kg" added, "100 kg" otherwise, as the set row shows it. */
export function loadLabel(kg: number, exercise: SessionExercise, unit: Unit): string {
  if (exercise.trackingType === 'bodyweight_plus_load') {
    return `BW ${formatLoad(kg, unit, { signed: true })}`;
  }
  return formatLoad(kg, unit, { perSide: exercise.loadConvention === 'per_side' });
}

export async function readSession(db: Db, sessionId: string): Promise<SessionView | null> {
  const r = repositories(db);
  const session = await r.sessions.get(sessionId);
  if (!session) return null;
  const [settings, logged] = await Promise.all([r.settings.get(), r.sessions.exercises(sessionId)]);
  const skillIds = [...new Set(logged.map((e) => e.exercise.skillId))];
  const [skills, lastTop, prs] = await Promise.all([
    r.skills.getMany(skillIds),
    r.sessions.lastTopSetBySkill(skillIds),
    readSessionPrs(r, sessionId),
  ]);
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const unit = settings.unit;

  const exercises = logged.map(({ exercise, sets }): SessionExerciseView => {
    const skill = skillById.get(exercise.skillId);
    let number = 0;
    const last = lastTop.get(exercise.skillId);
    return {
      id: exercise.id,
      skillId: exercise.skillId,
      name: skill?.name ?? 'Unknown exercise',
      exercise,
      restSec: exercise.restSec ?? settings.defaultRestSec,
      supersetGroup: exercise.supersetGroup,
      notes: exercise.notes,
      tmKg: exercise.tmSnapshotKg,
      increment: skill ? incrementFor(skill, settings, unit) : unit === 'kg' ? 2.5 : 5,
      lastTopSet:
        last && last.loadKg !== null && last.reps !== null
          ? `Last: ${loadLabel(last.loadKg, exercise, unit)} × ${last.reps}${last.rpe === null ? '' : ` @ RPE ${last.rpe}`}`
          : null,
      sets: sets.map((s) => {
        if (!s.isWarmup) number += 1;
        const rpe = rpeRange(s.targetRpeMin, s.targetRpeMax);
        const reps = repsTarget(s.prescribedRepsMin, s.prescribedRepsMax);
        return {
          ...s,
          number,
          prompt: rpePrompt(exercise, s),
          targetRpe: s.targetRpeMax ?? s.targetRpeMin,
          topSetTarget: s.isTopSet && reps && rpe ? { reps, rpe } : null,
        };
      }),
    };
  });

  const seen = new Set(settings.seenTips);
  const totals = sessionTotals(logged);
  return {
    id: session.id,
    name: session.name,
    kind: session.kind,
    status: session.status,
    localDate: session.localDate,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    notes: session.notes,
    rpe: session.rpe,
    volumeKg: totals.volumeKg,
    setsCompleted: totals.setsCompleted,
    setsIncomplete: logged.reduce(
      (n, e) => n + e.sets.filter((s) => s.status === 'pending').length,
      0,
    ),
    unit,
    keepAwake: settings.keepAwake,
    restTimerAlerts: settings.restTimerAlerts,
    tips: {
      rpePicker: settings.tipsEnabled && !seen.has('tip_rpe_picker'),
      topSet: settings.tipsEnabled && !seen.has('tip_top_set'),
    },
    exercises,
    prs,
  };
}

/** What the lifter reads when an action is refused (§6.6). */
const MESSAGES: Record<string, string> = {
  rpe_required: 'Pick an RPE to finish this set.',
  missing_reps: 'Enter the reps you did.',
  missing_load: 'Enter the weight you used.',
  missing_time: 'Enter the time you held it.',
  bad_rpe: 'That RPE can’t be used. Pick one from 6 to 10.',
  bad_value: 'That number can’t be used.',
  not_in_progress: 'This workout has already finished.',
  in_progress: 'This workout is still in progress.',
  not_found: 'That set is no longer in this workout.',
  skill_not_found: 'That exercise isn’t available.',
};

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Why a set can't be done yet, apart from its RPE, or null. Checked before the RPE picker opens,
 * so a set with no load says so at once rather than after the RPE is picked (§7.6).
 */
export function blockedBeforeRpe(exercise: SessionExercise, set: SetLog): string | null {
  // Any valid RPE stands in for the one still to be picked.
  const error = completionError(exercise, set, { ...set, rpe: 8 });
  return error ? (MESSAGES[error] ?? 'Something went wrong.') : null;
}

const toResult = (result: { ok: true } | { ok: false; reason: string }): ActionResult =>
  result.ok
    ? { ok: true }
    : { ok: false, message: MESSAGES[result.reason] ?? 'Something went wrong.' };

type Run = <R extends { ok: true } | { ok: false; reason: string }>(
  call: (db: Db, ctx: ServiceContext) => Promise<R>,
) => Promise<ActionResult>;

export interface SessionActions {
  completeSet: (input: SetInput) => Promise<ActionResult>;
  updateSet: (input: SetInput) => Promise<ActionResult>;
  addSet: (sessionExerciseId: string, warmup?: boolean) => Promise<ActionResult>;
  deleteSet: (setLogId: string) => Promise<ActionResult>;
  markWarmup: (setLogId: string, isWarmup: boolean) => Promise<ActionResult>;
  markFailed: (setLogId: string, failed: boolean) => Promise<ActionResult>;
  swapExercise: (sessionExerciseId: string, skillId: string) => Promise<ActionResult>;
  addExercise: (skillId: string) => Promise<ActionResult>;
  removeExercise: (sessionExerciseId: string) => Promise<ActionResult>;
  exerciseNote: (sessionExerciseId: string, notes: string | null) => Promise<ActionResult>;
  details: (input: { notes?: string | null; rpe?: number | null }) => Promise<ActionResult>;
  dismissTip: (key: string) => Promise<ActionResult>;
  discard: () => Promise<ActionResult>;
  /** Deletes a finished session from History; its PRs are recalculated (FR-9.12, FR-10.5). */
  remove: () => Promise<ActionResult>;
  finish: () => Promise<{ ok: true; summary: SessionSummary } | { ok: false; message: string }>;
}

export function useSessionActions(sessionId: string): SessionActions {
  const db = useDb();
  return useMemo(() => {
    const run: Run = async (call) => toResult(await call(db, serviceContext()));
    return {
      completeSet: (input) => run((d, c) => completeSet(d, input, c)),
      updateSet: (input) => run((d, c) => updateSet(d, input, c)),
      addSet: (sessionExerciseId, warmup = false) =>
        run((d, c) => addSet(d, { sessionExerciseId, warmup }, c)),
      deleteSet: (setLogId) => run((d, c) => deleteSet(d, { setLogId }, c)),
      markWarmup: (setLogId, isWarmup) =>
        run((d, c) => markSetWarmup(d, { setLogId, isWarmup }, c)),
      markFailed: (setLogId, failed) => run((d, c) => markSetFailed(d, { setLogId, failed }, c)),
      swapExercise: (sessionExerciseId, skillId) =>
        run((d, c) => swapExercise(d, { sessionExerciseId, skillId }, c)),
      addExercise: (skillId) => run((d, c) => addExercise(d, { sessionId, skillId }, c)),
      removeExercise: (sessionExerciseId) =>
        run((d, c) => removeExercise(d, { sessionExerciseId }, c)),
      exerciseNote: (sessionExerciseId, notes) =>
        run((d, c) => updateExerciseNote(d, { sessionExerciseId, notes }, c)),
      details: (input) => run((d, c) => updateSessionDetails(d, { sessionId, ...input }, c)),
      dismissTip: (key) => run((d, c) => dismissTip(d, { key }, c)),
      discard: () => run((d, c) => discardSession(d, { sessionId }, c)),
      remove: () => run((d, c) => deleteSession(d, { sessionId }, c)),
      finish: async () => {
        const result = await finishSession(db, { sessionId }, serviceContext());
        return result.ok ? result : { ok: false as const, message: MESSAGES[result.reason]! };
      },
    };
  }, [db, sessionId]);
}
