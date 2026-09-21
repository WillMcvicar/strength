// Record that the user tapped "I understand" on the first-launch disclaimer (FR-5.2). The first
// acknowledgement stands; the disclaimer is never shown again automatically (FR-5.3).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext } from './context';

// No reconcile: this changes no plan state (DESIGN §2.5).
export function acknowledgeDisclaimer(db: Db, ctx: ServiceContext): Promise<void> {
  return exclusive(db, async (tx) => {
    const settings = repositories(tx).settings;
    if ((await settings.get()).disclaimerAckAt !== null) return;
    await settings.update({ disclaimerAckAt: ctx.now });
  });
}
