// Plan setup (FR-2.3, FR-3.3, FR-4.1, DESIGN §7.5), rendered from view-model states.
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import PlanSetupScreen from '../../app/plan/[id]/setup';
import { useRecordEstimate } from '@/features/estimateOneRm';
import {
  usePlanSetup,
  useStartPlan,
  type PlanSetupScreenView,
  type PlanSetupView,
} from '@/features/planSetup';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
  useLocalSearchParams: () => ({ id: 'plan' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/planSetup', () => ({
  ...jest.requireActual('@/features/planSetup'),
  usePlanSetup: jest.fn(),
  useStartPlan: jest.fn(),
}));
jest.mock('@/features/estimateOneRm', () => ({
  ...jest.requireActual('@/features/estimateOneRm'),
  useRecordEstimate: jest.fn(),
}));

const start = jest.fn(async () => null);
const record = jest.fn(async () => true);
const show = (view: PlanSetupScreenView) => jest.mocked(usePlanSetup).mockReturnValue(view);

const SETUP: PlanSetupView = {
  planId: 'plan',
  planName: 'Beginner Strength',
  defaultStartDate: '2026-09-21',
  today: '2026-09-16',
  totalWeeks: 13,
  tmPercent: 0.9,
  unit: 'kg',
  increment: 2.5,
  weekStart: 1,
  activePlanName: null,
  slots: [
    { id: 's1', label: 'Week A · Full body A', weekday: 1, phaseId: 'p1', cycleWeekIndex: 1 },
    { id: 's2', label: 'Week A · Full body B', weekday: 3, phaseId: 'p1', cycleWeekIndex: 1 },
  ],
  skills: [
    { skillId: 'skill_back_squat', name: 'Back squat', oneRmKg: 110 },
    { skillId: 'skill_bench_press', name: 'Bench press', oneRmKg: null },
  ],
};

const ready = (over: Partial<PlanSetupView> = {}) =>
  show({ status: 'ready', setup: { ...SETUP, ...over } });

/** Steps forward to the numbered step (1-based). */
const goTo = async (step: number) => {
  for (let i = 1; i < step; i++) await fireEvent.press(screen.getByText('Next'));
};

beforeEach(() => {
  mockReplace.mockClear();
  start.mockClear();
  jest.mocked(useStartPlan).mockReturnValue({ start, busy: false });
  record.mockClear();
  jest.mocked(useRecordEstimate).mockReturnValue({ record, busy: false });
});

