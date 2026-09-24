// The Drizzle schema: the code source of truth for DESIGN §4.3, which it must match exactly.
// `schema.test.ts` migrates a database and compares it with the DDL extracted from the doc.
//
// Conventions (DESIGN §4.1, D-27):
// - every TEXT primary key is NOT NULL
// - booleans are INTEGER 0/1; their defaults are written as sql`0`/sql`1`, because
//   `.default(false)` would emit `DEFAULT false` and no longer match the DDL
// - CHECKs, index expressions and partial-index WHERE clauses use raw column names, so the
//   generated SQL reads like the DDL
// - self and forward references are typed `AnySQLiteColumn`
import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type { Equipment, LoadConvention, LocalDate, MuscleGroup, TrackingType } from '@/core/types';

/** §4.1: every local-date column is checked for the YYYY-MM-DD shape. */
const isLocalDate = (column: string) =>
  sql.raw(`${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`);

const FALSE = sql`0`;
const TRUE = sql`1`;
const bool = (name: string) => integer(name, { mode: 'boolean' });

// ───────────── Meta & settings ─────────────

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey().notNull(), // 'schema_version', 'seed_version'
  value: text('value').notNull(),
});

export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey(),
    unit: text('unit', { enum: ['kg', 'lb'] })
      .notNull()
      .default('kg'),
    defaultRestSec: integer('default_rest_sec').notNull().default(120),
    weekStart: integer('week_start').$type<0 | 1>().notNull().default(1),
    weightIncrementKg: real('weight_increment_kg').notNull().default(2.5),
    weightIncrementLb: real('weight_increment_lb').notNull().default(5),
    reminderEnabled: bool('reminder_enabled').notNull().default(FALSE),
    reminderTime: text('reminder_time'),
    restTimerAlerts: bool('rest_timer_alerts').notNull().default(TRUE),
    keepAwake: bool('keep_awake').notNull().default(TRUE),
    theme: text('theme', { enum: ['light', 'dark', 'system'] })
      .notNull()
      .default('system'),
    disclaimerAckAt: text('disclaimer_ack_at'),
    tipsEnabled: bool('tips_enabled').notNull().default(TRUE),
    seenTips: text('seen_tips', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    onboardingCompletedAt: text('onboarding_completed_at'),
    lastExportAt: text('last_export_at'),
    backupReminderDismissedAt: text('backup_reminder_dismissed_at'),
    autoBackupEnabled: bool('auto_backup_enabled').notNull().default(FALSE), // v1.1
    lastAutoBackupAt: text('last_auto_backup_at'),
    lastAutoBackupError: text('last_auto_backup_error'),
  },
  () => [
    check('settings_singleton', sql`id = 1`),
    check('settings_unit', sql`unit IN ('kg','lb')`),
    check('settings_week_start', sql`week_start IN (0,1)`),
    check('settings_theme', sql`theme IN ('light','dark','system')`),
  ],
);

// ───────────── Skill Library (FR-1) ─────────────

export const skill = sqliteTable(
  'skill',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group').$type<MuscleGroup>().notNull(),
    secondaryMuscles: text('secondary_muscles', { mode: 'json' })
      .$type<MuscleGroup[]>()
      .notNull()
      .default(sql`'[]'`),
    equipment: text('equipment').$type<Equipment>().notNull(),
    trackingType: text('tracking_type').$type<TrackingType>().notNull(),
    loadConvention: text('load_convention').$type<LoadConvention>().notNull().default('total'),
    isUnilateral: bool('is_unilateral').notNull().default(FALSE),
    isMainLift: bool('is_main_lift').notNull().default(FALSE),
    loadIncrementKg: real('load_increment_kg'),
    loadIncrementLb: real('load_increment_lb'),
    isCustom: bool('is_custom').notNull().default(FALSE),
    isArchived: bool('is_archived').notNull().default(FALSE),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  () => [
    check(
      'skill_tracking_type',
      sql`tracking_type IN ('weight_reps','reps_only','bodyweight_plus_load','time','completion_only')`,
    ),
    check('skill_load_convention', sql`load_convention IN ('total','per_side')`),
    // FR-1.9
    check(
      'skill_main_lift',
      sql`is_main_lift = 0 OR (tracking_type = 'weight_reps' AND load_convention = 'total')`,
    ),
    index('idx_skill_name').on(sql`name COLLATE NOCASE`),
    index('idx_skill_filter').on(sql`is_archived`, sql`muscle_group`, sql`equipment`),
  ],
);

