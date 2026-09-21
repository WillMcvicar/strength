// Design tokens (DESIGN §6.2–6.4) and their contrast (NFR-7, D-33).
import { contrastRatio } from './contrast';
import { colors, radius, spacing, touch, typography, type ColorTokens } from './tokens';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Colours that may be used for text or icons, and the surfaces they sit on. */
const TEXT = [
  'ink',
  'inkMuted',
  'plateBlue',
  'plateGreen',
  'plateYellowText',
  'plateRedText',
] as const;
const SURFACES = ['bg', 'surface', 'surfaceSunk'] as const;
/** Text on a plate-coloured fill. */
const ON_FILLS = [
  ['onPlate', 'plateBlue'],
  ['onPlate', 'plateGreen'],
  ['onPlate', 'plateRed'],
  ['onPlateYellow', 'plateYellow'],
] as const satisfies readonly (readonly [keyof ColorTokens, keyof ColorTokens])[];

describe('contrastRatio (WCAG 2.x)', () => {
  it('is 21 for black on white and 1 for a colour on itself, in either order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#1F5FAE', '#1F5FAE')).toBe(1);
  });

  it('accepts lower-case hex', () => {
    expect(contrastRatio('#ffffff', '#1f5fae')).toBe(contrastRatio('#FFFFFF', '#1F5FAE'));
  });

  it('rejects anything but #RRGGBB', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow(/#RRGGBB/);
  });
});

describe('colour tokens (DESIGN §6.2)', () => {
  it('match the §6.2 table', () => {
    expect(colors.light).toEqual({
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
    });
    expect(colors.dark).toEqual({
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
    });
  });

  it('give the light-theme figures in §6.2', () => {
    const c = colors.light;
    expect(round1(contrastRatio(c.onPlate, c.plateBlue))).toBe(6.4);
    expect(round1(contrastRatio(c.onPlate, c.plateGreen))).toBe(5.8);
    expect(round1(contrastRatio(c.onPlate, c.plateRed))).toBe(5.5);
    expect(round1(contrastRatio(c.onPlateYellow, c.plateYellow))).toBe(6.6);
    expect(round1(contrastRatio(c.plateYellowText, c.bg))).toBe(5.4);
    expect(round1(contrastRatio(c.plateGreen, c.bg))).toBe(5.1);
    expect(round1(contrastRatio(c.plateRedText, c.bg))).toBe(5.4);
    expect(round1(contrastRatio(c.inkMuted, c.surfaceSunk))).toBe(4.6);
    expect(round1(contrastRatio(c.plateGreen, c.surfaceSunk))).toBe(4.7);
    expect(round1(contrastRatio(c.plateRedText, c.surfaceSunk))).toBe(5.0);
  });

  it('never allow white on yellow (2.4)', () => {
    expect(round1(contrastRatio('#FFFFFF', colors.light.plateYellow))).toBe(2.4);
    expect(colors.light.onPlateYellow).not.toBe('#FFFFFF');
  });

  describe.each(['light', 'dark'] as const)('%s theme meets WCAG AA (NFR-7, D-33)', (theme) => {
    const c = colors[theme];

    it.each(TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const)))('%s on %s', (fg, bg) => {
      expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it.each(ON_FILLS)('%s on %s', (fg, bg) => {
      expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('keeps every dark-theme pair at 4.8 or higher (§6.2)', () => {
    const c = colors.dark;
    const pairs = [...TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const)), ...ON_FILLS];
    for (const [fg, bg] of pairs) expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.8);
  });
});

describe('typography (DESIGN §6.3)', () => {
  it('matches the §6.3 roles, sizes and line heights', () => {
    expect(typography).toEqual({
      scoreboard: {
        fontFamily: 'BarlowSemiCondensed_600SemiBold',
        fontSize: 40,
        lineHeight: 44,
        fontVariant: ['tabular-nums'],
      },
      display: { fontFamily: 'BarlowSemiCondensed_600SemiBold', fontSize: 28, lineHeight: 34 },
      title: { fontFamily: 'Barlow_600SemiBold', fontSize: 20, lineHeight: 26 },
      body: { fontFamily: 'Barlow_400Regular', fontSize: 16, lineHeight: 24 },
      label: { fontFamily: 'Barlow_500Medium', fontSize: 14, lineHeight: 20 },
      caption: { fontFamily: 'Barlow_400Regular', fontSize: 13, lineHeight: 18 },
    });
  });

  it('never caps text scaling, so every role follows the OS text size (NFR-7)', () => {
    for (const style of Object.values(typography)) {
      expect(style).not.toHaveProperty('maxFontSizeMultiplier');
    }
  });
});

describe('spacing, shape and touch (DESIGN §6.4)', () => {
  it('uses a 4-pt grid with the §6.4 paddings and gaps', () => {
    for (const value of Object.values(spacing)) expect(value % 4).toBe(0);
    expect(spacing.screen).toBe(16);
    expect(spacing.card).toBe(16);
    expect(spacing.cardGap).toBe(12);
  });

  it('has the §6.4 radii and touch targets', () => {
    expect(radius).toEqual({ card: 12, sheet: 12, button: 10, chip: 999, setRow: 0 });
    expect(touch).toEqual({ min: 48, setDone: 56 });
  });
});
