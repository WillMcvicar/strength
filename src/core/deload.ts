// DESIGN §3.9 — deload generation (FR-2.12) and inserting a deload into a draft (FR-2.11, D-23).
//
// The load factor is not applied here: `prescribedLoadKg` applies it when loads are calculated
// (§3.3, D-9), so a generated deload stores its sets at their normal prescriptions.
import { MAX_PLAN_WEEKS, rootOf, totalWeeks } from './schedule/generate';
import type { CycleExercise, CycleSet, CycleSlot, CycleWorkout, Phase } from './types';

/** FR-2.12 defaults, all editable after generation. */
export const DELOAD_DEFAULTS = {
  lengthWeeks: 1,
  volumeFactor: 0.5,
  loadFactor: 0.9,
  rpeCap: 7,
} as const;

/** A phase blueprint, flattened: workouts, their slots, exercises and sets. */
export interface DeloadSource {
  workouts: readonly CycleWorkout[];
  slots: readonly CycleSlot[];
  exercises: readonly CycleExercise[];
  sets: readonly CycleSet[];
}

export interface GeneratedBlueprint {
  workouts: CycleWorkout[];
  slots: CycleSlot[];
  exercises: CycleExercise[];
  sets: CycleSet[];
}

export interface DeloadFactors {
  volumeFactor: number;
  rpeCap: number;
}

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/**
 * Sets for one deload exercise: warm-ups as they are, then the first `ceil(n × volumeFactor)`
 * working sets (at least 1), with any top set kept first and turned into a normal %-of-TM set
 * at its starting % (D-19). Every kept working set has its RPE capped, and an AMRAP set becomes
 * a fixed-rep set at its minimum reps, since an all-out set contradicts the cap (D-30).
 */
function deloadSets(
  sets: readonly CycleSet[],
  cycleExerciseId: string,
  factors: DeloadFactors,
  newId: () => string,
): CycleSet[] {
  const ordered = [...sets].sort((a, b) => a.setIndex - b.setIndex);
  const working = ordered.filter((s) => !s.isWarmup);
  // FR-2.12's "minimum of 1 per skill" is applied per exercise: the same thing unless a
  // workout lists one skill twice.
  const keepCount = Math.max(1, Math.ceil(working.length * factors.volumeFactor));
  const priority = [
    ...working.filter((s) => s.loadType === 'top_set'),
    ...working.filter((s) => s.loadType !== 'top_set'),
  ];
  const kept = new Set(priority.slice(0, keepCount));
  const cap = factors.rpeCap;

  return ordered
    .filter((s) => s.isWarmup || kept.has(s))
    .map((s, i) => ({
      ...s,
      id: newId(),
      cycleExerciseId,
      setIndex: i + 1,
      ...(s.isWarmup
        ? {}
        : {
            loadType: s.loadType === 'top_set' ? 'percent_tm' : s.loadType,
            targetRpeMin: s.targetRpeMin === null ? null : Math.min(s.targetRpeMin, cap),
            targetRpeMax: Math.min(s.targetRpeMax ?? cap, cap),
            ...(s.isAmrap ? { isAmrap: false, repsMax: s.repsMin } : {}),
          }),
    }));
}

/**
 * Builds a deload's own workouts from the workouts in cycle week 1 of the source phase (FR-2.12):
 * one copy per distinct workout, slots on the same weekdays, and each exercise linked to its
 * source so double-progression state can be read during the deload.
 */
export function generateDeload(
  source: DeloadSource,
  deloadPhaseId: string,
  factors: DeloadFactors,
  newId: () => string,
): GeneratedBlueprint {
  const weekSlots = source.slots
    .filter((s) => s.cycleWeekIndex === 1 && s.retiredFromGroupWeek === null)
    .sort(bySortOrder);
  const usedIds = new Set(weekSlots.map((s) => s.cycleWorkoutId));

  const out: GeneratedBlueprint = { workouts: [], slots: [], exercises: [], sets: [] };
  const copyOf = new Map<string, string>();

  for (const w of source.workouts.filter((w) => usedIds.has(w.id)).sort(bySortOrder)) {
    const workoutId = newId();
    copyOf.set(w.id, workoutId);
    out.workouts.push({ ...w, id: workoutId, phaseId: deloadPhaseId });

    const exercises = source.exercises.filter((e) => e.cycleWorkoutId === w.id).sort(bySortOrder);
    for (const e of exercises) {
      const exerciseId = newId();
      out.exercises.push({
        ...e,
        id: exerciseId,
        cycleWorkoutId: workoutId,
        sourceCycleExerciseId: e.id,
      });
      const sets = source.sets.filter((s) => s.cycleExerciseId === e.id);
      out.sets.push(...deloadSets(sets, exerciseId, factors, newId));
    }
  }

  for (const s of weekSlots) {
    out.slots.push({
      ...s,
      id: newId(),
      phaseId: deloadPhaseId,
      cycleWorkoutId: copyOf.get(s.cycleWorkoutId)!,
      cycleWeekIndex: 1,
      retiredFromGroupWeek: null,
      sourceCycleSlotId: s.id,
    });
  }
  return out;
}

