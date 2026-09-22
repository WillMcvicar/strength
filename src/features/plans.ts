// The Plans tab and template detail (FR-2.1, FR-2.2, DESIGN §7.4). Reads and assembles; every
// number comes from src/core.
import {
  progress,
  weekPosition,
  workoutRows,
  type PhaseType,
  type Unit,
  type WorkoutRow,
} from '@/core';
import type { Phase, PlanStatus, Settings } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';
import { today as clockToday } from '@/services/clock';

import { useLiveQuery } from './useLiveQuery';

export interface RibbonPhaseView {
  name: string;
  type: PhaseType;
  weeks: number;
}

export interface ActivePlanView {
  id: string;
  name: string;
  /** "Week 9 of 13" (DESIGN §7.4). */
  header: string;
  ribbon: RibbonPhaseView[];
  currentWeek: number;
}

export interface PlanListItemView {
  id: string;
  name: string;
  status: PlanStatus;
  /** "Draft · 13 weeks", "Completed · 13 weeks". */
  subtitle: string;
}

export interface TemplateListItemView {
  id: string;
  name: string;
  /** "13 wk · 3/wk" (DESIGN §7.4). */
  summary: string;
}

export interface PlansView {
  active: ActivePlanView | null;
  /** Drafts and ended plans, newest first (DESIGN §7.4). */
  myPlans: PlanListItemView[];
  templates: TemplateListItemView[];
}

export type PlansScreenView =
  { status: 'loading' } | { status: 'failed'; error: Error } | ({ status: 'ready' } & PlansView);

export function usePlans(today = clockToday()): PlansScreenView {
  const view = useLiveQuery((db) => readPlans(db, today), [today]);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', ...view.data };
}

const ribbonOf = (phases: readonly Phase[]): RibbonPhaseView[] =>
  phases.map((p) => ({ name: p.name, type: p.type, weeks: p.lengthWeeks }));

const totalWeeks = (phases: readonly Phase[]) => phases.reduce((n, p) => n + p.lengthWeeks, 0);

const STATUS_WORD: Record<PlanStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  abandoned: 'Ended',
};

async function readPlans(db: Db, today: string): Promise<PlansView> {
  const r = repositories(db);
  const [plans, templates] = await Promise.all([r.plans.list(), r.templates.list()]);

  let active: ActivePlanView | null = null;
  const myPlans: PlanListItemView[] = [];
  for (const plan of plans) {
    const phases = await r.blueprints.phasesOfPlan(plan.id);
    if (plan.status === 'active' || plan.status === 'paused') {
      const workouts = await r.plannedWorkouts.listByPlan(plan.id);
      const position = weekPosition(phases, progress(phases, workouts, today, plan).currentWeek);
      active = {
        id: plan.id,
        name: plan.name,
        header: `Week ${position.weekIndex} of ${position.totalWeeks}`,
        ribbon: ribbonOf(phases),
        currentWeek: position.weekIndex,
      };
    } else {
      myPlans.push({
        id: plan.id,
        name: plan.name,
        status: plan.status,
        subtitle: `${STATUS_WORD[plan.status]} · ${totalWeeks(phases)} weeks`,
      });
    }
  }

  const templateViews: TemplateListItemView[] = [];
  for (const t of templates) {
    const phases = await r.blueprints.phasesOfTemplate(t.id);
    templateViews.push({
      id: t.id,
      name: t.name,
      summary: `${totalWeeks(phases)} wk · ${t.sessionsPerWeek}/wk`,
    });
  }

  return { active, myPlans, templates: templateViews };
}

// ───────────── Template detail (FR-2.2, DESIGN §7.4) ─────────────

export interface TemplatePhaseView {
  name: string;
  type: PhaseType;
  /** "6 weeks · 2-week cycle". */
  length: string;
  /** The suggested-increase rule in plain words (FR-2.2). */
  increase: string;
}

export interface TemplateWorkoutView {
  id: string;
  name: string;
  /** "Monday". */
  day: string;
  rows: WorkoutRow[];
}

export interface TemplateCycleWeekView {
  /** "Week A", "Week B" (DESIGN §7.4). */
  label: string;
  workouts: TemplateWorkoutView[];
}

