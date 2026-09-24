// Shared types for the pure domain layer (DESIGN §2.2). These mirror the §4 tables, in the
// camelCase shape repositories return, and are extended as later build-plan slices land.

/** Display unit. Weights are always stored in kg (FR-12.1). */
export type Unit = 'kg' | 'lb';

/** A plan date: 'YYYY-MM-DD', local calendar, never a timestamp (NFR-12, DESIGN §3.15). */
export type LocalDate = string;

export interface LoadFormatOptions {
  /** `per_side` skills read as "22.5 kg × 2" (FR-1.8). */
  perSide?: boolean;
  /** Added load for `bodyweight_plus_load`, shown as "+20 kg" or "−10 kg". */
  signed?: boolean;
}

/** The per-unit increment overrides on a skill (FR-1.6). */
export interface SkillIncrements {
  loadIncrementKg?: number | null;
  loadIncrementLb?: number | null;
}

/** The global fallback increments (FR-12.4). */
export interface IncrementSettings {
  weightIncrementKg: number;
  weightIncrementLb: number;
}

export type SetStatus = 'pending' | 'completed' | 'failed';

/** A logged set, as far as the estimation rules need it (DESIGN §4.3 `set_log`). */
export interface LoggedSet {
  status: SetStatus;
  isWarmup: boolean;
  isTopSet: boolean;
  isAmrap: boolean;
  reps: number | null;
  /** 6–10 in half steps, or null when none was logged. */
  rpe: number | null;
  /** Per side for `per_side` skills; added load for `bodyweight_plus_load`. */
  loadKg: number | null;
}

export type LoadType = 'percent_tm' | 'top_set' | 'double_progression' | 'fixed' | 'bodyweight';

/** A prescribed set (DESIGN §4.3 `workout_set`). */
export interface PrescribedSet {
  loadType: LoadType;
  /** Fraction of TM, e.g. 0.8. Required for `percent_tm` and `top_set`. */
  loadPercent?: number | null;
  /** Required for `fixed`. */
  fixedLoadKg?: number | null;
}

export type PhaseType = 'training' | 'deload' | 'taper';

export interface PhaseLoadSettings {
  type: PhaseType;
  /** 0.5–1, deload phases only (D-9). */
  loadFactor?: number | null;
}

export interface DoubleProgressionState {
  workingLoadKg: number;
}

/** Everything `prescribedLoadKg` needs about the surrounding plan (DESIGN §3.3). */
export interface LoadContext {
  tmKg: number;
  unit: Unit;
  increment: number;
  phase: PhaseLoadSettings;
  dpState?: DoubleProgressionState | null;
  lastLoadKg?: number | null;
}

// ───────────── Stored rows (DESIGN §4.3) ─────────────
// The camelCase shapes repositories return. Booleans are `boolean`, JSON columns are parsed, and
// dates are `LocalDate` or ISO-8601 UTC strings as the DDL comments say.

export type MuscleGroup =
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'lower_back'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'band'
  | 'cardio_machine'
  | 'other';

/** FR-1.2 */
export type TrackingType =
  'weight_reps' | 'reps_only' | 'bodyweight_plus_load' | 'time' | 'completion_only';

/** FR-1.8 */
export type LoadConvention = 'total' | 'per_side';

export type Theme = 'light' | 'dark' | 'system';
export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned';
export type TemplateLevel = 'beginner' | 'intermediate';
export type ReviewMode = 'every_cycle' | 'end_of_phase' | 'none';
export type IncreaseType = 'estimated' | 'percent' | 'fixed' | 'none';
export type FallbackIncreaseType = 'percent' | 'fixed' | 'none';
export type WorkoutKind = 'normal' | 'test_day';
/** Stored status only; "missed" is derived (DESIGN §3.7). */
export type PlannedStatus = 'upcoming' | 'completed' | 'skipped';

