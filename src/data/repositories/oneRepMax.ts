// 1RM history (SRS §4). A plan's cycles resolve their 1RM from these rows (DESIGN §3.3, C-9).
import { asc, desc, eq, inArray } from 'drizzle-orm';

import type { OneRepMaxHistory } from '@/core/types';

import type { Orm } from '../orm';
import { oneRepMaxHistory } from '../schema';

export function oneRepMaxRepository(o: Orm) {
  return {
    /** The plan's rows, by skill then `set_at`. */
    async listByPlan(planId: string): Promise<OneRepMaxHistory[]> {
      return o
        .select()
        .from(oneRepMaxHistory)
        .where(eq(oneRepMaxHistory.planId, planId))
        .orderBy(asc(oneRepMaxHistory.skillId), asc(oneRepMaxHistory.setAt));
    },

    /**
     * Each skill's current 1RM: its newest row, whichever plan set it (FR-3.3). Plan setup
     * pre-fills from these, so a new plan starts where the last one left off.
     */
    async latestBySkill(skillIds: readonly string[]): Promise<Map<string, OneRepMaxHistory>> {
      if (skillIds.length === 0) return new Map();
      const rows = await o
        .select()
        .from(oneRepMaxHistory)
        .where(inArray(oneRepMaxHistory.skillId, [...skillIds]))
        .orderBy(asc(oneRepMaxHistory.skillId), desc(oneRepMaxHistory.setAt));
      const latest = new Map<string, OneRepMaxHistory>();
      for (const row of rows) if (!latest.has(row.skillId)) latest.set(row.skillId, row);
      return latest;
    },

    async insert(row: OneRepMaxHistory): Promise<void> {
      await o.insert(oneRepMaxHistory).values(row);
    },
  };
}
