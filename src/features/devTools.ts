// Development-only tools (docs/BUILD_PLAN.md Slice 5). The services are required inside a branch
// on the inlined NODE_ENV, not imported, so production bundles drop the branch before
// dependencies are collected and never ship them — the same guard `samplePlan.ts` uses.
import { useCallback, useState } from 'react';

import type { Db } from '@/data/db';

import { useDb } from './database';

type Reset = (db: Db) => Promise<unknown>;

let resetAppData: Reset | null = null;
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  resetAppData = (require('@/services/dev/resetAppData') as { resetAppData: Reset }).resetAppData;
}

export function useResetAppData(): { reset: () => Promise<void>; resetting: boolean } {
  const db = useDb();
  const [resetting, setResetting] = useState(false);
  const reset = useCallback(async () => {
    if (!resetAppData) return;
    setResetting(true);
    try {
      await resetAppData(db);
    } finally {
      setResetting(false);
    }
  }, [db]);
  return { reset, resetting };
}
