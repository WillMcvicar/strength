// DESIGN §3.7 (FR-4.11, FR-4.15, FR-8.3, C-2, D-24).
import type { Phase, Plan, PlannedWorkout } from '../types';
import { effectiveStatus, progress } from './status';

const plan = (over: Partial<Plan> = {}): Pick<Plan, 'status' | 'pausedOn' | 'endedOn'> => ({
  status: 'active',
  pausedOn: null,
  endedOn: null,
  ...over,
});

const pw = (
  id: string,
  weekIndex: number,
  scheduledDate: string,
  status: PlannedWorkout['status'] = 'upcoming',
): PlannedWorkout => ({
  id,
  planId: 'plan',
  phaseId: 'p',
  cycleGroupId: 'p',
  cycleWorkoutId: 'A',
  cycleSlotId: 's',
  phaseCycleIndex: Math.ceil(weekIndex / 2),
  weekIndex,
  scheduledDate,
  status,
  sessionId: null,
  skippedAt: null,
});

describe('effectiveStatus (FR-4.11: missed is derived)', () => {
  const today = '2026-09-16';

  it.each`
    case                                      | status         | date            | p                                                       | inProgress | expected
    ${'completed stays completed'}            | ${'completed'} | ${'2026-09-14'} | ${plan()}                                               | ${false}   | ${'completed'}
    ${'skipped stays skipped'}                | ${'skipped'}   | ${'2026-09-14'} | ${plan({ status: 'abandoned', endedOn: '2026-09-01' })} | ${false}   | ${'skipped'}
    ${'D-24: open on/after end date'}         | ${'upcoming'}  | ${'2026-09-14'} | ${plan({ status: 'abandoned', endedOn: '2026-09-14' })} | ${true}    | ${'not_done'}
    ${'D-24: open before end date is missed'} | ${'upcoming'}  | ${'2026-09-13'} | ${plan({ status: 'completed', endedOn: '2026-09-14' })} | ${false}   | ${'missed'}
    ${'ended with no end date'}               | ${'upcoming'}  | ${'2026-09-14'} | ${plan({ status: 'abandoned' })}                        | ${false}   | ${'missed'}
    ${'in progress beats missed'}             | ${'upcoming'}  | ${'2026-09-14'} | ${plan()}                                               | ${true}    | ${'in_progress'}
    ${'C-2: paused on/after pause date'}      | ${'upcoming'}  | ${'2026-09-15'} | ${plan({ status: 'paused', pausedOn: '2026-09-15' })}   | ${false}   | ${'paused'}
    ${'C-2: before the pause it is missed'}   | ${'upcoming'}  | ${'2026-09-14'} | ${plan({ status: 'paused', pausedOn: '2026-09-15' })}   | ${false}   | ${'missed'}
    ${'paused with no pause date'}            | ${'upcoming'}  | ${'2026-09-14'} | ${plan({ status: 'paused' })}                           | ${false}   | ${'missed'}
    ${'dated before today is missed'}         | ${'upcoming'}  | ${'2026-09-15'} | ${plan()}                                               | ${false}   | ${'missed'}
    ${'dated today'}                          | ${'upcoming'}  | ${'2026-09-16'} | ${plan()}                                               | ${false}   | ${'today'}
    ${'dated after today'}                    | ${'upcoming'}  | ${'2026-09-17'} | ${plan()}                                               | ${false}   | ${'upcoming'}
  `('$case', ({ status, date, p, inProgress, expected }) => {
    expect(effectiveStatus(pw('x', 1, date, status), today, p, inProgress)).toBe(expected);
  });
});

describe('progress (FR-8.3)', () => {
  const phases: Phase[] = [
    {
      id: 'p',
      templateId: null,
      planId: 'plan',
      sortOrder: 1,
      name: 'Block 1',
      type: 'training',
      reviewMode: 'every_cycle',
      lengthWeeks: 2,
      cycleLengthWeeks: 2,
      volumeFactor: null,
      loadFactor: null,
      rpeCap: null,
      restDaysAtEnd: null,
      hasTestDay: false,
      generatedFromPhaseId: null,
      continuesPhaseId: null,
      continuesOffsetWeeks: null,
      defaultIncreaseType: 'percent',
      defaultIncreaseValue: 0.025,
      defaultIncreaseValueLb: null,
      fallbackIncreaseType: null,
      fallbackIncreaseValue: null,
      fallbackIncreaseValueLb: null,
    },
  ];
  const schedule = [
    pw('w1', 1, '2026-09-14'),
    pw('w2', 1, '2026-09-16'),
    pw('w3', 2, '2026-09-21'),
    pw('w4', 2, '2026-09-23'),
  ];

  it('before the start: week 1 of 2, 0%, no adherence yet', () => {
    expect(progress(phases, schedule, '2026-09-10', plan())).toEqual({
      currentWeek: 1,
      totalWeeks: 2,
      currentPhase: phases[0],
      completed: 0,
      total: 4,
      pctSessions: 0,
      adherence: null,
    });
  });

  it('counts completed over scheduled, and adherence over completed + missed (skips excluded)', () => {
    const done = [
      pw('w1', 1, '2026-09-14', 'completed'),
      pw('w2', 1, '2026-09-16', 'skipped'),
      schedule[2],
      schedule[3],
    ];
    // Today is the 22nd: w3 (21st) is missed; w4 is the next workout, in week 2.
    expect(progress(phases, done, '2026-09-22', plan())).toMatchObject({
      currentWeek: 2,
      completed: 1,
      total: 4,
      pctSessions: 0.25,
      adherence: 0.5,
    });
  });

  it('an in-progress session is neither completed nor missed', () => {
    const result = progress(phases, schedule, '2026-09-15', plan(), new Set(['w1']));
    expect(result).toMatchObject({ currentWeek: 1, completed: 0, adherence: null });
  });

  it('after the last workout, the current week is the last week', () => {
    expect(progress(phases, schedule, '2026-10-01', plan())).toMatchObject({
      currentWeek: 2,
      adherence: 0,
    });
  });

  it('D-24: workouts not done after an early end do not count against adherence', () => {
    const ended = plan({ status: 'abandoned', endedOn: '2026-09-16' });
    const done = [pw('w1', 1, '2026-09-14', 'completed'), ...schedule.slice(1)];
    expect(progress(phases, done, '2026-10-01', ended)).toMatchObject({ adherence: 1 });
  });

  it('FR-4.7: with two workouts on the next date, the earlier plan week is current', () => {
    const moved = [pw('w4', 2, '2026-09-21'), pw('w2', 1, '2026-09-21'), pw('w3', 2, '2026-09-21')];
    expect(progress(phases, moved, '2026-09-18', plan()).currentWeek).toBe(1);
  });

  it('an empty schedule is 0% with no adherence', () => {
    expect(progress(phases, [], '2026-09-10', plan())).toMatchObject({
      currentWeek: 2,
      total: 0,
      pctSessions: 0,
      adherence: null,
    });
  });
});
