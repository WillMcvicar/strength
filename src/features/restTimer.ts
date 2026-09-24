// The rest timer (FR-9.6, DESIGN §2.6, D-39). The end time is kept in memory in this store and
// never stored; the countdown is always worked out from it, so it stays right after the app is
// backgrounded. A local notification is scheduled for the end time when rest timer alerts are on,
// and rescheduled on ±15 s; Skip cancels it. Permission is asked the first time a timer runs.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { now } from '@/services/clock';

const CHANNEL = 'rest-timer';

interface RestTimerState {
  /** ISO end time, or null when no rest is running. */
  endsAt: string | null;
  notificationId: string | null;
  /** Whether alerts were on when this rest started. */
  alerts: boolean;
}

export const useRestTimerStore = create<RestTimerState>(() => ({
  endsAt: null,
  notificationId: null,
  alerts: false,
}));

let permission: Promise<boolean> | null = null;

/** Asked once per launch, the first time a timer runs (§2.6). */
function allowed(): Promise<boolean> {
  permission ??= (async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => false);
  return permission;
}

async function cancel(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

async function schedule(endsAt: string): Promise<string | null> {
  if (!(await allowed())) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over', body: 'Time for your next set.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(endsAt),
      channelId: CHANNEL,
    },
  }).catch(() => null);
}

const plus = (iso: string, sec: number) => new Date(Date.parse(iso) + sec * 1000).toISOString();

/** Starts (or restarts) the rest for `restSec` from now. */
export async function startRest(restSec: number, alerts: boolean): Promise<void> {
  const previous = useRestTimerStore.getState().notificationId;
  const endsAt = plus(now(), restSec);
  useRestTimerStore.setState({ endsAt, notificationId: null, alerts });
  await cancel(previous);
  if (!alerts) return;
  const id = await schedule(endsAt);
  // A newer start or a skip may have landed while this was scheduling.
  if (useRestTimerStore.getState().endsAt === endsAt) {
    useRestTimerStore.setState({ notificationId: id });
  } else {
    await cancel(id);
  }
}

/** −15 s / +15 s (§7.6). The countdown never goes below now. */
export async function adjustRest(deltaSec: number): Promise<void> {
  const { endsAt, notificationId, alerts } = useRestTimerStore.getState();
  if (!endsAt) return;
  const current = now();
  const next = plus(endsAt, deltaSec);
  const clamped = Date.parse(next) < Date.parse(current) ? current : next;
  useRestTimerStore.setState({ endsAt: clamped, notificationId: null });
  await cancel(notificationId);
  if (!alerts) return;
  const id = await schedule(clamped);
  if (useRestTimerStore.getState().endsAt === clamped) {
    useRestTimerStore.setState({ notificationId: id });
  } else {
    await cancel(id);
  }
}

/** Skip, or the session ending: no rest, and no alert. */
export async function stopRest(): Promise<void> {
  const { notificationId } = useRestTimerStore.getState();
  useRestTimerStore.setState({ endsAt: null, notificationId: null });
  await cancel(notificationId);
}

/** Seconds of rest left, rounded up, at `at`; null when no rest is running. */
export function restRemainingSec(endsAt: string | null, at: string): number | null {
  if (!endsAt) return null;
  return Math.ceil((Date.parse(endsAt) - Date.parse(at)) / 1000);
}
