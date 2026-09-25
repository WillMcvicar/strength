// The PR log and the history queries (FR-10, FR-11, DESIGN §3.13, §4.7).
import type { PersonalRecord, Session, SessionExercise, SetLog } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';

let db: Db;
let repos: Repositories;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
});

afterEach(async () => {
  await db.closeAsync();
});

const day = (i: number) =>
  new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

const aSession = (id: string, i: number, over: Partial<Session> = {}): Session => ({
  id,
  planId: null,
  plannedWorkoutId: null,
  phaseId: null,
  cycleGroupId: null,
  phaseCycleIndex: null,
  name: 'Workout',
  kind: 'ad_hoc',
  localDate: day(i),
  startedAt: `${day(i)}T17:00:00.000Z`,
  endedAt: `${day(i)}T18:00:00.000Z`,
  status: 'completed',
  notes: null,
  rpe: null,
  totalVolumeKg: null,
  updatedAt: `${day(i)}T18:00:00.000Z`,
  ...over,
});

const anExercise = (id: string, sessionId: string, skillId: string, sortOrder: number) =>
  ({
    id,
    sessionId,
    skillId,
    cycleExerciseId: null,
    sortOrder,
    supersetGroup: null,
    restSec: null,
    notes: null,
    wasSubstituted: false,
    wasAdded: true,
    tmSnapshotKg: null,
    trackingType: 'weight_reps',
    loadConvention: 'total',
    isUnilateral: false,
    isMainLift: false,
    dpIncreaseKg: null,
  }) satisfies SessionExercise;

const aSet = (id: string, exerciseId: string, setIndex: number, over: Partial<SetLog> = {}) =>
  ({
    id,
    sessionExerciseId: exerciseId,
    setIndex,
    isWarmup: false,
    isAmrap: false,
    isTopSet: false,
    prescribedRepsMin: null,
    prescribedRepsMax: null,
    prescribedLoadKg: null,
    prescribedTimeSec: null,
    targetRpeMin: null,
    targetRpeMax: null,
    reps: 5,
    loadKg: 100,
    timeSec: null,
    rpe: null,
    status: 'completed',
    completedAt: null,
    ...over,
  }) satisfies SetLog;

const aRecord = (id: string, over: Partial<PersonalRecord> = {}): PersonalRecord => ({
  id,
  skillId: 'skill_back_squat',
  type: 'heaviest',
  value: 100,
  contextWeightKg: null,
  sessionId: null,
  setLogId: null,
  achievedAt: '2024-01-01T17:00:00.000Z',
  isManual: false,
  note: null,
  ...over,
});

describe('personal record repository', () => {
  it('keeps manual records when clearing logged ones for a replay (FR-10.6)', async () => {
    await repos.prs.insertMany([
      aRecord('logged'),
      aRecord('manual', { isManual: true }),
      aRecord('bench', { skillId: 'skill_bench_press' }),
    ]);
    await repos.prs.deleteLogged(['skill_back_squat']);
    expect((await repos.prs.all()).map((r) => r.id)).toEqual(['manual', 'bench']);
    await repos.prs.deleteLogged([]);
    await repos.prs.insertMany([]);
    expect(await repos.prs.all()).toHaveLength(2);
  });

  it('lists by session and by skill in the order records were set, and drops a deleted session’s', async () => {
    await repos.sessions.insert(aSession('s1', 0));
    await repos.sessions.insert(aSession('s2', 1));
    // Same moment, inserted heaviest first: insertion order breaks the tie.
    const at = '2024-01-01T17:10:00.000Z';
    await repos.prs.insertMany([
      aRecord('z', { sessionId: 's1', achievedAt: at }),
      aRecord('a', { sessionId: 's1', type: 'e1rm', achievedAt: at }),
      aRecord('later', { sessionId: 's2', achievedAt: '2024-01-02T17:10:00.000Z' }),
    ]);
    expect((await repos.prs.bySession('s1')).map((r) => r.id)).toEqual(['z', 'a']);
    expect((await repos.prs.bySessions(['s2', 's1'])).map((r) => r.id)).toEqual([
      'z',
      'a',
      'later',
    ]);
    expect(await repos.prs.bySessions([])).toEqual([]);
    expect((await repos.prs.bySkills(['skill_back_squat'])).map((r) => r.id)).toEqual([
      'z',
      'a',
      'later',
    ]);
    expect(await repos.prs.bySkills([])).toEqual([]);

    await repos.sessions.delete('s1');
    expect((await repos.prs.all()).map((r) => r.id)).toEqual(['later']);
  });
});

