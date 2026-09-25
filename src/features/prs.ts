// PR views shared by the session summary, Today, History and Progress (FR-10.2, FR-10.3, DESIGN
// §7.7, §7.11). Which records to show is decided in src/core/prs.ts; this reads and names them.
import {
  firstLogSessions,
  sessionHighlights,
  type PersonalRecord,
  type PrType,
  type Skill,
} from '@/core';
import type { Repositories } from '@/data/repositories';

/** A record with what the UI needs to word it (§7.7): "Bench press · Heaviest · 82.5 kg". */
export interface PrView {
  id: string;
  skillId: string;
  skillName: string;
  type: PrType;
  /** kg, reps or seconds, by type (§3.13). */
  value: number;
  contextWeightKg: number | null;
  /** Loads of a per-side skill read "22.5 kg × 2" (FR-1.8). */
  perSide: boolean;
  achievedAt: string;
  sessionId: string | null;
}

export interface SessionPrsView {
  /** New PRs, best per type (§3.13). */
  prs: PrView[];
  /** Skills logged for the first time, named "First log" rather than celebrated (C-7). */
  firstLog: string[];
}

export function prView(record: PersonalRecord, skill: Skill | undefined): PrView {
  return {
    id: record.id,
    skillId: record.skillId,
    skillName: skill?.name ?? 'Unknown exercise',
    type: record.type,
    value: record.value,
    contextWeightKg: record.contextWeightKg,
    perSide: skill?.loadConvention === 'per_side',
    achievedAt: record.achievedAt,
    sessionId: record.sessionId,
  };
}

/** What a finished session's summary, Today card and detail show (FR-10.2, C-7). */
export async function readSessionPrs(r: Repositories, sessionId: string): Promise<SessionPrsView> {
  const rows = await r.prs.bySession(sessionId);
  if (rows.length === 0) return { prs: [], firstLog: [] };
  const skillIds = [...new Set(rows.map((row) => row.skillId))];
  const [history, skills] = await Promise.all([
    r.prs.bySkills(skillIds),
    r.skills.getMany(skillIds),
  ]);
  const first = firstLogSessions(history);
  const firstLogSkills = new Set(skillIds.filter((id) => first.get(id) === sessionId));
  const shown = sessionHighlights(rows, firstLogSkills);
  const byId = new Map(skills.map((s) => [s.id, s]));
  return {
    prs: shown.prs.map((row) => prView(row, byId.get(row.skillId))),
    firstLog: shown.firstLog.map((id) => byId.get(id)?.name ?? 'Unknown exercise'),
  };
}
