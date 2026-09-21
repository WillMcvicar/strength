// Every font family the typography uses is loaded at launch (DESIGN §6.3, D-18).
import { fontSources } from './fonts';
import { FONT_FAMILIES, typography } from './tokens';

describe('fontSources (DESIGN §6.3)', () => {
  it('loads exactly the families the type roles use', () => {
    expect(Object.keys(fontSources).sort()).toEqual([...FONT_FAMILIES].sort());
    for (const style of Object.values(typography)) {
      expect(FONT_FAMILIES).toContain(style.fontFamily);
    }
  });
});
