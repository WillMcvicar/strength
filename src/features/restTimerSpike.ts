// Development-only spike (DESIGN §2.6, docs/BUILD_PLAN.md Slice 6): how late does a rest-timer
// notification fire on Android when the phone is locked? Each run schedules one local notification
// and records when it was due. When the app comes back to the foreground, the delivery time is read
// from the notification tray, so the lateness is measured by the OS rather than guessed.
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { now } from '@/services/clock';

const CHANNEL = 'rest-timer-spike';

export type SpikeRun = {
  id: string;
  delaySec: number;
  dueAt: string;
  /** When the OS posted the notification, or null until it is seen. */
  deliveredAt: string | null;
};

/** Seconds late (negative means early), or null until delivered. */
export function lateBySec(run: SpikeRun): number | null {
  if (!run.deliveredAt) return null;
  return (Date.parse(run.deliveredAt) - Date.parse(run.dueAt)) / 1000;
}

export function useRestTimerSpike(): {
  runs: SpikeRun[];
  error: string | null;
  schedule: (delaySec: number) => Promise<void>;
  clear: () => void;
} {
  const [runs, setRuns] = useState<SpikeRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const markDelivered = useCallback((id: string, deliveredAt: string) => {
    setRuns((all) => all.map((r) => (r.id === id && !r.deliveredAt ? { ...r, deliveredAt } : r)));
  }, []);

  // Foreground: show the banner, and the listener fires as the notification arrives.
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) =>
      markDelivered(n.request.identifier, new Date(n.date).toISOString()),
    );
    return () => sub.remove();
  }, [markDelivered]);

  // Background or locked: read the posted time from the tray on return.
  useEffect(() => {
    const readTray = async () => {
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const n of presented) {
        markDelivered(n.request.identifier, new Date(n.date).toISOString());
      }
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void readTray();
    });
    return () => sub.remove();
  }, [markDelivered]);

  const schedule = useCallback(async (delaySec: number) => {
    setError(null);
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Notification permission was not granted.');
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Rest timer (spike)',
          importance: Notifications.AndroidImportance.MAX,
        });
      }
      const scheduledAt = now();
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: 'Rest over', body: `${delaySec} s rest timer (spike)` },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySec,
          channelId: CHANNEL,
        },
      });
      const dueAt = new Date(Date.parse(scheduledAt) + delaySec * 1000).toISOString();
      setRuns((all) => [{ id, delaySec, dueAt, deliveredAt: null }, ...all]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const clear = useCallback(() => {
    void Notifications.dismissAllNotificationsAsync();
    setRuns([]);
  }, []);

  return { runs, error, schedule, clear };
}
