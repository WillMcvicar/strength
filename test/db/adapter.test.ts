// Proves the better-sqlite3 test driver satisfies the `Db` interface (DESIGN §9.1), including the
// exclusive transaction behaviour that every service depends on (C-15).
import type { Db } from '@/data/db';

import { openTestDb } from './betterSqlite3';

describe('better-sqlite3 adapter', () => {
  let db: Db;

  beforeEach(async () => {
    db = openTestDb();
    await db.execAsync('CREATE TABLE skill (id TEXT PRIMARY KEY, one_rm_kg REAL NOT NULL)');
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('runs writes and reads them back', async () => {
    const result = await db.runAsync('INSERT INTO skill VALUES (?, ?)', ['squat', 110]);
    expect(result.changes).toBe(1);

    expect(await db.getFirstAsync('SELECT * FROM skill WHERE id = ?', ['squat'])).toEqual({
      id: 'squat',
      one_rm_kg: 110,
    });
    expect(await db.getAllAsync('SELECT * FROM skill')).toHaveLength(1);
  });

  it('reads rows as positional arrays, keeping duplicate column names from a join', async () => {
    await db.runAsync('INSERT INTO skill VALUES (?, ?)', ['squat', 110]);

    expect(await db.getAllRawAsync('SELECT a.id, b.id FROM skill a JOIN skill b')).toEqual([
      ['squat', 'squat'],
    ]);
    expect(await db.getAllRawAsync('SELECT * FROM skill WHERE id = ?', ['nope'])).toEqual([]);
  });

  it('returns null rather than undefined when a row is missing', async () => {
    expect(await db.getFirstAsync('SELECT * FROM skill WHERE id = ?', ['nope'])).toBeNull();
  });

  it('commits an exclusive transaction that succeeds', async () => {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('INSERT INTO skill VALUES (?, ?)', ['bench', 80]);
      await tx.runAsync('INSERT INTO skill VALUES (?, ?)', ['deadlift', 140]);
    });

    expect(await db.getAllAsync('SELECT * FROM skill')).toHaveLength(2);
  });

  it('rolls the whole transaction back when the task throws (C-15)', async () => {
    await expect(
      db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('INSERT INTO skill VALUES (?, ?)', ['bench', 80]);
        throw new Error('service failed halfway');
      }),
    ).rejects.toThrow('service failed halfway');

    expect(await db.getAllAsync('SELECT * FROM skill')).toHaveLength(0);
  });

  it('enforces foreign keys, so DDL constraints are exercised in tests', async () => {
    await db.execAsync(
      'CREATE TABLE plan_skill (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skill(id))',
    );
    await expect(
      db.runAsync('INSERT INTO plan_skill VALUES (?, ?)', ['ps1', 'missing']),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });
});