// ───────────── Templates & plans ─────────────

export const template = sqliteTable(
  'template',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    defaultTmPercent: real('default_tm_percent').notNull().default(0.9),
    sessionsPerWeek: integer('sessions_per_week').notNull(),
    level: text('level', { enum: ['beginner', 'intermediate'] }),
    isBuiltIn: bool('is_built_in').notNull().default(FALSE),
    createdAt: text('created_at').notNull(),
  },
  () => [check('template_level', sql`level IN ('beginner','intermediate')`)],
);

export const plan = sqliteTable(
  'plan',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sourceTemplateId: text('source_template_id').references(() => template.id, {
      onDelete: 'set null',
    }),
    status: text('status', {
      enum: ['draft', 'active', 'paused', 'completed', 'abandoned'],
    }).notNull(),
    startDate: text('start_date').$type<LocalDate>(), // required before 'active'
    defaultTmPercent: real('default_tm_percent').notNull().default(0.9),
    pausedOn: text('paused_on').$type<LocalDate>(), // v1.1
    endedAt: text('ended_at'),
    endedOn: text('ended_on').$type<LocalDate>(), // D-24
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  () => [
    check('plan_status', sql`status IN ('draft','active','paused','completed','abandoned')`),
    check('plan_start_date', isLocalDate('start_date')),
    check('plan_paused_on', isLocalDate('paused_on')),
    check('plan_ended_on', isLocalDate('ended_on')),
    // FR-4.1: at most one active or paused plan. `uq_plan_single_active` is an expression index
    // that drizzle-kit can't serialise (it splits the expression on its comma), so it lives in the
    // hand-written migration 0001_plan_single_active.sql.
  ],
);

export const planSkill = sqliteTable(
  'plan_skill',
  {
    id: text('id').primaryKey().notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    tmPercent: real('tm_percent'), // null = plan default
    startingOneRmKg: real('starting_one_rm_kg'),
  },
  (t) => [unique('uq_plan_skill').on(t.planId, t.skillId)],
);

// ───────────── Blueprint (shared) ─────────────

