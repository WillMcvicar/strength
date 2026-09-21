// The first-launch disclaimer acknowledgement (FR-5.2, FR-5.3; DESIGN §7.1 launch rule 2).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { acknowledgeDisclaimer } from './acknowledgeDisclaimer';
import type { ServiceContext } from './context';

let db: Db;
const at = (now: string): ServiceContext => ({ today: now.slice(0, 10), now, newId: idSequence() });

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('acknowledgeDisclaimer (FR-5.2)', () => {
  it('starts unacknowledged on a fresh install (FR-5.1, FR-5.4)', async () => {
    expect((await repositories(db).settings.get()).disclaimerAckAt).toBeNull();
  });

  it('stores the acknowledgement locally with a timestamp', async () => {
    await acknowledgeDisclaimer(db, at('2026-09-21T07:30:00.000Z'));
    expect((await repositories(db).settings.get()).disclaimerAckAt).toBe(
      '2026-09-21T07:30:00.000Z',
    );
  });

  it('keeps the first timestamp if it is somehow acknowledged again (FR-5.3)', async () => {
    await acknowledgeDisclaimer(db, at('2026-09-21T07:30:00.000Z'));
    await acknowledgeDisclaimer(db, at('2026-10-01T18:00:00.000Z'));
    expect((await repositories(db).settings.get()).disclaimerAckAt).toBe(
      '2026-09-21T07:30:00.000Z',
    );
  });
});
