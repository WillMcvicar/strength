// Type roles fall back to the system font if the §6.3 fonts fail to load, so iOS never looks up an
// unregistered family (DESIGN §6.3).
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { typography } from './tokens';
import { FontsLoadedProvider, useTypography } from './typography';

describe('useTypography (§6.3)', () => {
  it('uses the Barlow roles once the fonts have loaded', async () => {
    const { result } = await renderHook(() => useTypography());
    expect(result.current).toBe(typography);
  });

  it('drops the font families but keeps sizes and weights if they failed to load', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FontsLoadedProvider value={false}>{children}</FontsLoadedProvider>
    );
    const { result } = await renderHook(() => useTypography(), { wrapper });

    for (const style of Object.values(result.current))
      expect(style).not.toHaveProperty('fontFamily');
    expect(result.current.scoreboard).toEqual({
      fontSize: 40,
      lineHeight: 44,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
    });
    expect(result.current.body.fontWeight).toBe('400');
    expect(result.current.label.fontWeight).toBe('500');
  });
});
