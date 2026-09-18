// Plans and their per-skill settings (FR-2.3, FR-3.3).
import { asc, desc, eq, inArray } from 'drizzle-orm';

import type { Plan, PlanSkill, PlanStatus } from '@/core/types';

import type { Orm } from '../orm';
import { plan, planSkill } from '../schema';

export type PlanPatch = Partial<Omit<Plan, 'id' | 'createdAt'>>;
export type PlanSkillPatch = Partial<Pick<PlanSkill, 'tmPercent' | 'startingOneRmKg'>>;

export function planRepository(o: Orm) {
  return {
    async get(id: string): Promise<Plan | null> {
      return (await o.query.plan.findFirst({ where: eq(plan.id, id) })) ?? null;
    },

    /** The one active or paused plan, if any (FR-4.1). */
    async current(): Promise<Plan | null> {
      const current: PlanStatus[] = ['active', 'paused'];
      return (await o.query.plan.findFirst({ where: inArray(plan.status, current) })) ?? null;
    },

    async list(): Promise<Plan[]> {
      return o.select().from(plan).orderBy(desc(plan.createdAt));
    },

    async insert(row: Plan): Promise<void> {
      await o.insert(plan).values(row);
    },

    async update(id: string, patch: PlanPatch): Promise<void> {
      await o.update(plan).set(patch).where(eq(plan.id, id));
    },

    async skills(planId: string): Promise<PlanSkill[]> {
      return o
        .select()
        .from(planSkill)
        .where(eq(planSkill.planId, planId))
        .orderBy(asc(planSkill.skillId));
    },

    async insertSkill(row: PlanSkill): Promise<void> {
      await o.insert(planSkill).values(row);
    },

    async updateSkill(id: string, patch: PlanSkillPatch): Promise<void> {
      await o.update(planSkill).set(patch).where(eq(planSkill.id, id));
    },
  };
}
