// The Today screen (FR-7.1–7.5, FR-7.7, FR-7.8, DESIGN §7.2), rendered from view-model states.
import { fireEvent, render, screen } from '@testing-library/react-native';

import TodayScreen from '../../app/(tabs)/index';
import { useSamplePlan } from '@/features/samplePlan';
import { useToday, type TodayPlanView, type TodayView } from '@/features/today';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/today', () => ({ useToday: jest.fn() }));
jest.mock('@/features/samplePlan', () => ({ useSamplePlan: jest.fn() }));

const load = jest.fn(async () => {});
jest.mocked(useSamplePlan).mockReturnValue({ load, loading: false });
const show = (view: TodayView) => jest.mocked(useToday).mockReturnValue(view);

const plan: TodayPlanView = {
  header: 'Block 2 · Cycle 4 · Week 9 of 13',
  ribbon: [
    { name: 'Block 1', type: 'training', weeks: 6 },
    { name: 'Deload', type: 'deload', weeks: 1 },
    { name: 'Block 2', type: 'training', weeks: 6 },
  ],
  currentWeek: 9,
  progress: { currentWeek: 9, totalWeeks: 13, pctSessions: 0.62, adherence: 0.96 },
  week: [
    { date: '2026-09-14', status: 'completed' },
    { date: '2026-09-15', status: 'rest' },
    { date: '2026-09-16', status: 'today' },
    { date: '2026-09-17', status: 'rest' },
    { date: '2026-09-18', status: 'upcoming' },
    { date: '2026-09-19', status: 'rest' },
    { date: '2026-09-20', status: 'rest' },
  ],
};

const workout: Extract<TodayView, { status: 'ready' }> = {
  status: 'ready',
  unit: 'kg',
  plan,
  card: {
    kind: 'workout',
    name: 'Full body A',
    durationMin: 55,
    rows: [
      {
        exerciseId: 'e1',
        name: 'Squat',
        sets: 5,
        target: { reps: [5] },
        load: { kg: 90, perSide: false, added: false },
        rpe: { min: 7, max: 8 },
        topSet: false,
        restSec: 180,
        inSuperset: false,
      },
      {
        exerciseId: 'e2',
        name: 'Plank',
        sets: 3,
        target: { seconds: 45 },
        load: null,
        rpe: null,
        topSet: false,
        restSec: 60,
        inSuperset: false,
      },
    ],
  },
};

beforeEach(() => mockPush.mockClear());

describe('Today screen (§7.2)', () => {
  it("shows today's workout: name, plan position, exercises and duration (FR-7.2)", async () => {
    show(workout);
    await render(<TodayScreen />);

    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Block 2 · Cycle 4 · Week 9 of 13')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Full body A' })).toBeTruthy();
    expect(screen.getByLabelText('About 55 minutes')).toHaveTextContent('~55 min');
    expect(
      screen.getByLabelText('Squat, 5 sets of 5 reps, at RPE 7 to 8, 90 kilograms'),
    ).toBeTruthy();
    expect(screen.getByText('@ RPE 7–8')).toBeTruthy();
    expect(screen.getByLabelText('Plank, 3 sets of 45 seconds')).toBeTruthy();
  });

  it('shows the ribbon, the compact progress meter and the week strip (FR-7.7)', async () => {
    show(workout);
    await render(<TodayScreen />);

    expect(screen.getByLabelText('Phase 3 of 3, Block 2, week 9 of 13')).toBeTruthy();
    expect(screen.getByText('62% · adherence 96%')).toBeTruthy();
    expect(screen.getAllByTestId('week-strip-day')).toHaveLength(7);
  });

  it('has Start workout in the bottom bar, disabled until logging arrives (FR-7.3)', async () => {
    show(workout);
    await render(<TodayScreen />);
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeDisabled();
  });

  it('says when it is a rest day, with the next workout and its date (FR-7.4)', async () => {
    show({
      ...workout,
      card: { kind: 'rest', next: { name: 'Full body B', date: '2026-09-16' } },
    } as TodayView);
    await render(<TodayScreen />);

    expect(screen.getByRole('header', { name: 'Rest day' })).toBeTruthy();
    expect(screen.getByText('Next: Full body B, Wed 16 Sep')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
  });

  it('says when the plan has no workouts left', async () => {
    show({ ...workout, card: { kind: 'rest', next: null } } as TodayView);
    await render(<TodayScreen />);
    expect(screen.getByText('No more workouts in this plan.')).toBeTruthy();
  });

  it("shows today's workout as done once completed (FR-7.5)", async () => {
    show({ ...workout, card: { ...workout.card, kind: 'completed' } } as TodayView);
    await render(<TodayScreen />);

    expect(screen.getByLabelText('Done')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Full body A' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
  });

  it('shows the no-plan empty state with both actions (FR-7.8)', async () => {
    show({ status: 'ready', unit: 'kg', plan: null, card: { kind: 'no_plan' } });
    await render(<TodayScreen />);

    expect(screen.getByText('No plan yet. Pick a ready-made plan or build your own.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Browse templates' }));
    expect(mockPush).toHaveBeenCalledWith('/plans');
    expect(screen.getByRole('button', { name: 'Build a plan' })).toBeTruthy();
  });

  it('offers the sample plan in development builds only', async () => {
    show({ status: 'ready', unit: 'kg', plan: null, card: { kind: 'no_plan' } });
    await render(<TodayScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Load sample plan (dev)' }));
    expect(load).toHaveBeenCalled();
  });

  it('shows the blocking error if Today cannot be read', async () => {
    show({ status: 'failed', error: new Error('no such table: plan') });
    await render(<TodayScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load today/i);
  });

  it('renders nothing while loading', async () => {
    show({ status: 'loading' });
    await render(<TodayScreen />);
    expect(screen.queryByRole('header')).toBeNull();
  });
});
