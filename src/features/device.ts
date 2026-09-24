// Device effects for the workout session (DESIGN §6.4, §7.6): a ticking clock for elapsed time
// and the rest countdown, haptics, and keep-awake. The clock is read through services/clock.ts
// (§3.15), so tests can control it.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { now } from '@/services/clock';

/** The current instant as an ISO string, refreshed every `intervalMs`. */
export function useNow(intervalMs = 1000): string {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setCurrent(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return current;
}

/** Whole seconds from `from` to `to`, both ISO timestamps. */
export function secondsBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 1000);
}

/** A light tap on set completion (§6.4). Haptics never block logging. */
export function tapHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** The success pattern on Finish and on PRs (§6.4). */
export function successHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

const KEEP_AWAKE_TAG = 'workout-session';

/** Keeps the screen on while `active`: the session with "keep screen awake" on (FR-12.2). */
export function useKeepAwakeWhile(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active]);
}