describe('FR-2.3 step 1, the start date', () => {
  it('opens on the next week-start day and shows the end date', async () => {
    ready();
    await render(<PlanSetupScreen />);
    expect(screen.getByText('Step 1 of 3 · Start date')).toBeOnTheScreen();
    expect(screen.getByText('Monday 21 September')).toBeOnTheScreen();
    expect(screen.getByText(/Ends Sunday 20 December · 13 weeks/)).toBeOnTheScreen();
    expect(screen.getByText(/line up with calendar weeks/)).toBeOnTheScreen();
  });

  it('steps a week and a day, and drops the alignment note once moved', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await fireEvent.press(screen.getByLabelText('A week later'));
    expect(screen.getByText('Monday 28 September')).toBeOnTheScreen();
    expect(screen.queryByText(/line up with calendar weeks/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('A day earlier'));
    expect(screen.getByText('Sunday 27 September')).toBeOnTheScreen();
  });

  it('will not step back before today', async () => {
    ready({ defaultStartDate: '2026-09-16' });
    await render(<PlanSetupScreen />);
    expect(screen.getByLabelText('A day earlier').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByLabelText('A week earlier').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});

describe('DESIGN §7.5 step 2, training days', () => {
  it('two phases each have a "Week A", so that alone is no clash', async () => {
    ready({
      slots: [
        { id: 's1', label: 'Week A · Upper', weekday: 1, phaseId: 'p1', cycleWeekIndex: 1 },
        { id: 's2', label: 'Week A · Squat', weekday: 1, phaseId: 'p2', cycleWeekIndex: 1 },
      ],
    });
    await render(<PlanSetupScreen />);
    await goTo(2);
    expect(screen.queryByText(/share a day/)).not.toBeOnTheScreen();
  });

  it('lists a picker per slot and warns when two workouts share a day', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await goTo(2);

    expect(screen.getByText('Week A · Full body A')).toBeOnTheScreen();
    expect(screen.getByText(/leave a day between full-body sessions/)).toBeOnTheScreen();
    expect(screen.queryByText(/share a day/)).not.toBeOnTheScreen();

    // Move Full body B onto Monday, where Full body A already is.
    const pickerB = within(screen.getByLabelText('Week A · Full body B'));
    await fireEvent.press(pickerB.getByLabelText('Monday'));
    expect(screen.getByText(/share a day/)).toBeOnTheScreen();
  });
});

describe('FR-3.3 step 3, the 1RMs', () => {
  it('pre-fills known 1RMs, shows the TM, and names the one still missing', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await goTo(3);

    expect(screen.getByLabelText('Back squat one rep max in kg')).toHaveDisplayValue('110');
    expect(screen.getByText('→ TM 99 kg (90%)')).toBeOnTheScreen();
    expect(screen.getByText('Add a 1RM for Bench press')).toBeOnTheScreen();
  });

  it('enables "Start plan" once every 1RM is filled, and starts with what was entered', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await goTo(3);

    await fireEvent.changeText(screen.getByLabelText('Bench press one rep max in kg'), '90');
    await fireEvent.press(screen.getByText('Start plan'));

    expect(start).toHaveBeenCalledWith({
      planId: 'plan',
      startDate: '2026-09-21',
      weekdayPins: { s1: 1, s2: 3 },
      oneRms: { skill_back_squat: 110, skill_bench_press: 90 },
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('FR-12.1 works in the display unit, and stores kilograms', async () => {
    // 242.5 lb = 110.0 kg; the TM line stays in lb, and the service is handed kg.
    ready({
      unit: 'lb',
      increment: 5,
      skills: [{ skillId: 'skill_back_squat', name: 'Back squat', oneRmKg: 110 }],
    });
    await render(<PlanSetupScreen />);
    await goTo(3);

    expect(screen.getByLabelText('Back squat one rep max in lb')).toHaveDisplayValue('242.51');
    await fireEvent.changeText(screen.getByLabelText('Back squat one rep max in lb'), '245');
    expect(screen.getByText('→ TM 220.5 lb (90%)')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Start plan'));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        oneRms: { skill_back_squat: expect.closeTo(111.13, 2) as number },
      }),
    );
  });

  it('FR-3.3a records a confirmed estimate and fills the field', async () => {
    ready({ skills: [{ skillId: 'skill_bench_press', name: 'Bench press', oneRmKg: null }] });
    await render(<PlanSetupScreen />);
    await goTo(3);

    await fireEvent.press(screen.getByText("Don't know it? Estimate it for me"));
    await fireEvent.press(screen.getByText('Next')); // safety and warm-up
    await fireEvent.changeText(screen.getByLabelText('Test set weight in kg'), '100');
    await fireEvent.press(screen.getByText('Next')); // choose a load

    const reps = within(screen.getByLabelText('Reps you completed'));
    await fireEvent.press(reps.getByLabelText('3'));
    const rpe = within(screen.getByLabelText('How hard it felt (RPE)'));
    await fireEvent.press(rpe.getByLabelText('8'));
    await fireEvent.press(screen.getByText('Next')); // log the set

    expect(screen.getByText(/Estimated 1RM: 117.5/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Your 1RM in kg')).toHaveDisplayValue('117.5');
    await fireEvent.press(screen.getByText('Use this'));

    expect(record).toHaveBeenCalledWith({
      planId: 'plan',
      skillId: 'skill_bench_press',
      oneRmKg: 117.5,
    });
    expect(screen.getByLabelText('Bench press one rep max in kg')).toHaveDisplayValue('117.5');
  });

  it('FR-3.3a the estimate can be edited before it is used', async () => {
    ready({ skills: [{ skillId: 'skill_bench_press', name: 'Bench press', oneRmKg: null }] });
    await render(<PlanSetupScreen />);
    await goTo(3);

    await fireEvent.press(screen.getByText("Don't know it? Estimate it for me"));
    await fireEvent.press(screen.getByText('Next'));
    await fireEvent.changeText(screen.getByLabelText('Test set weight in kg'), '100');
    await fireEvent.press(screen.getByText('Next'));
    await fireEvent.press(within(screen.getByLabelText('Reps you completed')).getByLabelText('3'));
    await fireEvent.press(
      within(screen.getByLabelText('How hard it felt (RPE)')).getByLabelText('8'),
    );
    await fireEvent.press(screen.getByText('Next'));

    // The lifter knows they have done 120 before, so they keep that instead.
    await fireEvent.changeText(screen.getByLabelText('Your 1RM in kg'), '120');
    await fireEvent.press(screen.getByText('Use this'));

    expect(record).toHaveBeenCalledWith({
      planId: 'plan',
      skillId: 'skill_bench_press',
      oneRmKg: 120,
    });
    expect(screen.getByLabelText('Bench press one rep max in kg')).toHaveDisplayValue('120');
  });

  it('treats a zero or empty 1RM as missing', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await goTo(3);
    await fireEvent.changeText(screen.getByLabelText('Bench press one rep max in kg'), '0');
    expect(screen.getByText('Add a 1RM for Bench press')).toBeOnTheScreen();
  });

  it('FR-4.1 says which plan is running, and explains a refusal', async () => {
    ready({ activePlanName: 'Beginner Hypertrophy', skills: [SETUP.skills[0]!] });
    start.mockResolvedValueOnce('plan_already_current' as never);
    await render(<PlanSetupScreen />);
    await goTo(3);

    expect(screen.getByText(/Only one plan can be active at a time/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Start plan'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Beginner Hypertrophy is still running/,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('the setup screen’s other states', () => {
  it('explains a plan that is no longer a draft, and a failed read', async () => {
    show({ status: 'ready', setup: null });
    const { rerender } = await render(<PlanSetupScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/isn't waiting to be set up/);

    show({ status: 'failed', error: new Error('nope') });
    await rerender(<PlanSetupScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Close the app/);
  });

  it('goes back a step', async () => {
    ready();
    await render(<PlanSetupScreen />);
    await goTo(2);
    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('Step 1 of 3 · Start date')).toBeOnTheScreen();
  });
});
