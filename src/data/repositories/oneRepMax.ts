// 1RM history (SRS §4). A plan's cycles resolve their 1RM from these rows (DESIGN §3.3, C-9).
import { asc, eq } from 'drizzle-orm';

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

    async insert(row: OneRepMaxHistory): Promise<void> {
      await o.insert(oneRepMaxHistory).values(row);
    },
  };
}
