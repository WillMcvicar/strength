// The post-commit signal behind live reads (D-32, DESIGN §2.4).
import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';

describe('liveDb (D-32)', () => {
  let db: Db;
  let live: LiveDb;

  beforeEach(async () => {
    db = await openMigratedTestDb();
    live = liveDb(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('signals once per committed transaction, after the commit', async () => {
    const seen: string[] = [];
    live.subscribe(() => {
      // A read on the outer connection when the signal fires sees the committed row.
      void repositories(live.db)
        .settings.get()
        .then((s) => seen.push(s.unit));
    });

    await live.db.withExclusiveTransactionAsync(async (tx) => {
      await repositories(tx).settings.update({ unit: 'lb' });
      await repositories(tx).settings.update({ defaultRestSec: 150 });
    });
    await new Promise(setImmediate);

    expect(seen).toEqual(['lb']);
  });

  it('never signals during the transaction', async () => {
    const listener = jest.fn();
    live.subscribe(listener);

    await live.db.withExclusiveTransactionAsync(async (tx) => {
      await repositories(tx).settings.update({ unit: 'lb' });
      expect(listener).not.toHaveBeenCalled();
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not signal a rollback, and rethrows its error', async () => {
    const listener = jest.fn();
    live.subscribe(listener);

    await expect(
      live.db.withExclusiveTransactionAsync(async (tx) => {
        await repositories(tx).settings.update({ unit: 'lb' });
        throw new Error('rejected');
      }),
    ).rejects.toThrow('rejected');

    expect(listener).not.toHaveBeenCalled();
    expect((await repositories(live.db).settings.get()).unit).toBe('kg');
  });

  it('still resolves the committed transaction, and signals the others, if a listener throws', async () => {
    const reported: unknown[] = [];
    const queue = jest.spyOn(global, 'queueMicrotask').mockImplementation((report) => {
      try {
        report();
      } catch (error) {
        reported.push(error);
      }
    });
    const after = jest.fn();
    live.subscribe(() => {
      throw new Error('listener bug');
    });
    live.subscribe(after);

    await expect(
      live.db.withExclusiveTransactionAsync(async (tx) => {
        await repositories(tx).settings.update({ unit: 'lb' });
      }),
    ).resolves.toBeUndefined();

    expect(after).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([new Error('listener bug')]);
    queue.mockRestore();
  });

  it('stops signalling a listener once it unsubscribes', async () => {
    const kept = jest.fn();
    const dropped = jest.fn();
    live.subscribe(kept);
    const unsubscribe = live.subscribe(dropped);
    unsubscribe();

    await live.db.withExclusiveTransactionAsync(async () => {});

    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });

  it('passes reads and closing straight through to the database', async () => {
    const rows = await live.db.getAllAsync<{ n: number }>('SELECT 1 AS n');
    expect(rows).toEqual([{ n: 1 }]);
    expect(await live.db.getFirstAsync<{ n: number }>('SELECT 2 AS n')).toEqual({ n: 2 });
    expect(await live.db.getAllRawAsync('SELECT 3')).toEqual([[3]]);
    await live.db.execAsync('CREATE TEMP TABLE t (x INTEGER)');
    expect(await live.db.runAsync('INSERT INTO t VALUES (?)', [4])).toMatchObject({ changes: 1 });
  });
});
