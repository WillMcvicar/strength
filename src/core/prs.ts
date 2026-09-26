// DESIGN §3.13 — personal records (FR-10.1, FR-10.2, FR-10.5, C-7). PRs are an event log: a set
// records a PR when it strictly beats the best so far for that (skill, type, weight). Finishing a
// session detects against the current bests; editing or deleting one replays the skill's history.
import { e1rm, isPrEligibleE1rm } from './e1rm';
import { FLOAT_NOISE } from './tracking';
import type { PersonalRecord, PrType, SetStatus, TrackingType } from './types';

/** A logged set with what PR detection needs from its exercise and session. */
export interface PrSet {
  skillId: string;
  sessionId: string;
  setLogId: string;
  /** The exercise's snapshot (FR-1.10), so a set is judged as it was logged. */
  trackingType: TrackingType;
  status: SetStatus;
  isWarmup: boolean;
  reps: number | null;
  loadKg: number | null;
  timeSec: number | null;
  rpe: number | null;
  completedAt: string | null;
}

export interface PrScore {
  type: PrType;
  value: number;
  contextWeightKg: number | null;
}

export type NewPr = Omit<PersonalRecord, 'id'>;

type Keyed = Pick<PersonalRecord, 'skillId' | 'type' | 'contextWeightKg'>;

/**
 * Whether a value strictly beats the best so far. Values within a millionth are a tie: e1RMs of
 * different sets can be equal but for floating-point noise (87.5 × 10 and 100 × 5 are both 116.67).
 */
const beats = (value: number, best: number | undefined): boolean =>
  best === undefined || value > best + FLOAT_NOISE;

/** The (skill, type, weight) a record competes within. */
const keyOf = (r: Keyed): string => `${r.skillId}|${r.type}|${r.contextWeightKg ?? ''}`;

/**
 * What a set scores for each PR type it can set (§3.13 table). Warm-ups, failed and unfinished
 * sets score nothing (FR-9.14, FR-9.15), and neither do completion-only items.
 */
export function prScores(s: PrSet): PrScore[] {
  if (s.status !== 'completed' || s.isWarmup || s.completedAt === null) return [];
  const hasReps = s.reps !== null && s.reps >= 1;
  switch (s.trackingType) {
    case 'weight_reps': {
      if (!hasReps || s.loadKg === null) return [];
      const scores: PrScore[] = [{ type: 'heaviest', value: s.loadKg, contextWeightKg: null }];
      // D-10: a missing RPE counts as RIR 0 for PRs, over 1–10 reps.
      if (isPrEligibleE1rm(s)) {
        scores.push({ type: 'e1rm', value: e1rm(s.loadKg, s.reps!, s.rpe), contextWeightKg: null });
      }
      scores.push({ type: 'reps_at_weight', value: s.reps!, contextWeightKg: s.loadKg });
      return scores;
    }
    case 'bodyweight_plus_load': {
      if (!hasReps) return [];
      // No added load is bodyweight alone; no e1RM, since bodyweight isn't tracked (FR-10.1).
      const added = s.loadKg ?? 0;
      return [
        { type: 'heaviest_added', value: added, contextWeightKg: null },
        { type: 'reps_at_added', value: s.reps!, contextWeightKg: added },
      ];
    }
    case 'reps_only':
      return hasReps ? [{ type: 'max_reps', value: s.reps!, contextWeightKg: null }] : [];
    case 'time':
      return s.timeSec !== null && s.timeSec >= 1
        ? [{ type: 'longest_time', value: s.timeSec, contextWeightKg: null }]
        : [];
    case 'completion_only':
      return [];
  }
}

/** The best value so far for each (skill, type, weight). */
export function bestsOf(records: readonly (Keyed & { value: number })[]): Map<string, number> {
  const bests = new Map<string, number>();
  for (const r of records) {
    const key = keyOf(r);
    const best = bests.get(key);
    if (best === undefined || r.value > best) bests.set(key, r.value);
  }
  return bests;
}

/**
 * The PRs these sets set, taken in the order given, against `bests`. Only a strictly greater
 * value counts, and a skill's first sets set its baseline (§3.13). `bests` isn't changed.
 */
