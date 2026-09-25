// The More tab (DESIGN §7.1) and its development-only reset (docs/BUILD_PLAN.md Slice 5).
import { fireEvent, render, screen } from '@testing-library/react-native';

import MoreScreen from '../../app/(tabs)/more';
import { useResetAppData } from '@/features/devTools';
import { useRestTimerSpike } from '@/features/restTimerSpike';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/devTools', () => ({ useResetAppData: jest.fn() }));
jest.mock('@/features/restTimerSpike', () => ({
  lateBySec: (run: { dueAt: string; deliveredAt: string | null }) =>
    run.deliveredAt ? (Date.parse(run.deliveredAt) - Date.parse(run.dueAt)) / 1000 : null,
  useRestTimerSpike: jest.fn(),
}));

const reset = jest.fn(async () => {});
const schedule = jest.fn(async (_sec: number) => {});
const clear = jest.fn();

beforeEach(() => {
  reset.mockClear();
  jest.mocked(useResetAppData).mockReturnValue({ reset, resetting: false });
  schedule.mockClear();
  jest.mocked(useRestTimerSpike).mockReturnValue({ runs: [], error: null, schedule, clear });
});

describe('the More tab', () => {
  it('opens History (FR-11.1, §7.1)', async () => {
    await render(<MoreScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'History' }));
    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('offers the reset in development, and says what it clears', async () => {
    await render(<MoreScreen />);
    expect(screen.getByText('More')).toBeOnTheScreen();
    expect(screen.getByText(/first launch runs again/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Reset app data (dev)'));
    expect(reset).toHaveBeenCalled();
  });

  it('will not fire twice while it is running', async () => {
    jest.mocked(useResetAppData).mockReturnValue({ reset, resetting: true });
    await render(<MoreScreen />);

    await fireEvent.press(screen.getByText('Reset app data (dev)'));
    expect(reset).not.toHaveBeenCalled();
  });
});

describe('the rest-timer spike (DESIGN §2.6)', () => {
  it('schedules a notification and shows how late each one arrived', async () => {
    jest.mocked(useRestTimerSpike).mockReturnValue({
      runs: [
        {
          id: 'a',
          delaySec: 120,
          dueAt: '2026-09-24T10:02:00.000Z',
          deliveredAt: '2026-09-24T10:02:03.500Z',
        },
        { id: 'b', delaySec: 60, dueAt: '2026-09-24T10:05:00.000Z', deliveredAt: null },
      ],
      error: null,
      schedule,
      clear,
    });
    await render(<MoreScreen />);

    await fireEvent.press(screen.getByText('Notify in 120 s'));
    expect(schedule).toHaveBeenCalledWith(120);
    expect(screen.getByText(/3\.5 s late/)).toBeOnTheScreen();
    expect(screen.getByText(/not delivered yet/)).toBeOnTheScreen();
  });
});
