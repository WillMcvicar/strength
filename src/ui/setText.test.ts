// What a set row shows and says (DESIGN §7.6 set row table, §7.17; FR-1.8, FR-9.2b, FR-9.3).
import { loadText, repsText, spokenSet, type RowExercise, type RowSet } from './setText';

const barbell: RowExercise = {
  trackingType: 'weight_reps',
  loadConvention: 'total',
  isUnilateral: false,
};

const set = (over: Partial<RowSet> = {}): RowSet => ({
  isWarmup: false,
  isTopSet: false,
  isAmrap: false,
  reps: 5,
  loadKg: 100,
  timeSec: null,
  rpe: null,
  status: 'pending',
  ...over,
});

describe('loadText', () => {
  it('shows a barbell load, and a dash when there is none to pre-fill yet', () => {
    expect(loadText(set(), barbell, 'kg')).toEqual({ shown: '100 kg', spoken: '100 kilograms' });
    expect(loadText(set({ loadKg: null }), barbell, 'kg')).toEqual({
      shown: '—',
      spoken: 'no load entered',
    });
  });

  it('shows per-side loads as "× 2" (FR-1.8)', () => {
    expect(
      loadText(set({ loadKg: 22.5 }), { ...barbell, loadConvention: 'per_side' }, 'kg'),
    ).toEqual({ shown: '22.5 kg × 2', spoken: '22.5 kilograms each side' });
  });

  it('shows weighted and assisted bodyweight as "BW +20 kg" and "BW −10 kg"', () => {
    const pullUp = { ...barbell, trackingType: 'bodyweight_plus_load' as const };
    expect(loadText(set({ loadKg: 20 }), pullUp, 'kg')).toEqual({
      shown: 'BW +20 kg',
      spoken: 'bodyweight plus 20 kilograms',
    });
    expect(loadText(set({ loadKg: -10 }), pullUp, 'kg')?.shown).toBe('BW −10 kg');
    expect(loadText(set({ loadKg: null }), pullUp, 'kg')).toEqual({
      shown: 'BW',
      spoken: 'bodyweight',
    });
    expect(loadText(set({ loadKg: 0 }), pullUp, 'kg')?.shown).toBe('BW');
  });

  it('rounds in the display unit', () => {
    // 80 kg = 176.37 lb, shown to 2 dp; prescriptions are already rounded in lb (FR-3.6).
    expect(loadText(set({ loadKg: 79.3787 }), barbell, 'lb')?.shown).toBe('175 lb');
  });

  it('has no load cell for skills tracked without one', () => {
    for (const trackingType of ['reps_only', 'time', 'completion_only'] as const) {
      expect(loadText(set(), { ...barbell, trackingType }, 'kg')).toBeNull();
    }
  });
});

describe('repsText', () => {
  it('shows reps, "each side" for unilateral skills, and "AMRAP" until an AMRAP is entered', () => {
    expect(repsText(set(), barbell)).toEqual({ shown: '5', spoken: '5 reps' });
    expect(repsText(set({ reps: 1 }), barbell)?.spoken).toBe('1 rep');
    expect(repsText(set({ reps: 8 }), { ...barbell, isUnilateral: true })).toEqual({
      shown: '8 each side',
      spoken: '8 reps each side',
    });
    expect(repsText(set({ isAmrap: true, reps: null }), barbell)).toEqual({
      shown: 'AMRAP',
      spoken: 'as many reps as possible',
    });
    expect(repsText(set({ reps: null }), barbell)).toEqual({
      shown: '—',
      spoken: 'no reps entered',
    });
  });

  it('shows a timed set as a clock', () => {
    const plank = { ...barbell, trackingType: 'time' as const };
    expect(repsText(set({ timeSec: 60, reps: null }), plank)).toEqual({
      shown: '1:00',
      spoken: '1 minute',
    });
    expect(repsText(set({ timeSec: null, reps: null }), plank)?.shown).toBe('—');
  });

  it('has nothing to show for completion-only items', () => {
    expect(repsText(set(), { ...barbell, trackingType: 'completion_only' })).toBeNull();
  });
});

describe('spokenSet (§7.17)', () => {
  it('reads the row as one sentence: "Set 2, 100 kilograms, 5 reps, not done"', () => {
    expect(spokenSet({ number: 2, set: set(), exercise: barbell, unit: 'kg' })).toBe(
      'Set 2, 100 kilograms, 5 reps, not done',
    );
  });

  it('names warm-ups and top sets, and says how the set went', () => {
    expect(
      spokenSet({
        number: 1,
        set: set({ isWarmup: true, loadKg: 60 }),
        exercise: barbell,
        unit: 'kg',
      }),
    ).toBe('Warm-up, 60 kilograms, 5 reps, not done');
    expect(
      spokenSet({
        number: 1,
        set: set({ isTopSet: true, status: 'completed', rpe: 8, reps: 3 }),
        exercise: barbell,
        unit: 'kg',
      }),
    ).toBe('Top set, 100 kilograms, 3 reps, done at RPE 8');
    expect(
      spokenSet({ number: 3, set: set({ status: 'failed' }), exercise: barbell, unit: 'kg' }),
    ).toBe('Set 3, 100 kilograms, 5 reps, failed');
    expect(
      spokenSet({ number: 3, set: set(), exercise: barbell, unit: 'kg', awaitingRpe: true }),
    ).toBe('Set 3, 100 kilograms, 5 reps, pick an RPE to finish it');
  });

  it('reads a completion-only item by its name', () => {
    const run = { ...barbell, trackingType: 'completion_only' as const };
    expect(spokenSet({ number: 1, set: set(), exercise: run, unit: 'kg', name: 'Easy run' })).toBe(
      'Easy run, not done',
    );
  });
});

describe('spokenSet with the exercise name', () => {
  it("names the exercise, so two exercises' set 1s are told apart", () => {
    expect(
      spokenSet({ number: 1, set: set(), exercise: barbell, unit: 'kg', name: 'Back squat' }),
    ).toBe('Back squat, set 1, 100 kilograms, 5 reps, not done');
  });
});
