// Discard an in-progress session after the user confirms (FR-9.11, DESIGN §7.6). Its exercises
// and sets go with it; the planned workout was never linked, so it stays open. A finished session
// is removed from History instead (FR-9.12), which also replays PRs.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export type DiscardSessionResult = ServiceResult<'not_in_progress'>;

// No reconcile: an in-progress session changes no plan state (DESIGN §2.5).
export function discardSession(
  db: Db,
  input: { sessionId: string },
  _ctx: ServiceContext,
): Promise<DiscardSessionResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const session = await r.sessions.get(input.sessionId);
    if (!session || session.status !== 'in_progress') {
      return { ok: false, reason: 'not_in_progress' };
    }
    await r.sessions.delete(session.id);
    return { ok: true };
  });
}
