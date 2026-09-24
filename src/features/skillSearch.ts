// The Skill picker's list (DESIGN §7.1 sheets, FR-9.4): unarchived skills whose name matches the
// query, in name order. Slice 13 adds the muscle and equipment filters.
import { repositories } from '@/data/repositories';

import { useLiveQuery } from './useLiveQuery';

export interface SkillOption {
  id: string;
  name: string;
}

export function useSkillSearch(query: string): SkillOption[] | null {
  const view = useLiveQuery(
    async (db) =>
      (await repositories(db).skills.search({ query })).map((s) => ({ id: s.id, name: s.name })),
    [query],
  );
  return view.status === 'ready' ? view.data : null;
}
