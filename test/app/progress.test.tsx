// The PR board and exercise detail (FR-10.3, DESIGN §7.11), rendered from view-model states.
import { fireEvent, render, screen } from '@testing-library/react-native';

import ProgressScreen from '../../app/(tabs)/progress';
import ExerciseDetailScreen from '../../app/skill/[id]';
import type { PrView } from '@/features/prs';
import { useExerciseDetail, usePrBoard } from '@/features/progress';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (href: string) => mockPush(href), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'skill_bench_press' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/progress', () => ({ usePrBoard: jest.fn(), useExerciseDetail: jest.fn() }));

// Local noon, so the day shown is the same in every CI time zone.
const WED_NOON = new Date(2026, 8, 16, 12).toISOString();

const pr = (id: string, over: Partial<PrView> = {}): PrView => ({
  id,
  skillId: 'skill_bench_press',
  skillName: 'Bench press',
  type: 'heaviest',
  value: 82.5,
  contextWeightKg: null,
  perSide: false,
  achievedAt: WED_NOON,
  day: '2026-09-16',
  sessionId: 's2',
  ...over,
});

beforeEach(() => {
  mockPush.mockClear();
});

describe('AC-4 PR detection', () => {
  it('shows the new heaviest bench press on the PR board', async () => {
    jest.mocked(usePrBoard).mockReturnValue({
      status: 'ready',
      unit: 'kg',
      rows: [{ skillId: 'skill_bench_press', name: 'Bench press', headline: pr('p1') }],
    });
    await render(<ProgressScreen />);

    const row = screen.getByRole('button', {
      name: 'Bench press, heaviest, 82.5 kilograms, set Wednesday 16 September',
    });
    expect(screen.getByText('82.5 kg')).toBeTruthy();
    expect(screen.getByText('Heaviest · Wed 16 Sep')).toBeTruthy();
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith('/skill/skill_bench_press');
  });
});

describe('the PR board (FR-10.3, §7.11)', () => {
  it('dates a record by the day its session was logged, not when its set was ticked (D-39)', async () => {
    // Ticked after midnight in a session logged on the 15th.
    const late = pr('p1', { day: '2026-09-15', achievedAt: WED_NOON });
    jest.mocked(usePrBoard).mockReturnValue({
      status: 'ready',
      unit: 'kg',
      rows: [{ skillId: 'skill_bench_press', name: 'Bench press', headline: late }],
    });
    await render(<ProgressScreen />);
    expect(screen.getByText('Heaviest · Tue 15 Sep')).toBeTruthy();
  });

  it('dates a manual record, which has no session, by when it was set', async () => {
    const manual = pr('p1', { day: null, sessionId: null });
    jest.mocked(usePrBoard).mockReturnValue({
      status: 'ready',
      unit: 'kg',
      rows: [{ skillId: 'skill_bench_press', name: 'Bench press', headline: manual }],
    });
    await render(<ProgressScreen />);
    expect(screen.getByText('Heaviest · Wed 16 Sep')).toBeTruthy();
  });

  it('searches by name, and lists a skill with no records', async () => {
    jest.mocked(usePrBoard).mockReturnValue({
      status: 'ready',
      unit: 'kg',
      rows: [{ skillId: 'skill_run', name: 'Run', headline: null }],
    });
    await render(<ProgressScreen />);
    expect(screen.getByRole('button', { name: 'Run, no records' })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'bench');
    expect(usePrBoard).toHaveBeenLastCalledWith('bench');
  });

  it('says what to do when there are no records, or nothing matches', async () => {
    jest.mocked(usePrBoard).mockReturnValue({ status: 'ready', unit: 'kg', rows: [] });
    await render(<ProgressScreen />);
    expect(screen.getByText('No records yet. Finish a workout to set your first.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzz');
    expect(screen.getByText('No logged exercise matches that.')).toBeTruthy();
  });
});

describe('exercise detail (§7.11, v1.0)', () => {
  it('shows the current PRs, the 1RM history and recent workouts', async () => {
    jest.mocked(useExerciseDetail).mockReturnValue({
      status: 'ready',
      detail: {
        skillId: 'skill_bench_press',
        name: 'Bench press',
        unit: 'kg',
        prs: [
          pr('p1'),
          pr('p2', { type: 'e1rm', value: 82.5 * (1 + 7 / 30) }),
          pr('p3', { type: 'reps_at_weight', value: 5, contextWeightKg: 80 }),
        ],
        oneRmHistory: [
          { id: 'o1', oneRmKg: 100, source: 'plan_setup', setAt: WED_NOON, note: null },
        ],
        recent: [{ id: 's2', name: 'Full body B', localDate: '2026-09-21' }],
      },
    });
    await render(<ExerciseDetailScreen />);

    expect(screen.getByRole('header', { name: 'Bench press' })).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Bench press, estimated 1 rep max, 101.8 kilograms, set Wednesday 16 September',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Reps at 80 kg')).toBeTruthy();
    expect(screen.getByLabelText('100 kilograms, Plan setup, Wednesday 16 September')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Full body B, Monday 21 September' }));
    expect(mockPush).toHaveBeenCalledWith('/history/s2');
  });

  it('explains an exercise that is not there', async () => {
    jest.mocked(useExerciseDetail).mockReturnValue({ status: 'ready', detail: null });
    await render(<ExerciseDetailScreen />);
    expect(screen.getByText('This exercise isn’t available.')).toBeTruthy();
  });
});
