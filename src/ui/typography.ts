// The type roles to render with (DESIGN §6.3). If the fonts failed to load, the roles drop their
// font family and keep size and weight, so the system font stands in; iOS would otherwise look up
// an unregistered family.
import { createContext, useContext } from 'react';
import type { TextStyle } from 'react-native';

import { typography } from './tokens';

const WEIGHTS: Record<string, TextStyle['fontWeight']> = {
  '400': '400',
  '500': '500',
  '600': '600',
};

const systemTypography = Object.fromEntries(
  Object.entries(typography).map(([role, { fontFamily, ...rest }]) => [
    role,
    { ...rest, fontWeight: WEIGHTS[/_(\d{3})/.exec(fontFamily ?? '')?.[1] ?? '400'] },
  ]),
) as typeof typography;

const FontsLoaded = createContext(true);

/** Set by the root layout: false when the fonts failed to load. */
export const FontsLoadedProvider = FontsLoaded.Provider;

export function useTypography(): typeof typography {
  return useContext(FontsLoaded) ? typography : systemTypography;
}
