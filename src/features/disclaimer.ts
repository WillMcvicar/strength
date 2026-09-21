// The disclaimer gate's view-model (FR-5, DESIGN §7.1 launch rule 2): shown until the user taps
// "I understand", then never again automatically. Failures are reported, never thrown: a failed
// read goes to the §4.6 blocking error, and a failed save leaves the user on the disclaimer to
// try again.
import { useCallback, useState } from 'react';

import { repositories } from '@/data/repositories';
import { acknowledgeDisclaimer } from '@/services/acknowledgeDisclaimer';

import { useDb } from './database';
import { serviceContext } from './serviceContext';
import { useLiveQuery } from './useLiveQuery';

export interface DisclaimerState {
  status: 'loading' | 'needed' | 'acknowledged' | 'failed';
  /** Why the acknowledgement couldn't be read, when `status` is `failed`. */
  error: Error | null;
  acknowledge: () => Promise<void>;
  saving: boolean;
  /** The last tap on "I understand" didn't save. */
  saveFailed: boolean;
}

export function useDisclaimer(): DisclaimerState {
  const db = useDb();
  const ackAt = useLiveQuery(
    async (d) => (await repositories(d).settings.get()).disclaimerAckAt,
    [],
  );
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const acknowledge = useCallback(async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await acknowledgeDisclaimer(db, serviceContext());
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [db]);

  const common = { acknowledge, saving, saveFailed };
  if (ackAt.status === 'failed') return { status: 'failed', error: ackAt.error, ...common };
  const status =
    ackAt.status === 'loading' ? 'loading' : ackAt.data === null ? 'needed' : 'acknowledged';
  return { status, error: null, ...common };
}