export function detectPrs(bests: ReadonlyMap<string, number>, sets: readonly PrSet[]): NewPr[] {
  const running = new Map(bests);
  const found: NewPr[] = [];
  for (const s of sets) {
    for (const score of prScores(s)) {
      const key = keyOf({ skillId: s.skillId, ...score });
      if (!beats(score.value, running.get(key))) continue;
      running.set(key, score.value);
      found.push({
        skillId: s.skillId,
        ...score,
        sessionId: s.sessionId,
        setLogId: s.setLogId,
        achievedAt: s.completedAt!,
        isManual: false,
        note: null,
      });
    }
  }
  return found;
}

/**
 * Rebuilds the logged PRs of a skill's history (FR-10.5): its sets in `completed_at` order, with
 * its manual PRs taking their place by date. Manual rows are kept as they are, so only the
 * logged PRs are returned. A manual PR comes before a set logged at the same moment. To replay
 * from part-way through, pass the bests from before that point; they aren't changed.
 */
export function replayPrs(
  manual: readonly PersonalRecord[],
  sets: readonly PrSet[],
  bests: ReadonlyMap<string, number> = new Map(),
): NewPr[] {
  const running = new Map(bests);
  const found: NewPr[] = [];
  const byTime = [...manual].sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));
  let m = 0;
  for (const s of sets) {
    while (m < byTime.length && byTime[m]!.achievedAt <= (s.completedAt ?? '')) {
      absorb(running, byTime[m]!);
      m += 1;
    }
    const step = detectPrs(running, [s]);
    for (const pr of step) absorb(running, pr);
    found.push(...step);
  }
  return found;
}

function absorb(running: Map<string, number>, r: Keyed & { value: number }): void {
  const key = keyOf(r);
  const best = running.get(key);
  if (best === undefined || r.value > best) running.set(key, r.value);
}

const ALSO_SET_BY: Partial<Record<PrType, PrType>> = {
  reps_at_weight: 'heaviest',
  reps_at_added: 'heaviest_added',
};

/**
 * What a session's summary shows (FR-10.2, §7.7): the best record per (skill, type, weight) it
 * set. A reps-at-weight record is hidden when the same set was also the heaviest (§3.13), and
 * a skill logged for the first time is named under "First log" instead (C-7).
 */
export function sessionHighlights(
  rows: readonly PersonalRecord[],
  firstLogSkills: ReadonlySet<string>,
): { prs: PersonalRecord[]; firstLog: string[] } {
  const firstLog: string[] = [];
  const best = new Map<string, PersonalRecord>();
  for (const r of rows) {
    if (firstLogSkills.has(r.skillId)) {
      if (!firstLog.includes(r.skillId)) firstLog.push(r.skillId);
      continue;
    }
    const alsoBy = ALSO_SET_BY[r.type];
    if (alsoBy && rows.some((o) => o.type === alsoBy && o.setLogId === r.setLogId)) continue;
    const key = keyOf(r);
    const kept = best.get(key);
    if (!kept || r.value > kept.value) best.set(key, r);
  }
  return { prs: [...best.values()], firstLog };
}

/**
 * The current record for each (skill, type, weight), in the order the types first appear. Values
 * only ever rise in the log, so the highest is also the latest.
 */
export function currentBests(records: readonly PersonalRecord[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const r of records) {
    const key = keyOf(r);
    const kept = best.get(key);
    if (!kept || r.value > kept.value) best.set(key, r);
  }
  return [...best.values()];
}

const HEADLINE: readonly PrType[] = ['heaviest', 'heaviest_added', 'max_reps', 'longest_time'];

/** The PR board's headline for a skill: heaviest, or its most reps or longest time (§7.11). */
export function headlinePr(bests: readonly PersonalRecord[]): PersonalRecord | null {
  for (const type of HEADLINE) {
    const found = bests.find((r) => r.type === type);
    if (found) return found;
  }
  return bests[0] ?? null;
}

/**
 * The session each skill was first logged in, from its oldest record (C-7). A skill whose oldest
 * record is manual maps to null: it had a best before its first logged session.
 */
export function firstLogSessions(
  oldestFirst: readonly Pick<PersonalRecord, 'skillId' | 'sessionId' | 'isManual'>[],
): Map<string, string | null> {
  const first = new Map<string, string | null>();
  for (const r of oldestFirst) {
    if (!first.has(r.skillId)) first.set(r.skillId, r.isManual ? null : r.sessionId);
  }
  return first;
}
