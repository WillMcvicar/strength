// What a set row shows and says (DESIGN §7.6 set row table, §7.17): "22.5 kg × 2", "BW +20 kg",
// "8 each side", "AMRAP", read aloud as one sentence such as "Set 2, 100 kilograms, 5 reps, not
// done". Loads are stored in kg and shown in the display unit (FR-12.1).
import {
  formatLoad,
  type LoadConvention,
  type SetStatus,
  type TrackingType,
  type Unit,
} from '@/core';

import { spokenLoad } from './components/LoadText';
import { formatClock, spokenClock } from './format';

export interface RowExercise {
  trackingType: TrackingType;
  loadConvention: LoadConvention;
  isUnilateral: boolean;
}

export interface RowSet {
  isWarmup: boolean;
  isTopSet: boolean;
  isAmrap: boolean;
  reps: number | null;
  loadKg: number | null;
  timeSec: number | null;
  rpe: number | null;
  status: SetStatus;
}

export interface CellText {
  shown: string;
  spoken: string;
}

/** The load cell, or null when the skill is tracked without a load. */
export function loadText(set: RowSet, exercise: RowExercise, unit: Unit): CellText | null {
  if (exercise.trackingType === 'bodyweight_plus_load') {
    if (!set.loadKg) return { shown: 'BW', spoken: 'bodyweight' };
    return {
      shown: `BW ${formatLoad(set.loadKg, unit, { signed: true })}`,
      spoken: `bodyweight ${spokenLoad(set.loadKg, unit, false, true)}`,
    };
  }
  if (exercise.trackingType !== 'weight_reps') return null;
  if (set.loadKg === null) return { shown: '—', spoken: 'no load entered' };
  const perSide = exercise.loadConvention === 'per_side';
  return {
    shown: formatLoad(set.loadKg, unit, { perSide }),
    spoken: spokenLoad(set.loadKg, unit, perSide),
  };
}

/** The reps or time cell, or null for a completion-only item. */
export function repsText(set: RowSet, exercise: RowExercise): CellText | null {
  if (exercise.trackingType === 'completion_only') return null;
  if (exercise.trackingType === 'time') {
    return set.timeSec === null
      ? { shown: '—', spoken: 'no time entered' }
      : { shown: formatClock(set.timeSec), spoken: spokenClock(set.timeSec) };
  }
  if (set.reps === null) {
    return set.isAmrap
      ? { shown: 'AMRAP', spoken: 'as many reps as possible' }
      : { shown: '—', spoken: 'no reps entered' };
  }
  const side = exercise.isUnilateral ? ' each side' : '';
  return {
    shown: `${set.reps}${side}`,
    spoken: `${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}${side}`,
  };
}

/** "Set 2", "Warm-up" or "Top set" (FR-9.2b, FR-9.14). */
export function spokenSetName(number: number, set: Pick<RowSet, 'isWarmup' | 'isTopSet'>): string {
  if (set.isWarmup) return 'Warm-up';
  if (set.isTopSet) return 'Top set';
  return `Set ${number}`;
}

function spokenStatus(set: RowSet, awaitingRpe: boolean): string {
  if (set.status === 'completed') return set.rpe === null ? 'done' : `done at RPE ${set.rpe}`;
  if (set.status === 'failed') return 'failed';
  return awaitingRpe ? 'pick an RPE to finish it' : 'not done';
}

/** The whole row as one element for screen readers (§7.17). */
export function spokenSet(args: {
  number: number;
  set: RowSet;
  exercise: RowExercise;
  unit: Unit;
  awaitingRpe?: boolean;
  /** A completion-only item is read by its name. */
  name?: string;
}): string {
  const { number, set, exercise, unit, awaitingRpe = false, name } = args;
  const status = spokenStatus(set, awaitingRpe);
  if (exercise.trackingType === 'completion_only') return `${name ?? 'Item'}, ${status}`;
  const parts = [
    spokenSetName(number, set),
    loadText(set, exercise, unit)?.spoken,
    repsText(set, exercise)?.spoken,
    status,
  ];
  return parts.filter((p): p is string => p !== undefined).join(', ');
}
