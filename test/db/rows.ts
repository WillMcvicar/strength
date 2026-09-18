// Raw-SQL row builders for constraint tests (DESIGN §9.1). Each table has a minimal valid row;
// a test overrides only the columns it is about. Column names are the §4.3 snake_case ones, so
// these tests exercise the DDL directly, with no repository in between.
import type { Db, SqlValue } from '@/data/db';

type Row = Record<string, SqlValue>;

const NOW = '2026-09-14T08:00:00.000Z';

/** Minimal valid rows. Foreign keys point at the graph `insertGraph` builds. */
export const DEFAULTS: Record<string, Row> = {
  template: { id: 'tpl', name: 'Template', sessions_per_week: 3, created_at: NOW },
  plan: { id: 'plan', name: 'Plan', status: 'draft', created_at: NOW, updated_at: NOW },
  plan_skill: { id: 'ps', plan_id: 'plan', skill_id: 'skill_back_squat' },
  phase: {
    id: 'phase',
    plan_id: 'plan',
    sort_order: 1,
    name: 'Block 1',
    type: 'training',
    review_mode: 'every_cycle',
    length_weeks: 6,
  },
  increase_rule: {
    id: 'ir',
    phase_id: 'phase',
    skill_id: 'skill_back_squat',
    increase_type: 'percent',
  },
  cycle_workout: { id: 'cw', phase_id: 'phase', name: 'Full body A', sort_order: 1 },
  cycle_slot: {
    id: 'slot',
    phase_id: 'phase',
    cycle_workout_id: 'cw',
    cycle_week_index: 1,
    weekday: 1,
    sort_order: 1,
  },
  cycle_exercise: { id: 'ce', cycle_workout_id: 'cw', skill_id: 'skill_back_squat', sort_order: 1 },
  cycle_set: {
    id: 'cs',
    cycle_exercise_id: 'ce',
    set_index: 1,
    reps_min: 5,
    reps_max: 5,
    load_type: 'percent_tm',
    load_percent: 0.75,
  },
  planned_workout: {
    id: 'pw',
    plan_id: 'plan',
    phase_id: 'phase',
    cycle_group_id: 'phase',
    cycle_workout_id: 'cw',
    cycle_slot_id: 'slot',
    phase_cycle_index: 1,
    week_index: 1,
    scheduled_date: '2026-09-14',
  },
  session: {
    id: 'session',
    plan_id: 'plan',
    planned_workout_id: 'pw',
    phase_id: 'phase',
    name: 'Full body A',
    local_date: '2026-09-14',
    started_at: NOW,
    status: 'completed',
    updated_at: NOW,
  },
  session_exercise: {
    id: 'se',
    session_id: 'session',
    skill_id: 'skill_back_squat',
    cycle_exercise_id: 'ce',
    sort_order: 1,
    tracking_type: 'weight_reps',
    load_convention: 'total',
    is_unilateral: 0,
    is_main_lift: 1,
  },
  set_log: { id: 'log', session_exercise_id: 'se', set_index: 1, reps: 5, load_kg: 80, rpe: 8 },
  double_progression_state: { cycle_exercise_id: 'ce', plan_id: 'plan' },
  cycle_review: {
    id: 'review',
    plan_id: 'plan',
    kind: 'cycle',
    cycle_group_id: 'phase',
    phase_cycle_index: 1,
    sessions_completed: 6,
    sessions_planned: 6,
    created_at: NOW,
  },
  cycle_review_item: {
    id: 'item',
    cycle_review_id: 'review',
    skill_id: 'skill_back_squat',
    previous_one_rm_kg: 100,
    suggestion_source: 'percent',
  },
  one_rep_max_history: {
    id: 'orm',
    skill_id: 'skill_back_squat',
    one_rm_kg: 100,
    source: 'plan_setup',
    plan_id: 'plan',
    set_at: NOW,
  },
  schedule_change: {
    id: 'change',
    plan_id: 'plan',
    type: 'shift',
    payload: '{"changes":[]}',
    summary: 'Pushed back 1 day',
    created_at: NOW,
  },
  personal_record: {
    id: 'pr',
    skill_id: 'skill_back_squat',
    type: 'heaviest',
    value: 80,
    session_id: 'session',
    set_log_id: 'log',
    achieved_at: NOW,
  },
};

/** Parents before children, so a full graph inserts with foreign keys on. */
export const GRAPH_ORDER = [
  'template',
  'plan',
  'plan_skill',
  'phase',
  'increase_rule',
  'cycle_workout',
  'cycle_slot',
  'cycle_exercise',
  'cycle_set',
  'planned_workout',
  'session',
  'session_exercise',
  'set_log',
  'double_progression_state',
  'cycle_review',
  'cycle_review_item',
  'one_rep_max_history',
  'schedule_change',
  'personal_record',
] as const;

export type GraphTable = (typeof GRAPH_ORDER)[number];

export async function insert(db: Db, table: GraphTable, overrides: Row = {}): Promise<void> {
  const row = { ...DEFAULTS[table], ...overrides };
  const cols = Object.keys(row);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => row[c]),
  );
}

/** One of every row, all linked: a template, a plan with a blueprint, a logged session, … */
export async function insertGraph(db: Db): Promise<void> {
  for (const table of GRAPH_ORDER) await insert(db, table);
}

export async function count(db: Db, table: string, where = '1 = 1'): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`,
  );
  return row?.n ?? 0;
}