export interface TemplateDetailView {
  id: string;
  name: string;
  description: string;
  ribbon: RibbonPhaseView[];
  /** "13 weeks · 3 sessions a week". */
  summary: string;
  phases: TemplatePhaseView[];
  cycleWeeks: TemplateCycleWeekView[];
  unit: Unit;
}

export type TemplateScreenView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; template: TemplateDetailView | null };

export function useTemplate(templateId: string): TemplateScreenView {
  const view = useLiveQuery((db) => readTemplate(db, templateId), [templateId]);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', template: view.data };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_LETTERS = 'ABCDEFGH';

/**
 * A phase's suggested-increase rule in plain words (FR-2.2, FR-3.5). Per-skill overrides are
 * listed on the Cycle Review, not here, so this describes the phase default.
 */
export function increaseRuleText(phase: Phase, unit: Unit): string {
  if (phase.reviewMode === 'none') return 'No review';
  switch (phase.defaultIncreaseType) {
    case 'none':
      return 'No increase suggested';
    case 'percent':
      return `+${round((phase.defaultIncreaseValue ?? 0) * 100)}% each cycle`;
    case 'fixed': {
      const value = unit === 'kg' ? phase.defaultIncreaseValue : phase.defaultIncreaseValueLb;
      return `+${round(value ?? 0)} ${unit} each cycle`;
    }
    case 'estimated':
      return 'Estimated from your top sets';
  }
}

const round = (n: number) => Number(n.toFixed(2));

async function readTemplate(db: Db, templateId: string): Promise<TemplateDetailView | null> {
  const r = repositories(db);
  const [settings, template] = await Promise.all([r.settings.get(), r.templates.get(templateId)]);
  if (!template) return null;

  const phases = await r.blueprints.phasesOfTemplate(template.id);
  const weeks = totalWeeks(phases);

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    ribbon: ribbonOf(phases),
    summary: `${weeks} weeks · ${template.sessionsPerWeek} ${
      template.sessionsPerWeek === 1 ? 'session' : 'sessions'
    } a week`,
    phases: phases.map((p) => ({
      name: p.name,
      type: p.type,
      length: `${p.lengthWeeks} ${p.lengthWeeks === 1 ? 'week' : 'weeks'} · ${p.cycleLengthWeeks}-week cycle`,
      increase: increaseRuleText(p, settings.unit),
    })),
    cycleWeeks: await cycleWeeks(r, template, phases, settings),
    unit: settings.unit,
  };
}

/** One preview per cycle week of the first training phase (FR-2.2). */
async function cycleWeeks(
  r: Repositories,
  template: { defaultTmPercent: number },
  phases: readonly Phase[],
  settings: Settings,
): Promise<TemplateCycleWeekView[]> {
  const first = phases.find((p) => p.type === 'training');
  const blueprint = first ? await r.blueprints.loadBlueprint(first.id) : null;
  if (!first || !blueprint) return [];

  const skillIds = [
    ...new Set(blueprint.workouts.flatMap((w) => w.exercises.map((e) => e.exercise.skillId))),
  ];
  const skills = new Map((await r.skills.getMany(skillIds)).map((s) => [s.id, s]));

  const out: TemplateCycleWeekView[] = [];
  for (let index = 1; index <= first.cycleLengthWeeks; index++) {
    const slots = blueprint.slots
      .filter((s) => s.cycleWeekIndex === index)
      .sort((a, b) => a.weekday - b.weekday);
    out.push({
      label: `Week ${WEEK_LETTERS[index - 1] ?? index}`,
      workouts: slots.map((slot) => {
        const workout = blueprint.workouts.find((w) => w.workout.id === slot.cycleWorkoutId);
        return {
          id: slot.id,
          name: workout?.workout.name ?? 'Workout',
          day: DAYS[slot.weekday] as string,
          // A template has no 1RMs, so loads show as blank until Plan setup (FR-3.3).
          rows: workoutRows({
            exercises: workout?.exercises ?? [],
            skills,
            planSkills: new Map(),
            oneRmRows: new Map(),
            defaultTmPercent: template.defaultTmPercent,
            firstWeekOfCycle: 1,
            phase: { type: first.type, loadFactor: first.loadFactor },
            unit: settings.unit,
            increments: settings,
            defaultRestSec: settings.defaultRestSec,
          }),
        };
      }),
    });
  }
  return out;
}
