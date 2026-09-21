// DESIGN §3.6 — schedule generation (FR-2.5, FR-2.11, FR-4.3, D-1, D-14, D-20, C-1, C-5).
//
// Week and cycle indices follow the SRS §4 "Indexes" rules. A continuation part (D-1) has no
// slots or cycle length of its own: both are read from the original phase of its cycle group.
import { addDays, firstOnOrAfter, isLocalDate } from '../dates';
import type { CycleSlot, LocalDate, Phase, PlannedWorkout } from '../types';

/** A plan never runs longer than this (FR-2.4). */
export const MAX_PLAN_WEEKS = 52;

/** A phase plus its continuations (D-1, D-14). */
export interface PhaseGroup {
  rootId: string;
  phases: Phase[];
}

/** One phase as the builder shows it: an original phase and everything inside its span (FR-2.11). */
export interface BuilderSection {
  phase: Phase;
  /** In plan order: the original, any deloads inside it, and its continuations. */
  parts: Phase[];
  totalWeeks: number;
}

export interface WeekPosition {
  weekIndex: number;
  phase: Phase;
  cycleGroupId: string;
  weeksIntoGroup: number;
  phaseCycleIndex: number;
  cycleWeekIndex: number;
  totalWeeks: number;
}

/** The cycle group a phase belongs to (D-14). */
export function rootOf(phase: Pick<Phase, 'id' | 'continuesPhaseId'>): string {
  return phase.continuesPhaseId ?? phase.id;
}

const inOrder = (phases: readonly Phase[]): Phase[] =>
  [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Checks the cycle-group rules and returns the phases in plan order. A continuation must come
 * after its original, point at an original rather than another continuation, and carry the
 * weeks its group had before it as its offset. These are programmer errors: services build
 * phases through `planDraftDeloadInsert` and never store an inconsistent set.
 */
function checked(phases: readonly Phase[]): Phase[] {
  const ordered = inOrder(phases);
  const groupWeeks = new Map<string, number>();
  let total = 0;
  for (const p of ordered) {
    if (p.continuesPhaseId !== null) {
      const before = groupWeeks.get(p.continuesPhaseId);
      const root = ordered.find((q) => q.id === p.continuesPhaseId);
      if (before === undefined || root?.continuesPhaseId !== null) {
        throw new Error(`Phase ${p.id} must follow its original phase ${p.continuesPhaseId}`);
      }
      if (p.continuesOffsetWeeks !== before) {
        throw new Error(
          `Phase ${p.id} has offset ${p.continuesOffsetWeeks}, but its group had ${before} weeks`,
        );
      }
    }
    const group = rootOf(p);
    groupWeeks.set(group, (groupWeeks.get(group) ?? 0) + p.lengthWeeks);
    total += p.lengthWeeks;
  }
  if (total > MAX_PLAN_WEEKS) {
    throw new Error(`A plan can be at most ${MAX_PLAN_WEEKS} weeks, got ${total}`);
  }
  return ordered;
}

/** Program length: the sum of the phase lengths (SRS §4). */
export function totalWeeks(phases: readonly Phase[]): number {
  return checked(phases).reduce((sum, p) => sum + p.lengthWeeks, 0);
}

/** `phaseStartWeek = 1 + sum(lengthWeeks of earlier phases)` (SRS §4). */
export function phaseStartWeeks(phases: readonly Phase[]): Map<string, number> {
  const starts = new Map<string, number>();
  let week = 1;
  for (const p of checked(phases)) {
    starts.set(p.id, week);
    week += p.lengthWeeks;
  }
  return starts;
}

export function phaseGroups(phases: readonly Phase[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const p of checked(phases)) {
    const rootId = rootOf(p);
    const group = groups.find((g) => g.rootId === rootId);
    if (group) group.phases.push(p);
    else groups.push({ rootId, phases: [p] });
  }
  return groups;
}

/**
 * The builder's view (FR-2.11): an original phase and its continuations read as one phase, and
 * anything between them (a deload inside it) is shown inside that phase.
 */
export function builderSections(phases: readonly Phase[]): BuilderSection[] {
  const ordered = checked(phases);
  const lastIndex = new Map<string, number>();
  ordered.forEach((p, i) => lastIndex.set(rootOf(p), i));

  const sections: BuilderSection[] = [];
  for (let i = 0; i < ordered.length;) {
    // A section always starts at an original phase: continuations sit inside their span.
    const end = lastIndex.get(ordered[i].id)!;
    const parts = ordered.slice(i, end + 1);
    sections.push({
      phase: ordered[i],
      parts,
      totalWeeks: parts.reduce((sum, p) => sum + p.lengthWeeks, 0),
    });
    i = end + 1;
  }
  return sections;
}

/** Where a plan week sits: its phase, cycle group, cycle and cycle week (FR-4.3, SRS §4). */
export function weekPosition(phases: readonly Phase[], weekIndex: number): WeekPosition {
  const ordered = checked(phases);
  const total = ordered.reduce((sum, p) => sum + p.lengthWeeks, 0);
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > total) {
    throw new Error(`Week ${weekIndex} is outside this ${total}-week plan`);
  }

  let start = 1;
  let phase = ordered[0];
  for (const p of ordered) {
    if (weekIndex < start + p.lengthWeeks) {
      phase = p;
      break;
    }
    start += p.lengthWeeks;
  }

  const cycleGroupId = rootOf(phase);
  // A continuation reads its cycle length from its original (FR-2.11); `checked` guarantees it exists.
  const cycleLength = ordered.find((p) => p.id === cycleGroupId)!.cycleLengthWeeks;
  const weeksIntoGroup = (phase.continuesOffsetWeeks ?? 0) + (weekIndex - start + 1);
  return {
    weekIndex,
    phase,
    cycleGroupId,
    weeksIntoGroup,
    phaseCycleIndex: Math.ceil(weeksIntoGroup / cycleLength),
    cycleWeekIndex: ((weeksIntoGroup - 1) % cycleLength) + 1,
    totalWeeks: total,
  };
}

