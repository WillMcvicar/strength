// The Skill Library (FR-1). Locks and snapshots (D-16) are service rules, not repository ones.
import { and, asc, eq, inArray, type SQL, sql } from 'drizzle-orm';

import type { Equipment, MuscleGroup, Skill } from '@/core/types';

import type { Orm } from '../orm';
import { skill } from '../schema';

export interface SkillSearch {
  /** Case-insensitive substring of the name (FR-1.4). */
  query?: string;
  muscleGroup?: MuscleGroup;
  equipment?: Equipment;
  /** Archived skills are hidden from pickers unless asked for (FR-1.5). */
  includeArchived?: boolean;
}

export type SkillPatch = Partial<Omit<Skill, 'id' | 'createdAt'>>;

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function skillRepository(o: Orm) {
  return {
    async get(id: string): Promise<Skill | null> {
      return (await o.query.skill.findFirst({ where: eq(skill.id, id) })) ?? null;
    },

    async getMany(ids: readonly string[]): Promise<Skill[]> {
      if (ids.length === 0) return [];
      return o
        .select()
        .from(skill)
        .where(inArray(skill.id, [...ids]));
    },

    async search(filter: SkillSearch = {}): Promise<Skill[]> {
      const where: SQL[] = [];
      if (!filter.includeArchived) where.push(eq(skill.isArchived, false));
      if (filter.muscleGroup) where.push(eq(skill.muscleGroup, filter.muscleGroup));
      if (filter.equipment) where.push(eq(skill.equipment, filter.equipment));
      const query = filter.query?.trim();
      if (query) where.push(sql`${skill.name} LIKE ${likePattern(query)} ESCAPE '\\'`);

      return o
        .select()
        .from(skill)
        .where(and(...where))
        .orderBy(asc(sql`${skill.name} COLLATE NOCASE`));
    },

    async insert(row: Skill): Promise<void> {
      await o.insert(skill).values(row);
    },

    async update(id: string, patch: SkillPatch): Promise<void> {
      await o.update(skill).set(patch).where(eq(skill.id, id));
    },
  };
}
