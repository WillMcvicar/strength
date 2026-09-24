// Development mode only (`__DEV__`, including Expo Go): put the database back to how it looks
// straight after a fresh install, so the first-launch flow can be walked again while testing
// (docs/BUILD_PLAN.md Slice 5). The More tab offers it only when `__DEV__` is true, and
// `src/features/devTools.ts` keeps it out of production bundles entirely.
//
// The seeded skills and templates stay, because a fresh install has them too: `runSeed` puts them
// there before any screen renders (DESIGN §4.6). Everything the user made goes.
import type { Db } from '@/data/db';

import { exclusive, type ServiceResult } from '../context';

/**
 * Child before parent, so this holds whether or not a cascade covers it. `plan` takes its phases
 * and their whole blueprint with it; template phases are left alone, since they are seed data.
 */
const CLEAR = [
  'set_log',
  'session_exercise',
  'session',
  'personal_record',
  'one_rep_max_history',
  'cycle_review_item',
  'cycle_review',
  'schedule_change',
  'double_progression_state',
  'planned_workout',
  'plan',
] as const;

export type ResetAppDataResult = ServiceResult<never>;

export function resetAppData(db: Db): Promise<ResetAppDataResult> {
  return exclusive(db, async (tx) => {
    for (const table of CLEAR) await tx.runAsync(`DELETE FROM ${table}`);
    await tx.runAsync('DELETE FROM skill WHERE is_custom = 1');
    // Re-inserting the singleton restores every DDL default, including the null
    // `disclaimer_ack_at` and `onboarding_completed_at` that the launch rules read (§7.1).
    await tx.runAsync('DELETE FROM settings');
    await tx.runAsync('INSERT INTO settings (id) VALUES (1)');
    return { ok: true };
  });
}
