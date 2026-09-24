// Finishing onboarding (FR-12.1, DESIGN §7.15, §7.1 launch rule 3).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import type { ServiceContext } from './context';
import { completeOnboarding } from './completeOnboarding';

let db: Db;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  ctx = { today: '2026-09-16', now: '2026-09-16T09:00:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

describe('DESIGN §7.15 finishing onboarding', () => {
  it('saves the chosen unit and closes launch rule 3', async () => {
    expect((await repositories(db).settings.get()).onboardingCompletedAt).toBeNull();

    await completeOnboarding(db, 'lb', ctx);

    expect(await repositories(db).settings.get()).toMatchObject({
      unit: 'lb',
      onboardingCompletedAt: ctx.now,
    });
  });

  it('defaults to kg when that is what the user chose', async () => {
    await completeOnboarding(db, 'kg', ctx);
    expect((await repositories(db).settings.get()).unit).toBe('kg');
  });

  it('FR-5.3: the first run stands, so a second call changes nothing', async () => {
    await completeOnboarding(db, 'lb', ctx);
    await completeOnboarding(db, 'kg', { ...ctx, now: '2027-01-01T00:00:00.000Z' });

    expect(await repositories(db).settings.get()).toMatchObject({
      unit: 'lb',
      onboardingCompletedAt: '2026-09-16T09:00:00.000Z',
    });
  });
});
