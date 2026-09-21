// The palette follows the OS light or dark setting (DESIGN §6.2). The in-app theme choice
// (FR-12) arrives with Settings in Slice 14.
import { renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { useColors } from './theme';
import { colors } from './tokens';

describe('useColors (DESIGN §6.2)', () => {
  it.each([
    ['dark', colors.dark],
    ['light', colors.light],
    ['unspecified', colors.light],
  ] as const)('uses the %s palette', async (scheme, palette) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
    const { result } = await renderHook(() => useColors());
    expect(result.current).toBe(palette);
  });
});
