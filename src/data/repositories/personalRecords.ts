// Personal records (FR-10, DESIGN §3.13): an event log that services append to on finish and
// rebuild by replay after a past session changes (FR-10.5). Deleting a session removes its rows
// through `ON DELETE CASCADE`. Rows from one set share a time, so ties keep insertion order.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { PersonalRecord } from '@/core/types';

import type { Orm } from '../orm';
import { personalRecord } from '../schema';

export function personalRecordRepository(o: Orm) {
  return {
    async insertMany(rows: readonly PersonalRecord[]): Promise<void> {
      if (rows.length === 0) return;
      await o.insert(personalRecord).values([...rows]);
    },

    /** The session's records in the order they were set. */
    async bySession(sessionId: string): Promise<PersonalRecord[]> {
      return o
        .select()
        .from(personalRecord)
        .where(eq(personalRecord.sessionId, sessionId))
        .orderBy(asc(personalRecord.achievedAt), asc(sql`rowid`));
    },

    /** Every record for these skills, oldest first. */
    async bySkills(skillIds: readonly string[]): Promise<PersonalRecord[]> {
      if (skillIds.length === 0) return [];
      return o
        .select()
        .from(personalRecord)
        .where(inArray(personalRecord.skillId, [...skillIds]))
        .orderBy(asc(personalRecord.achievedAt), asc(sql`rowid`));
    },

    /** Every record, oldest first, for the PR board (FR-10.3). */
    async all(): Promise<PersonalRecord[]> {
      return o
        .select()
        .from(personalRecord)
        .orderBy(asc(personalRecord.achievedAt), asc(sql`rowid`));
    },

    /** Clears the logged records of these skills before a replay; manual ones stay (FR-10.6). */
    async deleteLogged(skillIds: readonly string[]): Promise<void> {
      if (skillIds.length === 0) return;
      await o
        .delete(personalRecord)
        .where(
          and(inArray(personalRecord.skillId, [...skillIds]), eq(personalRecord.isManual, false)),
        );
    },
  };
}
