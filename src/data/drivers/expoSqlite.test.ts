// The device driver's exclusive transactions (C-15, D-35). expo-sqlite itself only runs on a
// device, so this checks the calls we make against a recording mock: its own connection, foreign
// keys switched on before BEGIN EXCLUSIVE, then COMMIT or ROLLBACK, and the connection always
// closed. A device run is still the real test.
import * as SQLite from 'expo-sqlite';

import { openDeviceDb } from './expoSqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

let log: string[];

function handle(name: string) {
  return {
    execAsync: jest.fn(async (sql: string) => {
      log.push(`${name}: ${sql}`);
    }),
    runAsync: jest.fn(async (sql: string) => {
      log.push(`${name}: run ${sql}`);
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    closeAsync: jest.fn(async () => {
      log.push(`${name}: close`);
    }),
  };
}

let main: ReturnType<typeof handle>;
let txn: ReturnType<typeof handle>;

beforeEach(() => {
  log = [];
  main = handle('main');
  txn = handle('txn');
  jest
    .mocked(SQLite.openDatabaseAsync)
    .mockReset()
    .mockImplementation(async (_name, options) => {
      log.push(`open ${options?.useNewConnection ? 'new connection' : 'main'}`);
      return (options?.useNewConnection ? txn : main) as unknown as SQLite.SQLiteDatabase;
    });
});

describe('openDeviceDb (D-35)', () => {
  it('opens without change listening and turns on foreign keys and WAL', async () => {
    await openDeviceDb('app.db');
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('app.db');
    expect(log).toEqual(['open main', 'main: PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL']);
  });
});

describe('withExclusiveTransactionAsync (C-15, D-35)', () => {
  it('runs on its own connection: foreign keys on, BEGIN EXCLUSIVE, work, COMMIT, close', async () => {
    const db = await openDeviceDb('app.db');
    log = [];

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('INSERT INTO plan VALUES (1)');
    });

    expect(SQLite.openDatabaseAsync).toHaveBeenLastCalledWith('app.db', { useNewConnection: true });
    expect(log).toEqual([
      'open new connection',
      'txn: PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000',
      'txn: BEGIN EXCLUSIVE',
      'txn: run INSERT INTO plan VALUES (1)',
      'txn: COMMIT',
      'txn: close',
    ]);
  });

  it('rolls back, closes and rethrows when the work fails', async () => {
    const db = await openDeviceDb('app.db');
    log = [];

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error('rejected');
      }),
    ).rejects.toThrow('rejected');

    expect(log.slice(-2)).toEqual(['txn: ROLLBACK', 'txn: close']);
    expect(log).not.toContain('txn: COMMIT');
  });

  it('keeps the original error if the rollback also fails', async () => {
    const db = await openDeviceDb('app.db');
    txn.execAsync.mockImplementation(async (sql: string) => {
      log.push(`txn: ${sql}`);
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
    });

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error('rejected');
      }),
    ).rejects.toThrow('rejected');
    expect(log.at(-1)).toBe('txn: close');
  });

  it('closes the connection if BEGIN EXCLUSIVE fails, without committing or rolling back', async () => {
    const db = await openDeviceDb('app.db');
    txn.execAsync.mockImplementation(async (sql: string) => {
      log.push(`txn: ${sql}`);
      if (sql === 'BEGIN EXCLUSIVE') throw new Error('database is locked');
    });
    const work = jest.fn();

    await expect(db.withExclusiveTransactionAsync(work)).rejects.toThrow('database is locked');
    expect(work).not.toHaveBeenCalled();
    expect(log.slice(-2)).toEqual(['txn: BEGIN EXCLUSIVE', 'txn: close']);
  });

  it('refuses to nest, since a second connection would wait on the first', async () => {
    const db = await openDeviceDb('app.db');

    await expect(
      db.withExclusiveTransactionAsync((tx) => tx.withExclusiveTransactionAsync(async () => {})),
    ).rejects.toThrow(/Already inside an exclusive transaction/);
  });
});