export const phase = sqliteTable(
  'phase',
  {
    id: text('id').primaryKey().notNull(),
    templateId: text('template_id').references(() => template.id, { onDelete: 'cascade' }),
    planId: text('plan_id').references(() => plan.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ['training', 'deload', 'taper'] }).notNull(),
    reviewMode: text('review_mode', { enum: ['every_cycle', 'end_of_phase', 'none'] }).notNull(),
    lengthWeeks: integer('length_weeks').notNull(),
    cycleLengthWeeks: integer('cycle_length_weeks').notNull().default(2),
    volumeFactor: real('volume_factor'),
    loadFactor: real('load_factor'),
    rpeCap: real('rpe_cap'),
    restDaysAtEnd: integer('rest_days_at_end'),
    hasTestDay: bool('has_test_day').notNull().default(FALSE),
    generatedFromPhaseId: text('generated_from_phase_id').references(
      (): AnySQLiteColumn => phase.id,
      { onDelete: 'set null' },
    ),
    // D-1, D-14
    continuesPhaseId: text('continues_phase_id').references((): AnySQLiteColumn => phase.id, {
      onDelete: 'cascade',
    }),
    continuesOffsetWeeks: integer('continues_offset_weeks'),
    defaultIncreaseType: text('default_increase_type', {
      enum: ['estimated', 'percent', 'fixed', 'none'],
    })
      .notNull()
      .default('percent'),
    defaultIncreaseValue: real('default_increase_value'),
    defaultIncreaseValueLb: real('default_increase_value_lb'),
    fallbackIncreaseType: text('fallback_increase_type', { enum: ['percent', 'fixed', 'none'] }),
    fallbackIncreaseValue: real('fallback_increase_value'),
    fallbackIncreaseValueLb: real('fallback_increase_value_lb'),
  },
  () => [
    check('phase_type', sql`type IN ('training','deload','taper')`),
    check('phase_review_mode', sql`review_mode IN ('every_cycle','end_of_phase','none')`),
    check('phase_length_weeks', sql`length_weeks BETWEEN 1 AND 52`),
    check('phase_cycle_length_weeks', sql`cycle_length_weeks BETWEEN 1 AND 8`),
    check('phase_volume_factor', sql`volume_factor IS NULL OR volume_factor BETWEEN 0.1 AND 1`),
    check('phase_load_factor', sql`load_factor IS NULL OR load_factor BETWEEN 0.5 AND 1`),
    check('phase_rpe_cap', sql`rpe_cap IS NULL OR rpe_cap BETWEEN 6 AND 10`),
    check(
      'phase_rest_days_at_end',
      sql`rest_days_at_end IS NULL OR rest_days_at_end BETWEEN 2 AND 7`,
    ),
    check(
      'phase_default_increase_type',
      sql`default_increase_type IN ('estimated','percent','fixed','none')`,
    ),
    check(
      'phase_fallback_increase_type',
      sql`fallback_increase_type IN ('percent','fixed','none')`,
    ),
    check('phase_owner', sql`(template_id IS NULL) <> (plan_id IS NULL)`),
    // C-1
    check(
      'phase_non_training_shape',
      sql`type = 'training' OR (length_weeks <= 2 AND cycle_length_weeks = 1)`,
    ),
    check(
      'phase_continuation',
      // D-28: a comparison on NULL passes, so the offset is required explicitly
      sql`continues_phase_id IS NULL OR (type = 'training' AND continues_offset_weeks IS NOT NULL
                                         AND continues_offset_weeks >= 1)`,
    ),
    check('phase_test_day', sql`has_test_day = 0 OR type = 'taper'`),
    index('idx_phase_plan').on(sql`plan_id`, sql`sort_order`),
    index('idx_phase_template').on(sql`template_id`, sql`sort_order`),
  ],
);

