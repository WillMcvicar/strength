// A screen counts as active while it and its parent screen are focused (DESIGN §4.7).
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  ActiveWhileFocused,
  ScreenActiveContext,
  useScreenActive,
  type FocusSource,
} from '@/features/screenActivity';

function fakeNavigation(focused: boolean) {
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  const navigation: FocusSource = {
    isFocused: () => focused,
    addListener: (event, callback) => {
      listeners[event].add(callback);
      return () => listeners[event].delete(callback);
    },
  };
  const emit = (event: 'focus' | 'blur') => act(() => listeners[event].forEach((cb) => cb()));
  return { navigation, emit, listeners };
}

function Probe() {
  return <Text>{useScreenActive() ? 'active' : 'hidden'}</Text>;
}

describe('ActiveWhileFocused', () => {
  it('follows focus and blur, and stops listening when unmounted', async () => {
    const { navigation, emit, listeners } = fakeNavigation(true);
    const { unmount } = await render(
      <ActiveWhileFocused navigation={navigation}>
        <Probe />
      </ActiveWhileFocused>,
    );
    expect(screen.getByText('active')).toBeTruthy();
    await emit('blur');
    expect(screen.getByText('hidden')).toBeTruthy();
    await emit('focus');
    expect(screen.getByText('active')).toBeTruthy();

    await unmount();
    expect(listeners.focus.size + listeners.blur.size).toBe(0);
  });

  it('counts a focused tab as hidden while its parent screen is covered', async () => {
    const { navigation } = fakeNavigation(true);
    await render(
      <ScreenActiveContext.Provider value={false}>
        <ActiveWhileFocused navigation={navigation}>
          <Probe />
        </ActiveWhileFocused>
      </ScreenActiveContext.Provider>,
    );
    expect(screen.getByText('hidden')).toBeTruthy();
  });

  it('is active outside any navigator', async () => {
    await render(<Probe />);
    expect(screen.getByText('active')).toBeTruthy();
  });
});
