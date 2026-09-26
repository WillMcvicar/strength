// Double-progression tracks (DESIGN §3.12, §4.3 `double_progression_state`): one row per cycle
// exercise, so every slot of a workout shares it (D-20). Services write them on finish and
// rebuild them by replay after a past session changes (C-4).
import { inArray } from 'drizzle-orm';

import type { DoubleProgressionState } from '@/core/types';

import type { Orm } from '../orm';
import { doubleProgressionState } from '../schema';

export interface ProgressionRow extends DoubleProgressionState {
  cycleExerciseId: string;
  planId: string;
}

export function doubleProgressionRepository(o: Orm) {
  return {
    /** The tracks of these cycle exercises, by id. Exercises with no row are left out. */
    async getMany(cycleExerciseIds: readonly string[]): Promise<Map<string, ProgressionRow>> {
      if (cycleExerciseIds.length === 0) return new Map();
      const rows = await o
        .select()
        .from(doubleProgressionState)
        .where(inArray(doubleProgressionState.cycleExerciseId, [...cycleExerciseIds]));
      return new Map(rows.map((row) => [row.cycleExerciseId, row]));
    },

    /** New tracks at plan start (§8.1 step 5); a track that already exists is kept. */
    async insertMany(rows: readonly ProgressionRow[]): Promise<void> {
      if (rows.length === 0) return;
      await o
        .insert(doubleProgressionState)
        .values([...rows])
        .onConflictDoNothing();
    },

    async upsert(row: ProgressionRow): Promise<void> {
      const { cycleExerciseId, ...rest } = row;
      await o
        .insert(doubleProgressionState)
        .values(row)
        .onConflictDoUpdate({ target: doubleProgressionState.cycleExerciseId, set: rest });
    },
  };
}
