// The context every service call gets (DESIGN §3.15): the clock is read here, at the outermost
// call, and new IDs are UUID v4 (DESIGN §4).
import { randomUUID } from 'expo-crypto';

import { now, today } from '@/services/clock';
import type { ServiceContext } from '@/services/context';

export function serviceContext(): ServiceContext {
  return { today: today(), now: now(), newId: randomUUID };
}
