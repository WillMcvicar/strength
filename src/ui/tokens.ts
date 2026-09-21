// Design tokens (DESIGN §6.2–6.4). Components take colours, type and spacing only from here.
import type { TextStyle } from 'react-native';

export interface ColorTokens {
  /** Screen background. */
  bg: string;
  /** Cards and sheets. */
  surface: string;
  /** Input wells and set rows. */
  surfaceSunk: string;
  /** Primary text. */
  ink: string;
  /** Secondary text and warm-up sets. */
  inkMuted: string;
  /** Dividers and outlines. */
  line: string;
  /** Training phase, primary action, "today". */
  plateBlue: string;
  /** Deload phase, completed. */
  plateGreen: string;
  /** Taper phase, PR and pending-review fills. Never behind white text. */
  plateYellow: string;
  /** Yellow text and icons. */
  plateYellowText: string;
  /** Missed and destructive fills; red means nothing else. */
  plateRed: string;
  /** Red text and icons (D-33). */
  plateRedText: string;
  /** Text on blue, green and red fills. */
  onPlate: string;
  /** Text on yellow fills. */
  onPlateYellow: string;
}

export const colors: Record<'light' | 'dark', ColorTokens> = {
  light: {
    bg: '#EEF1F0',
    surface: '#FFFFFF',
    surfaceSunk: '#E2E7E6',
    ink: '#18232D',
    inkMuted: '#5A6873',
    line: '#CBD3D6',
    plateBlue: '#1F5FAE',
    plateGreen: '#23733F',
    plateYellow: '#D69E12',
    plateYellowText: '#7F5C05',
    plateRed: '#BE3A2F',
    plateRedText: '#B0352B',
    onPlate: '#FFFFFF',
    onPlateYellow: '#18232D',
  },
  dark: {
    bg: '#131B22',
    surface: '#1C2630',
    surfaceSunk: '#0F161C',
    ink: '#E7ECEF',
    inkMuted: '#9AA7B1',
    line: '#2C3843',
    plateBlue: '#5B93DB',
    plateGreen: '#5DBB82',
    plateYellow: '#EDC04F',
    plateYellowText: '#EDC04F',
    plateRed: '#E8726A',
    plateRedText: '#E8726A',
    onPlate: '#0F161C',
    onPlateYellow: '#0F161C',
  },
};

/** The fonts loaded at launch, keyed by the family names below. */
export const FONT_FAMILIES = [
  'Barlow_400Regular',
  'Barlow_500Medium',
  'Barlow_600SemiBold',
  'BarlowSemiCondensed_600SemiBold',
] as const;

type Role = 'scoreboard' | 'display' | 'title' | 'body' | 'label' | 'caption';

// Sizes scale with the OS text size (NFR-7), so no role sets `maxFontSizeMultiplier`.
export const typography: Record<Role, TextStyle> = {
  /** Set load and reps: tabular figures, like a gym scoreboard. */
  scoreboard: {
    fontFamily: 'BarlowSemiCondensed_600SemiBold',
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  /** Screen titles, sentence case. */
  display: { fontFamily: 'BarlowSemiCondensed_600SemiBold', fontSize: 28, lineHeight: 34 },
  /** Cards and exercise names. */
  title: { fontFamily: 'Barlow_600SemiBold', fontSize: 20, lineHeight: 26 },
  /** The minimum body size. */
  body: { fontFamily: 'Barlow_400Regular', fontSize: 16, lineHeight: 24 },
  /** Sentence case, never all caps. */
  label: { fontFamily: 'Barlow_500Medium', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: 'Barlow_400Regular', fontSize: 13, lineHeight: 18 },
};

/** 4-pt grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  cardGap: 12,
  md: 16,
  screen: 16,
  card: 16,
  lg: 24,
  xl: 32,
} as const;

/** Set rows are square-cornered wells, so they read as a table, not as cards. */
export const radius = { card: 12, sheet: 12, button: 10, chip: 999, setRow: 0 } as const;

/** Minimum touch target, and the set row's "done" check (dp). */
export const touch = { min: 48, setDone: 56 } as const;
