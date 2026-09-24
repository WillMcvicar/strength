// DESIGN §3.14 session tonnage (FR-1.8, FR-9.8, FR-9.14, FR-9.15, D-11).
import type { SetStatus } from './types';
import {
  countsAsSet,
  sessionTotals,
  setVolumeKg,
  volumeMultiplier,
  type VolumeExercise,
  type VolumeSet,
} from './volume';

const barbell: VolumeExercise = {
  trackingType: 'weight_reps',
  loadConvention: 'total',
  isUnilateral: false,
};

const done = (loadKg: number | null, reps: number | null, over: Partial<VolumeSet> = {}) => ({
  status: 'completed' as SetStatus,
  isWarmup: false,
  loadKg,
  reps,
  ...over,
});

describe('volumeMultiplier (FR-1.8, D-11)', () => {
  it('is 2 for per-side or unilateral skills, never 4', () => {
    expect(volumeMultiplier(barbell)).toBe(1);
    expect(volumeMultiplier({ ...barbell, loadConvention: 'per_side' })).toBe(2);
    expect(volumeMultiplier({ ...barbell, isUnilateral: true })).toBe(2);
    expect(volumeMultiplier({ ...barbell, loadConvention: 'per_side', isUnilateral: true })).toBe(
      2,
    );
  });
});

describe('AC-39 Per-side dumbbells', () => {
  it('counts 30 kg × 10 per hand as 600 kg', () => {
    expect(setVolumeKg(done(30, 10), { ...barbell, loadConvention: 'per_side' })).toBe(600);
  });
});

describe('AC-55 Unilateral volume', () => {
  it('counts a 20 kg × 8 split squat (total convention) as 320 kg', () => {
    expect(setVolumeKg(done(20, 8), { ...barbell, isUnilateral: true })).toBe(320);
  });
});

describe('AC-38 Warm-ups and failed sets', () => {
  it('uses only the 120 kg working sets for volume and set counts', () => {
    const squat = {
      exercise: barbell,
      sets: [
        done(60, 5, { isWarmup: true }),
        done(80, 3, { isWarmup: true }),
        done(150, 1, { status: 'failed' }),
        done(120, 5),
        done(120, 5),
        done(120, 5),
      ],
    };
    expect(sessionTotals([squat])).toEqual({ volumeKg: 1800, setsCompleted: 3 });
  });
});

describe('setVolumeKg', () => {
  it('adds nothing for sets that are not completed working sets', () => {
    expect(setVolumeKg(done(100, 5, { status: 'pending' }), barbell)).toBe(0);
    expect(setVolumeKg(done(100, 5, { status: 'failed' }), barbell)).toBe(0);
    expect(setVolumeKg(done(100, 5, { isWarmup: true }), barbell)).toBe(0);
  });

  it('adds nothing when the load or reps are missing', () => {
    expect(setVolumeKg(done(null, 5), barbell)).toBe(0);
    expect(setVolumeKg(done(100, null), barbell)).toBe(0);
  });

  it('counts only weight_reps skills (DESIGN §3.14)', () => {
    for (const trackingType of [
      'reps_only',
      'bodyweight_plus_load',
      'time',
      'completion_only',
    ] as const) {
      expect(setVolumeKg(done(20, 5), { ...barbell, trackingType })).toBe(0);
    }
  });
});

describe('countsAsSet (FR-9.14, FR-9.15)', () => {
  it('counts completed working sets of any tracking type', () => {
    expect(countsAsSet(done(null, null))).toBe(true);
    expect(countsAsSet(done(null, null, { isWarmup: true }))).toBe(false);
    expect(countsAsSet(done(null, null, { status: 'failed' }))).toBe(false);
    expect(countsAsSet(done(null, null, { status: 'pending' }))).toBe(false);
  });
});

describe('sessionTotals: the §7.7 summary example', () => {
  it('gives 16 sets and 6,062.5 kg, with planks counted as sets but adding no volume', () => {
    const plank: VolumeExercise = { ...barbell, trackingType: 'time' };
    const totals = sessionTotals([
      { exercise: barbell, sets: Array.from({ length: 5 }, () => done(90, 5)) },
      {
        exercise: barbell,
        sets: [...Array.from({ length: 4 }, () => done(80, 5)), done(82.5, 5)],
      },
      { exercise: barbell, sets: Array.from({ length: 3 }, () => done(60, 10)) },
      { exercise: plank, sets: Array.from({ length: 3 }, () => done(null, null)) },
    ]);
    expect(totals).toEqual({ volumeKg: 6062.5, setsCompleted: 16 });
  });
});
