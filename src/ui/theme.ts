// The colour palette for the current OS appearance (DESIGN §6.2). The in-app theme choice
// (FR-12) arrives with Settings in Slice 14.
import { useColorScheme } from 'react-native';

import { colors, type ColorTokens } from './tokens';

export function useColors(): ColorTokens {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
