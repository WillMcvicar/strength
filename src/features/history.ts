// History's view-model (FR-11.1, DESIGN §7.12): completed sessions, newest first, grouped by the
// month they were logged in. A session shows ★ when it set a new PR; a first log alone doesn't
// count (C-7). Session detail reads through `useSession`.
import { firstLogSessions, sessionHighlights, type LocalDate, type PersonalRecord } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { secondsBetween } from './device';
import { useLiveQuery } from './useLiveQuery';

export interface HistoryItemView {
  id: string;
  localDate: LocalDate;
  name: string;
  durationMin: number;
  hasPrs: boolean;
}

export interface HistoryMonthView {
  /** `YYYY-MM`, worded by the screen. */
  month: string;
  sessions: HistoryItemView[];
}

export type HistoryView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; months: HistoryMonthView[] };

export function useHistory(): HistoryView {
  const view = useLiveQuery(readHistory, []);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', months: view.data };
}

export async function readHistory(db: Db): Promise<HistoryMonthView[]> {
  const r = repositories(db);
  const [sessions, records] = await Promise.all([r.sessions.completed(), r.prs.all()]);
  const first = firstLogSessions(records);
  const bySession = new Map<string, PersonalRecord[]>();
  for (const row of records) {
    if (row.sessionId === null) continue;
    bySession.set(row.sessionId, [...(bySession.get(row.sessionId) ?? []), row]);
  }

  const months: HistoryMonthView[] = [];
  for (const s of sessions) {
    const rows = bySession.get(s.id) ?? [];
    const firstLogs = new Set(
      rows.filter((row) => first.get(row.skillId) === s.id).map((row) => row.skillId),
    );
    const item: HistoryItemView = {
      id: s.id,
      localDate: s.localDate,
      name: s.name,
      durationMin: s.endedAt ? Math.round(secondsBetween(s.startedAt, s.endedAt) / 60) : 0,
      hasPrs: sessionHighlights(rows, firstLogs).prs.length > 0,
    };
    const month = s.localDate.slice(0, 7);
    const last = months.at(-1);
    if (last?.month === month) last.sessions.push(item);
    else months.push({ month, sessions: [item] });
  }
  return months;
}
