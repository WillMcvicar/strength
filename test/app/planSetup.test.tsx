// Plan setup (FR-2.3, FR-3.3, FR-4.1, DESIGN §7.5), rendered from view-model states.
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import PlanSetupScreen from '../../app/plan/[id]/setup';
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

const start = jest.fn(async () => null);
const show = (view: PlanSetupScreenView) => jest.mocked(usePlanSetup).mockReturnValue(view);

const SETUP: PlanSetupView = {
  planId: 'plan',
  planName: 'Beginner Strength',
  defaultStartDate: '2026-09-21',
  today: '2026-09-16',
  totalWeeks: 13,
  tmPercent: 0.9,
  unit: 'kg',
  weekStart: 1,
  activePlanName: null,
  slots: [
    { id: 's1', label: 'Week A · Full body A', weekday: 1 },
    { id: 's2', label: 'Week A · Full body B', weekday: 3 },
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
