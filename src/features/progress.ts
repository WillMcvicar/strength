// Progress's view-models (FR-10.3, DESIGN §7.11): the PR board, one row per skill with logged
// sets and its headline record, and an exercise's detail: its current PRs, 1RM history and
// recent sessions. Update 1RM between plans (FR-3.11) arrives with Slice 11.
import {
  currentBests,
  headlinePr,
  type LocalDate,
  type OneRepMaxHistory,
  type PersonalRecord,
  type Unit,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { prView, type PrView } from './prs';
import { useLiveQuery } from './useLiveQuery';

export interface PrBoardRowView {
  skillId: string;
  name: string;
  /** Null for a skill with no records, such as a completion-only item. */
  headline: PrView | null;
}

export type PrBoardView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; unit: Unit; rows: PrBoardRowView[] };

/** The board, narrowed to skills whose name contains `query` (§7.11 "searchable"). */
export function usePrBoard(query = ''): PrBoardView {
  const view = useLiveQuery(readPrBoard, []);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', unit: view.data.unit, rows: filterBoard(view.data.rows, query) };
}

export function filterBoard(rows: readonly PrBoardRowView[], query: string): PrBoardRowView[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : [...rows];
}

export async function readPrBoard(db: Db): Promise<{ unit: Unit; rows: PrBoardRowView[] }> {
  const r = repositories(db);
  const skillIds = await r.sessions.loggedSkillIds();
  const [settings, skills, records] = await Promise.all([
    r.settings.get(),
    r.skills.getMany(skillIds),
    r.prs.bySkills(skillIds),
  ]);
  const bySkill = groupBySkill(records);
  const headlines = skills.map((skill) => ({
    skill,
    headline: headlinePr(currentBests(bySkill.get(skill.id) ?? [])),
  }));
  const days = await r.sessions.localDates(sessionIdsOf(headlines.map((h) => h.headline)));
  const rows = headlines.map(({ skill, headline }) => ({
    skillId: skill.id,
    name: skill.name,
    headline: headline ? prView(headline, skill, days) : null,
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { unit: settings.unit, rows };
}

export interface OneRmHistoryItemView {
  id: string;
  oneRmKg: number;
  source: OneRepMaxHistory['source'];
  setAt: string;
  note: string | null;
}

export interface RecentSessionView {
  id: string;
  name: string;
  localDate: LocalDate;
}

export interface ExerciseDetailView {
  skillId: string;
  name: string;
  unit: Unit;
  /** The current best of each type and weight (§3.13). */
  prs: PrView[];
  oneRmHistory: OneRmHistoryItemView[];
  recent: RecentSessionView[];
}

export type ExerciseDetailScreenView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; detail: ExerciseDetailView | null };

export function useExerciseDetail(skillId: string): ExerciseDetailScreenView {
  const view = useLiveQuery((db) => readExerciseDetail(db, skillId), [skillId]);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', detail: view.data };
}

const RECENT_SESSIONS = 10;

export async function readExerciseDetail(
  db: Db,
  skillId: string,
): Promise<ExerciseDetailView | null> {
  const r = repositories(db);
  const skill = await r.skills.get(skillId);
  if (!skill) return null;
  const [settings, records, oneRms, recent] = await Promise.all([
    r.settings.get(),
    r.prs.bySkills([skillId]),
    r.oneRepMax.bySkill(skillId),
    r.sessions.completedWithSkill(skillId, RECENT_SESSIONS),
  ]);
  const bests = currentBests(records);
  const days = await r.sessions.localDates(sessionIdsOf(bests));
  return {
    skillId,
    name: skill.name,
    unit: settings.unit,
    prs: bests.map((row) => prView(row, skill, days)),
    oneRmHistory: oneRms.map((row) => ({
      id: row.id,
      oneRmKg: row.oneRmKg,
      source: row.source,
      setAt: row.setAt,
      note: row.note,
    })),
    recent: recent.map((s) => ({ id: s.id, name: s.name, localDate: s.localDate })),
  };
}

function groupBySkill(records: readonly PersonalRecord[]): Map<string, PersonalRecord[]> {
  const bySkill = new Map<string, PersonalRecord[]>();
  for (const row of records) {
    const group = bySkill.get(row.skillId);
    if (group) group.push(row);
    else bySkill.set(row.skillId, [row]);
  }
  return bySkill;
}

const sessionIdsOf = (records: readonly (PersonalRecord | null)[]): string[] =>
  records.flatMap((row) => (row?.sessionId ? [row.sessionId] : []));
