// Term explanations and one-time tips, read from one content file so the copy can change without
// code changes (FR-6.3, DESIGN §7.16). The copy is reviewed by the product owner before v1.0.
import content from '../../content/explanations.json';

export type ContentKey = keyof typeof content;

export const EXPLANATION_KEYS = [
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
] as const satisfies readonly ContentKey[];

export const TIP_KEYS = [
  'tip_rpe_picker',
  'tip_first_review',
  'tip_first_deload',
  'tip_top_set',
] as const satisfies readonly ContentKey[];

export type TermKey = (typeof EXPLANATION_KEYS)[number];

export function explanation(key: ContentKey): { title: string; body: string } {
  return content[key];
}
