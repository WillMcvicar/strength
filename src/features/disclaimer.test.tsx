// The disclaimer gate's view-model (FR-5, DESIGN §7.1 launch rule 2).
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb } from '@/data/live';
import { DatabaseProvider } from '@/features/database';
import { useDisclaimer } from '@/features/disclaimer';
import { acknowledgeDisclaimer } from '@/services/acknowledgeDisclaimer';

jest.mock('@/services/acknowledgeDisclaimer', () => ({ acknowledgeDisclaimer: jest.fn() }));
jest.mock('@/features/serviceContext', () => ({
  serviceContext: () => ({
    today: '2026-09-21',
    now: '2026-09-21T07:30:00.000Z',
    newId: () => 'id',
  }),
}));

const mockSettings = { disclaimerAckAt: null as string | null, readError: null as Error | null };
jest.mock('@/data/repositories', () => ({
  repositories: () => ({
    settings: {
      get: async () => {
        if (mockSettings.readError) throw mockSettings.readError;
        return { ...mockSettings };
      },
    },
  }),
}));

/** A settings row the test controls, behind a database whose transactions commit and signal. */
function fakeDatabase(ackAt: string | null) {
  mockSettings.disclaimerAckAt = ackAt;
  mockSettings.readError = null;
  const state = mockSettings;
  const db = {
    withExclusiveTransactionAsync: (task: (tx: Db) => Promise<void>) => task(db),
  } as unknown as Db;
  const live = liveDb(db);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DatabaseProvider value={live}>{children}</DatabaseProvider>
  );
  return { state, live, wrapper };
}

describe('useDisclaimer (FR-5)', () => {
  it('asks for the disclaimer on a fresh install', async () => {
    const { wrapper } = fakeDatabase(null);
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('needed'));
  });

  it('skips it once acknowledged, including after an update (FR-5.3)', async () => {
    const { wrapper } = fakeDatabase('2026-09-01T10:00:00.000Z');
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('acknowledged'));
  });

  it('acknowledges through the service, then reports acknowledged after the commit', async () => {
    const { state, live, wrapper } = fakeDatabase(null);
    jest.mocked(acknowledgeDisclaimer).mockImplementation(async (db) => {
      await db.withExclusiveTransactionAsync(async () => {
        state.disclaimerAckAt = '2026-09-21T07:30:00.000Z';
      });
    });
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('needed'));

    await act(() => result.current.acknowledge());

    expect(acknowledgeDisclaimer).toHaveBeenCalledWith(live.db, {
      today: '2026-09-21',
      now: '2026-09-21T07:30:00.000Z',
      newId: expect.any(Function),
    });
    await waitFor(() => expect(result.current.status).toBe('acknowledged'));
  });

  it('reports a failed read instead of crashing, so the launch gate can explain it', async () => {
    const { wrapper } = fakeDatabase(null);
    mockSettings.readError = new Error('disk I/O error');
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.error?.message).toBe('disk I/O error');
  });

  it('reports a failed save and stays on the disclaimer, so the user can try again', async () => {
    const { wrapper } = fakeDatabase(null);
    jest.mocked(acknowledgeDisclaimer).mockRejectedValueOnce(new Error('database is locked'));
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('needed'));

    await act(() => result.current.acknowledge());

    expect(result.current.saveFailed).toBe(true);
    expect(result.current.status).toBe('needed');
  });

  it('reports saving while the acknowledgement is being stored', async () => {
    const { wrapper } = fakeDatabase(null);
    let finish: () => void = () => {};
    jest
      .mocked(acknowledgeDisclaimer)
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useDisclaimer(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('needed'));

    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.acknowledge();
    });
    expect(result.current.saving).toBe(true);

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.saveFailed).toBe(false);
  });
});
