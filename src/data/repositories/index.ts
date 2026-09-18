// Repositories over one connection or transaction (DESIGN §2.1). A service opens an exclusive
// transaction and calls `repositories(tx)` inside it (C-15). Repositories return the plain
// objects in src/core/types.ts and hold no business rules.
import type { Db } from '../db';
import { orm } from '../orm';
import { appMetaRepository } from './appMeta';
import { blueprintRepository } from './blueprints';
import { plannedWorkoutRepository } from './plannedWorkouts';
import { planRepository } from './plans';
import { settingsRepository } from './settings';
import { skillRepository } from './skills';
import { templateRepository } from './templates';

export function repositories(db: Db) {
  const o = orm(db);
  return {
    appMeta: appMetaRepository(o),
    settings: settingsRepository(o),
    skills: skillRepository(o),
    templates: templateRepository(o),
    plans: planRepository(o),
    blueprints: blueprintRepository(o),
    plannedWorkouts: plannedWorkoutRepository(o),
  };
}

export type Repositories = ReturnType<typeof repositories>;
export type { Blueprint, BlueprintExercise, BlueprintWorkout } from './blueprints';
export type { SkillSearch } from './skills';
