// Term explanations and one-time tips come from one content file (FR-6.1, FR-6.3, DESIGN §7.16).
import { EXPLANATION_KEYS, explanation, TIP_KEYS } from './explanations';

const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length;

describe('content/explanations.json (§7.16)', () => {
  it('has every term and tip key §7.16 lists', () => {
    expect([...EXPLANATION_KEYS].sort()).toEqual(
      [
        'one_rm',
        'tm',
        'tm_percent',
        'rpe',
        'rir',
        'cycle',
        'phase',
        'deload',
        'taper',
        'double_progression',
        'amrap',
        'e1rm',
        'test_day',
        'top_set',
        'back_off_set',
      ].sort(),
    );
    expect([...TIP_KEYS].sort()).toEqual(
      ['tip_rpe_picker', 'tip_first_review', 'tip_first_deload', 'tip_top_set'].sort(),
    );
  });

  it.each([...EXPLANATION_KEYS])('explains %s in 2–3 plain sentences (FR-6.1)', (key) => {
    const { title, body } = explanation(key);
    expect(title.length).toBeGreaterThan(0);
    expect(sentences(body)).toBeGreaterThanOrEqual(2);
    expect(sentences(body)).toBeLessThanOrEqual(3);
  });

  it('uses the §7.16 wording for the training max', () => {
    expect(explanation('tm')).toEqual({
      title: 'Training max (TM)',
      body: 'A slightly reduced version of your 1RM that your working weights are based on. Using 90% of your true max leaves room to build up without grinding every set.',
    });
  });
});
