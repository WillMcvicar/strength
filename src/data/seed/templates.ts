// The built-in templates (FR-2.1, FR-2.2, DESIGN §4.6). Read-only after seeding (§4.4).
//
// Both beginner templates are Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk, continuation) on a
// 2-week cycle, so Block 2 carries on Block 1's cycle numbering as cycles 4–6 (FR-2.11, D-14).
// They are built as one 12-week phase and split by `withDeload`, which generates the deload week
// with the same core code a user-inserted deload uses (FR-2.12, D-37).
//
// The periodised template is v1.1 (SRS §11), so it isn't seeded here.
import type { IncreaseRule } from '@/core/types';

import { eq } from 'drizzle-orm';

import type { Orm } from '../orm';
import { phase, template } from '../schema';
import {
  buildBlueprint,
  withDeload,
  writeBlueprint,
  type ExerciseSpec,
  type PhaseSpec,
  type SetSpec,
  type SlotSpec,
} from './blueprint';

const MON = 1;
const WED = 3;
const FRI = 5;

/** Mon/Wed/Fri, full body A/B alternating over a 2-week cycle (FR-2.1). */
const FULL_BODY_AB: SlotSpec[] = [
  { cycleWeekIndex: 1, weekday: MON, workout: 'Full body A' },
  { cycleWeekIndex: 1, weekday: WED, workout: 'Full body B' },
  { cycleWeekIndex: 1, weekday: FRI, workout: 'Full body A' },
  { cycleWeekIndex: 2, weekday: MON, workout: 'Full body B' },
  { cycleWeekIndex: 2, weekday: WED, workout: 'Full body A' },
  { cycleWeekIndex: 2, weekday: FRI, workout: 'Full body B' },
];

const repeat = (n: number, set: SetSpec): SetSpec[] =>
  Array.from({ length: n }, () => ({ ...set }));

/** A %-of-TM main lift (FR-3.2). */
const main = (skillId: string, sets: number, set: SetSpec): ExerciseSpec => ({
  skillId,
  restSec: 180,
  sets: repeat(sets, { loadType: 'percent_tm', ...set }),
});

/** An accessory: double progression, so it needs no % and no starting load (FR-3.15, §3.12). */
const accessory = (skillId: string, sets: number, set: SetSpec): ExerciseSpec => ({
  skillId,
  restSec: 90,
  sets: repeat(sets, { loadType: 'double_progression', ...set }),
});

const fixedRule = (
  skillId: string,
  kg: number,
  lb: number,
): Omit<IncreaseRule, 'id' | 'phaseId'> => ({
  skillId,
  increaseType: 'fixed',
  increaseValue: kg,
  increaseValueLb: lb,
  fallbackType: null,
  fallbackValue: null,
  fallbackValueLb: null,
});

