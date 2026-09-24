// The session note and effort rating (FR-9.7). They're set during the session or on its summary
// (DESIGN §7.6, §7.7), so a finished session accepts them too; neither affects PRs or volume.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface SessionDetailsInput {
  sessionId: string;
  /** Blank means none. Left out, it is unchanged. */
  notes?: string | null;
  /** Effort, a whole number 1–10. Left out, it is unchanged. */
  rpe?: number | null;
}

export type UpdateSessionDetailsResult = ServiceResult<'not_found' | 'bad_rpe'>;

export function updateSessionDetails(
  db: Db,
  input: SessionDetailsInput,
  ctx: ServiceContext,
): Promise<UpdateSessionDetailsResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const session = await r.sessions.get(input.sessionId);
    if (!session) return { ok: false, reason: 'not_found' };
    const rpe = input.rpe;
    if (rpe != null && !(Number.isInteger(rpe) && rpe >= 1 && rpe <= 10)) {
      return { ok: false, reason: 'bad_rpe' };
    }

    await r.sessions.update(session.id, {
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
      ...(rpe !== undefined && { rpe }),
      updatedAt: ctx.now,
    });
    return { ok: true };
  });
}
