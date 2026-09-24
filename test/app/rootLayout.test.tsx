// Screen tests live here, not in app/, because Expo Router would route any file under app/.
// The launch gate (DESIGN §4.6, §6.3, §7.1): the database opens and the fonts load before any
// screen renders, a failed migration blocks the app with a plain-words message, and the
// disclaimer comes before everything else until it is acknowledged (FR-5).
import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import RootLayout from '../../app/_layout';
import { useOpenDatabase } from '@/features/database';
import { useDisclaimer } from '@/features/disclaimer';
import { useOnboarding } from '@/features/onboarding';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  // Renders the names of the screens the stack would allow.
  function Stack({ children }: { children: unknown }) {
    return children;
  }
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <Text>{`screen:${name}`}</Text>;
  };
  Stack.Protected = function Protected({ guard, children }: { guard: boolean; children: unknown }) {
    return guard ? children : null;
  };
  return { Stack };
});
jest.mock('@/features/disclaimer', () => ({ useDisclaimer: jest.fn() }));
jest.mock('@/features/onboarding', () => ({ useOnboarding: jest.fn() }));
jest.mock('@/features/database', () => ({
  DatabaseProvider: ({ children }: { children: unknown }) => children,
  useOpenDatabase: jest.fn(),
}));

const fonts = jest.mocked(useFonts);
const database = jest.mocked(useOpenDatabase);
const ready = { status: 'ready', db: {} } as ReturnType<typeof useOpenDatabase>;
const disclaimer = jest.mocked(useDisclaimer);
const gate = (
  status: ReturnType<typeof useDisclaimer>['status'],
  error: Error | null = null,
): ReturnType<typeof useDisclaimer> => ({
  status,
  error,
  acknowledge: jest.fn(),
  saving: false,
  saveFailed: false,
});

const onboarding = jest.mocked(useOnboarding);
const onboardingGate = (
  status: ReturnType<typeof useOnboarding>['status'],
  error: Error | null = null,
): ReturnType<typeof useOnboarding> => ({
  status,
  error,
  complete: jest.fn(),
  saving: false,
});

beforeEach(() => {
  disclaimer.mockReturnValue(gate('acknowledged'));
  onboarding.mockReturnValue(onboardingGate('done'));
});

describe('RootLayout', () => {
  it('shows a blocking, accessible error when the database cannot be opened', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue({ status: 'failed', error: new Error('Missing migration: 0001_x') });
    await render(<RootLayout />);

    expect(screen.getByRole('header', { name: "Your data couldn't be opened" })).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing has been deleted/);
    expect(screen.getByText('Missing migration: 0001_x')).toBeTruthy();
  });

  it('renders nothing until the fonts have loaded', async () => {
    fonts.mockReturnValue([false, null]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.queryByText(/^screen:/)).toBeNull();
  });

  it('renders the app once the database is open and the fonts have loaded', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('screen:(tabs)')).toBeTruthy();
  });

  it('falls back to system fonts rather than blocking the app if they fail to load', async () => {
    fonts.mockReturnValue([false, new Error('font missing')]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('screen:(tabs)')).toBeTruthy();
  });

  it('shows only the disclaimer until it is acknowledged (FR-5.1, §7.1 rule 2)', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    disclaimer.mockReturnValue(gate('needed'));
    await render(<RootLayout />);

    expect(screen.getByText('screen:disclaimer')).toBeTruthy();
    expect(screen.queryByText('screen:(tabs)')).toBeNull();
  });

  it('never shows the disclaimer again once acknowledged (FR-5.3)', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('screen:(tabs)')).toBeTruthy();
    expect(screen.queryByText('screen:disclaimer')).toBeNull();
  });

  it('renders nothing while it reads whether the disclaimer was acknowledged', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    disclaimer.mockReturnValue(gate('loading'));
    await render(<RootLayout />);

    expect(screen.queryByText(/^screen:/)).toBeNull();
  });

  it('§7.1 rule 3: onboarding follows the disclaimer and precedes the tabs', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    onboarding.mockReturnValue(onboardingGate('needed'));
    await render(<RootLayout />);

    expect(screen.getByText('screen:onboarding')).toBeTruthy();
    expect(screen.queryByText('screen:(tabs)')).toBeNull();
    expect(screen.queryByText('screen:disclaimer')).toBeNull();
  });

  it('never shows onboarding again once it is done', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('screen:(tabs)')).toBeTruthy();
    expect(screen.queryByText('screen:onboarding')).toBeNull();
  });

  it('shows the disclaimer first, even when onboarding is also outstanding', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    disclaimer.mockReturnValue(gate('needed'));
    onboarding.mockReturnValue(onboardingGate('needed'));
    await render(<RootLayout />);

    expect(screen.getByText('screen:disclaimer')).toBeTruthy();
    expect(screen.queryByText('screen:onboarding')).toBeNull();
  });

  it('renders nothing while it reads whether onboarding is done', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    onboarding.mockReturnValue(onboardingGate('loading'));
    await render(<RootLayout />);

    expect(screen.queryByText('screen:(tabs)')).toBeNull();
    expect(screen.queryByText('screen:onboarding')).toBeNull();
  });

  it('explains a failed onboarding read with the blocking error (§4.6)', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    onboarding.mockReturnValue(onboardingGate('failed', new Error('settings row missing')));
    await render(<RootLayout />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('settings row missing')).toBeTruthy();
  });

  it('explains a failed settings read with the blocking error, not a crash (§4.6)', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    disclaimer.mockReturnValue(gate('failed', new Error('disk I/O error')));
    await render(<RootLayout />);

    expect(screen.getByRole('header', { name: "Your data couldn't be opened" })).toBeTruthy();
    expect(screen.getByText('disk I/O error')).toBeTruthy();
    expect(screen.queryByText(/^screen:/)).toBeNull();
  });
});
