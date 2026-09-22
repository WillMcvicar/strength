// Plan setup (FR-2.3, FR-3.3, DESIGN §7.5, §8.1): start date, training days and 1RMs for a draft
// plan. Reads through repositories; every write goes through a service.
import { useCallback, useState } from 'react';

import { firstOnOrAfter, tmKg, type LocalDate, type Unit } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { createPlanFromTemplate } from '@/services/createPlanFromTemplate';
import { today as clockToday } from '@/services/clock';
import { startPlan, type StartPlanError } from '@/services/startPlan';

import { useDb } from './database';
import { serviceContext } from './serviceContext';
import { useLiveQuery } from './useLiveQuery';

export interface SetupSlotView {
  id: string;
  /** "Week A · Full body A" (DESIGN §7.5). */
  label: string;
  weekday: number;
}

export interface SetupSkillView {
  skillId: string;
  name: string;
  /** Pre-filled from the skill's current 1RM, or null when there isn't one (FR-3.3). */
  oneRmKg: number | null;
}

export interface PlanSetupView {
  planId: string;
  planName: string;
  /** The FR-2.3 default: the next week-start day, or today if today is it. */
  defaultStartDate: LocalDate;
  today: LocalDate;
  totalWeeks: number;
  slots: SetupSlotView[];
  skills: SetupSkillView[];
  tmPercent: number;
  unit: Unit;
  /** The user's weight increment in the display unit, for rounding an estimate (FR-1.6). */
  increment: number;
  weekStart: 0 | 1;
  /** FR-4.1: starting this plan ends the one that's running. */
  activePlanName: string | null;
}

export type PlanSetupScreenView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; setup: PlanSetupView | null };

const WEEK_LETTERS = 'ABCDEFGH';

export function usePlanSetup(planId: string, today: LocalDate = clockToday()): PlanSetupScreenView {
  const view = useLiveQuery((db) => readSetup(db, planId, today), [planId, today]);
  if (view.status === 'loading' || view.status === 'failed') return view;
  return { status: 'ready', setup: view.data };
}

async function readSetup(db: Db, planId: string, today: LocalDate): Promise<PlanSetupView | null> {
  const r = repositories(db);
  const [settings, plan] = await Promise.all([r.settings.get(), r.plans.get(planId)]);
  if (!plan || plan.status !== 'draft') return null;

  const [phases, slots, planSkills, active] = await Promise.all([
    r.blueprints.phasesOfPlan(planId),
    r.blueprints.slotsOfPlan(planId),
    r.plans.skills(planId),
    r.plans.current(),
  ]);

  // D-30: a generated deload slot has no row of its own; it takes its source slot's day.
  const ownSlots = slots.filter((s) => s.sourceCycleSlotId === null);
  const workoutNames = new Map<string, string>();
  for (const phase of phases) {
    const blueprint = await r.blueprints.loadBlueprint(phase.id);
    for (const w of blueprint?.workouts ?? []) workoutNames.set(w.workout.id, w.workout.name);
  }

  const skills = await r.skills.getMany(planSkills.map((ps) => ps.skillId));
  const names = new Map(skills.map((s) => [s.id, s.name]));

  return {
    planId,
    planName: plan.name,
    defaultStartDate: firstOnOrAfter(today, settings.weekStart),
    today,
    totalWeeks: phases.reduce((n, p) => n + p.lengthWeeks, 0),
    slots: ownSlots.map((slot) => ({
      id: slot.id,
      label: `Week ${WEEK_LETTERS[slot.cycleWeekIndex - 1] ?? slot.cycleWeekIndex} · ${
        workoutNames.get(slot.cycleWorkoutId) ?? 'Workout'
      }`,
      weekday: slot.weekday,
    })),
    skills: planSkills
      .map((ps) => ({
        skillId: ps.skillId,
        name: names.get(ps.skillId) ?? ps.skillId,
        oneRmKg: ps.startingOneRmKg,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tmPercent: plan.defaultTmPercent,
    unit: settings.unit,
    increment: settings.unit === 'kg' ? settings.weightIncrementKg : settings.weightIncrementLb,
    weekStart: settings.weekStart,
    activePlanName: active?.name ?? null,
  };
}

/** The training max a 1RM gives, for the "→ TM 99 kg (90%)" line (FR-3.2, DESIGN §7.5). */
export function trainingMaxKg(oneRmKg: number, tmPercent: number): number {
  return tmKg(oneRmKg, tmPercent);
}

// ───────────── Writes (DESIGN §8.1) ─────────────

export interface StartPlanArgs {
  planId: string;
  startDate: LocalDate;
  weekdayPins: Record<string, number>;
  oneRms: Record<string, number>;
}

export function useStartPlan(): {
  start: (args: StartPlanArgs) => Promise<StartPlanError | null>;
  busy: boolean;
} {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const start = useCallback(
    async (args: StartPlanArgs) => {
      setBusy(true);
      try {
        const result = await startPlan(db, args, serviceContext());
        return result.ok ? null : result.reason;
      } finally {
        setBusy(false);
      }
    },
    [db],
  );
  return { start, busy };
}

export function useCreatePlanFromTemplate(): {
  create: (templateId: string) => Promise<string | null>;
  busy: boolean;
} {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const create = useCallback(
    async (templateId: string) => {
      setBusy(true);
      try {
        const result = await createPlanFromTemplate(db, { templateId }, serviceContext());
        return result.ok ? result.planId : null;
      } finally {
        setBusy(false);
      }
    },
    [db],
  );
  return { create, busy };
}
