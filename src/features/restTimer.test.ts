// The rest timer (FR-9.6, DESIGN §2.6, D-39): an end time in memory, a notification for it when
// alerts are on, rescheduled on ±15 s and cancelled on Skip.
import * as Notifications from 'expo-notifications';

import { now } from '@/services/clock';

import { adjustRest, restRemainingSec, startRest, stopRest, useRestTimerStore } from './restTimer';

jest.mock('@/services/clock', () => ({ now: jest.fn() }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const NOW = '2026-09-14T17:30:00.000Z';
let ids = 0;

beforeEach(() => {
  ids = 0;
  jest.mocked(now).mockReturnValue(NOW);
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async () => `n${++ids}`);
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
  useRestTimerStore.setState({ endsAt: null, notificationId: null, alerts: false });
});

const scheduledFor = () =>
  jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mock.calls.map(([req]) => ((req.trigger as { date: Date }).date as Date).toISOString());

describe('rest timer (FR-9.6)', () => {
  it('starts a countdown from the rest time and schedules its alert', async () => {
    await startRest(120, true);
    expect(useRestTimerStore.getState()).toMatchObject({
      endsAt: '2026-09-14T17:32:00.000Z',
      notificationId: 'n1',
    });
    expect(scheduledFor()).toEqual(['2026-09-14T17:32:00.000Z']);
    expect(restRemainingSec(useRestTimerStore.getState().endsAt, NOW)).toBe(120);
  });

  it('counts down from the stored end time, however long the app was away (§2.6)', () => {
    const endsAt = '2026-09-14T17:32:00.000Z';
    expect(restRemainingSec(endsAt, '2026-09-14T17:30:18.200Z')).toBe(102);
    expect(restRemainingSec(endsAt, '2026-09-14T17:33:00.000Z')).toBe(-60);
    expect(restRemainingSec(null, NOW)).toBeNull();
  });

  it('reschedules on ±15 s, never ending before now', async () => {
    await startRest(20, true);
    await adjustRest(15);
    expect(useRestTimerStore.getState().endsAt).toBe('2026-09-14T17:30:35.000Z');
    await adjustRest(-60);
    expect(useRestTimerStore.getState().endsAt).toBe(NOW);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n1');
    expect(scheduledFor()).toEqual(['2026-09-14T17:30:20.000Z', '2026-09-14T17:30:35.000Z', NOW]);
  });

  it('cancels the alert on Skip', async () => {
    await startRest(90, true);
    await stopRest();
    expect(useRestTimerStore.getState().endsAt).toBeNull();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n1');
  });

  it('schedules nothing when rest timer alerts are off (FR-12.5)', async () => {
    await startRest(90, false);
    expect(useRestTimerStore.getState().endsAt).toBe('2026-09-14T17:31:30.000Z');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await adjustRest(15);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('replaces a running rest when the next set is done', async () => {
    await startRest(90, true);
    await startRest(60, true);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n1');
    expect(useRestTimerStore.getState()).toMatchObject({
      endsAt: '2026-09-14T17:31:00.000Z',
      notificationId: 'n2',
    });
  });
});
