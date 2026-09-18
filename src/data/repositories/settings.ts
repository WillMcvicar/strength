// The settings singleton, row id 1, created by the seed (FR-12).
import { eq } from 'drizzle-orm';

import type { Settings } from '@/core/types';

import type { Orm } from '../orm';
import { settings } from '../schema';

export type SettingsPatch = Partial<Omit<Settings, 'id'>>;

export function settingsRepository(o: Orm) {
  return {
    async get(): Promise<Settings> {
      const row = await o.query.settings.findFirst({ where: eq(settings.id, 1) });
      if (!row) throw new Error('The settings row is missing; initDatabase seeds it.');
      return row;
    },

    async update(patch: SettingsPatch): Promise<void> {
      await o.update(settings).set(patch).where(eq(settings.id, 1));
    },
  };
}
