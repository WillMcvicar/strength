// One-time tips (FR-6.2, DESIGN §6.5 TipCard): dismissing one records its key in
// `settings.seen_tips`, so it never shows again.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { dismissTip } from './dismissTip';

let db: Db;
const ctx = { today: '2026-09-14', now: '2026-09-14T17:30:00.000Z', newId: idSequence() };

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('dismissTip (FR-6.2)', () => {
  it('records the tip once, however often it is dismissed', async () => {
    expect(await dismissTip(db, { key: 'tip_rpe_picker' }, ctx)).toEqual({ ok: true });
    await dismissTip(db, { key: 'tip_top_set' }, ctx);
    await dismissTip(db, { key: 'tip_rpe_picker' }, ctx);
    expect((await repositories(db).settings.get()).seenTips).toEqual([
      'tip_rpe_picker',
      'tip_top_set',
    ]);
  });
});
