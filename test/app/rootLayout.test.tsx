// Screen tests live here, not in app/, because Expo Router would route any file under app/.
// The launch gate (DESIGN §4.6): a failed migration blocks the app with a plain-words message.
import { render, screen } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';

jest.mock('expo-router', () => ({ Stack: () => null }));
jest.mock('@/features/database', () => ({
  DatabaseProvider: ({ children }: { children: unknown }) => children,
  useOpenDatabase: () => ({ status: 'failed', error: new Error('Missing migration: 0001_x') }),
}));

describe('RootLayout', () => {
  it('shows a blocking, accessible error when the database cannot be opened', async () => {
    await render(<RootLayout />);

    expect(screen.getByRole('header', { name: "Your data couldn't be opened" })).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing has been deleted/);
    expect(screen.getByText('Missing migration: 0001_x')).toBeTruthy();
  });
});
