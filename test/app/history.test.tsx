// History and session detail (FR-11.1, FR-11.3, FR-9.12, DESIGN §7.12), rendered from view-model
// states with the actions mocked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SessionDetailScreen from '../../app/history/[id]';
import HistoryScreen from '../../app/history/index';
import { useHistory } from '@/features/history';
import {
  useSession,
  useSessionActions,
  type SessionExerciseView,
  type SessionSetView,
  type SessionView,
} from '@/features/session';

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  router: {
    back: () => mockRouter.back(),
    push: (href: string) => mockRouter.push(href),
  },
  useLocalSearchParams: () => ({ id: 's1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/history', () => ({ useHistory: jest.fn() }));
jest.mock('@/features/session', () => ({ useSession: jest.fn(), useSessionActions: jest.fn() }));

const remove = jest.fn(async () => ({ ok: true as const }));
jest
  .mocked(useSessionActions)
  .mockReturnValue({ remove } as unknown as ReturnType<typeof useSessionActions>);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('History (FR-11.1, §7.12)', () => {
  it('lists sessions by month with date, name, duration and ★ for PRs', async () => {
    jest.mocked(useHistory).mockReturnValue({
      status: 'ready',
      months: [
        {
          month: '2026-09',
          sessions: [
            {
              id: 's2',
              localDate: '2026-09-21',
              name: 'Full body B',
              durationMin: 48,
              hasPrs: true,
            },
            {
              id: 's1',
              localDate: '2026-09-16',
              name: 'Full body B',
              durationMin: 52,
              hasPrs: false,
            },
          ],
        },
      ],
    });
    await render(<HistoryScreen />);

    expect(screen.getByRole('header', { name: 'September 2026' })).toBeTruthy();
    const withPrs = screen.getByRole('button', {
      name: 'Monday 21 September, Full body B, 48 minutes, new PRs',
    });
    expect(screen.getByText('Mon 21 Sep')).toBeTruthy();
    expect(screen.getByText('48 min')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Wednesday 16 September, Full body B, 52 minutes' }),
    ).toBeTruthy();

    await fireEvent.press(withPrs);
    expect(mockRouter.push).toHaveBeenCalledWith('/history/s2');
  });

  it('says so when nothing has been logged yet', async () => {
    jest.mocked(useHistory).mockReturnValue({ status: 'ready', months: [] });
    await render(<HistoryScreen />);
    expect(screen.getByText('No workouts yet. Finished workouts appear here.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

const set = (id: string, over: Partial<SessionSetView>): SessionSetView => ({
  id,
  sessionExerciseId: 'e1',
  setIndex: 1,
  isWarmup: false,
  isAmrap: false,
  isTopSet: false,
  prescribedRepsMin: 5,
  prescribedRepsMax: null,
  prescribedLoadKg: 90,
  prescribedTimeSec: null,
  targetRpeMin: 8,
  targetRpeMax: 8,
  reps: 5,
  loadKg: 90,
  timeSec: null,
  rpe: 8,
  status: 'completed',
  completedAt: '2026-09-16T17:10:00.000Z',
  number: 1,
  prompt: 'required',
  targetRpe: 8,
  topSetTarget: null,
  ...over,
});

const squat: SessionExerciseView = {
  id: 'e1',
  skillId: 'skill_back_squat',
  name: 'Back squat',
  exercise: {
    id: 'e1',
    sessionId: 's1',
    skillId: 'skill_back_squat',
    cycleExerciseId: null,
    sortOrder: 1,
    supersetGroup: null,
    restSec: null,
    notes: null,
    wasSubstituted: false,
    wasAdded: false,
    tmSnapshotKg: 112.5,
    trackingType: 'weight_reps',
    loadConvention: 'total',
    isUnilateral: false,
    isMainLift: true,
    dpIncreaseKg: null,
  },
  restSec: 180,
  supersetGroup: null,
  notes: 'Belt from set 2',
  tmKg: 112.5,
  increment: 2.5,
  lastTopSet: null,
  sets: [
    set('w1', { isWarmup: true, number: 0, loadKg: 60, rpe: null, prompt: 'none' }),
    set('q1', {}),
    set('q2', { number: 2, loadKg: 100, rpe: null, status: 'failed' }),
  ],
};

const finished: SessionView = {
  id: 's1',
  name: 'Full body A',
  kind: 'planned',
  localDate: '2026-09-16',
  status: 'completed',
  startedAt: '2026-09-16T17:00:00.000Z',
  endedAt: '2026-09-16T17:52:00.000Z',
  durationMin: 52,
  notes: 'Felt strong',
  rpe: 7,
  volumeKg: 450,
  setsCompleted: 1,
  setsIncomplete: 0,
  unit: 'kg',
  keepAwake: true,
  restTimerAlerts: true,
  tips: { rpePicker: false, topSet: false },
  exercises: [squat],
  prs: { prs: [], firstLog: ['Back squat'] },
};

describe('Session detail (FR-11.3, §7.12)', () => {
  it('shows the sets, with warm-ups and failed sets marked, and the notes, effort and PRs', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: finished });
    await render(<SessionDetailScreen />);

    expect(screen.getByRole('header', { name: 'Full body A' })).toBeTruthy();
    expect(screen.getByText('Wed 16 Sep · 52 min')).toBeTruthy();
    expect(screen.getByLabelText('1 set, 450 kilograms lifted')).toBeTruthy();
    expect(screen.getByLabelText('Back squat, warm-up, 60 kilograms, 5 reps, done')).toBeTruthy();
    expect(
      screen.getByLabelText('Back squat, set 1, 90 kilograms, 5 reps, done at RPE 8'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Back squat, set 2, 100 kilograms, 5 reps, failed')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Note: Belt from set 2')).toBeTruthy();
    expect(screen.getByText('How hard it was: 7 of 10')).toBeTruthy();
    expect(screen.getByText('Note: Felt strong')).toBeTruthy();
    expect(screen.getByText('First log: Back squat')).toBeTruthy();
  });

  it('opens the logging screen to edit it (FR-9.12)', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: finished });
    await render(<SessionDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit workout' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/session/s1?edit=1');
  });

  it('deletes it only after confirming that PRs will be recalculated (FR-9.12, FR-10.5)', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: finished });
    await render(<SessionDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    expect(screen.getByText(/PRs from this workout will be recalculated/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep workout' }));
    expect(remove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    const buttons = screen.getAllByRole('button', { name: 'Delete workout' });
    await fireEvent.press(buttons.at(-1)!);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(remove).toHaveBeenCalled();
  });

  it('explains a session that is no longer there', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: null });
    await render(<SessionDetailScreen />);
    expect(screen.getByText('This workout is no longer in your history.')).toBeTruthy();
  });
});
