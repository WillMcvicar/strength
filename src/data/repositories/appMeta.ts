// app_meta key/value store: 'schema_version', 'seed_version' (DESIGN §4.6).
import { eq } from 'drizzle-orm';

import type { Orm } from '../orm';
import { appMeta } from '../schema';

export function appMetaRepository(o: Orm) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await o.query.appMeta.findFirst({ where: eq(appMeta.key, key) });
      return row?.value ?? null;
    },

    async set(key: string, value: string): Promise<void> {
      await o
        .insert(appMeta)
        .values({ key, value })
        .onConflictDoUpdate({ target: appMeta.key, set: { value } });
    },
  };
}
