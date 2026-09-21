// Live reads (D-32, DESIGN §2.4): a read re-runs after each committed transaction, never during one.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb } from '@/data/live';
import { DatabaseProvider } from '@/features/database';
import { useLiveQuery } from '@/features/useLiveQuery';

/** Just enough of `Db` for a transaction to commit or roll back. */
const fakeDb = {
  withExclusiveTransactionAsync: (task: (tx: Db) => Promise<void>) => task(fakeDb),
} as unknown as Db;

function setup() {
  const live = liveDb(fakeDb);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DatabaseProvider value={live}>{children}</DatabaseProvider>
  );
  const commit = () => act(() => live.db.withExclusiveTransactionAsync(async () => {}));
  return { live, wrapper, commit };
}

/** A read that returns the current value; `set` changes what later calls return. */
function counter() {
  let value = 0;
  const read = jest.fn(async (_db: Db) => value);
  return { read, set: (v: number) => (value = v) };
}

describe('useLiveQuery (D-32)', () => {
  it('reports loading, then the read result', async () => {
    const { live, wrapper } = setup();
    let release: (v: number) => void = () => {};
    const read = jest.fn((_db: Db) => new Promise<number>((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    expect(result.current).toEqual({ status: 'loading' });

    await act(async () => release(0));

    expect(result.current).toEqual({ status: 'ready', data: 0 });
    expect(read).toHaveBeenCalledWith(live.db);
  });

  it('re-reads after a commit and shows the committed value', async () => {
    const { wrapper, commit } = setup();
    const { read, set } = counter();
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 0 }));

    set(1);
    await commit();

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 1 }));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the last result while it re-reads', async () => {
    const { wrapper, commit } = setup();
    let release: (v: number) => void = () => {};
    const read = jest
      .fn<Promise<number>, [Db]>()
      .mockResolvedValueOnce(0)
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 0 }));

    await commit();
    expect(result.current).toEqual({ status: 'ready', data: 0 });

    await act(async () => release(1));
    expect(result.current).toEqual({ status: 'ready', data: 1 });
  });

  it('re-reads once for several commits in quick succession', async () => {
    const { live, wrapper } = setup();
    const { read } = counter();
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await Promise.all([
        live.db.withExclusiveTransactionAsync(async () => {}),
        live.db.withExclusiveTransactionAsync(async () => {}),
        live.db.withExclusiveTransactionAsync(async () => {}),
      ]);
    });

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not re-read after a rollback', async () => {
    const { live, wrapper } = setup();
    const { read } = counter();
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await live.db
        .withExclusiveTransactionAsync(async () => {
          throw new Error('rejected');
        })
        .catch(() => {});
    });

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('ignores a slower, older read that finishes after a newer one', async () => {
    const { wrapper, commit } = setup();
    let releaseFirst: (v: number) => void = () => {};
    const read = jest
      .fn<Promise<number>, [Db]>()
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce(2);
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });

    await commit();
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 2 }));

    await act(async () => releaseFirst(1));
    expect(result.current).toEqual({ status: 'ready', data: 2 });
  });

  it('re-reads when its dependencies change', async () => {
    const { wrapper } = setup();
    const read = jest.fn(async (_db: Db, id: string) => `plan ${id}`);
    const { result, rerender } = await renderHook(
      ({ id }: { id: string }) => useLiveQuery((db) => read(db, id), [id]),
      { wrapper, initialProps: { id: 'a' } },
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'plan a' }));

    await rerender({ id: 'b' });

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'plan b' }));
  });

  it("shows loading, not the old query's data, while new dependencies are read", async () => {
    const { wrapper } = setup();
    let release: (v: string) => void = () => {};
    const read = jest
      .fn<Promise<string>, [Db, string]>()
      .mockResolvedValueOnce('plan a')
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { result, rerender } = await renderHook(
      ({ id }: { id: string }) => useLiveQuery((db) => read(db, id), [id]),
      { wrapper, initialProps: { id: 'a' } },
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'plan a' }));

    await rerender({ id: 'b' });
    expect(result.current).toEqual({ status: 'loading' });

    await act(async () => release('plan b'));
    expect(result.current).toEqual({ status: 'ready', data: 'plan b' });
  });

  it('reports a failed read', async () => {
    const { wrapper } = setup();
    const read = () => Promise.reject(new Error('no such table'));
    const { result } = await renderHook(() => useLiveQuery(read, []), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current).toMatchObject({ error: { message: 'no such table' } });
  });

  it('stops listening once unmounted', async () => {
    const { live, wrapper, commit } = setup();
    const subscribe = jest.spyOn(live, 'subscribe');
    const { read } = counter();
    const { result, unmount } = await renderHook(() => useLiveQuery(read, []), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(subscribe).toHaveBeenCalledTimes(1);

    await unmount();
    await commit();

    expect(read).toHaveBeenCalledTimes(1);
  });
});
