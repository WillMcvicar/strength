// The "Estimate it for me" flow (FR-3.3a, DESIGN §7.5, §3.5). The maths and the bounds are in
// src/core; this holds the step the user is on and calls the service on confirm.
import { useCallback, useMemo, useState } from 'react';

import { validateEstimateSet, type EstimateRejection, type Unit } from '@/core';
import { recordEstimatedOneRm } from '@/services/recordEstimatedOneRm';

import { useDb } from './database';
import { serviceContext } from './serviceContext';

/** The §3.5 rejections in plain words, shown inline beside the entry (DESIGN §6.6). */
export const ESTIMATE_MESSAGES: Record<EstimateRejection, string> = {
  load_invalid: 'Enter the weight you lifted.',
  reps_low: 'Enter how many reps you did — at least one.',
  reps_high: 'Too many reps — use a heavier load and try again.',
  rpe_low: 'Too easy — add weight and try again.',
  rpe_invalid: 'RPE goes up to 10.',
};

export interface EstimateInput {
  loadKg: number;
  reps: number;
  rpe: number;
}

export interface EstimateState {
  /** null until reps and RPE are both in range. */
  oneRmKg: number | null;
  /** The reason there's no estimate yet, in plain words. */
  message: string | null;
}

export function useEstimate(
  input: Partial<EstimateInput>,
  unit: Unit,
  increment: number,
): EstimateState {
  return useMemo(() => {
    if (input.loadKg === undefined || input.reps === undefined || input.rpe === undefined) {
      return { oneRmKg: null, message: null };
    }
    const result = validateEstimateSet({
      loadKg: input.loadKg,
      reps: input.reps,
      rpe: input.rpe,
      unit,
      increment,
    });
    return result.ok
      ? { oneRmKg: result.oneRmKg, message: null }
      : { oneRmKg: null, message: ESTIMATE_MESSAGES[result.reason] };
  }, [input.loadKg, input.reps, input.rpe, unit, increment]);
}

export function useRecordEstimate(): {
  record: (args: { planId: string; skillId: string; oneRmKg: number }) => Promise<boolean>;
  busy: boolean;
} {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const record = useCallback(
    async (args: { planId: string; skillId: string; oneRmKg: number }) => {
      setBusy(true);
      try {
        return (await recordEstimatedOneRm(db, args, serviceContext())).ok;
      } finally {
        setBusy(false);
      }
    },
    [db],
  );
  return { record, busy };
}
