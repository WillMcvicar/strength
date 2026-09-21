// The first-launch disclaimer screen (FR-5.1, FR-5.2, DESIGN §7.15 step 1).
import { fireEvent, render, screen } from '@testing-library/react-native';

import DisclaimerScreen from '../../app/disclaimer';
import { useDisclaimer } from '@/features/disclaimer';

jest.mock('@/features/disclaimer', () => ({ useDisclaimer: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

const acknowledge = jest.fn(async () => {});
const state = (over: Partial<ReturnType<typeof useDisclaimer>> = {}) => ({
  status: 'needed' as const,
  error: null,
  acknowledge,
  saving: false,
  saveFailed: false,
  ...over,
});

beforeEach(() => {
  jest.mocked(useDisclaimer).mockReturnValue(state());
});

describe('Disclaimer screen (FR-5)', () => {
  it('covers the four FR-5.1 points in plain language', async () => {
    await render(<DisclaimerScreen />);
    expect(screen.getByRole('header', { name: 'Before you start' })).toBeTruthy();
    expect(screen.getByText(/isn't medical advice/)).toBeTruthy();
    expect(screen.getByText(/qualified professional before starting/)).toBeTruthy();
    expect(screen.getByText(/at your own risk/)).toBeTruthy();
    expect(screen.getByText(/stop and get help/)).toBeTruthy();
  });

  it('continues only through a single "I understand" button (FR-5.2)', async () => {
    await render(<DisclaimerScreen />);
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'I understand' }));
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });

  it('says so if the acknowledgement could not be saved, and lets the user try again', async () => {
    jest.mocked(useDisclaimer).mockReturnValue(state({ saveFailed: true }));
    await render(<DisclaimerScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't be saved/);
    expect(screen.getByRole('button', { name: 'I understand' })).toBeEnabled();
  });

  it('disables the button while saving, so a double tap saves once', async () => {
    jest.mocked(useDisclaimer).mockReturnValue(state({ saving: true }));
    await render(<DisclaimerScreen />);

    expect(screen.getByRole('button', { name: 'I understand' })).toBeDisabled();
  });
});
