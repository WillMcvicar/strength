// Templates are read-only after seeding, except user templates on save (DESIGN §4.4, FR-2.8).
import { asc, eq } from 'drizzle-orm';

import type { Template } from '@/core/types';

import type { Orm } from '../orm';
import { template } from '../schema';

export function templateRepository(o: Orm) {
  return {
    async get(id: string): Promise<Template | null> {
      return (await o.query.template.findFirst({ where: eq(template.id, id) })) ?? null;
    },

    async list(): Promise<Template[]> {
      return o.select().from(template).orderBy(asc(template.name));
    },
  };
}
