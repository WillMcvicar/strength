// The migrated schema must match DESIGN §4.3 exactly (DESIGN §4.1; build plan Slice 2). The reference is
// the ```sql block in docs/DESIGN.md itself, so the doc and the code can't drift apart silently.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Db } from '@/data/db';

import { openMigratedTestDb, openTestDb } from '../../test/db/betterSqlite3';

function designDdl(): string {
  const doc = readFileSync(join(__dirname, '../../docs/DESIGN.md'), 'utf8');
  const section = doc.indexOf('### 4.3 DDL');
  const start = doc.indexOf('```sql', section) + '```sql'.length;
  return doc.slice(start, doc.indexOf('```', start));
}

/** Lower-case, drop identifier quotes and all whitespace, so formatting can't cause a mismatch. */
const norm = (sql: string): string => sql.toLowerCase().replace(/[`"]/g, '').replace(/\s+/g, '');

/** The contents of every `CHECK (...)` in a CREATE TABLE statement, balanced-paren aware. */
function checks(createSql: string): string[] {
  const found: string[] = [];
  const re = /\bCHECK\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(createSql))) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    for (; depth > 0; i++) {
      if (createSql[i] === '(') depth++;
      else if (createSql[i] === ')') depth--;
    }
    found.push(norm(createSql.slice(start, i - 1)));
  }
  return found.sort();
}

/** name, type, NOT NULL, default, primary-key position */
type Column = [string, string, boolean, string | null, number];

interface Shape {
  tables: string[];
  columns: Record<string, Column[]>;
  foreignKeys: Record<string, string[]>;
  checks: Record<string, string[]>;
  /** Named, non-constraint indexes: normalised CREATE INDEX statements. */
  indexes: Record<string, string>;
  /** Every non-partial unique column set, however it was declared (constraint or index). */
  uniques: string[];
}

async function shapeOf(db: Db): Promise<Shape> {
  const tables = await db.getAllAsync<{ name: string; sql: string }>(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'
     ORDER BY name`,
  );
  const shape: Shape = {
    tables: tables.map((t) => t.name),
    columns: {},
    foreignKeys: {},
    checks: {},
    indexes: {},
    uniques: [],
  };

  for (const { name, sql } of tables) {
    const cols = await db.getAllAsync<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA table_xinfo(${name})`);
    shape.columns[name] = cols.map((c): Column => [
      c.name,
      c.type.toUpperCase(),
      // An INTEGER PRIMARY KEY is a rowid alias and can never be NULL, whether or not it says
      // NOT NULL (drizzle-kit always does).
      c.notnull === 1 || (c.pk === 1 && c.type.toUpperCase() === 'INTEGER'),
      c.dflt_value === null ? null : norm(c.dflt_value),
      c.pk,
    ]);

    const fks = await db.getAllAsync<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>(`PRAGMA foreign_key_list(${name})`);
    shape.foreignKeys[name] = fks
      .map((f) => `${f.from} → ${f.table}.${f.to} ON DELETE ${f.on_delete.toUpperCase()}`)
      .sort();

    shape.checks[name] = checks(sql);

    const indexes = await db.getAllAsync<{ name: string; unique: number; partial: number }>(
      `PRAGMA index_list(${name})`,
    );
    for (const index of indexes) {
      const cols = await db.getAllAsync<{ name: string | null; key: number }>(
        `PRAGMA index_xinfo(${index.name})`,
      );
      const key = cols.filter((c) => c.key === 1).map((c) => c.name ?? '<expr>');
      if (index.unique === 1 && index.partial === 0 && !key.includes('<expr>')) {
        shape.uniques.push(`${name}(${key.join(',')})`);
      }
    }
  }

  const named = await db.getAllAsync<{ name: string; sql: string }>(
    `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name`,
  );
  for (const { name, sql } of named) shape.indexes[name] = norm(sql);
  shape.uniques.sort();
  return shape;
}

describe('schema: migrated database matches DESIGN §4.3', () => {
  let actual: Shape;
  let expected: Shape;

  beforeAll(async () => {
    const migrated = await openMigratedTestDb();
    const reference = openTestDb();
    await reference.execAsync(designDdl());
    actual = await shapeOf(migrated);
    expected = await shapeOf(reference);
    await migrated.closeAsync();
    await reference.closeAsync();
  });

  it('has the 22 tables and 48 foreign keys the ERD documents', () => {
    expect(expected.tables).toHaveLength(22);
    expect(Object.values(expected.foreignKeys).flat()).toHaveLength(48);
    expect(Object.keys(expected.indexes)).toHaveLength(24);
    expect(actual.tables).toEqual(expected.tables);
  });

  it('matches every column: type, NOT NULL, default and primary key', () => {
    expect(actual.columns).toEqual(expected.columns);
  });

  it('matches every foreign key and its ON DELETE action', () => {
    expect(actual.foreignKeys).toEqual(expected.foreignKeys);
  });

  it('matches every CHECK constraint', () => {
    expect(actual.checks).toEqual(expected.checks);
  });

  it('matches every named index, including partial, expression, collation and DESC', () => {
    // drizzle-kit writes table-level UNIQUE constraints as named unique indexes (uq_plan_skill,
    // …); those are compared by column set below instead.
    const constraintIndexes = Object.keys(actual.indexes).filter((n) => !(n in expected.indexes));
    for (const name of constraintIndexes)
      expect(actual.indexes[name]).toMatch(/^createuniqueindex/);
    const namedOnly = Object.fromEntries(
      Object.entries(actual.indexes).filter(([n]) => n in expected.indexes),
    );
    expect(namedOnly).toEqual(expected.indexes);
  });

  it('enforces the same unique column sets', () => {
    expect(actual.uniques).toEqual(expected.uniques);
  });

  it('D-27: no primary key column accepts NULL', () => {
    for (const [table, cols] of Object.entries(actual.columns)) {
      for (const [name, , notnull, , pk] of cols) {
        if (pk)
          expect(`${table}.${String(name)} ${notnull ? 'NOT NULL' : 'nullable'}`).toBe(
            `${table}.${String(name)} NOT NULL`,
          );
      }
    }
  });
});
