// Development builds only: load the sample plan from Today's empty state (docs/BUILD_PLAN.md
// Slice 4). Writes go through the service, as everywhere else.
import { useCallback, useState } from 'react';

import type { Db } from '@/data/db';
import type { ServiceContext } from '@/services/context';

import { useDb } from './database';
import { serviceContext } from './serviceContext';

type Load = (db: Db, ctx: ServiceContext) => Promise<unknown>;

// The service is required inside a branch on the inlined NODE_ENV, not imported, so production
// bundles drop the branch before dependencies are collected and never ship the service.
let loadSamplePlan: Load | null = null;
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadSamplePlan = (require('@/services/dev/loadSamplePlan') as { loadSamplePlan: Load })
    .loadSamplePlan;
}

export function useSamplePlan(): { load: () => Promise<void>; loading: boolean } {
  const db = useDb();
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!loadSamplePlan) return;
    setLoading(true);
    try {
      await loadSamplePlan(db, serviceContext());
    } finally {
      setLoading(false);
    }
  }, [db]);
  return { load, loading };
}
