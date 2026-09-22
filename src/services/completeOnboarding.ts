// Finish onboarding (FR-12.1, DESIGN §7.15 steps 3–5). The unit the user chose is saved with the
// timestamp that closes launch rule 3 (§7.1), so the stack can never land back here half-set-up.
import type { Unit } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext } from './context';

// No reconcile: this changes no plan state (DESIGN §2.5).
export function completeOnboarding(db: Db, unit: Unit, ctx: ServiceContext): Promise<void> {
  return exclusive(db, async (tx) => {
    const settings = repositories(tx).settings;
    // The first run stands, like the disclaimer (FR-5.3): Settings changes the unit after this.
    if ((await settings.get()).onboardingCompletedAt !== null) return;
    await settings.update({ unit, onboardingCompletedAt: ctx.now });
  });
}