export interface Skill {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  trackingType: TrackingType;
  loadConvention: LoadConvention;
  isUnilateral: boolean;
  isMainLift: boolean;
  loadIncrementKg: number | null;
  loadIncrementLb: number | null;
  isCustom: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: number;
  unit: Unit;
  defaultRestSec: number;
  /** 0 Sunday, 1 Monday (FR-12.3). */
  weekStart: 0 | 1;
  weightIncrementKg: number;
  weightIncrementLb: number;
  reminderEnabled: boolean;
  /** 'HH:MM' local. */
  reminderTime: string | null;
  restTimerAlerts: boolean;
  keepAwake: boolean;
  theme: Theme;
  disclaimerAckAt: string | null;
  tipsEnabled: boolean;
  seenTips: string[];
  onboardingCompletedAt: string | null;
  lastExportAt: string | null;
  backupReminderDismissedAt: string | null;
  autoBackupEnabled: boolean;
  lastAutoBackupAt: string | null;
  lastAutoBackupError: string | null;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  defaultTmPercent: number;
  sessionsPerWeek: number;
  level: TemplateLevel | null;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  sourceTemplateId: string | null;
  status: PlanStatus;
  startDate: LocalDate | null;
  defaultTmPercent: number;
  pausedOn: LocalDate | null;
  endedAt: string | null;
  endedOn: LocalDate | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSkill {
  id: string;
  planId: string;
  skillId: string;
  /** null = the plan default. */
  tmPercent: number | null;
  startingOneRmKg: number | null;
}

/** A blueprint phase, owned by exactly one template or one plan. */
export interface Phase {
  id: string;
  templateId: string | null;
  planId: string | null;
  sortOrder: number;
  name: string;
  type: PhaseType;
  reviewMode: ReviewMode;
  lengthWeeks: number;
  cycleLengthWeeks: number;
  volumeFactor: number | null;
  loadFactor: number | null;
  rpeCap: number | null;
  restDaysAtEnd: number | null;
  hasTestDay: boolean;
  generatedFromPhaseId: string | null;
  /** D-1, D-14: the cycle group is `continuesPhaseId ?? id`. */
  continuesPhaseId: string | null;
  continuesOffsetWeeks: number | null;
  defaultIncreaseType: IncreaseType;
  defaultIncreaseValue: number | null;
  defaultIncreaseValueLb: number | null;
  fallbackIncreaseType: FallbackIncreaseType | null;
  fallbackIncreaseValue: number | null;
  fallbackIncreaseValueLb: number | null;
}

export interface IncreaseRule {
  id: string;
  phaseId: string;
  skillId: string;
  increaseType: IncreaseType;
  increaseValue: number | null;
  increaseValueLb: number | null;
  fallbackType: FallbackIncreaseType | null;
  fallbackValue: number | null;
  fallbackValueLb: number | null;
}

/** A workout, defined once per phase (D-20). */
export interface CycleWorkout {
  id: string;
  phaseId: string;
  name: string;
  sortOrder: number;
  kind: WorkoutKind;
}

/** One weekday appearance of a workout (D-20). */
export interface CycleSlot {
  id: string;
  phaseId: string;
  cycleWorkoutId: string;
  cycleWeekIndex: number;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  sortOrder: number;
  /** C-5: not generated from this week of the cycle group on. */
  retiredFromGroupWeek: number | null;
  /** D-30: on a generated deload slot, the slot it was copied from; it takes that slot's pin. */
  sourceCycleSlotId: string | null;
}

export interface CycleExercise {
  id: string;
  cycleWorkoutId: string;
  skillId: string;
  sortOrder: number;
  supersetGroup: string | null;
  restSec: number | null;
  notes: string | null;
  sourceCycleExerciseId: string | null;
}

export interface CycleSet {
  id: string;
  cycleExerciseId: string;
  setIndex: number;
  isWarmup: boolean;
  repsMin: number | null;
  repsMax: number | null;
  isAmrap: boolean;
  targetRpeMin: number | null;
  targetRpeMax: number | null;
  loadType: LoadType;
  loadPercent: number | null;
  fixedLoadKg: number | null;
  targetTimeSec: number | null;
}

/** One confirmed 1RM (SRS §4). The effective week is derived and cached (D-2). */
export interface OneRepMaxHistory {
  id: string;
  skillId: string;
  oneRmKg: number;
  source: 'plan_setup' | 'setup_estimate' | 'cycle_review' | 'manual';
  planId: string | null;
  effectiveFromWeekIndex: number | null;
  cycleReviewId: string | null;
  estimateSessionId: string | null;
  note: string | null;
  setAt: string;
}

export interface PlannedWorkout {
  id: string;
  planId: string;
  phaseId: string;
  cycleGroupId: string;
  cycleWorkoutId: string;
  /** null for Test Day. */
  cycleSlotId: string | null;
  phaseCycleIndex: number;
  weekIndex: number;
  scheduledDate: LocalDate;
  status: PlannedStatus;
  sessionId: string | null;
  skippedAt: string | null;
}

// ───────────── Sessions (FR-9, DESIGN §4.3) ─────────────

export type SessionKind = 'planned' | 'ad_hoc' | 'one_rm_estimate' | 'test_day';
export type SessionStatus = 'in_progress' | 'completed';

export interface Session {
  id: string;
  planId: string | null;
  plannedWorkoutId: string | null;
  phaseId: string | null;
  /** A historical label with no foreign key (D-27). */
  cycleGroupId: string | null;
  phaseCycleIndex: number | null;
  /** Snapshot of the workout name. */
  name: string;
  kind: SessionKind;
  /** The plan date the session counts for. */
  localDate: LocalDate;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  notes: string | null;
  /** Effort rating, 1–10 (FR-9.7). */
  rpe: number | null;
  /** Cached at finish (FR-9.8). */
  totalVolumeKg: number | null;
  updatedAt: string;
}

/** An exercise in a session, with the skill fields snapshotted when it was added (FR-1.10). */
export interface SessionExercise {
  id: string;
  sessionId: string;
  skillId: string;
  cycleExerciseId: string | null;
  sortOrder: number;
  supersetGroup: string | null;
  restSec: number | null;
  notes: string | null;
  wasSubstituted: boolean;
  wasAdded: boolean;
  tmSnapshotKg: number | null;
  trackingType: TrackingType;
  loadConvention: LoadConvention;
  isUnilateral: boolean;
  isMainLift: boolean;
  dpIncreaseKg: number | null;
}

export interface SetLog {
  id: string;
  sessionExerciseId: string;
  setIndex: number;
  isWarmup: boolean;
  isAmrap: boolean;
  isTopSet: boolean;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
  prescribedLoadKg: number | null;
  prescribedTimeSec: number | null;
  targetRpeMin: number | null;
  targetRpeMax: number | null;
  reps: number | null;
  /** Per side for `per_side`; added load (may be negative) for `bodyweight_plus_load`. */
  loadKg: number | null;
  timeSec: number | null;
  rpe: number | null;
  status: SetStatus;
  completedAt: string | null;
}
