// Built-in Skill Library (FR-1.1, FR-1.2, FR-1.8). The list isn't specified in the SRS or the
// design; this draft is awaiting product-owner review and a /spec-change to record it.
// IDs are fixed and readable (DESIGN §4.1). Barbell, machine and cable skills use the global
// increment (FR-12.4); dumbbells step 2 kg / 5 lb (FR-1.6). Volume counts × 2 for per_side or
// unilateral skills, never × 4 (D-11).
import type { Skill } from '@/core/types';

export type SeedSkill = Omit<Skill, 'isCustom' | 'isArchived' | 'createdAt' | 'updatedAt'>;

const base = {
  secondaryMuscles: [],
  trackingType: 'weight_reps',
  loadConvention: 'total',
  isUnilateral: false,
  isMainLift: false,
  loadIncrementKg: null,
  loadIncrementLb: null,
} as const satisfies Partial<SeedSkill>;

const dumbbell = {
  ...base,
  equipment: 'dumbbell',
  loadConvention: 'per_side',
  loadIncrementKg: 2,
  loadIncrementLb: 5,
} as const satisfies Partial<SeedSkill>;

export const SEED_SKILLS: readonly SeedSkill[] = [
  // Main lifts: %-based, so weight_reps + total (FR-1.9)
  {
    ...base,
    id: 'skill_back_squat',
    name: 'Back squat',
    muscleGroup: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings', 'lower_back'],
    equipment: 'barbell',
    isMainLift: true,
  },
  {
    ...base,
    id: 'skill_bench_press',
    name: 'Bench press',
    muscleGroup: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    isMainLift: true,
  },
  {
    ...base,
    id: 'skill_deadlift',
    name: 'Deadlift',
    muscleGroup: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower_back', 'upper_back', 'forearms'],
    equipment: 'barbell',
    isMainLift: true,
  },
  {
    ...base,
    id: 'skill_overhead_press',
    name: 'Overhead press',
    muscleGroup: 'shoulders',
    secondaryMuscles: ['triceps', 'upper_back'],
    equipment: 'barbell',
    isMainLift: true,
  },

  // Barbell accessories
  {
    ...base,
    id: 'skill_front_squat',
    name: 'Front squat',
    muscleGroup: 'quads',
    secondaryMuscles: ['glutes', 'abs'],
    equipment: 'barbell',
  },
  {
    ...base,
    id: 'skill_romanian_deadlift',
    name: 'Romanian deadlift',
    muscleGroup: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower_back'],
    equipment: 'barbell',
  },
  {
    ...base,
    id: 'skill_barbell_row',
    name: 'Barbell row',
    muscleGroup: 'upper_back',
    secondaryMuscles: ['lats', 'biceps'],
    equipment: 'barbell',
  },
  {
    ...base,
    id: 'skill_hip_thrust',
    name: 'Hip thrust',
    muscleGroup: 'glutes',
    secondaryMuscles: ['hamstrings'],
    equipment: 'barbell',
  },

  // Dumbbells: load entered per hand
  {
    ...dumbbell,
    id: 'skill_incline_dumbbell_press',
    name: 'Incline dumbbell press',
    muscleGroup: 'chest',
    secondaryMuscles: ['shoulders', 'triceps'],
  },
  { ...dumbbell, id: 'skill_lateral_raise', name: 'Lateral raise', muscleGroup: 'shoulders' },
  {
    ...dumbbell,
    id: 'skill_dumbbell_curl',
    name: 'Dumbbell curl',
    muscleGroup: 'biceps',
    secondaryMuscles: ['forearms'],
  },
  {
    ...dumbbell,
    id: 'skill_walking_lunge',
    name: 'Walking lunge',
    muscleGroup: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
  },
  { ...dumbbell, id: 'skill_wrist_curl', name: 'Dumbbell wrist curl', muscleGroup: 'forearms' },
  // per_side and unilateral together still count × 2 (D-11)
  {
    ...dumbbell,
    id: 'skill_bulgarian_split_squat',
    name: 'Bulgarian split squat',
    muscleGroup: 'quads',
    secondaryMuscles: ['glutes'],
    isUnilateral: true,
  },
  // One dumbbell, one arm at a time: the total load, reps each side
  {
    ...dumbbell,
    id: 'skill_dumbbell_row',
    name: 'One-arm dumbbell row',
    muscleGroup: 'lats',
    secondaryMuscles: ['upper_back', 'biceps'],
    loadConvention: 'total',
    isUnilateral: true,
  },

  // Kettlebell and band
  {
    ...base,
    id: 'skill_kettlebell_swing',
    name: 'Kettlebell swing',
    muscleGroup: 'glutes',
    secondaryMuscles: ['hamstrings', 'lower_back'],
    equipment: 'kettlebell',
  },
  {
    ...base,
    id: 'skill_band_pull_apart',
    name: 'Band pull-apart',
    muscleGroup: 'upper_back',
    secondaryMuscles: ['shoulders'],
    equipment: 'band',
    trackingType: 'reps_only',
  },

  // Machines and cables
  {
    ...base,
    id: 'skill_leg_press',
    name: 'Leg press',
    muscleGroup: 'quads',
    secondaryMuscles: ['glutes'],
    equipment: 'machine',
  },
  {
    ...base,
    id: 'skill_leg_curl',
    name: 'Leg curl',
    muscleGroup: 'hamstrings',
    equipment: 'machine',
  },
  {
    ...base,
    id: 'skill_leg_extension',
    name: 'Leg extension',
    muscleGroup: 'quads',
    equipment: 'machine',
  },
  {
    ...base,
    id: 'skill_calf_raise',
    name: 'Calf raise',
    muscleGroup: 'calves',
    equipment: 'machine',
  },
  {
    ...base,
    id: 'skill_lat_pulldown',
    name: 'Lat pulldown',
    muscleGroup: 'lats',
    secondaryMuscles: ['biceps'],
    equipment: 'cable',
  },
  {
    ...base,
    id: 'skill_seated_cable_row',
    name: 'Seated cable row',
    muscleGroup: 'upper_back',
    secondaryMuscles: ['lats', 'biceps'],
    equipment: 'cable',
  },
  {
    ...base,
    id: 'skill_triceps_pushdown',
    name: 'Triceps pushdown',
    muscleGroup: 'triceps',
    equipment: 'cable',
  },
  {
    ...base,
    id: 'skill_face_pull',
    name: 'Face pull',
    muscleGroup: 'shoulders',
    secondaryMuscles: ['upper_back'],
    equipment: 'cable',
  },

  // Bodyweight: added load is logged, negative = assisted (FR-1.2)
  {
    ...base,
    id: 'skill_pull_up',
    name: 'Pull-up',
    muscleGroup: 'lats',
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: 'bodyweight',
    trackingType: 'bodyweight_plus_load',
  },
  {
    ...base,
    id: 'skill_dip',
    name: 'Dip',
    muscleGroup: 'triceps',
    secondaryMuscles: ['chest', 'shoulders'],
    equipment: 'bodyweight',
    trackingType: 'bodyweight_plus_load',
  },
  {
    ...base,
    id: 'skill_back_extension',
    name: 'Back extension',
    muscleGroup: 'lower_back',
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'bodyweight',
    trackingType: 'bodyweight_plus_load',
  },
  {
    ...base,
    id: 'skill_push_up',
    name: 'Push-up',
    muscleGroup: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    trackingType: 'reps_only',
  },
  {
    ...base,
    id: 'skill_hanging_leg_raise',
    name: 'Hanging leg raise',
    muscleGroup: 'abs',
    equipment: 'bodyweight',
    trackingType: 'reps_only',
  },
  {
    ...base,
    id: 'skill_plank',
    name: 'Plank',
    muscleGroup: 'abs',
    equipment: 'bodyweight',
    trackingType: 'time',
  },

  // Cardio: done / not done only (FR-1.2)
  {
    ...base,
    id: 'skill_run',
    name: 'Run',
    muscleGroup: 'cardio',
    equipment: 'other',
    trackingType: 'completion_only',
  },
  {
    ...base,
    id: 'skill_rowing_machine',
    name: 'Rowing machine',
    muscleGroup: 'cardio',
    equipment: 'cardio_machine',
    trackingType: 'completion_only',
  },
  {
    ...base,
    id: 'skill_bike',
    name: 'Bike',
    muscleGroup: 'cardio',
    equipment: 'cardio_machine',
    trackingType: 'completion_only',
  },
];
