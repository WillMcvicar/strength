// The More tab (DESIGN §7.1) and its development-only reset (docs/BUILD_PLAN.md Slice 5).
import { fireEvent, render, screen } from '@testing-library/react-native';

import MoreScreen from '../../app/(tabs)/more';
import { useResetAppData } from '@/features/devTools';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/devTools', () => ({ useResetAppData: jest.fn() }));

const reset = jest.fn(async () => {});

beforeEach(() => {
  reset.mockClear();
  jest.mocked(useResetAppData).mockReturnValue({ reset, resetting: false });
});

describe('the More tab', () => {
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
