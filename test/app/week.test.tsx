// The Week tab, Workout detail and the plan overview (FR-8.1–8.4, D-7, DESIGN §7.3), rendered from
// view-model states with the hooks mocked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import WeekScreen from '../../app/(tabs)/week';
import PlanOverviewScreen from '../../app/plan/[id]/overview';
import WorkoutDetailScreen from '../../app/workout/[id]';
import { useStartWorkout } from '@/features/today';
import {
  usePlanOverview,
  useWeek,
  useWorkoutDetail,
  type PlanOverviewView,
  type WeekScreenView,
  type WorkoutDetailView,
} from '@/features/week';

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  router: {
    back: () => mockRouter.back(),
    push: (href: string) => mockRouter.push(href),
    replace: (href: string) => mockRouter.replace(href),
  },
  useLocalSearchParams: () => ({ id: 'pw1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/week', () => ({
  useWeek: jest.fn(),
  useWorkoutDetail: jest.fn(),
  usePlanOverview: jest.fn(),
}));
jest.mock('@/features/today', () => ({ useStartWorkout: jest.fn() }));

const start = jest.fn();
jest.mocked(useStartWorkout).mockReturnValue({ start, startAdHoc: jest.fn(), starting: false });

beforeEach(() => {
  jest.clearAllMocks();
});

const thisWeek: WeekScreenView = {
  planId: 'plan',
  range: { start: '2026-09-14', end: '2026-09-20' },
  isThisWeek: true,
  header: 'Plan week 9',
  footer: 'Strength · Cycle 4 (week B)',
  days: [
    {
      date: '2026-09-14',
      workouts: [{ workoutId: 'mon', name: 'Full body B', status: 'completed' }],
    },
    { date: '2026-09-15', workouts: [] },
    {
      date: '2026-09-16',
      workouts: [
        { workoutId: 'wed', name: 'Full body A', status: 'today' },
        { workoutId: 'moved', name: 'Full body B', status: 'today' },
      ],
    },
    { date: '2026-09-17', workouts: [] },
    {
      date: '2026-09-18',
      workouts: [{ workoutId: 'fri', name: 'Full body B', status: 'upcoming' }],
    },
    { date: '2026-09-19', workouts: [] },
    { date: '2026-09-20', workouts: [] },
  ],
};

describe('Week (FR-8.1, FR-8.2, §7.3)', () => {
  const show = (week: WeekScreenView | null) =>
    jest.mocked(useWeek).mockReturnValue({ status: 'ready', week });

  it('lists the seven days with workout names, statuses and "Rest", under the plan week', async () => {
    show(thisWeek);
    await render(<WeekScreen />);

    expect(screen.getByText('14–20 Sep')).toBeTruthy();
    expect(screen.getByText('Plan week 9')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Monday 14 September, Full body B, Done' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Tuesday 15 September, rest')).toHaveTextContent('Rest');
    expect(screen.getAllByText('Rest')).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: 'Friday 18 September, Full body B, Upcoming' }),
    ).toBeTruthy();
    expect(screen.getByText('Strength · Cycle 4 (week B)')).toBeTruthy();
  });

  it('shows both workouts on a day with two (FR-4.7, D-4)', async () => {
    show(thisWeek);
    await render(<WeekScreen />);

    expect(
      screen.getByRole('button', { name: 'Wednesday 16 September, Full body A, Today' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Wednesday 16 September, Full body B, Today' }),
    ).toBeTruthy();
  });

  it('steps between weeks with ‹ ›, and the dates come back to this week', async () => {
    show(thisWeek);
    await render(<WeekScreen />);
    const offsets = () => jest.mocked(useWeek).mock.calls.map(([offset]) => offset);

    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(offsets().at(-1)).toBe(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    expect(offsets().at(-1)).toBe(1);

    show({ ...thisWeek, isThisWeek: false, range: { start: '2026-09-21', end: '2026-09-27' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    await fireEvent.press(screen.getByRole('button', { name: '21 to 27 September' }));
    expect(offsets().at(-1)).toBe(0);
  });

  it('opens Workout detail from a day, and the plan overview from the footer', async () => {
    show(thisWeek);
    await render(<WeekScreen />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Monday 14 September, Full body B, Done' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/mon');
    await fireEvent.press(screen.getByRole('button', { name: 'View whole plan' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/plan/plan/overview');
  });

  it('keeps the last week on screen while the next one loads', async () => {
    show(thisWeek);
    await render(<WeekScreen />);
    jest.mocked(useWeek).mockReturnValue({ status: 'loading' });
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));

    expect(screen.getByText('14–20 Sep')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeTruthy();
  });

  it('leaves out the plan week and phase in a week with no workouts', async () => {
    show({
      ...thisWeek,
      header: null,
      footer: null,
      days: thisWeek.days.map((d) => ({ ...d, workouts: [] })),
    });
    await render(<WeekScreen />);

    expect(screen.getAllByText('Rest')).toHaveLength(7);
    expect(screen.queryByText(/Plan week/)).toBeNull();
  });

  it('offers templates when there is no plan', async () => {
    show(null);
    await render(<WeekScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Browse templates' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/plans');
  });

  it('says so when the week cannot be read', async () => {
    jest.mocked(useWeek).mockReturnValue({ status: 'failed', error: new Error('boom') });
    await render(<WeekScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load this week/);
  });
});

const detail: WorkoutDetailView = {
  workoutId: 'pw1',
  name: 'Full body A',
  date: '2026-09-16',
  status: 'today',
  context: 'Strength · Cycle 4 · Week 9 of 13',
  unit: 'kg',
  durationMin: 55,
  sessionId: null,
  canStart: true,
  rows: [
    {
      exerciseId: 'e1',
      name: 'Squat',
      sets: 5,
      target: { reps: [5] },
      load: { kg: 90, perSide: false, added: false },
      rpe: { min: 7, max: 8 },
      topSet: false,
      increased: false,
      restSec: 180,
      inSuperset: false,
    },
  ],
};

describe('Workout detail (§7.3)', () => {
  const show = (d: WorkoutDetailView | null) =>
    jest.mocked(useWorkoutDetail).mockReturnValue({ status: 'ready', detail: d });

  it('shows the date, status, position and exercises with loads', async () => {
    show(detail);
    await render(<WorkoutDetailScreen />);

    expect(screen.getByRole('header', { name: 'Full body A' })).toBeTruthy();
    expect(screen.getByLabelText('Wednesday 16 September')).toHaveTextContent('Wed 16 Sep');
    expect(screen.getByLabelText('Today')).toBeTruthy();
    expect(screen.getByText('Strength · Cycle 4 · Week 9 of 13')).toBeTruthy();
    expect(screen.getByLabelText('About 55 minutes')).toBeTruthy();
    expect(
      screen.getByLabelText('Squat, 5 sets of 5 reps, at RPE 7 to 8, 90 kilograms'),
    ).toBeTruthy();
  });

  it("starts today's workout and opens the session in its place (FR-9.1)", async () => {
    start.mockResolvedValue({ ok: true, sessionId: 's1' });
    show(detail);
    await render(<WorkoutDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    expect(start).toHaveBeenCalledWith('pw1');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/session/s1'));
  });

  it('says why a workout could not start', async () => {
    start.mockResolvedValue({
      ok: false,
      message: 'A workout is already in progress. Resume it first.',
    });
    show(detail);
    await render(<WorkoutDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already in progress/);
  });

  it('has no Start for a workout on another day', async () => {
    show({ ...detail, status: 'upcoming', canStart: false });
    await render(<WorkoutDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
  });

  it('resumes a workout in progress, and opens a finished one’s session', async () => {
    show({ ...detail, status: 'in_progress', sessionId: 's1', canStart: false });
    const { rerender } = await render(<WorkoutDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/session/s1');

    show({ ...detail, status: 'completed', sessionId: 's1', canStart: false, rows: [] });
    await rerender(<WorkoutDetailScreen />);
    expect(screen.getByText('Done. The session shows what you lifted.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'View session' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/history/s1');
  });

  it('closes, and says so when the workout has gone', async () => {
    show(null);
    await render(<WorkoutDetailScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent('This workout is no longer in your plan.');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

const overview: PlanOverviewView = {
  name: 'Beginner Strength',
  ribbon: [
    { name: 'Block 1', type: 'training', weeks: 1 },
    { name: 'Deload', type: 'deload', weeks: 1 },
  ],
  progress: {
    currentWeek: 1,
    totalWeeks: 2,
    pctSessions: 1 / 6,
    adherence: 1,
    completed: 1,
    total: 6,
  },
  rows: [
    {
      weekIndex: 1,
      phaseIndex: 0,
      label: null,
      cells: [
        { workoutId: 'a1', name: 'Full body A', date: '2026-09-14', status: 'completed' },
        { workoutId: 'b1', name: 'Full body B', date: '2026-09-16', status: 'today' },
        { workoutId: 'a2', name: 'Full body A', date: '2026-09-18', status: 'upcoming' },
      ],
    },
    {
      weekIndex: 2,
      phaseIndex: 1,
      label: 'Deload',
      cells: [
        { workoutId: 'd1', name: 'Full body B', date: '2026-09-21', status: 'upcoming' },
        { workoutId: 'd2', name: 'Full body A', date: '2026-09-23', status: 'upcoming' },
        { workoutId: 'd3', name: 'Full body B', date: '2026-09-25', status: 'upcoming' },
      ],
    },
  ],
};

describe('Plan overview (FR-8.4, FR-8.3, §7.3)', () => {
  it('shows a row per week, the deload labelled, and each workout’s status', async () => {
    jest.mocked(usePlanOverview).mockReturnValue({ status: 'ready', overview });
    await render(<PlanOverviewScreen />);

    expect(screen.getByRole('header', { name: 'Beginner Strength' })).toBeTruthy();
    expect(screen.getAllByTestId('overview-row')).toHaveLength(2);
    expect(screen.getByRole('header', { name: 'Week 1, this week' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Week 2 · Deload' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Full body A, Monday 14 September, Done' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Full body B, Wednesday 16 September, Today' }),
    ).toBeTruthy();
    // The full meter (FR-8.3).
    expect(screen.getByText('17% · adherence 100%')).toBeTruthy();
    expect(screen.getByText('1 of 6 workouts done')).toBeTruthy();
  });

  it('opens Workout detail from a cell', async () => {
    jest.mocked(usePlanOverview).mockReturnValue({ status: 'ready', overview });
    await render(<PlanOverviewScreen />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Full body B, Monday 21 September, Upcoming' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/d1');
  });

  it('says so when the plan has gone', async () => {
    jest.mocked(usePlanOverview).mockReturnValue({ status: 'ready', overview: null });
    await render(<PlanOverviewScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('This plan no longer exists.');
  });
});
