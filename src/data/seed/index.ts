// Seeding (DESIGN §4.6). Versioned separately from the schema: `app_meta.seed_version` is the
// export `seedVersion`. Upgrades add built-ins and never touch custom skills or user templates.
// Templates are seeded once OQ-1 settles their exercises.
import type { Db } from '../db';
import { orm } from '../orm';
import { appMeta, settings, skill } from '../schema';
import { SEED_SKILLS } from './skills';

export const SEED_VERSION = 1;

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

    await o
      .insert(appMeta)
      .values({ key: 'seed_version', value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: String(SEED_VERSION) } });
  });
}
