// How a PR is worded (DESIGN §7.7, §7.11, §7.17).
import type { PrView } from '@/features/prs';

import { prText } from './prText';

const pr = (over: Partial<PrView>): PrView => ({
  id: 'pr1',
  skillId: 'skill_bench_press',
  skillName: 'Bench press',
  type: 'heaviest',
  value: 82.5,
  contextWeightKg: null,
  perSide: false,
  achievedAt: '2026-09-16T18:00:00.000Z',
  sessionId: 's1',
  ...over,
});

describe('prText', () => {
  it('words the §7.7 example: Heaviest 82.5 kg, Est. 1RM 99 kg', () => {
    expect(prText(pr({}), 'kg')).toEqual({
      label: 'Heaviest',
      value: '82.5 kg',
      spoken: 'Bench press, heaviest, 82.5 kilograms',
    });
    expect(prText(pr({ type: 'e1rm', value: 82.5 * (1 + 6 / 30) }), 'kg')).toMatchObject({
      label: 'Est. 1RM',
      value: '99 kg',
    });
  });

  it('shows an estimated 1RM to one decimal in the display unit (AC-54)', () => {
    const e1rm = pr({ type: 'e1rm', value: 80 * (1 + 10 / 30) });
    expect(prText(e1rm, 'kg')).toMatchObject({
      value: '106.7 kg',
      spoken: 'Bench press, estimated 1 rep max, 106.7 kilograms',
    });
    // 106.667 kg is 235.16 lb
    expect(prText(e1rm, 'lb').value).toBe('235.2 lb');
  });

  it('words reps at a weight, per-side loads, reps, time and added load', () => {
    expect(prText(pr({ type: 'reps_at_weight', value: 8, contextWeightKg: 80 }), 'kg')).toEqual({
      label: 'Reps at 80 kg',
      value: '8 reps',
      spoken: 'Bench press, most reps at 80 kilograms, 8 reps',
    });
    expect(prText(pr({ value: 22.5, perSide: true }), 'kg').value).toBe('22.5 kg × 2');
    expect(prText(pr({ type: 'max_reps', value: 1 }), 'kg')).toMatchObject({
      label: 'Most reps',
      value: '1 rep',
    });
    expect(prText(pr({ type: 'longest_time', value: 90 }), 'kg')).toMatchObject({
      label: 'Longest time',
      value: '1:30',
    });
    expect(prText(pr({ type: 'heaviest_added', value: 20 }), 'kg')).toEqual({
      label: 'Heaviest added',
      value: 'BW +20 kg',
      spoken: 'Bench press, heaviest added load, bodyweight plus 20 kilograms',
    });
    expect(
      prText(pr({ type: 'reps_at_added', value: 5, contextWeightKg: -10 }), 'kg'),
    ).toMatchObject({ label: 'Reps at BW −10 kg', value: '5 reps' });
    expect(
      prText(pr({ type: 'reps_at_added', value: 12, contextWeightKg: 0 }), 'kg'),
    ).toMatchObject({ label: 'Reps at BW', value: '12 reps' });
  });
});
