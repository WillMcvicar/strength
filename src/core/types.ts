// Shared types for the pure domain layer (DESIGN §2.2). These mirror the §4 tables, in the
// camelCase shape repositories return, and are extended as later build-plan steps land.

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
