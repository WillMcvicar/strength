// The PR board, exercise detail, History and a session's PRs, read from a real migrated database
// after sessions are logged through the services (FR-10.2, FR-10.3, FR-11.1, DESIGN §7.7,
// §7.11, §7.12, C-7).
import type { Db } from '@/data/db';
import { readHistory } from '@/features/history';
import { filterBoard, readExerciseDetail, readPrBoard } from '@/features/progress';
import { readSession } from '@/features/session';
import type { ServiceContext } from '@/services/context';
import { deleteSession } from '@/services/deleteSession';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import {
  aStartedPlan,
  logAndFinish,
  MON,
  NEXT_MON,
  on,
  START,
  WED,
} from '../../test/fixtures/sessions';

let db: Db;
let ctx: ServiceContext;
let planId: string;

beforeEach(async () => {
  db = await openMigratedTestDb();
  ctx = { today: START, now: `${START}T17:00:00.000Z`, newId: idSequence() };
  ({ planId } = await aStartedPlan(db, ctx));
});

afterEach(async () => {
  await db.closeAsync();
});

/** The AC-4 history: bench 80 kg × 5 on Wednesday, then 82.5 kg × 5 the next Monday. */
async function benchTwice() {
  const first = await logAndFinish(db, planId, WED, ctx, {
    skill_bench_press: { loadKg: 80, reps: 5 },
  });
  const second = await logAndFinish(db, planId, NEXT_MON, ctx, {
    skill_bench_press: { loadKg: 82.5, reps: 5 },
  });
  return { first: first.sessionId, second: second.sessionId };
}

describe('AC-4 PR detection', () => {
  it('shows the heaviest and Est. 1RM PRs in the summary and on the PR board', async () => {
    const { second } = await benchTwice();

    const summary = (await readSession(db, second))!.prs;
    expect(summary.firstLog).toEqual([]);
    expect(summary.prs.map((pr) => [pr.skillName, pr.type, pr.value])).toEqual([
      ['Bench press', 'heaviest', 82.5],
      ['Bench press', 'e1rm', 82.5 * (1 + 7 / 30)],
    ]);

    const board = await readPrBoard(db);
    const bench = board.rows.find((row) => row.skillId === 'skill_bench_press');
    expect(bench).toMatchObject({
      name: 'Bench press',
      headline: { type: 'heaviest', value: 82.5, sessionId: second, day: NEXT_MON },
    });
  });
});

describe('First log (C-7)', () => {
  it("names a session's first-ever skills rather than counting them as new PRs", async () => {
    const { first } = await benchTwice();
    const prs = (await readSession(db, first))!.prs;
    expect(prs.prs).toEqual([]);
    // Bench and pull-ups set baselines; the completion-only run sets none (FR-10.1).
    expect(prs.firstLog).toEqual(['Bench press', 'Pull-up']);
  });
});

describe('the PR board (FR-10.3, §7.11)', () => {
  it('lists every logged skill by name, with its headline record or none', async () => {
    await logAndFinish(db, planId, MON, ctx);
    const board = await readPrBoard(db);
    expect(board.unit).toBe('kg');
    expect(board.rows.map((row) => [row.name, row.headline?.type ?? null])).toEqual([
      ['Back squat', 'heaviest'],
      ['Incline dumbbell press', 'heaviest'],
      ['One-arm dumbbell row', 'heaviest'],
      ['Plank', 'longest_time'],
    ]);
    // Per-side loads are marked so they read "30 kg × 2" (FR-1.8).
    expect(board.rows[1]!.headline).toMatchObject({ value: 30, perSide: true });
  });

  it('narrows to names containing the search, ignoring case and spaces', () => {
    const rows = [
      { skillId: 'a', name: 'Back squat', headline: null },
      { skillId: 'b', name: 'Bench press', headline: null },
    ];
    expect(filterBoard(rows, ' SQU ').map((r) => r.skillId)).toEqual(['a']);
    expect(filterBoard(rows, '')).toEqual(rows);
  });
});

describe('exercise detail (§7.11, v1.0)', () => {
  it('shows current PRs, the 1RM history and recent workouts', async () => {
    const { first, second } = await benchTwice();
    const detail = (await readExerciseDetail(db, 'skill_bench_press'))!;
    expect(detail.name).toBe('Bench press');
    expect(detail.prs.map((pr) => [pr.type, pr.value, pr.contextWeightKg])).toEqual([
      ['heaviest', 82.5, null],
      ['e1rm', 82.5 * (1 + 7 / 30), null],
      ['reps_at_weight', 5, 80],
      ['reps_at_weight', 5, 82.5],
    ]);
    expect(detail.oneRmHistory.map((row) => [row.oneRmKg, row.source])).toEqual([
      [100, 'plan_setup'],
    ]);
    expect(detail.recent.map((s) => s.id)).toEqual([second, first]);
    expect(await readExerciseDetail(db, 'nope')).toBeNull();
  });
});

describe('History (FR-11.1, §7.12)', () => {
  it('lists sessions newest first by month, with ★ only for new PRs', async () => {
    const { first, second } = await benchTwice();
    expect(await readHistory(db)).toEqual([
      {
        month: '2026-09',
        sessions: [
          { id: second, localDate: NEXT_MON, name: 'Full body B', durationMin: 60, hasPrs: true },
          // Only first logs: baselines, not new PRs (C-7).
          { id: first, localDate: WED, name: 'Full body B', durationMin: 60, hasPrs: false },
        ],
      },
    ]);
  });

  it('drops a deleted session, and its PRs with it (AC-5)', async () => {
    const { first, second } = await benchTwice();
    await deleteSession(db, { sessionId: second }, on(ctx, NEXT_MON));
    const [month] = await readHistory(db);
    expect(month!.sessions.map((s) => s.id)).toEqual([first]);
    const board = await readPrBoard(db);
    expect(board.rows.find((r) => r.skillId === 'skill_bench_press')!.headline).toMatchObject({
      value: 80,
    });
  });
});
