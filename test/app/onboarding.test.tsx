// Onboarding (DESIGN §7.15 steps 3–5, FR-12.1, FR-7.8), rendered from view-model states.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '../../app/onboarding';
import { useOnboarding } from '@/features/onboarding';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (href: string) => mockReplace(href) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/onboarding', () => ({ useOnboarding: jest.fn() }));

// The real hook reads through useLiveQuery, so the status only flips once the write has
// committed. The screen waits for that before navigating, so the mock has to model it.
let status: 'needed' | 'done';
const complete = jest.fn(async () => {
  status = 'done';
  return true;
});

beforeEach(() => {
  mockReplace.mockClear();
  complete.mockClear();
  complete.mockImplementation(async () => {
    status = 'done';
    return true;
  });
  status = 'needed';
  jest.mocked(useOnboarding).mockImplementation(() => ({
    status,
    error: null,
    complete,
    saving: false,
  }));
});

const goTo = async (step: number) => {
  for (let i = 1; i < step; i++) await fireEvent.press(screen.getByText('Next'));
};

describe('FR-12.1 step 3, units', () => {
  it('opens on units, with kilograms chosen', async () => {
    await render(<OnboardingScreen />);
    expect(screen.getByRole('header', { name: 'Which weights do you use?' })).toBeTruthy();
    expect(screen.getByLabelText('Kilograms').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('Pounds').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('does not navigate until the launch-rule-3 guard has flipped', async () => {
    complete.mockImplementation(async () => true); // resolves, but the status stays 'needed'
    await render(<OnboardingScreen />);
    await goTo(3);
    await fireEvent.press(screen.getByText('Skip for now'));

    expect(complete).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('saves the unit the user chose when onboarding finishes', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByLabelText('Pounds'));
    await goTo(3);
    await fireEvent.press(screen.getByText('Skip for now'));

    expect(complete).toHaveBeenCalledWith('lb');
  });
});

describe('DESIGN §7.15 step 4, where the data lives', () => {
  it('says the data stays on the phone and backups are the user’s job (NFR-2)', async () => {
    await render(<OnboardingScreen />);
    await goTo(2);
    expect(screen.getByRole('header', { name: 'Your data stays on this phone' })).toBeTruthy();
    expect(screen.getByText(/no account and no server/)).toBeOnTheScreen();
    expect(screen.getByText(/backups on, or\s+export your data/)).toBeOnTheScreen();
  });

  it('goes back to units', async () => {
    await render(<OnboardingScreen />);
    await goTo(2);
    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByRole('header', { name: 'Which weights do you use?' })).toBeTruthy();
  });
});

describe('DESIGN §7.15 step 5, get started', () => {
  it('opens Plans after finishing onboarding, so the stack cannot come back here', async () => {
    await render(<OnboardingScreen />);
    await goTo(3);
    await fireEvent.press(screen.getByText('Pick a plan'));

    expect(complete).toHaveBeenCalledWith('kg');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plans'));
  });

  it('FR-7.8 "Skip for now" goes to Today, where the empty state offers a plan', async () => {
    await render(<OnboardingScreen />);
    await goTo(3);
    await fireEvent.press(screen.getByText('Skip for now'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('offers "Build a plan", which the builder enables (Slice 12)', async () => {
    await render(<OnboardingScreen />);
    await goTo(3);
    expect(screen.getByText('Build a plan')).toBeOnTheScreen();
  });

  it('stays put and says so when the save fails', async () => {
    complete.mockImplementation(async () => false);
    await render(<OnboardingScreen />);
    await goTo(3);
    await fireEvent.press(screen.getByText('Skip for now'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't save/);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
