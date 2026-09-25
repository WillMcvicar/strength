// How a PR reads on screen and aloud (DESIGN §7.7, §7.11, §7.17): "Heaviest · 82.5 kg",
// "Est. 1RM · 99 kg", "Reps at 80 kg · 8 reps". An estimated 1RM shows one decimal in the
// display unit (AC-54's 106.7 kg); other loads show as the set rows do.
import { formatLoad, toDisplay, toKg, type Unit } from '@/core';
import type { PrView } from '@/features/prs';

import { spokenLoad } from './components/LoadText';
import { formatClock, spokenClock } from './format';

export interface PrText {
  label: string;
  value: string;
  /** The whole record as one phrase, skill first. */
  spoken: string;
}

const reps = (n: number) => `${n} ${n === 1 ? 'rep' : 'reps'}`;

function load(kg: number, unit: Unit, perSide: boolean) {
  return { shown: formatLoad(kg, unit, { perSide }), spoken: spokenLoad(kg, unit, perSide) };
}

function added(kg: number, unit: Unit) {
  return kg === 0
    ? { shown: 'BW', spoken: 'bodyweight' }
    : {
        shown: `BW ${formatLoad(kg, unit, { signed: true })}`,
        spoken: `bodyweight ${spokenLoad(kg, unit, false, true)}`,
      };
}

export function prText(pr: PrView, unit: Unit): PrText {
  const say = (label: string, spokenLabel: string, value: { shown: string; spoken: string }) => ({
    label,
    value: value.shown,
    spoken: `${pr.skillName}, ${spokenLabel}, ${value.spoken}`,
  });
  const count = { shown: reps(pr.value), spoken: reps(pr.value) };

  switch (pr.type) {
    case 'heaviest':
      return say('Heaviest', 'heaviest', load(pr.value, unit, pr.perSide));
    case 'e1rm': {
      const tenth = Math.round(toDisplay(pr.value, unit) * 10) / 10;
      return say('Est. 1RM', 'estimated 1 rep max', load(toKg(tenth, unit), unit, pr.perSide));
    }
    case 'reps_at_weight': {
      const at = load(pr.contextWeightKg ?? 0, unit, pr.perSide);
      return say(`Reps at ${at.shown}`, `most reps at ${at.spoken}`, count);
    }
    case 'max_reps':
      return say('Most reps', 'most reps', count);
    case 'longest_time':
      return say('Longest time', 'longest time', {
        shown: formatClock(pr.value),
        spoken: spokenClock(pr.value),
      });
    case 'heaviest_added':
      return say('Heaviest added', 'heaviest added load', added(pr.value, unit));
    case 'reps_at_added': {
      const at = added(pr.contextWeightKg ?? 0, unit);
      return say(`Reps at ${at.shown}`, `most reps at ${at.spoken}`, count);
    }
  }
}