export type DeloadInsertRejection =
  'length_out_of_range' | 'bad_week' | 'too_long' | 'no_training_phase_before' | 'next_to_deload';

export type DeloadInsertPlan =
  | {
      ok: true;
      /** The new deload phase (C-1: cycle length 1; no reviews). */
      deload: Phase;
      /** The part after the split, when the deload lands inside a phase (D-1). */
      continuation: Phase | null;
      /** The original phase whose cycle week 1 the deload is generated from. */
      sourcePhaseId: string;
      /** Changed fields of existing phases: the split phase's length, later sort orders. */
      updates: { id: string; patch: Partial<Pick<Phase, 'lengthWeeks' | 'sortOrder'>> }[];
      /** Every phase after the insert, in plan order. */
      phases: Phase[];
    }
  | { ok: false; reason: DeloadInsertRejection };

/**
 * Inserts a deload after plan week `afterWeek` of a draft (DESIGN §3.9 "Inserting a deload in
 * the builder"). This is the `planDeloadNow` split without any dates to shift, since a draft has
 * no planned workouts (D-23). A split inside a phase makes the rest of it a continuation.
 */
export function planDraftDeloadInsert(
  phases: readonly Phase[],
  afterWeek: number,
  lengthWeeks: number,
  newId: () => string,
): DeloadInsertPlan {
  if (lengthWeeks !== 1 && lengthWeeks !== 2) return { ok: false, reason: 'length_out_of_range' };
  const total = totalWeeks(phases);
  if (!Number.isInteger(afterWeek) || afterWeek < 1 || afterWeek > total) {
    return { ok: false, reason: 'bad_week' };
  }
  if (total + lengthWeeks > MAX_PLAN_WEEKS) return { ok: false, reason: 'too_long' };

  const ordered = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  let start = 1;
  let index = 0;
  while (afterWeek >= start + ordered[index].lengthWeeks) {
    start += ordered[index].lengthWeeks;
    index += 1;
  }
  const p = ordered[index];
  if (p.type !== 'training') return { ok: false, reason: 'no_training_phase_before' };

  const weeksOfP = afterWeek - start + 1;
  // D-30: two deloads in a row; the user lengthens the existing one instead (up to 2 weeks).
  if (weeksOfP === p.lengthWeeks && ordered[index + 1]?.type === 'deload') {
    return { ok: false, reason: 'next_to_deload' };
  }
  const deload: Phase = {
    ...p,
    id: newId(),
    name: 'Deload',
    type: 'deload',
    reviewMode: 'none',
    lengthWeeks,
    cycleLengthWeeks: 1,
    volumeFactor: DELOAD_DEFAULTS.volumeFactor,
    loadFactor: DELOAD_DEFAULTS.loadFactor,
    rpeCap: DELOAD_DEFAULTS.rpeCap,
    restDaysAtEnd: null,
    hasTestDay: false,
    // DESIGN §3.9: P itself, which may be a continuation with no blueprint of its own. Anything
    // that regenerates from it must go through `rootOf`, as `sourcePhaseId` below does.
    generatedFromPhaseId: p.id,
    continuesPhaseId: null,
    continuesOffsetWeeks: null,
    defaultIncreaseType: 'none',
    defaultIncreaseValue: null,
    defaultIncreaseValueLb: null,
    fallbackIncreaseType: null,
    fallbackIncreaseValue: null,
    fallbackIncreaseValueLb: null,
  };
  const continuation: Phase | null =
    weeksOfP < p.lengthWeeks
      ? {
          ...p,
          id: newId(),
          lengthWeeks: p.lengthWeeks - weeksOfP,
          continuesPhaseId: rootOf(p),
          continuesOffsetWeeks: (p.continuesOffsetWeeks ?? 0) + weeksOfP,
        }
      : null;

  const inserted = [
    ...ordered.slice(0, index),
    { ...p, lengthWeeks: weeksOfP },
    deload,
    ...(continuation ? [continuation] : []),
    ...ordered.slice(index + 1),
  ];
  const result = inserted.map((q, i) => ({ ...q, sortOrder: i + 1 }));

  const updates: { id: string; patch: Partial<Pick<Phase, 'lengthWeeks' | 'sortOrder'>> }[] = [];
  for (const before of ordered) {
    const after = result.find((q) => q.id === before.id)!;
    const patch: Partial<Pick<Phase, 'lengthWeeks' | 'sortOrder'>> = {};
    if (after.lengthWeeks !== before.lengthWeeks) patch.lengthWeeks = after.lengthWeeks;
    if (after.sortOrder !== before.sortOrder) patch.sortOrder = after.sortOrder;
    if (Object.keys(patch).length > 0) updates.push({ id: before.id, patch });
  }

  return {
    ok: true,
    deload: result.find((q) => q.id === deload.id)!,
    continuation: continuation ? result.find((q) => q.id === continuation.id)! : null,
    sourcePhaseId: rootOf(p),
    updates,
    phases: result,
  };
}
