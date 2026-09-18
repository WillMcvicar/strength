// The built-in Skill Library seed (FR-1.1, FR-1.2, FR-1.8, DESIGN §4.6).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { runSeed, SEED_VERSION } from '@/data/seed';
import { SEED_SKILLS } from '@/data/seed/skills';

import { openMigratedTestDb, SEEDED_AT } from '../../../test/db/betterSqlite3';

let db: Db;

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('seed', () => {
  it('FR-1.1 seeds every built-in skill and records seed_version', async () => {
    const all = await repositories(db).skills.search({ includeArchived: true });
    expect(all).toHaveLength(SEED_SKILLS.length);
    expect(all.every((s) => !s.isCustom && s.createdAt === SEEDED_AT)).toBe(true);
    expect(await repositories(db).appMeta.get('seed_version')).toBe(String(SEED_VERSION));
  });

  it('is idempotent', async () => {
    await runSeed(db, '2027-01-01T00:00:00.000Z');
    expect(await repositories(db).skills.search()).toHaveLength(SEED_SKILLS.length);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM settings')).toEqual({ n: 1 });
  });

  it('never touches custom skills or user settings on a seed upgrade (§4.6)', async () => {
    const { skills, settings, appMeta } = repositories(db);
    await skills.insert({
      ...(await skills.get('skill_plank'))!,
      id: 'mine',
      name: 'My plank',
      isCustom: true,
    });
    await settings.update({ unit: 'lb' });
    await appMeta.set('seed_version', '0');

    await runSeed(db, '2027-01-01T00:00:00.000Z');

    expect(await skills.get('mine')).toMatchObject({ name: 'My plank', isCustom: true });
    expect((await settings.get()).unit).toBe('lb');
    expect(await appMeta.get('seed_version')).toBe(String(SEED_VERSION));
  });

  it('uses readable, fixed IDs (DESIGN §4.1)', () => {
    for (const s of SEED_SKILLS) expect(s.id).toMatch(/^skill_[a-z_]+$/);
    expect(new Set(SEED_SKILLS.map((s) => s.id)).size).toBe(SEED_SKILLS.length);
  });

  it('FR-1.2 covers every tracking type, and FR-1.8 both conventions and unilateral', () => {
    expect(new Set(SEED_SKILLS.map((s) => s.trackingType))).toEqual(
      new Set(['weight_reps', 'reps_only', 'bodyweight_plus_load', 'time', 'completion_only']),
    );
    expect(new Set(SEED_SKILLS.map((s) => s.loadConvention))).toEqual(
      new Set(['total', 'per_side']),
    );
    expect(SEED_SKILLS.some((s) => s.isUnilateral && s.loadConvention === 'per_side')).toBe(true);
    expect(SEED_SKILLS.some((s) => s.isUnilateral && s.loadConvention === 'total')).toBe(true);
  });

  it('covers all 14 muscle groups as a primary muscle', () => {
    expect(new Set(SEED_SKILLS.map((s) => s.muscleGroup)).size).toBe(14);
  });

  it('FR-1.1 flags the four main lifts', () => {
    expect(
      SEED_SKILLS.filter((s) => s.isMainLift)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['skill_back_squat', 'skill_bench_press', 'skill_deadlift', 'skill_overhead_press']);
  });
});
