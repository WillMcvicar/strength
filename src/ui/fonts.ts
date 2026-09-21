// The fonts behind the type roles (DESIGN §6.3), used under OFL-1.1 (D-18, THIRD_PARTY_NOTICES.md).
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed';

import type { FONT_FAMILIES } from './tokens';

/** For `useFonts` at launch; keyed by the family names in `typography`. */
export const fontSources: Record<(typeof FONT_FAMILIES)[number], number> = {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  BarlowSemiCondensed_600SemiBold,
};
