// Every rule DESIGN §4.3 enforces in the database itself: CHECKs, unique and partial indexes,
// NOT NULL keys (D-27) and ON DELETE behaviour (SRS §4, docs/ERD.md §4.2). Rules the DDL can't
// express live in services (DESIGN §4.4) and are tested there.
import type { Db, SqlValue } from '@/data/db';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { count, GRAPH_ORDER, type GraphTable, insert, insertGraph } from '../../test/db/rows';

type Row = Record<string, SqlValue>;

let db: Db;

beforeEach(async () => {
  db = await openMigratedTestDb();
  await insertGraph(db);
});

afterEach(async () => {
  await db.closeAsync();
});

const accepts = (table: GraphTable, row: Row) =>
  expect(insert(db, table, row)).resolves.toBeUndefined();
const rejects = (table: GraphTable, row: Row, error: RegExp = /constraint failed/i) =>
  expect(insert(db, table, row)).rejects.toThrow(error);

const CHECK = /CHECK constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;
const NOT_NULL = /NOT NULL constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;

describe('D-27 Primary keys are never NULL', () => {
  it.each(GRAPH_ORDER.filter((t) => t !== 'double_progression_state'))('%s.id', async (table) => {
    await rejects(table, { id: null }, NOT_NULL);
  });

  it('double_progression_state.cycle_exercise_id', async () => {
    await db.runAsync('DELETE FROM double_progression_state');
    await rejects('double_progression_state', { cycle_exercise_id: null }, NOT_NULL);
  });

  it('app_meta.key', async () => {
    await expect(db.runAsync("INSERT INTO app_meta VALUES (NULL, '1')")).rejects.toThrow(NOT_NULL);
  });
});

describe('settings is a singleton', () => {
  it('has the seeded row only, and rejects a second', async () => {
    expect(await count(db, 'settings')).toBe(1);
    await expect(db.runAsync('INSERT INTO settings (id) VALUES (2)')).rejects.toThrow(CHECK);
  });
});

