// The fonts behind the type roles (DESIGN §6.3), used under OFL-1.1 (D-18, THIRD_PARTY_NOTICES.md).
// Per-weight entry points: the package index requires every weight and italic, which would ship
// about 36 unused font files.
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';

import type { FONT_FAMILIES } from './tokens';

/** For `useFonts` at launch; keyed by the family names in `typography`. */
export const fontSources: Record<(typeof FONT_FAMILIES)[number], number> = {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  BarlowSemiCondensed_600SemiBold,
};
