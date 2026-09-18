// The Skill Library repository (FR-1.1, FR-1.4, FR-1.5).
import type { Skill } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb, SEEDED_AT } from '../../../test/db/betterSqlite3';

let db: Db;

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

const names = (skills: Skill[]) => skills.map((s) => s.name);

const custom: Skill = {
  id: 'c1',
  name: 'Zercher squat',
  muscleGroup: 'quads',
  secondaryMuscles: ['glutes', 'abs'],
  equipment: 'barbell',
  trackingType: 'weight_reps',
  loadConvention: 'total',
  isUnilateral: false,
  isMainLift: false,
  loadIncrementKg: 1.25,
  loadIncrementLb: null,
  isCustom: true,
  isArchived: false,
  createdAt: '2026-09-15T08:00:00.000Z',
  updatedAt: '2026-09-15T08:00:00.000Z',
};

describe('skill repository', () => {
  it('maps a seeded skill to the core shape (FR-1.8)', async () => {
    expect(await repositories(db).skills.get('skill_bulgarian_split_squat')).toEqual({
      id: 'skill_bulgarian_split_squat',
      name: 'Bulgarian split squat',
      muscleGroup: 'quads',
      secondaryMuscles: ['glutes'],
      equipment: 'dumbbell',
      trackingType: 'weight_reps',
      loadConvention: 'per_side',
      isUnilateral: true,
      isMainLift: false,
      loadIncrementKg: 2,
      loadIncrementLb: 5,
      isCustom: false,
      isArchived: false,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    });
    expect(await repositories(db).skills.get('nope')).toBeNull();
  });

  it('round-trips a custom skill and its edits (FR-1.3)', async () => {
    const { skills } = repositories(db);
    await skills.insert(custom);
    expect(await skills.get('c1')).toEqual(custom);

    await skills.update('c1', { name: 'Zercher squat (pause)', loadIncrementKg: null });
    expect(await skills.get('c1')).toMatchObject({
      name: 'Zercher squat (pause)',
      loadIncrementKg: null,
    });
  });

  describe('FR-1.4 search and filter', () => {
    it('matches a name substring, ignoring case, in name order', async () => {
      expect(names(await repositories(db).skills.search({ query: 'SQUAT' }))).toEqual([
        'Back squat',
        'Bulgarian split squat',
        'Front squat',
      ]);
    });

    it('filters by muscle group and equipment together', async () => {
      const found = await repositories(db).skills.search({
        muscleGroup: 'quads',
        equipment: 'machine',
      });
      expect(names(found)).toEqual(['Leg extension', 'Leg press']);
    });

    it('treats LIKE wildcards in the query literally', async () => {
      expect(await repositories(db).skills.search({ query: '%' })).toEqual([]);
      expect(await repositories(db).skills.search({ query: '_' })).toEqual([]);
    });

    it('returns every skill for an empty or blank query', async () => {
      const all = await repositories(db).skills.search();
      expect(await repositories(db).skills.search({ query: '  ' })).toEqual(all);
      expect(all.length).toBeGreaterThan(30);
    });
  });

  it('FR-1.5 hides archived skills from pickers unless asked for', async () => {
    const { skills } = repositories(db);
    await skills.update('skill_plank', { isArchived: true });

    expect(names(await skills.search({ query: 'plank' }))).toEqual([]);
    expect(names(await skills.search({ query: 'plank', includeArchived: true }))).toEqual([
      'Plank',
    ]);
  });
});