describe('FR-1.9 Only weight_reps skills with the total convention can be main lifts', () => {
  const skill = (id: string, row: Row) =>
    db.runAsync(
      `INSERT INTO skill (id, name, muscle_group, equipment, tracking_type, load_convention,
                          is_main_lift, created_at, updated_at)
       VALUES (?, 'X', 'quads', 'barbell', ?, ?, 1, 'now', 'now')`,
      [id, row.tracking_type, row.load_convention],
    );

  it('accepts weight_reps + total', async () => {
    await expect(
      skill('a', { tracking_type: 'weight_reps', load_convention: 'total' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['per_side', { tracking_type: 'weight_reps', load_convention: 'per_side' }],
    ['reps_only', { tracking_type: 'reps_only', load_convention: 'total' }],
    ['bodyweight_plus_load', { tracking_type: 'bodyweight_plus_load', load_convention: 'total' }],
  ])('rejects %s', async (_, row) => {
    await expect(skill('b', row)).rejects.toThrow(CHECK);
  });
});

describe('FR-4.1 At most one active or paused plan', () => {
  beforeEach(async () => {
    await db.runAsync("UPDATE plan SET status = 'active'");
  });

  it('rejects a second active plan', () => rejects('plan', { id: 'p2', status: 'active' }, UNIQUE));
  it('rejects a paused plan alongside an active one', () =>
    rejects('plan', { id: 'p2', status: 'paused' }, UNIQUE));
  it.each(['draft', 'completed', 'abandoned'])('allows any number of %s plans', async (status) => {
    await accepts('plan', { id: 'p2', status });
    await accepts('plan', { id: 'p3', status });
  });
});

describe('Phase shape (DESIGN §4.3)', () => {
  const phase = (row: Row) => ({ id: 'p2', ...row });

  it('belongs to exactly one template or plan', async () => {
    await accepts('phase', phase({ plan_id: null, template_id: 'tpl' }));
    await rejects('phase', { id: 'p3', plan_id: null, template_id: null }, CHECK);
    await rejects('phase', { id: 'p4', plan_id: 'plan', template_id: 'tpl' }, CHECK);
  });

  it('C-1: deload and taper phases have a 1-week cycle and last at most 2 weeks', async () => {
    await accepts(
      'phase',
      phase({ type: 'deload', review_mode: 'none', length_weeks: 2, cycle_length_weeks: 1 }),
    );
    await rejects('phase', { id: 'p3', type: 'deload', length_weeks: 1 }, CHECK); // cycle defaults to 2
    await rejects(
      'phase',
      { id: 'p4', type: 'taper', length_weeks: 3, cycle_length_weeks: 1 },
      CHECK,
    );
  });

  it('D-1: a continuation is a training phase with an offset of at least 1 week', async () => {
    await accepts('phase', phase({ continues_phase_id: 'phase', continues_offset_weeks: 6 }));
    await rejects('phase', { id: 'p3', continues_phase_id: 'phase' }, CHECK);
    await rejects(
      'phase',
      { id: 'p4', continues_phase_id: 'phase', continues_offset_weeks: 0 },
      CHECK,
    );
    await rejects(
      'phase',
      {
        id: 'p5',
        continues_phase_id: 'phase',
        continues_offset_weeks: 6,
        type: 'deload',
        length_weeks: 1,
        cycle_length_weeks: 1,
      },
      CHECK,
    );
  });

  it('FR-2.14: only a taper can have a Test Day', async () => {
    await accepts(
      'phase',
      phase({ type: 'taper', length_weeks: 1, cycle_length_weeks: 1, has_test_day: 1 }),
    );
    await rejects('phase', { id: 'p3', has_test_day: 1 }, CHECK);
  });

  it.each<[string, Row]>([
    ['length over 52 weeks', { length_weeks: 53 }],
    ['length under 1 week', { length_weeks: 0 }],
    ['cycle over 8 weeks', { cycle_length_weeks: 9 }],
    ['volume factor under 0.1', { volume_factor: 0.05 }],
    ['load factor under 0.5 (D-9)', { load_factor: 0.4 }],
    ['RPE cap under 6', { rpe_cap: 5.5 }],
    ['fewer than 2 rest days', { rest_days_at_end: 1 }],
  ])('rejects %s', (_, row) => rejects('phase', { id: 'p3', ...row }, CHECK));
});

describe('Prescribed sets (DESIGN §4.3)', () => {
  const topSet: Row = {
    id: 'cs2',
    set_index: 2,
    load_type: 'top_set',
    load_percent: 0.975,
    target_rpe_max: 8,
    reps_min: 1,
    reps_max: 3,
  };

  it('D-19: accepts a top set prescribed by RPE with a starting % of TM', () =>
    accepts('cycle_set', topSet));

  it.each<[string, Row]>([
    ['more than 5 reps', { reps_max: 6 }],
    ['AMRAP', { is_amrap: 1 }],
    ['a warm-up', { is_warmup: 1 }],
    ['no target RPE', { target_rpe_max: null }],
    ['no starting %', { load_percent: null }],
    ['no rep target (D-28)', { reps_min: null, reps_max: null }],
  ])('D-19: rejects a top set with %s', (_, row) =>
    rejects('cycle_set', { ...topSet, ...row }, CHECK),
  );

  it.each<[string, Row]>([
    ['percent_tm without a %', { load_type: 'percent_tm', load_percent: null }],
    ['fixed without a load', { load_type: 'fixed', load_percent: null }],
    ['reps_min above reps_max', { reps_min: 8, reps_max: 6 }],
    ['a target RPE under 6', { target_rpe_min: 5 }],
  ])('rejects %s', (_, row) => rejects('cycle_set', { id: 'cs2', set_index: 2, ...row }, CHECK));

  it('numbers sets uniquely within an exercise', () => rejects('cycle_set', { id: 'cs2' }, UNIQUE));
});

describe('D-28 Local dates are YYYY-MM-DD', () => {
  it.each<[GraphTable, string, Row?]>([
    ['plan', 'start_date'],
    ['plan', 'paused_on'],
    ['plan', 'ended_on'],
    ['planned_workout', 'scheduled_date'],
    ['session', 'local_date', { planned_workout_id: null }],
  ])('%s.%s', async (table, column, extra = {}) => {
    await accepts(table, { id: 'good', ...extra, [column]: '2026-09-14' });
    for (const bad of ['2026-9-14', '14/09/2026', '2026-09-14T00:00:00Z']) {
      await rejects(table, { id: `bad ${bad}`, ...extra, [column]: bad }, CHECK);
    }
  });
});

describe('Logged sets and sessions (DESIGN §4.3)', () => {
  it.each([6, 7.5, 10])('FR-9.2a: accepts RPE %s', (rpe) =>
    accepts('set_log', { id: 'l2', set_index: 2, rpe }),
  );

  it.each([5.5, 8.3, 10.5])('FR-9.2a: rejects RPE %s (6–10 in half steps)', (rpe) =>
    rejects('set_log', { id: 'l2', set_index: 2, rpe }, CHECK),
  );

  it('numbers logged sets uniquely within an exercise', () =>
    rejects('set_log', { id: 'l2' }, UNIQUE));

  it('rejects a session RPE outside 1–10', () =>
    rejects('session', { id: 's2', planned_workout_id: null, rpe: 0.5 }, CHECK));

  it('FR-9.10: allows only one session in progress at a time', async () => {
    await accepts('session', { id: 's2', planned_workout_id: null, status: 'in_progress' });
    await rejects('session', { id: 's3', planned_workout_id: null, status: 'in_progress' }, UNIQUE);
  });
});

describe('Reviews (DESIGN §4.3)', () => {
  it('a cycle review names its cycle group and index; a final review names neither', async () => {
    await accepts('cycle_review', {
      id: 'final',
      kind: 'final',
      cycle_group_id: null,
      phase_cycle_index: null,
    });
    await rejects('cycle_review', { id: 'r2', kind: 'final' }, CHECK);
    await rejects('cycle_review', { id: 'r3', phase_cycle_index: null }, CHECK);
  });

  it('D-5: at most one Final Review per plan', async () => {
    const final = { kind: 'final', cycle_group_id: null, phase_cycle_index: null };
    await accepts('cycle_review', { id: 'f1', ...final });
    await rejects('cycle_review', { id: 'f2', ...final }, UNIQUE);
  });

  it('D-14: one review per cycle of a cycle group', () =>
    rejects('cycle_review', { id: 'r2' }, UNIQUE));

  it('one item per skill in a review', () => rejects('cycle_review_item', { id: 'i2' }, UNIQUE));

  it('rejects a 1RM of zero', () =>
    rejects('one_rep_max_history', { id: 'o2', one_rm_kg: 0 }, CHECK));
});

describe('Unique plan rows (DESIGN §4.3)', () => {
  it('one plan_skill per skill', () => rejects('plan_skill', { id: 'ps2' }, UNIQUE));
  it('one increase rule per skill and phase', () =>
    rejects('increase_rule', { id: 'ir2' }, UNIQUE));
  it('one double-progression state per exercise', () =>
    rejects('double_progression_state', {}, UNIQUE));
});

describe('Enums reject unknown values (DESIGN §4.3)', () => {
  it.each<[GraphTable, string, SqlValue, Row?]>([
    ['plan', 'status', 'done'],
    ['template', 'level', 'advanced'],
    ['phase', 'type', 'peak'],
    ['phase', 'review_mode', 'weekly'],
    ['phase', 'default_increase_type', 'double'],
    ['phase', 'fallback_increase_type', 'estimated'],
    ['increase_rule', 'increase_type', 'double'],
    ['increase_rule', 'fallback_type', 'estimated'],
    ['cycle_workout', 'kind', 'deload'],
    ['cycle_set', 'load_type', 'rpe', { set_index: 2 }],
    // 'missed' is derived, never stored (DESIGN §3.7)
    ['planned_workout', 'status', 'missed'],
    ['session', 'kind', 'deload', { planned_workout_id: null }],
    ['session', 'status', 'abandoned', { planned_workout_id: null }],
    ['set_log', 'status', 'skipped', { set_index: 2 }],
    ['cycle_review', 'status', 'withdrawn', { phase_cycle_index: 2 }],
    ['cycle_review_item', 'suggestion_source', 'manual', { skill_id: 'skill_bench_press' }],
    ['cycle_review_item', 'decision', 'ignored', { skill_id: 'skill_bench_press' }],
    ['one_rep_max_history', 'source', 'import'],
    ['schedule_change', 'type', 'swap'],
    ['personal_record', 'type', 'volume'],
  ])('%s.%s rejects %s', (table, column, value, extra = {}) =>
    rejects(table, { id: 'bad', ...extra, [column]: value }, CHECK),
  );

  it.each([
    ['unit', "'st'"],
    ['theme', "'sepia'"],
    ['week_start', '3'],
  ])('settings.%s rejects %s', async (column, value) => {
    await expect(db.runAsync(`UPDATE settings SET ${column} = ${value}`)).rejects.toThrow(CHECK);
  });

  it.each([
    ['tracking_type', 'distance'],
    ['load_convention', 'per_hand'],
  ])('skill.%s rejects %s', async (column, value) => {
    await expect(
      db.runAsync(`UPDATE skill SET ${column} = ? WHERE id = 'skill_plank'`, [value]),
    ).rejects.toThrow(CHECK);
  });
});

describe('Deleting rows (SRS §4, docs/ERD.md §4.2)', () => {
  beforeEach(async () => {
    // Close the cycles the base graph leaves open.
    await db.runAsync("UPDATE plan SET source_template_id = 'tpl'");
    await db.runAsync("UPDATE planned_workout SET session_id = 'session'");
    await db.runAsync("UPDATE double_progression_state SET last_increase_session_id = 'session'");
    await db.runAsync(
      "UPDATE one_rep_max_history SET estimate_session_id = 'session', cycle_review_id = 'review'",
    );
    await db.runAsync("UPDATE cycle_review_item SET source_set_log_id = 'log'");
  });

  it('a plan: its sessions, PRs and 1RM history survive with plan_id cleared', async () => {
    await db.runAsync("DELETE FROM plan WHERE id = 'plan'");

    expect(
      await db.getFirstAsync('SELECT plan_id, planned_workout_id, phase_id FROM session'),
    ).toEqual({
      plan_id: null,
      planned_workout_id: null,
      phase_id: null,
    });
    expect(await count(db, 'set_log')).toBe(1);
    expect(await count(db, 'personal_record')).toBe(1);
    expect(
      await db.getFirstAsync('SELECT plan_id, cycle_review_id FROM one_rep_max_history'),
    ).toEqual({
      plan_id: null,
      cycle_review_id: null,
    });
    expect(await db.getFirstAsync('SELECT cycle_exercise_id FROM session_exercise')).toEqual({
      cycle_exercise_id: null,
    });
  });

  it('a plan: its blueprint, schedule, reviews, progression state and history go with it', async () => {
    await db.runAsync("DELETE FROM plan WHERE id = 'plan'");

    for (const table of [
      'plan_skill',
      'phase',
      'increase_rule',
      'cycle_workout',
      'cycle_slot',
      'cycle_exercise',
      'cycle_set',
      'planned_workout',
      'double_progression_state',
      'cycle_review',
      'cycle_review_item',
      'schedule_change',
    ]) {
      expect([table, await count(db, table)]).toEqual([table, 0]);
    }
  });

  it('a template: plans keep their copied blueprint, and source_template_id is cleared', async () => {
    await insert(db, 'phase', { id: 'tpl_phase', plan_id: null, template_id: 'tpl' });
    await db.runAsync("DELETE FROM template WHERE id = 'tpl'");

    expect(await db.getFirstAsync('SELECT source_template_id FROM plan')).toEqual({
      source_template_id: null,
    });
    expect(await count(db, 'phase', "id = 'tpl_phase'")).toBe(0);
    expect(await count(db, 'phase', "id = 'phase'")).toBe(1);
  });

  it('a session: its exercises, sets and PRs go; references to it are cleared', async () => {
    await db.runAsync("DELETE FROM session WHERE id = 'session'");

    expect(await count(db, 'session_exercise')).toBe(0);
    expect(await count(db, 'set_log')).toBe(0);
    expect(await count(db, 'personal_record')).toBe(0);
    expect(await db.getFirstAsync('SELECT session_id FROM planned_workout')).toEqual({
      session_id: null,
    });
    expect(
      await db.getFirstAsync('SELECT last_increase_session_id FROM double_progression_state'),
    ).toEqual({
      last_increase_session_id: null,
    });
    expect(await db.getFirstAsync('SELECT estimate_session_id FROM one_rep_max_history')).toEqual({
      estimate_session_id: null,
    });
    expect(await db.getFirstAsync('SELECT source_set_log_id FROM cycle_review_item')).toEqual({
      source_set_log_id: null,
    });
  });

  it('C-5: a workout with generated planned workouts is retired, never deleted', async () => {
    await expect(db.runAsync("DELETE FROM cycle_workout WHERE id = 'cw'")).rejects.toThrow(
      FOREIGN_KEY,
    );
    await expect(db.runAsync("DELETE FROM cycle_slot WHERE id = 'slot'")).rejects.toThrow(
      FOREIGN_KEY,
    );
  });

  it('C-16: a phase takes its cycle reviews, schedule and blueprint with it', async () => {
    await db.runAsync("DELETE FROM phase WHERE id = 'phase'");

    expect(await count(db, 'cycle_review')).toBe(0);
    expect(await count(db, 'planned_workout')).toBe(0);
    expect(await count(db, 'cycle_workout')).toBe(0);
    expect(await db.getFirstAsync('SELECT phase_id FROM session')).toEqual({ phase_id: null });
  });

  it('D-1: a continuation goes with its original phase', async () => {
    await insert(db, 'phase', {
      id: 'block2',
      continues_phase_id: 'phase',
      continues_offset_weeks: 6,
    });
    await db.runAsync("DELETE FROM phase WHERE id = 'phase'");
    expect(await count(db, 'phase', "id = 'block2'")).toBe(0);
  });

  it('a generated deload outlives its source phase', async () => {
    await insert(db, 'phase', {
      id: 'deload',
      type: 'deload',
      review_mode: 'none',
      length_weeks: 1,
      cycle_length_weeks: 1,
      generated_from_phase_id: 'phase',
    });
    await db.runAsync('DELETE FROM planned_workout');
    await db.runAsync("DELETE FROM phase WHERE id = 'phase'");
    expect(
      await db.getFirstAsync("SELECT generated_from_phase_id FROM phase WHERE id = 'deload'"),
    ).toEqual({
      generated_from_phase_id: null,
    });
  });

  it('a skill that is referenced anywhere cannot be deleted (FR-1.3 archives instead)', async () => {
    await expect(db.runAsync("DELETE FROM skill WHERE id = 'skill_back_squat'")).rejects.toThrow(
      FOREIGN_KEY,
    );
  });
});
