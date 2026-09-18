CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cycle_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_workout_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`superset_group` text,
	`rest_sec` integer,
	`notes` text,
	`source_cycle_exercise_id` text,
	FOREIGN KEY (`cycle_workout_id`) REFERENCES `cycle_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_cycle_exercise_id`) REFERENCES `cycle_exercise`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_ce_workout` ON `cycle_exercise` (cycle_workout_id,sort_order);--> statement-breakpoint
CREATE TABLE `cycle_review` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`kind` text NOT NULL,
	`cycle_group_id` text,
	`phase_cycle_index` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`sessions_completed` integer NOT NULL,
	`sessions_planned` integer NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_group_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cycle_review_kind" CHECK(kind IN ('cycle','final')),
	CONSTRAINT "cycle_review_status" CHECK(status IN ('pending','completed')),
	CONSTRAINT "cycle_review_kind_keys" CHECK((kind = 'cycle') = (cycle_group_id IS NOT NULL AND phase_cycle_index IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_final_review` ON `cycle_review` (plan_id) WHERE kind = 'final';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cycle_review` ON `cycle_review` (`plan_id`,`cycle_group_id`,`phase_cycle_index`);--> statement-breakpoint
CREATE TABLE `cycle_review_item` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_review_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`previous_one_rm_kg` real NOT NULL,
	`suggested_one_rm_kg` real,
	`reference_e1rm_kg` real,
	`heaviest_single_kg` real,
	`suggestion_source` text NOT NULL,
	`is_fallback` integer DEFAULT 0 NOT NULL,
	`source_set_log_id` text,
	`confirmed_one_rm_kg` real,
	`decision` text,
	FOREIGN KEY (`cycle_review_id`) REFERENCES `cycle_review`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_set_log_id`) REFERENCES `set_log`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "cycle_review_item_source" CHECK(suggestion_source IN ('estimated','test_day','percent','fixed','none')),
	CONSTRAINT "cycle_review_item_decision" CHECK(decision IN ('accepted','edited','kept'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cycle_review_item` ON `cycle_review_item` (`cycle_review_id`,`skill_id`);--> statement-breakpoint
CREATE TABLE `cycle_set` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`is_warmup` integer DEFAULT 0 NOT NULL,
	`reps_min` integer,
	`reps_max` integer,
	`is_amrap` integer DEFAULT 0 NOT NULL,
	`target_rpe_min` real,
	`target_rpe_max` real,
	`load_type` text NOT NULL,
	`load_percent` real,
	`fixed_load_kg` real,
	`target_time_sec` integer,
	FOREIGN KEY (`cycle_exercise_id`) REFERENCES `cycle_exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cycle_set_target_rpe_min" CHECK(target_rpe_min IS NULL OR target_rpe_min BETWEEN 6 AND 10),
	CONSTRAINT "cycle_set_target_rpe_max" CHECK(target_rpe_max IS NULL OR target_rpe_max BETWEEN 6 AND 10),
	CONSTRAINT "cycle_set_load_type" CHECK(load_type IN ('percent_tm','double_progression','fixed','bodyweight','top_set')),
	CONSTRAINT "cycle_set_percent_tm" CHECK(load_type <> 'percent_tm' OR load_percent IS NOT NULL),
	CONSTRAINT "cycle_set_fixed" CHECK(load_type <> 'fixed' OR fixed_load_kg IS NOT NULL),
	CONSTRAINT "cycle_set_top_set" CHECK(load_type <> 'top_set' OR (load_percent IS NOT NULL AND target_rpe_max IS NOT NULL
                                    AND reps_max IS NOT NULL AND reps_max <= 5
                                    AND is_amrap = 0 AND is_warmup = 0)),
	CONSTRAINT "cycle_set_reps" CHECK(reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cycle_set` ON `cycle_set` (`cycle_exercise_id`,`set_index`);--> statement-breakpoint
CREATE TABLE `cycle_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`cycle_workout_id` text NOT NULL,
	`cycle_week_index` integer NOT NULL,
	`weekday` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`retired_from_group_week` integer,
	FOREIGN KEY (`phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_workout_id`) REFERENCES `cycle_workout`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cycle_slot_week_index" CHECK(cycle_week_index >= 1),
	CONSTRAINT "cycle_slot_weekday" CHECK(weekday BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE INDEX `idx_slot_phase` ON `cycle_slot` (phase_id,cycle_week_index,sort_order);--> statement-breakpoint
CREATE INDEX `idx_slot_workout` ON `cycle_slot` (cycle_workout_id);--> statement-breakpoint
CREATE TABLE `cycle_workout` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`kind` text DEFAULT 'normal' NOT NULL,
	FOREIGN KEY (`phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cycle_workout_kind" CHECK(kind IN ('normal','test_day'))
);
--> statement-breakpoint
CREATE INDEX `idx_cw_phase` ON `cycle_workout` (phase_id,sort_order);--> statement-breakpoint
CREATE TABLE `double_progression_state` (
	`cycle_exercise_id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`working_load_kg` real,
	`previous_working_load_kg` real,
	`last_increased_at` text,
	`last_increase_session_id` text,
	`last_reps` text DEFAULT '[]' NOT NULL,
	`consecutive_below_min` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`cycle_exercise_id`) REFERENCES `cycle_exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_increase_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `increase_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`increase_type` text NOT NULL,
	`increase_value` real,
	`increase_value_lb` real,
	`fallback_type` text,
	`fallback_value` real,
	`fallback_value_lb` real,
	FOREIGN KEY (`phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "increase_rule_type" CHECK(increase_type IN ('estimated','percent','fixed','none')),
	CONSTRAINT "increase_rule_fallback_type" CHECK(fallback_type IN ('percent','fixed','none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_increase_rule` ON `increase_rule` (`phase_id`,`skill_id`);--> statement-breakpoint
CREATE TABLE `one_rep_max_history` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`one_rm_kg` real NOT NULL,
	`source` text NOT NULL,
	`plan_id` text,
	`effective_from_week_index` integer,
	`cycle_review_id` text,
	`estimate_session_id` text,
	`note` text,
	`set_at` text NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cycle_review_id`) REFERENCES `cycle_review`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`estimate_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "one_rep_max_history_positive" CHECK(one_rm_kg > 0),
	CONSTRAINT "one_rep_max_history_source" CHECK(source IN ('plan_setup','setup_estimate','cycle_review','manual'))
);
--> statement-breakpoint
CREATE INDEX `idx_orm_skill` ON `one_rep_max_history` (skill_id,set_at DESC);--> statement-breakpoint
CREATE INDEX `idx_orm_plan` ON `one_rep_max_history` (plan_id,skill_id,effective_from_week_index);--> statement-breakpoint
CREATE TABLE `personal_record` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`context_weight_kg` real,
	`session_id` text,
	`set_log_id` text,
	`achieved_at` text NOT NULL,
	`is_manual` integer DEFAULT 0 NOT NULL,
	`note` text,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`set_log_id`) REFERENCES `set_log`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_record_type" CHECK(type IN ('heaviest','e1rm','reps_at_weight','max_reps','heaviest_added','reps_at_added','longest_time'))
);
--> statement-breakpoint
CREATE INDEX `idx_pr_skill` ON `personal_record` (skill_id,type,achieved_at);--> statement-breakpoint
CREATE INDEX `idx_pr_session` ON `personal_record` (session_id);--> statement-breakpoint
CREATE TABLE `phase` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`plan_id` text,
	`sort_order` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`review_mode` text NOT NULL,
	`length_weeks` integer NOT NULL,
	`cycle_length_weeks` integer DEFAULT 2 NOT NULL,
	`volume_factor` real,
	`load_factor` real,
	`rpe_cap` real,
	`rest_days_at_end` integer,
	`has_test_day` integer DEFAULT 0 NOT NULL,
	`generated_from_phase_id` text,
	`continues_phase_id` text,
	`continues_offset_weeks` integer,
	`default_increase_type` text DEFAULT 'percent' NOT NULL,
	`default_increase_value` real,
	`default_increase_value_lb` real,
	`fallback_increase_type` text,
	`fallback_increase_value` real,
	`fallback_increase_value_lb` real,
	FOREIGN KEY (`template_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generated_from_phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`continues_phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "phase_type" CHECK(type IN ('training','deload','taper')),
	CONSTRAINT "phase_review_mode" CHECK(review_mode IN ('every_cycle','end_of_phase','none')),
	CONSTRAINT "phase_length_weeks" CHECK(length_weeks BETWEEN 1 AND 52),
	CONSTRAINT "phase_cycle_length_weeks" CHECK(cycle_length_weeks BETWEEN 1 AND 8),
	CONSTRAINT "phase_volume_factor" CHECK(volume_factor IS NULL OR volume_factor BETWEEN 0.1 AND 1),
	CONSTRAINT "phase_load_factor" CHECK(load_factor IS NULL OR load_factor BETWEEN 0.5 AND 1),
	CONSTRAINT "phase_rpe_cap" CHECK(rpe_cap IS NULL OR rpe_cap BETWEEN 6 AND 10),
	CONSTRAINT "phase_rest_days_at_end" CHECK(rest_days_at_end IS NULL OR rest_days_at_end BETWEEN 2 AND 7),
	CONSTRAINT "phase_default_increase_type" CHECK(default_increase_type IN ('estimated','percent','fixed','none')),
	CONSTRAINT "phase_fallback_increase_type" CHECK(fallback_increase_type IN ('percent','fixed','none')),
	CONSTRAINT "phase_owner" CHECK((template_id IS NULL) <> (plan_id IS NULL)),
	CONSTRAINT "phase_non_training_shape" CHECK(type = 'training' OR (length_weeks <= 2 AND cycle_length_weeks = 1)),
	CONSTRAINT "phase_continuation" CHECK(continues_phase_id IS NULL OR (type = 'training' AND continues_offset_weeks IS NOT NULL
                                         AND continues_offset_weeks >= 1)),
	CONSTRAINT "phase_test_day" CHECK(has_test_day = 0 OR type = 'taper')
);
--> statement-breakpoint
CREATE INDEX `idx_phase_plan` ON `phase` (plan_id,sort_order);--> statement-breakpoint
CREATE INDEX `idx_phase_template` ON `phase` (template_id,sort_order);--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`source_template_id` text,
	`status` text NOT NULL,
	`start_date` text,
	`default_tm_percent` real DEFAULT 0.9 NOT NULL,
	`paused_on` text,
	`ended_at` text,
	`ended_on` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_template_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "plan_status" CHECK(status IN ('draft','active','paused','completed','abandoned')),
	CONSTRAINT "plan_start_date" CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "plan_paused_on" CHECK(paused_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "plan_ended_on" CHECK(ended_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `plan_skill` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`tm_percent` real,
	`starting_one_rm_kg` real,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plan_skill` ON `plan_skill` (`plan_id`,`skill_id`);--> statement-breakpoint
CREATE TABLE `planned_workout` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`phase_id` text NOT NULL,
	`cycle_group_id` text NOT NULL,
	`cycle_workout_id` text NOT NULL,
	`cycle_slot_id` text,
	`phase_cycle_index` integer NOT NULL,
	`week_index` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`session_id` text,
	`skipped_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_group_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_workout_id`) REFERENCES `cycle_workout`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_slot_id`) REFERENCES `cycle_slot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "planned_workout_status" CHECK(status IN ('upcoming','completed','skipped')),
	CONSTRAINT "planned_workout_scheduled_date" CHECK(scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_pw_date` ON `planned_workout` (plan_id,scheduled_date);--> statement-breakpoint
CREATE INDEX `idx_pw_cycle` ON `planned_workout` (plan_id,cycle_group_id,phase_cycle_index);--> statement-breakpoint
CREATE INDEX `idx_pw_week` ON `planned_workout` (plan_id,week_index);--> statement-breakpoint
CREATE TABLE `schedule_change` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`type` text NOT NULL,
	`from_planned_workout_id` text,
	`from_week_index` integer,
	`offset_days` integer,
	`payload` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	`undone_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_planned_workout_id`) REFERENCES `planned_workout`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "schedule_change_type" CHECK(type IN ('shift','move','repin','pause','length','insert_deload'))
);
--> statement-breakpoint
CREATE INDEX `idx_sc_plan` ON `schedule_change` (plan_id,created_at DESC);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text,
	`planned_workout_id` text,
	`phase_id` text,
	`cycle_group_id` text,
	`phase_cycle_index` integer,
	`name` text NOT NULL,
	`kind` text DEFAULT 'planned' NOT NULL,
	`local_date` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`status` text NOT NULL,
	`notes` text,
	`rpe` real,
	`total_volume_kg` real,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`planned_workout_id`) REFERENCES `planned_workout`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`phase_id`) REFERENCES `phase`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "session_kind" CHECK(kind IN ('planned','ad_hoc','one_rm_estimate','test_day')),
	CONSTRAINT "session_status" CHECK(status IN ('in_progress','completed')),
	CONSTRAINT "session_rpe" CHECK(rpe IS NULL OR rpe BETWEEN 1 AND 10),
	CONSTRAINT "session_local_date" CHECK(local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_in_progress` ON `session` (status) WHERE status = 'in_progress';--> statement-breakpoint
CREATE INDEX `idx_session_date` ON `session` (status,started_at DESC);--> statement-breakpoint
CREATE INDEX `idx_session_plan` ON `session` (plan_id,started_at DESC);--> statement-breakpoint
CREATE TABLE `session_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`cycle_exercise_id` text,
	`sort_order` integer NOT NULL,
	`superset_group` text,
	`rest_sec` integer,
	`notes` text,
	`was_substituted` integer DEFAULT 0 NOT NULL,
	`was_added` integer DEFAULT 0 NOT NULL,
	`tm_snapshot_kg` real,
	`tracking_type` text NOT NULL,
	`load_convention` text NOT NULL,
	`is_unilateral` integer NOT NULL,
	`is_main_lift` integer NOT NULL,
	`dp_increase_kg` real,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_exercise_id`) REFERENCES `cycle_exercise`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_se_session` ON `session_exercise` (session_id,sort_order);--> statement-breakpoint
CREATE INDEX `idx_se_skill` ON `session_exercise` (skill_id);--> statement-breakpoint
CREATE TABLE `set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`is_warmup` integer DEFAULT 0 NOT NULL,
	`is_amrap` integer DEFAULT 0 NOT NULL,
	`is_top_set` integer DEFAULT 0 NOT NULL,
	`prescribed_reps_min` integer,
	`prescribed_reps_max` integer,
	`prescribed_load_kg` real,
	`prescribed_time_sec` integer,
	`target_rpe_min` real,
	`target_rpe_max` real,
	`reps` integer,
	`load_kg` real,
	`time_sec` integer,
	`rpe` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "set_log_rpe" CHECK(rpe IS NULL OR (rpe BETWEEN 6 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
	CONSTRAINT "set_log_status" CHECK(status IN ('pending','completed','failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_set_completed` ON `set_log` (completed_at);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_set_log` ON `set_log` (`session_exercise_id`,`set_index`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`unit` text DEFAULT 'kg' NOT NULL,
	`default_rest_sec` integer DEFAULT 120 NOT NULL,
	`week_start` integer DEFAULT 1 NOT NULL,
	`weight_increment_kg` real DEFAULT 2.5 NOT NULL,
	`weight_increment_lb` real DEFAULT 5 NOT NULL,
	`reminder_enabled` integer DEFAULT 0 NOT NULL,
	`reminder_time` text,
	`rest_timer_alerts` integer DEFAULT 1 NOT NULL,
	`keep_awake` integer DEFAULT 1 NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`disclaimer_ack_at` text,
	`tips_enabled` integer DEFAULT 1 NOT NULL,
	`seen_tips` text DEFAULT '[]' NOT NULL,
	`onboarding_completed_at` text,
	`last_export_at` text,
	`backup_reminder_dismissed_at` text,
	`auto_backup_enabled` integer DEFAULT 0 NOT NULL,
	`last_auto_backup_at` text,
	`last_auto_backup_error` text,
	CONSTRAINT "settings_singleton" CHECK(id = 1),
	CONSTRAINT "settings_unit" CHECK(unit IN ('kg','lb')),
	CONSTRAINT "settings_week_start" CHECK(week_start IN (0,1)),
	CONSTRAINT "settings_theme" CHECK(theme IN ('light','dark','system'))
);
--> statement-breakpoint
CREATE TABLE `skill` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle_group` text NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`tracking_type` text NOT NULL,
	`load_convention` text DEFAULT 'total' NOT NULL,
	`is_unilateral` integer DEFAULT 0 NOT NULL,
	`is_main_lift` integer DEFAULT 0 NOT NULL,
	`load_increment_kg` real,
	`load_increment_lb` real,
	`is_custom` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "skill_tracking_type" CHECK(tracking_type IN ('weight_reps','reps_only','bodyweight_plus_load','time','completion_only')),
	CONSTRAINT "skill_load_convention" CHECK(load_convention IN ('total','per_side')),
	CONSTRAINT "skill_main_lift" CHECK(is_main_lift = 0 OR (tracking_type = 'weight_reps' AND load_convention = 'total'))
);
--> statement-breakpoint
CREATE INDEX `idx_skill_name` ON `skill` (name COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `idx_skill_filter` ON `skill` (is_archived,muscle_group,equipment);--> statement-breakpoint
CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`default_tm_percent` real DEFAULT 0.9 NOT NULL,
	`sessions_per_week` integer NOT NULL,
	`level` text,
	`is_built_in` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "template_level" CHECK(level IN ('beginner','intermediate'))
);
