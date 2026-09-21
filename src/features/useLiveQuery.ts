// Live reads (D-32, DESIGN §2.4): run a repository read, then run it again after every committed
// exclusive transaction. The commit signal comes from `liveDb`, never from expo-sqlite's per-row
// change events, so a re-read can't see a transaction that hasn't committed yet.
import { useEffect, useState, type DependencyList } from 'react';

import type { Db } from '@/data/db';

import { toError, useLiveDb } from './database';

export type LiveQuery<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed'; error: Error };

/**
 * `read` re-runs when `deps` change and after each commit. After a commit the last result stays on
 * screen while the re-read runs; after a `deps` change it is a different query, so the hook
 * reports loading. A result that arrives after a newer read has started is dropped.
 */
export function useLiveQuery<T>(read: (db: Db) => Promise<T>, deps: DependencyList): LiveQuery<T> {
  const live = useLiveDb();
  // Each result remembers the deps it was read for, so a stale one is never shown for new deps.
  const [state, setState] = useState<{ deps: DependencyList; result: LiveQuery<T> }>({
    deps,
    result: { status: 'loading' },
  });
  // Bumped on each commit. React batches the bumps from several quick commits into one render,
  // so they cause one re-read.
  const [commits, setCommits] = useState(0);

  useEffect(() => live.subscribe(() => setCommits((n) => n + 1)), [live]);

  useEffect(() => {
    let current = true;
    read(live.db).then(
      (data) => current && setState({ deps, result: { status: 'ready', data } }),
      (error: unknown) =>
        current && setState({ deps, result: { status: 'failed', error: toError(error) } }),
    );
    return () => {
      current = false;
    };
    // `read` is usually an inline closure; `deps` says when it really changes, as with useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, commits, ...deps]);

  return sameDeps(state.deps, deps) ? state.result : { status: 'loading' };
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}
