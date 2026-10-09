// Reads shared by the screens that show a planned workout (Today, Week, Workout detail and the plan
// overview, DESIGN §7.2–§7.3): its name and its exercise rows with calculated loads. The maths is
// `workoutRows` in src/core; this only gathers its inputs.
import {
  cycleFirstWeek,
  progressionKey,
  workoutRows,
  type OneRmRow,
  type Phase,
  type Plan,
  type PlannedWorkout,
  type Settings,
  type WeekPosition,
  type WorkoutRow,
} from '@/core';
import type { Repositories } from '@/data/repositories';

/** "Strength · Cycle 4 · Week 9 of 13" (FR-7.2): Today's header and Workout detail's context. */
export function positionLabel(position: WeekPosition): string {
  return `${position.phase.name} · Cycle ${position.phaseCycleIndex} · Week ${position.weekIndex} of ${position.totalWeeks}`;
}

/** Each workout's name by its cycle workout, reading every cycle group's blueprint once. */
export async function workoutNames(
  r: Repositories,
  workouts: readonly PlannedWorkout[],
): Promise<Map<string, string>> {
  const groups = [...new Set(workouts.map((w) => w.cycleGroupId))];
  const blueprints = await Promise.all(groups.map((id) => r.blueprints.loadBlueprint(id)));
  const names = new Map<string, string>();
  for (const blueprint of blueprints) {
    for (const { workout } of blueprint?.workouts ?? []) names.set(workout.id, workout.name);
  }
  return names;
}

export async function workoutName(r: Repositories, workout: PlannedWorkout): Promise<string> {
  return (await workoutNames(r, [workout])).get(workout.cycleWorkoutId) ?? 'Workout';
}

/** A planned workout's name and exercise rows (FR-7.2): sets × target × calculated load (§3.3). */
export async function readWorkoutRows(
  r: Repositories,
  plan: Plan,
  phases: readonly Phase[],
  settings: Settings,
  workout: PlannedWorkout,
): Promise<{ name: string; rows: WorkoutRow[] }> {
  const blueprint = await r.blueprints.loadBlueprint(workout.cycleGroupId);
  const planned = blueprint?.workouts.find((w) => w.workout.id === workout.cycleWorkoutId);
  const exercises = planned?.exercises ?? [];
  const skillIds = [...new Set(exercises.map((e) => e.exercise.skillId))];
  const [skills, planSkills, oneRms, dpStates, lastLoads] = await Promise.all([
    r.skills.getMany(skillIds),
    r.plans.skills(plan.id),
    r.oneRepMax.listByPlan(plan.id),
    r.progression.getMany(exercises.map((e) => progressionKey(e.exercise))),
    r.sessions.lastLoadBySkill(skillIds),
  ]);
  const phase = phases.find((p) => p.id === workout.phaseId);
  const rows = workoutRows({
    exercises,
    skills: new Map(skills.map((s) => [s.id, s])),
    planSkills: new Map(planSkills.map((s) => [s.skillId, s])),
    oneRmRows: groupBySkill(oneRms),
    defaultTmPercent: plan.defaultTmPercent,
    firstWeekOfCycle: cycleFirstWeek(phases, workout.weekIndex),
    phase: { type: phase?.type ?? 'training', loadFactor: phase?.loadFactor ?? null },
    unit: settings.unit,
    increments: settings,
    defaultRestSec: settings.defaultRestSec,
    dpStates,
    lastLoads,
  });
  return { name: planned?.workout.name ?? 'Workout', rows };
}

function groupBySkill(rows: readonly (OneRmRow & { skillId: string })[]) {
  const bySkill = new Map<string, OneRmRow[]>();
  for (const row of rows) bySkill.set(row.skillId, [...(bySkill.get(row.skillId) ?? []), row]);
  return bySkill;
}
