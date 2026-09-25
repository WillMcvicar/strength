// Session summary (FR-9.8, FR-10.2, DESIGN §7.7): duration, sets and volume, PRs, then effort and
// a note.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SessionSummaryScreen from '../../app/session/summary/[id]';
import type { PrView } from '@/features/prs';
import { useSession, useSessionActions, type SessionView } from '@/features/session';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  router: {
    replace: (href: string) => mockReplace(href),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack,
  },
  useLocalSearchParams: () => ({ id: 's1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/session', () => ({ useSession: jest.fn(), useSessionActions: jest.fn() }));

const details = jest.fn(async () => ({ ok: true as const }));
jest
  .mocked(useSessionActions)
  .mockReturnValue({ details } as unknown as ReturnType<typeof useSessionActions>);

// The §7.7 example: 52 minutes, 16 sets, 6,062.5 kg.
const finished: SessionView = {
  id: 's1',
  name: 'Full body A',
  kind: 'planned',
  localDate: '2026-09-14',
  status: 'completed',
  startedAt: '2026-09-16T17:30:00.000Z',
  endedAt: '2026-09-16T18:22:00.000Z',
  notes: null,
  rpe: null,
  volumeKg: 6062.5,
  setsCompleted: 16,
  setsIncomplete: 0,
  unit: 'kg',
  keepAwake: true,
  restTimerAlerts: true,
  tips: { rpePicker: false, topSet: false },
  exercises: [],
  prs: { prs: [], firstLog: [] },
};

const pr = (id: string, over: Partial<PrView>): PrView => ({
  id,
  skillId: 'skill_bench_press',
  skillName: 'Bench press',
  type: 'heaviest',
  value: 82.5,
  contextWeightKg: null,
  perSide: false,
  achievedAt: '2026-09-16T18:10:00.000Z',
  sessionId: 's1',
  ...over,
});

beforeEach(() => {
  mockCanGoBack = true;
  mockBack.mockClear();
  mockReplace.mockClear();
  details.mockClear();
});

describe('Session summary (§7.7)', () => {
  it('shows the §7.7 figures: 52 min, 16 sets, 6,063 kg', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: finished });
    await render(<SessionSummaryScreen />);

    expect(screen.getByRole('header', { name: 'Workout finished' })).toBeTruthy();
    expect(screen.getByText('Full body A · 52 min')).toBeTruthy();
    expect(screen.getByLabelText('16 sets, 6063 kilograms lifted')).toBeTruthy();
    expect(screen.getByText('6,063 kg')).toBeTruthy();
  });

  it('saves the effort and the note, then returns to Today (FR-9.7)', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: finished });
    await render(<SessionSummaryScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Effort 8 of 10' }));
    expect(details).toHaveBeenCalledWith({ rpe: 8 });
    await fireEvent.changeText(screen.getByLabelText('Session note'), 'Felt strong');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    // Back to the Today that opened the session, not a second one pushed on top.
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(details).toHaveBeenCalledWith({ notes: 'Felt strong' });
  });

  it('opens Today when there is nothing to summarise and nothing behind it', async () => {
    mockCanGoBack = false;
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: null });
    await render(<SessionSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

describe('AC-4 PR detection', () => {
  it('shows the heaviest and Est. 1RM PRs for 82.5 kg × 5 @ RPE 9 (§7.7)', async () => {
    const prs = [pr('p1', {}), pr('p2', { type: 'e1rm', value: 82.5 * (1 + 6 / 30) })];
    jest
      .mocked(useSession)
      .mockReturnValue({ status: 'ready', session: { ...finished, prs: { prs, firstLog: [] } } });
    await render(<SessionSummaryScreen />);

    expect(screen.getByRole('header', { name: '2 new PRs' })).toBeTruthy();
    expect(screen.getByLabelText('Bench press, heaviest, 82.5 kilograms')).toBeTruthy();
    expect(screen.getByLabelText('Bench press, estimated 1 rep max, 99 kilograms')).toBeTruthy();
    expect(screen.getByText('Est. 1RM')).toBeTruthy();
  });
});

describe('First log (C-7)', () => {
  it('names a first-ever log instead of counting its baseline as new PRs', async () => {
    jest.mocked(useSession).mockReturnValue({
      status: 'ready',
      session: { ...finished, prs: { prs: [], firstLog: ['Squat', 'Plank'] } },
    });
    await render(<SessionSummaryScreen />);

    expect(screen.getByText('First log: Squat, Plank')).toBeTruthy();
    expect(screen.queryByText(/new PR/)).toBeNull();
  });
});
