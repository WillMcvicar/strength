// The launch gate's view-model (DESIGN §4.6): open, migrate and seed, or report why not.
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { DatabaseProvider, useDb, useOpenDatabase } from '@/features/database';

const fakeDb = { closeAsync: jest.fn() } as unknown as Db;

describe('useOpenDatabase', () => {
  it('reports opening, then ready with the database', async () => {
    const open = jest.fn(() => Promise.resolve(fakeDb));
    const { result } = await renderHook(() => useOpenDatabase(open));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', db: fakeDb }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('reports a failed migration instead of rendering the app', async () => {
    const open = () => Promise.reject(new Error('Missing migration: 0001_x'));
    const { result } = await renderHook(() => useOpenDatabase(open));

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current).toMatchObject({ error: { message: 'Missing migration: 0001_x' } });
  });

  it('wraps a non-Error rejection', async () => {
    const open = () => Promise.reject('disk full');
    const { result } = await renderHook(() => useOpenDatabase(open));

    await waitFor(() => expect(result.current).toMatchObject({ error: { message: 'disk full' } }));
  });
});

describe('useDb', () => {
  it('returns the provided database', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatabaseProvider value={fakeDb}>{children}</DatabaseProvider>
    );
    const { result } = await renderHook(() => useDb(), { wrapper });
    expect(result.current).toBe(fakeDb);
  });

  it('fails clearly outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useDb())).rejects.toThrow(/inside <DatabaseProvider>/);
  });
});