// TODO(OQ-1): placeholder exercises. The final lists are the product owner's call (SRS Open
// Question 1), and a release build fails while this marker is here (DESIGN §4.6).
const STRENGTH_BLOCK: PhaseSpec = {
  phase: {
    name: 'Block 1',
    type: 'training',
    reviewMode: 'every_cycle',
    lengthWeeks: 12,
    cycleLengthWeeks: 2,
    // Fixed +2.5 kg / +5 lb, with lower-body lifts overridden per skill below (FR-3.5).
    defaultIncreaseType: 'fixed',
    defaultIncreaseValue: 2.5,
    defaultIncreaseValueLb: 5,
  },
  // 5 × 5 at 80% TM: the figure DESIGN §7.6 works through for this template.
  increaseRules: [
    fixedRule('skill_back_squat', 5, 10),
    fixedRule('skill_deadlift', 5, 10),
    fixedRule('skill_bench_press', 2.5, 5),
    fixedRule('skill_overhead_press', 2.5, 5),
  ],
  workouts: [
    {
      name: 'Full body A',
      exercises: [
        main('skill_back_squat', 5, {
          repsMin: 5,
          repsMax: 5,
          loadPercent: 0.8,
          targetRpeMin: 7,
          targetRpeMax: 8,
        }),
        main('skill_bench_press', 5, {
          repsMin: 5,
          repsMax: 5,
          loadPercent: 0.8,
          targetRpeMin: 7,
          targetRpeMax: 8,
        }),
        accessory('skill_barbell_row', 3, {
          repsMin: 8,
          repsMax: 12,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
        { skillId: 'skill_plank', sets: repeat(3, { loadType: 'bodyweight', targetTimeSec: 45 }) },
      ],
    },
    {
      name: 'Full body B',
      exercises: [
        main('skill_deadlift', 3, {
          repsMin: 5,
          repsMax: 5,
          loadPercent: 0.8,
          targetRpeMin: 7,
          targetRpeMax: 8,
        }),
        main('skill_overhead_press', 5, {
          repsMin: 5,
          repsMax: 5,
          loadPercent: 0.8,
          targetRpeMin: 7,
          targetRpeMax: 8,
        }),
        accessory('skill_lat_pulldown', 3, {
          repsMin: 8,
          repsMax: 12,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
      ],
    },
  ],
  slots: FULL_BODY_AB,
};

// TODO(OQ-1): placeholder exercises, as above. AC-56 works through a curl in Full body A.
const HYPERTROPHY_BLOCK: PhaseSpec = {
  phase: {
    name: 'Block 1',
    type: 'training',
    reviewMode: 'every_cycle',
    lengthWeeks: 12,
    cycleLengthWeeks: 2,
    // +2.5%: beginners log no qualifying low-rep sets, so nothing can be estimated (FR-3.5).
    defaultIncreaseType: 'percent',
    defaultIncreaseValue: 0.025,
  },
  workouts: [
    {
      name: 'Full body A',
      exercises: [
        main('skill_back_squat', 4, {
          repsMin: 8,
          repsMax: 12,
          loadPercent: 0.7,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
        main('skill_bench_press', 4, {
          repsMin: 8,
          repsMax: 12,
          loadPercent: 0.7,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
        accessory('skill_barbell_row', 3, {
          repsMin: 10,
          repsMax: 15,
          targetRpeMin: 8,
          targetRpeMax: 9,
        }),
        accessory('skill_dumbbell_curl', 3, {
          repsMin: 10,
          repsMax: 15,
          targetRpeMin: 8,
          targetRpeMax: 9,
        }),
      ],
    },
    {
      name: 'Full body B',
      exercises: [
        main('skill_deadlift', 4, {
          repsMin: 8,
          repsMax: 12,
          loadPercent: 0.7,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
        main('skill_overhead_press', 4, {
          repsMin: 8,
          repsMax: 12,
          loadPercent: 0.7,
          targetRpeMin: 7,
          targetRpeMax: 9,
        }),
        accessory('skill_lat_pulldown', 3, {
          repsMin: 10,
          repsMax: 15,
          targetRpeMin: 8,
          targetRpeMax: 9,
        }),
        accessory('skill_leg_curl', 3, {
          repsMin: 10,
          repsMax: 15,
          targetRpeMin: 8,
          targetRpeMax: 9,
        }),
      ],
    },
  ],
  slots: FULL_BODY_AB,
};

export interface SeedTemplate {
  id: string;
  name: string;
  description: string;
  sessionsPerWeek: number;
  /** The plan week the deload follows (FR-2.12). */
  deloadAfterWeek: number;
  block: PhaseSpec;
}

export const SEED_TEMPLATES: readonly SeedTemplate[] = [
  {
    id: 'tpl_beginner_strength',
    name: 'Beginner Strength',
    description:
      'Thirteen weeks of full-body training three days a week, built around five sets of five on the main lifts. Loads step up after every two-week cycle, with a deload in week 7.',
    sessionsPerWeek: 3,
    deloadAfterWeek: 6,
    block: STRENGTH_BLOCK,
  },
  {
    id: 'tpl_beginner_hypertrophy',
    name: 'Beginner Hypertrophy',
    description:
      'Thirteen weeks of full-body training three days a week, in the 8–12 rep range for size. Loads step up 2.5% after every two-week cycle, with a deload in week 7.',
    sessionsPerWeek: 3,
    deloadAfterWeek: 6,
    block: HYPERTROPHY_BLOCK,
  },
];

/** IDs are fixed and readable, so re-running the seed writes nothing new (DESIGN §4.1, §4.6). */
function seedIds(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

/**
 * Writes the built-in templates. A seed upgrade updates their content (DESIGN §4.6): the template
 * row is upserted and its blueprint is replaced, because the generated IDs are positional, so
 * leaving old rows in place would strand them beside shifted duplicates. The template row itself
 * survives, so a plan started from it keeps its `source_template_id`; plans are copies and are
 * untouched either way.
 */
export async function seedTemplates(o: Orm, now: string): Promise<void> {
  for (const t of SEED_TEMPLATES) {
    const row = {
      name: t.name,
      description: t.description,
      defaultTmPercent: 0.9,
      sessionsPerWeek: t.sessionsPerWeek,
      level: 'beginner',
      isBuiltIn: true,
    } as const;
    await o
      .insert(template)
      .values({ id: t.id, createdAt: now, ...row })
      .onConflictDoUpdate({ target: template.id, set: row });
    // Cascades through the phase's workouts, exercises, sets, slots and increase rules (§4.3).
    await o.delete(phase).where(eq(phase.templateId, t.id));

    const newId = seedIds(t.id);
    const block = buildBlueprint({ templateId: t.id }, [t.block], newId);
    const rows = withDeload(block, t.deloadAfterWeek, 1, newId);
    // FR-2.1: the deload splits the block, and the half after it is Block 2. A deload at the very
    // end would leave nothing to continue, which would make the template a different shape.
    const continuation = rows.phases.find((p) => p.continuesPhaseId !== null);
    if (!continuation) throw new Error(`${t.id}: the deload left no continuation to name Block 2`);
    continuation.name = 'Block 2';
    await writeBlueprint(o, rows);
  }
}