/** Per-skill override of a phase's increase rule. */
export const increaseRule = sqliteTable(
  'increase_rule',
  {
    id: text('id').primaryKey().notNull(),
    phaseId: text('phase_id')
      .notNull()
      .references(() => phase.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    increaseType: text('increase_type', {
      enum: ['estimated', 'percent', 'fixed', 'none'],
    }).notNull(),
    increaseValue: real('increase_value'),
    increaseValueLb: real('increase_value_lb'),
    fallbackType: text('fallback_type', { enum: ['percent', 'fixed', 'none'] }),
    fallbackValue: real('fallback_value'),
    fallbackValueLb: real('fallback_value_lb'),
  },
  (t) => [
    check('increase_rule_type', sql`increase_type IN ('estimated','percent','fixed','none')`),
    check('increase_rule_fallback_type', sql`fallback_type IN ('percent','fixed','none')`),
    unique('uq_increase_rule').on(t.phaseId, t.skillId),
  ],
);

/** A workout, defined once per phase (D-20). */
export const cycleWorkout = sqliteTable(
  'cycle_workout',
  {
    id: text('id').primaryKey().notNull(),
    phaseId: text('phase_id')
      .notNull()
      .references(() => phase.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
    kind: text('kind', { enum: ['normal', 'test_day'] })
      .notNull()
      .default('normal'),
  },
  () => [
    check('cycle_workout_kind', sql`kind IN ('normal','test_day')`),
    index('idx_cw_phase').on(sql`phase_id`, sql`sort_order`),
  ],
);

/** One weekday appearance of a workout (D-20). */
export const cycleSlot = sqliteTable(
  'cycle_slot',
  {
    id: text('id').primaryKey().notNull(),
    phaseId: text('phase_id')
      .notNull()
      .references(() => phase.id, { onDelete: 'cascade' }),
    cycleWorkoutId: text('cycle_workout_id')
      .notNull()
      .references(() => cycleWorkout.id, { onDelete: 'cascade' }),
    cycleWeekIndex: integer('cycle_week_index').notNull(),
    weekday: integer('weekday').notNull(),
    sortOrder: integer('sort_order').notNull(),
    // C-5: not generated from this week of the cycle group on
    retiredFromGroupWeek: integer('retired_from_group_week'),
    // D-30: a deload copy follows this slot's weekday pin
    sourceCycleSlotId: text('source_cycle_slot_id').references(
      (): AnySQLiteColumn => cycleSlot.id,
      { onDelete: 'set null' },
    ),
  },
  () => [
    check('cycle_slot_week_index', sql`cycle_week_index >= 1`),
    check('cycle_slot_weekday', sql`weekday BETWEEN 0 AND 6`),
    index('idx_slot_phase').on(sql`phase_id`, sql`cycle_week_index`, sql`sort_order`),
    index('idx_slot_workout').on(sql`cycle_workout_id`),
  ],
);

export const cycleExercise = sqliteTable(
  'cycle_exercise',
  {
    id: text('id').primaryKey().notNull(),
    cycleWorkoutId: text('cycle_workout_id')
      .notNull()
      .references(() => cycleWorkout.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    sortOrder: integer('sort_order').notNull(),
    supersetGroup: text('superset_group'), // same value = same superset
    restSec: integer('rest_sec'),
    notes: text('notes'),
    // deload/taper copies
    sourceCycleExerciseId: text('source_cycle_exercise_id').references(
      (): AnySQLiteColumn => cycleExercise.id,
      { onDelete: 'set null' },
    ),
  },
  () => [index('idx_ce_workout').on(sql`cycle_workout_id`, sql`sort_order`)],
);

export const cycleSet = sqliteTable(
  'cycle_set',
  {
    id: text('id').primaryKey().notNull(),
    cycleExerciseId: text('cycle_exercise_id')
      .notNull()
      .references(() => cycleExercise.id, { onDelete: 'cascade' }),
    setIndex: integer('set_index').notNull(),
    isWarmup: bool('is_warmup').notNull().default(FALSE),
    repsMin: integer('reps_min'),
    repsMax: integer('reps_max'),
    isAmrap: bool('is_amrap').notNull().default(FALSE),
    targetRpeMin: real('target_rpe_min'),
    targetRpeMax: real('target_rpe_max'),
    loadType: text('load_type', {
      enum: ['percent_tm', 'double_progression', 'fixed', 'bodyweight', 'top_set'],
    }).notNull(),
    loadPercent: real('load_percent'), // top_set: starting % of TM (pre-fill)
    fixedLoadKg: real('fixed_load_kg'),
    targetTimeSec: integer('target_time_sec'),
  },
  (t) => [
    check(
      'cycle_set_target_rpe_min',
      sql`target_rpe_min IS NULL OR target_rpe_min BETWEEN 6 AND 10`,
    ),
    check(
      'cycle_set_target_rpe_max',
      sql`target_rpe_max IS NULL OR target_rpe_max BETWEEN 6 AND 10`,
    ),
    check(
      'cycle_set_load_type',
      sql`load_type IN ('percent_tm','double_progression','fixed','bodyweight','top_set')`,
    ),
    check('cycle_set_percent_tm', sql`load_type <> 'percent_tm' OR load_percent IS NOT NULL`),
    check('cycle_set_fixed', sql`load_type <> 'fixed' OR fixed_load_kg IS NOT NULL`),
    // D-19
    check(
      'cycle_set_top_set',
      sql`load_type <> 'top_set' OR (load_percent IS NOT NULL AND target_rpe_max IS NOT NULL
                                    AND reps_max IS NOT NULL AND reps_max <= 5
                                    AND is_amrap = 0 AND is_warmup = 0)`,
    ),
    check('cycle_set_reps', sql`reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max`),
    unique('uq_cycle_set').on(t.cycleExerciseId, t.setIndex),
  ],
);

// ───────────── Generated schedule ─────────────

export const plannedWorkout = sqliteTable(
  'planned_workout',
  {
    id: text('id').primaryKey().notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    phaseId: text('phase_id')
      .notNull()
      .references(() => phase.id, { onDelete: 'cascade' }),
    // D-14
    cycleGroupId: text('cycle_group_id')
      .notNull()
      .references(() => phase.id, { onDelete: 'cascade' }),
    cycleWorkoutId: text('cycle_workout_id')
      .notNull()
      .references(() => cycleWorkout.id),
    // D-20; null for Test Day
    cycleSlotId: text('cycle_slot_id').references(() => cycleSlot.id),
    phaseCycleIndex: integer('phase_cycle_index').notNull(),
    weekIndex: integer('week_index').notNull(),
    scheduledDate: text('scheduled_date').$type<LocalDate>().notNull(),
    // 'missed' is derived
    status: text('status', { enum: ['upcoming', 'completed', 'skipped'] })
      .notNull()
      .default('upcoming'),
    sessionId: text('session_id').references((): AnySQLiteColumn => session.id, {
      onDelete: 'set null',
    }),
    skippedAt: text('skipped_at'),
  },
  () => [
    check('planned_workout_status', sql`status IN ('upcoming','completed','skipped')`),
    check('planned_workout_scheduled_date', isLocalDate('scheduled_date')),
    index('idx_pw_date').on(sql`plan_id`, sql`scheduled_date`),
    index('idx_pw_cycle').on(sql`plan_id`, sql`cycle_group_id`, sql`phase_cycle_index`),
    index('idx_pw_week').on(sql`plan_id`, sql`week_index`),
  ],
);

// "paused" is derived from the phase type (§3.12), so it isn't stored.
export const doubleProgressionState = sqliteTable('double_progression_state', {
  cycleExerciseId: text('cycle_exercise_id')
    .primaryKey()
    .notNull()
    .references(() => cycleExercise.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .notNull()
    .references(() => plan.id, { onDelete: 'cascade' }),
  workingLoadKg: real('working_load_kg'),
  previousWorkingLoadKg: real('previous_working_load_kg'), // one-tap revert
  lastIncreasedAt: text('last_increased_at'),
  lastIncreaseSessionId: text('last_increase_session_id').references(
    (): AnySQLiteColumn => session.id,
    { onDelete: 'set null' },
  ),
  // JSON reps per set, for the D-12 pre-fill
  lastReps: text('last_reps', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default(sql`'[]'`),
  consecutiveBelowMin: integer('consecutive_below_min').notNull().default(0),
});

// ───────────── Reviews ─────────────

export const cycleReview = sqliteTable(
  'cycle_review',
  {
    id: text('id').primaryKey().notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['cycle', 'final'] }).notNull(),
    // C-16
    cycleGroupId: text('cycle_group_id').references(() => phase.id, { onDelete: 'cascade' }),
    phaseCycleIndex: integer('phase_cycle_index'),
    status: text('status', { enum: ['pending', 'completed'] })
      .notNull()
      .default('pending'),
    sessionsCompleted: integer('sessions_completed').notNull(),
    sessionsPlanned: integer('sessions_planned').notNull(),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [
    check('cycle_review_kind', sql`kind IN ('cycle','final')`),
    check('cycle_review_status', sql`status IN ('pending','completed')`),
    check(
      'cycle_review_kind_keys',
      sql`(kind = 'cycle') = (cycle_group_id IS NOT NULL AND phase_cycle_index IS NOT NULL)`,
    ),
    unique('uq_cycle_review').on(t.planId, t.cycleGroupId, t.phaseCycleIndex),
    // SQLite treats NULLs as distinct in UNIQUE, so the final review needs its own index
    uniqueIndex('uq_final_review')
      .on(sql`plan_id`)
      .where(sql`kind = 'final'`),
  ],
);

export const cycleReviewItem = sqliteTable(
  'cycle_review_item',
  {
    id: text('id').primaryKey().notNull(),
    cycleReviewId: text('cycle_review_id')
      .notNull()
      .references(() => cycleReview.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    previousOneRmKg: real('previous_one_rm_kg').notNull(),
    suggestedOneRmKg: real('suggested_one_rm_kg'),
    referenceE1rmKg: real('reference_e1rm_kg'), // best qualifying e1RM this cycle (D-26)
    heaviestSingleKg: real('heaviest_single_kg'), // reference only
    suggestionSource: text('suggestion_source', {
      enum: ['estimated', 'test_day', 'percent', 'fixed', 'none'],
    }).notNull(),
    isFallback: bool('is_fallback').notNull().default(FALSE),
    sourceSetLogId: text('source_set_log_id').references((): AnySQLiteColumn => setLog.id, {
      onDelete: 'set null',
    }),
    confirmedOneRmKg: real('confirmed_one_rm_kg'),
    decision: text('decision', { enum: ['accepted', 'edited', 'kept'] }),
  },
  (t) => [
    check(
      'cycle_review_item_source',
      sql`suggestion_source IN ('estimated','test_day','percent','fixed','none')`,
    ),
    check('cycle_review_item_decision', sql`decision IN ('accepted','edited','kept')`),
    unique('uq_cycle_review_item').on(t.cycleReviewId, t.skillId),
  ],
);

export const oneRepMaxHistory = sqliteTable(
  'one_rep_max_history',
  {
    id: text('id').primaryKey().notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    oneRmKg: real('one_rm_kg').notNull(),
    source: text('source', {
      enum: ['plan_setup', 'setup_estimate', 'cycle_review', 'manual'],
    }).notNull(),
    planId: text('plan_id').references(() => plan.id, { onDelete: 'set null' }),
    effectiveFromWeekIndex: integer('effective_from_week_index'), // cached, see D-2
    cycleReviewId: text('cycle_review_id').references(() => cycleReview.id, {
      onDelete: 'set null',
    }),
    estimateSessionId: text('estimate_session_id').references((): AnySQLiteColumn => session.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    setAt: text('set_at').notNull(),
  },
  () => [
    check('one_rep_max_history_positive', sql`one_rm_kg > 0`),
    check(
      'one_rep_max_history_source',
      sql`source IN ('plan_setup','setup_estimate','cycle_review','manual')`,
    ),
    index('idx_orm_skill').on(sql`skill_id`, sql`set_at DESC`),
    index('idx_orm_plan').on(sql`plan_id`, sql`skill_id`, sql`effective_from_week_index`),
  ],
);

// ───────────── Schedule history (FR-4.13) ─────────────

export const scheduleChange = sqliteTable(
  'schedule_change',
  {
    id: text('id').primaryKey().notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['shift', 'move', 'repin', 'pause', 'length', 'insert_deload'],
    }).notNull(),
    fromPlannedWorkoutId: text('from_planned_workout_id').references(() => plannedWorkout.id, {
      onDelete: 'set null',
    }),
    fromWeekIndex: integer('from_week_index'),
    offsetDays: integer('offset_days'),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(), // JSON, see §4.5
    summary: text('summary').notNull(), // "Pushed back 2 days from Wed 24 Sep"
    createdAt: text('created_at').notNull(),
    undoneAt: text('undone_at'),
  },
  () => [
    check(
      'schedule_change_type',
      sql`type IN ('shift','move','repin','pause','length','insert_deload')`,
    ),
    index('idx_sc_plan').on(sql`plan_id`, sql`created_at DESC`),
  ],
);

// ───────────── Logging ─────────────

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey().notNull(),
    planId: text('plan_id').references(() => plan.id, { onDelete: 'set null' }),
    plannedWorkoutId: text('planned_workout_id').references(
      (): AnySQLiteColumn => plannedWorkout.id,
      { onDelete: 'set null' },
    ),
    phaseId: text('phase_id').references(() => phase.id, { onDelete: 'set null' }),
    // Historical label with no FK (D-27, DESIGN §4.4)
    cycleGroupId: text('cycle_group_id'),
    phaseCycleIndex: integer('phase_cycle_index'),
    name: text('name').notNull(), // snapshot of the workout name
    kind: text('kind', { enum: ['planned', 'ad_hoc', 'one_rm_estimate', 'test_day'] })
      .notNull()
      .default('planned'),
    localDate: text('local_date').$type<LocalDate>().notNull(), // the day it was logged (D-39)
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    status: text('status', { enum: ['in_progress', 'completed'] }).notNull(),
    notes: text('notes'),
    rpe: real('rpe'),
    totalVolumeKg: real('total_volume_kg'), // cached at finish, recomputed on edit
    updatedAt: text('updated_at').notNull(),
  },
  () => [
    check('session_kind', sql`kind IN ('planned','ad_hoc','one_rm_estimate','test_day')`),
    check('session_status', sql`status IN ('in_progress','completed')`),
    check('session_rpe', sql`rpe IS NULL OR rpe BETWEEN 1 AND 10`),
    check('session_local_date', isLocalDate('local_date')),
    uniqueIndex('uq_session_in_progress')
      .on(sql`status`)
      .where(sql`status = 'in_progress'`),
    index('idx_session_date').on(sql`status`, sql`started_at DESC`),
    index('idx_session_plan').on(sql`plan_id`, sql`started_at DESC`),
  ],
);

export const sessionExercise = sqliteTable(
  'session_exercise',
  {
    id: text('id').primaryKey().notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    cycleExerciseId: text('cycle_exercise_id').references(() => cycleExercise.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull(),
    supersetGroup: text('superset_group'),
    restSec: integer('rest_sec'),
    notes: text('notes'),
    wasSubstituted: bool('was_substituted').notNull().default(FALSE),
    wasAdded: bool('was_added').notNull().default(FALSE),
    tmSnapshotKg: real('tm_snapshot_kg'),
    // snapshots (D-16)
    trackingType: text('tracking_type').$type<TrackingType>().notNull(),
    loadConvention: text('load_convention').$type<LoadConvention>().notNull(),
    isUnilateral: bool('is_unilateral').notNull(),
    isMainLift: bool('is_main_lift').notNull(),
    dpIncreaseKg: real('dp_increase_kg'), // shows the "↑" badge, null if none
  },
  () => [
    index('idx_se_session').on(sql`session_id`, sql`sort_order`),
    index('idx_se_skill').on(sql`skill_id`),
  ],
);

export const setLog = sqliteTable(
  'set_log',
  {
    id: text('id').primaryKey().notNull(),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercise.id, { onDelete: 'cascade' }),
    setIndex: integer('set_index').notNull(),
    isWarmup: bool('is_warmup').notNull().default(FALSE),
    isAmrap: bool('is_amrap').notNull().default(FALSE),
    isTopSet: bool('is_top_set').notNull().default(FALSE), // copied from the prescription (D-19)
    prescribedRepsMin: integer('prescribed_reps_min'),
    prescribedRepsMax: integer('prescribed_reps_max'),
    prescribedLoadKg: real('prescribed_load_kg'),
    prescribedTimeSec: integer('prescribed_time_sec'),
    targetRpeMin: real('target_rpe_min'),
    targetRpeMax: real('target_rpe_max'),
    reps: integer('reps'),
    // per side if per_side; added load (may be < 0) if bodyweight_plus_load
    loadKg: real('load_kg'),
    timeSec: integer('time_sec'),
    rpe: real('rpe'),
    status: text('status', { enum: ['pending', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    completedAt: text('completed_at'),
  },
  (t) => [
    check(
      'set_log_rpe',
      sql`rpe IS NULL OR (rpe BETWEEN 6 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))`,
    ),
    check('set_log_status', sql`status IN ('pending','completed','failed')`),
    unique('uq_set_log').on(t.sessionExerciseId, t.setIndex),
    index('idx_set_completed').on(sql`completed_at`),
  ],
);

// ───────────── PRs (FR-10) ─────────────

export const personalRecord = sqliteTable(
  'personal_record',
  {
    id: text('id').primaryKey().notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id),
    type: text('type', {
      enum: [
        'heaviest',
        'e1rm',
        'reps_at_weight',
        'max_reps',
        'heaviest_added',
        'reps_at_added',
        'longest_time',
      ],
    }).notNull(),
    value: real('value').notNull(),
    contextWeightKg: real('context_weight_kg'),
    sessionId: text('session_id').references(() => session.id, { onDelete: 'cascade' }),
    setLogId: text('set_log_id').references(() => setLog.id, { onDelete: 'cascade' }),
    achievedAt: text('achieved_at').notNull(),
    isManual: bool('is_manual').notNull().default(FALSE),
    note: text('note'),
  },
  () => [
    check(
      'personal_record_type',
      sql`type IN ('heaviest','e1rm','reps_at_weight','max_reps','heaviest_added','reps_at_added','longest_time')`,
    ),
    index('idx_pr_skill').on(sql`skill_id`, sql`type`, sql`achieved_at`),
    index('idx_pr_session').on(sql`session_id`),
  ],
);
