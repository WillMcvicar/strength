// The onboarding gate's view-model (DESIGN §7.15, §7.1 launch rule 3). Like the disclaimer, a
// failed read goes to the §4.6 blocking error and a failed save leaves the user where they are.
import { useCallback, useState } from 'react';

import type { Unit } from '@/core';
import { repositories } from '@/data/repositories';
import { completeOnboarding } from '@/services/completeOnboarding';

import { useDb } from './database';
import { serviceContext } from './serviceContext';
import { useLiveQuery } from './useLiveQuery';

export interface OnboardingState {
  status: 'loading' | 'needed' | 'done' | 'failed';
  error: Error | null;
  complete: (unit: Unit) => Promise<boolean>;
  saving: boolean;
}

export function useOnboarding(): OnboardingState {
  const db = useDb();
  const completedAt = useLiveQuery(
    async (d) => (await repositories(d).settings.get()).onboardingCompletedAt,
    [],
  );
  const [saving, setSaving] = useState(false);

  const complete = useCallback(
    async (unit: Unit) => {
      setSaving(true);
      try {
        await completeOnboarding(db, unit, serviceContext());
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [db],
  );

  if (completedAt.status === 'failed') {
    return { status: 'failed', error: completedAt.error, complete, saving };
  }
  const status =
    completedAt.status === 'loading' ? 'loading' : completedAt.data === null ? 'needed' : 'done';
  return { status, error: null, complete, saving };
}