/**
 * The plan week a cycle starts in, for the week given (§3.3). Cycles belong to the cycle group
 * (D-14), so a cycle split by a deload starts in its first part.
 */
export function cycleFirstWeek(phases: readonly Phase[], weekIndex: number): number {
  const target = weekPosition(phases, weekIndex);
  let first = weekIndex;
  for (let w = weekIndex - 1; w >= 1; w--) {
    const pos = weekPosition(phases, w);
    if (pos.cycleGroupId !== target.cycleGroupId) continue;
    if (pos.phaseCycleIndex !== target.phaseCycleIndex) break;
    first = w;
  }
  return first;
}

export interface GenerateInput {
  planId: string;
  startDate: LocalDate;
  phases: readonly Phase[];
  /** Every slot of the plan's phases. Continuations have none; they use their original's. */
  slots: readonly CycleSlot[];
}

/**
 * Dated planned workouts for the whole plan (DESIGN §3.6, FR-4.3). Plan week N starts on
 * `startDate + 7 × (N − 1)`, and each slot falls on the first occurrence of its weekday in that
 * week. `newId` supplies the row IDs, so this stays deterministic.
 */
export function generatePlannedWorkouts(
  input: GenerateInput,
  newId: () => string,
): PlannedWorkout[] {
  if (!isLocalDate(input.startDate)) {
    throw new Error(`Start date is not a local date: ${JSON.stringify(input.startDate)}`);
  }
  const phases = checked(input.phases);
  if (phases.some((p) => p.type === 'taper')) {
    // Taper rest windows and Test Day ship with FR-2.14 in v1.1 (flag `taperAndTestDay`).
    throw new Error('Taper phases are not supported until v1.1 (FR-2.14)');
  }

  const rows: PlannedWorkout[] = [];
  let week = 0;
  for (const phase of phases) {
    const cycleGroupId = rootOf(phase);
    const root = phases.find((p) => p.id === cycleGroupId)!;
    const slots = input.slots.filter((s) => s.phaseId === cycleGroupId);
    const offset = phase.continuesOffsetWeeks ?? 0;

    for (let w = 1; w <= phase.lengthWeeks; w++) {
      week += 1;
      const g = offset + w;
      const cycleIndex = Math.ceil(g / root.cycleLengthWeeks);
      const cycleWeekIndex = ((g - 1) % root.cycleLengthWeeks) + 1;
      const weekStart = addDays(input.startDate, 7 * (week - 1));

      const inWeek = slots
        .filter((s) => s.cycleWeekIndex === cycleWeekIndex)
        .filter((s) => s.retiredFromGroupWeek === null || g < s.retiredFromGroupWeek)
        .map((s) => ({ slot: s, date: firstOnOrAfter(weekStart, s.weekday) }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.slot.sortOrder - b.slot.sortOrder);

      for (const { slot, date } of inWeek) {
        rows.push({
          id: newId(),
          planId: input.planId,
          phaseId: phase.id,
          cycleGroupId,
          cycleWorkoutId: slot.cycleWorkoutId,
          cycleSlotId: slot.id,
          phaseCycleIndex: cycleIndex,
          weekIndex: week,
          scheduledDate: date,
          status: 'upcoming',
          sessionId: null,
          skippedAt: null,
        });
      }
    }
  }
  return rows;
}
