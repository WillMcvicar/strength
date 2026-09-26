// The settings singleton and app_meta (FR-12, DESIGN §4.6).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { SEED_VERSION } from '@/data/seed';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';

let db: Db;

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('settings repository', () => {
  it('reads the seeded singleton with the §4.3 defaults', async () => {
    expect(await repositories(db).settings.get()).toEqual({
      id: 1,
      unit: 'kg',
      defaultRestSec: 120,
      weekStart: 1,
      weightIncrementKg: 2.5,
      weightIncrementLb: 5,
      reminderEnabled: false,
      reminderTime: null,
      restTimerAlerts: true,
      keepAwake: true,
      theme: 'system',
      disclaimerAckAt: null,
      tipsEnabled: true,
      seenTips: [],
      onboardingCompletedAt: null,
      lastExportAt: null,
      backupReminderDismissedAt: null,
      autoBackupEnabled: false,
      lastAutoBackupAt: null,
      lastAutoBackupError: null,
    });
  });

  it('round-trips booleans, JSON and nullable text', async () => {
    const { settings } = repositories(db);
    await settings.update({
      unit: 'lb',
      weekStart: 0,
      keepAwake: false,
      seenTips: ['rpe', 'tm'],
      disclaimerAckAt: '2026-09-14T08:00:00.000Z',
    });

    expect(await settings.get()).toMatchObject({
      unit: 'lb',
      weekStart: 0,
      keepAwake: false,
      seenTips: ['rpe', 'tm'],
      disclaimerAckAt: '2026-09-14T08:00:00.000Z',
    });
    expect(await db.getFirstAsync('SELECT keep_awake, seen_tips FROM settings')).toEqual({
      keep_awake: 0,
      seen_tips: '["rpe","tm"]',
    });
  });

  it('fails loudly if the singleton is missing', async () => {
    await db.runAsync('DELETE FROM settings');
    await expect(repositories(db).settings.get()).rejects.toThrow(/settings row is missing/);
  });
});

describe('app_meta repository', () => {
  it('holds the schema and seed versions (NFR-4)', async () => {
    const { appMeta } = repositories(db);
    expect(await appMeta.get('schema_version')).toBe('4');
    expect(await appMeta.get('seed_version')).toBe(String(SEED_VERSION));
    expect(await appMeta.get('nope')).toBeNull();
  });

  it('inserts and overwrites', async () => {
    const { appMeta } = repositories(db);
    await appMeta.set('k', 'a');
    await appMeta.set('k', 'b');
    expect(await appMeta.get('k')).toBe('b');
  });
});
