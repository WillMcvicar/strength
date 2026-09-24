// Dismiss a one-time tip (FR-6.2, DESIGN §6.5 TipCard). Its key joins `settings.seen_tips`, so it
// never shows again unless the tips are reset in Settings (Slice 14).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

// No reconcile: this changes no plan state (DESIGN §2.5).
export function dismissTip(
  db: Db,
  input: { key: string },
  _ctx: ServiceContext,
): Promise<ServiceResult<never>> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const { seenTips } = await r.settings.get();
    if (!seenTips.includes(input.key)) {
      await r.settings.update({ seenTips: [...seenTips, input.key] });
    }
    return { ok: true };
  });
}
