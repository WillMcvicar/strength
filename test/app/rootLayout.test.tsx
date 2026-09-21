// Screen tests live here, not in app/, because Expo Router would route any file under app/.
// The launch gate (DESIGN §4.6, §6.3): the database opens and the fonts load before any screen
// renders, and a failed migration blocks the app with a plain-words message.
import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import RootLayout from '../../app/_layout';
import { useOpenDatabase } from '@/features/database';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return { Stack: () => <Text>app</Text> };
});
jest.mock('@/features/database', () => ({
  DatabaseProvider: ({ children }: { children: unknown }) => children,
  useOpenDatabase: jest.fn(),
}));

const fonts = jest.mocked(useFonts);
const database = jest.mocked(useOpenDatabase);
const ready = { status: 'ready', db: {} } as ReturnType<typeof useOpenDatabase>;

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

    expect(screen.queryByText('app')).toBeNull();
  });

  it('renders the app once the database is open and the fonts have loaded', async () => {
    fonts.mockReturnValue([true, null]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('app')).toBeTruthy();
  });

  it('falls back to system fonts rather than blocking the app if they fail to load', async () => {
    fonts.mockReturnValue([false, new Error('font missing')]);
    database.mockReturnValue(ready);
    await render(<RootLayout />);

    expect(screen.getByText('app')).toBeTruthy();
  });
});