describe('history queries (FR-11.1, §7.11)', () => {
  it('lists completed sessions newest first, and the skills they logged', async () => {
    await repos.sessions.insert(aSession('old', 0));
    await repos.sessions.insert(aSession('new', 5));
    await repos.sessions.insert(aSession('open', 6, { status: 'in_progress', endedAt: null }));
    await repos.sessions.insertExercise(anExercise('e1', 'old', 'skill_back_squat', 1));
    await repos.sessions.insertExercise(anExercise('e2', 'new', 'skill_back_squat', 1));
    await repos.sessions.insertExercise(anExercise('e3', 'new', 'skill_bench_press', 2));
    await repos.sessions.insertExercise(anExercise('e4', 'open', 'skill_deadlift', 1));
    await repos.sessions.insertSet(aSet('x1', 'e1', 1));
    await repos.sessions.insertSet(aSet('x2', 'e2', 1));
    await repos.sessions.insertSet(aSet('x3', 'e3', 1, { status: 'pending' }));
    await repos.sessions.insertSet(aSet('x4', 'e4', 1));

    expect((await repos.sessions.completed()).map((s) => s.id)).toEqual(['new', 'old']);
    expect(await repos.sessions.loggedSkillIds()).toEqual(['skill_back_squat']);
    expect(
      (await repos.sessions.completedWithSkill('skill_back_squat', 1)).map((s) => s.id),
    ).toEqual(['new']);
  });
});

describe('query performance (§4.7, NFR-5)', () => {
  it('answers history and PR queries in under 50 ms with 500 sessions × 40 sets', async () => {
    const skills = ['skill_back_squat', 'skill_bench_press', 'skill_deadlift', 'skill_barbell_row'];
    await db.withExclusiveTransactionAsync(async (tx) => {
      const r = repositories(tx);
      for (let i = 0; i < 500; i += 1) {
        const sessionId = `s${i}`;
        await r.sessions.insert(aSession(sessionId, i));
        for (const [e, skillId] of skills.entries()) {
          const exerciseId = `${sessionId}e${e}`;
          await r.sessions.insertExercise(anExercise(exerciseId, sessionId, skillId, e + 1));
          for (let k = 1; k <= 10; k += 1) {
            const minute = String(e * 10 + k).padStart(2, '0');
            await r.sessions.insertSet(
              aSet(`${exerciseId}s${k}`, exerciseId, k, {
                loadKg: 60 + (i % 50),
                completedAt: `${day(i)}T17:${minute}:00.000Z`,
              }),
            );
          }
          await r.prs.insertMany([
            aRecord(`${exerciseId}pr`, {
              skillId,
              sessionId,
              value: 60 + i,
              achievedAt: `${day(i)}T17:${String(e * 10 + 1).padStart(2, '0')}:00.000Z`,
            }),
          ]);
        }
      }
    });

    const timed = async (query: () => Promise<unknown>) => {
      const start = performance.now();
      await query();
      return performance.now() - start;
    };
    const ids = (await repos.sessions.completed()).slice(0, 50).map((s) => s.id);
    const times = {
      history: await timed(() => repos.sessions.completed()),
      historyPrs: await timed(() => repos.prs.bySessions(ids)),
      board: await timed(() => repos.sessions.loggedSkillIds()),
      boardPrs: await timed(() => repos.prs.all()),
      skillPrs: await timed(() => repos.prs.bySkills(['skill_back_squat'])),
      recent: await timed(() => repos.sessions.completedWithSkill('skill_back_squat', 10)),
      replay: await timed(() => repos.sessions.prSets(['skill_back_squat'])),
    };
    for (const [query, ms] of Object.entries(times)) {
      expect({ query, fast: ms < 50 }).toEqual({ query, fast: true });
    }
  }, 60_000);
});
