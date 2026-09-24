// Session summary (FR-9.8, DESIGN §7.7): duration, sets and volume, then effort and a note.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SessionSummaryScreen from '../../app/session/summary/[id]';
import { useSession, useSessionActions, type SessionView } from '@/features/session';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
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
};

beforeEach(() => {
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
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(details).toHaveBeenCalledWith({ notes: 'Felt strong' });
  });

  it('goes back to Today when there is nothing to summarise', async () => {
    jest.mocked(useSession).mockReturnValue({ status: 'ready', session: null });
    await render(<SessionSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
