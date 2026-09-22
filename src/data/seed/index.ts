// Seeding (DESIGN §4.6). Versioned separately from the schema: `app_meta.seed_version` is the
// export `seedVersion`. Upgrades add built-ins and never touch custom skills or user templates.
import type { Db } from '../db';
import { orm } from '../orm';
import { appMeta, settings, skill } from '../schema';
import { SEED_SKILLS } from './skills';
import { seedTemplates } from './templates';

export const SEED_VERSION = 2;

export async function runSeed(db: Db, now: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const o = orm(tx);

    // The settings singleton: every default comes from the DDL.
    await o.insert(settings).values({ id: 1 }).onConflictDoNothing();

    const row = await o.query.appMeta.findFirst({
      where: (meta, { eq }) => eq(meta.key, 'seed_version'),
    });
    if (Number(row?.value ?? 0) >= SEED_VERSION) return;

    for (const s of SEED_SKILLS) {
      await o
        .insert(skill)
        .values({ ...s, isCustom: false, isArchived: false, createdAt: now, updatedAt: now })
        .onConflictDoNothing();
    }

    // Built-in templates (FR-2.1). Their exercises are placeholders until OQ-1 settles (§4.6).
    await seedTemplates(o, now);

    await o
      .insert(appMeta)
      .values({ key: 'seed_version', value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: String(SEED_VERSION) } });
  });
}
