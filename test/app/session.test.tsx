// The workout session screen (FR-9, DESIGN §7.6), rendered from view-model states with the
// services, rest timer and device effects mocked.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import SessionScreen from '../../app/session/[id]';
import { startRest, stopRest, useRestTimerStore } from '@/features/restTimer';
import {
  useSession,
  useSessionActions,
  type ActionResult,
  type SessionActions,
  type SessionExerciseView,
  type SessionSetView,
  type SessionView,
} from '@/features/session';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  // Read on use: the factory runs before `mockRouter` is initialised.
  router: {
    back: () => mockRouter.back(),
    replace: (href: string) => mockRouter.replace(href),
    push: (href: string) => mockRouter.push(href),
  },
  useLocalSearchParams: () => ({ id: 's1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/session', () => ({ useSession: jest.fn(), useSessionActions: jest.fn() }));
jest.mock('@/features/skillSearch', () => ({
  useSkillSearch: () => [{ id: 'skill_front_squat', name: 'Front squat' }],
}));
jest.mock('@/features/device', () => ({
  useNow: () => '2026-09-14T17:54:13.000Z',
  secondsBetween: (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 1000,
  tapHaptic: jest.fn(),
  successHaptic: jest.fn(),
  useKeepAwakeWhile: jest.fn(),
}));
jest.mock('@/features/restTimer', () => {
  const state = { endsAt: null as string | null };
  return {
    useRestTimerStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
      state,
    }),
    restRemainingSec: (endsAt: string | null, at: string) =>
      endsAt === null ? null : Math.ceil((Date.parse(endsAt) - Date.parse(at)) / 1000),
    startRest: jest.fn(async () => {}),
    adjustRest: jest.fn(async () => {}),
    stopRest: jest.fn(async () => {}),
  };
});

const ok = async (): Promise<ActionResult> => ({ ok: true });
const actions = {
  completeSet: jest.fn(ok),
  updateSet: jest.fn(ok),
  addSet: jest.fn(ok),
  deleteSet: jest.fn(ok),
  markWarmup: jest.fn(ok),
  markFailed: jest.fn(ok),
  swapExercise: jest.fn(ok),
  addExercise: jest.fn(ok),
  removeExercise: jest.fn(ok),
  exerciseNote: jest.fn(ok),
  details: jest.fn(ok),
  dismissTip: jest.fn(ok),
  discard: jest.fn(ok),
  finish: jest.fn(async () => ({
    ok: true as const,
    summary: {
      name: 'Full body A',
      startedAt: '',
      endedAt: '',
      volumeKg: 0,
      setsCompleted: 0,
      setsIncomplete: 0,
    },
  })),
} as unknown as jest.Mocked<SessionActions>;

const set = (id: string, over: Partial<SessionSetView> = {}): SessionSetView => ({
  id,
  sessionExerciseId: 'e',
  setIndex: 1,
  number: 1,
  isWarmup: false,
  isAmrap: false,
  isTopSet: false,
  prescribedRepsMin: 5,
  prescribedRepsMax: 5,
  prescribedLoadKg: 90,
  prescribedTimeSec: null,
  targetRpeMin: 8,
  targetRpeMax: 8,
  reps: 5,
  loadKg: 90,
  timeSec: null,
  rpe: null,
  status: 'pending',
  completedAt: null,
  prompt: 'required',
  targetRpe: 8,
  target: null,
  ...over,
});

const exercise = (
  id: string,
  name: string,
  sets: SessionSetView[],
  over: Partial<SessionExerciseView> = {},
): SessionExerciseView => ({
  id,
  skillId: `skill_${id}`,
  name,
  exercise: {
    id,
    sessionId: 's1',
    skillId: `skill_${id}`,
    cycleExerciseId: null,
    sortOrder: 1,
    supersetGroup: null,
    restSec: 180,
    notes: null,
    wasSubstituted: false,
    wasAdded: false,
    tmSnapshotKg: null,
    trackingType: 'weight_reps',
    loadConvention: 'total',
    isUnilateral: false,
    isMainLift: false,
    dpIncreaseKg: null,
  },
  restSec: 180,
  supersetGroup: null,
  notes: null,
  tmKg: null,
  increment: 2.5,
  lastTopSet: null,
  sets,
  ...over,
});

const squat = exercise(
  'squat',
  'Back squat',
  [
    set('w1', { isWarmup: true, number: 0, loadKg: 60, prompt: 'none', targetRpe: null }),
    set('q1', { number: 1 }),
    set('q2', { number: 2 }),
  ],
  { tmKg: 112.5 },
);
const row = exercise('row', 'Barbell row', [
  set('r1', { prompt: 'optional', targetRpe: null, targetRpeMin: null, targetRpeMax: null }),
]);

const session = (over: Partial<SessionView> = {}): SessionView => ({
  id: 's1',
  name: 'Full body A',
  kind: 'planned',
  status: 'in_progress',
  startedAt: '2026-09-14T17:30:00.000Z',
  endedAt: null,
  notes: null,
  rpe: null,
  volumeKg: 0,
  setsCompleted: 0,
  setsIncomplete: 4,
  unit: 'kg',
  keepAwake: true,
  restTimerAlerts: true,
  tips: { rpePicker: false, topSet: false },
  exercises: [squat, row],
  ...over,
});

const show = (view: SessionView) =>
  jest.mocked(useSession).mockReturnValue({ status: 'ready', session: view });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSessionActions).mockReturnValue(actions);
  (useRestTimerStore as unknown as { state: { endsAt: string | null } }).state.endsAt = null;
});

describe('AC-31 Per-set RPE', () => {
  it('opens the picker at the target on a main lift, and completes the set only after a tap', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark back squat set 1 done' }));
    // The rest starts at once; the set waits for its RPE.
    expect(startRest).toHaveBeenCalledWith(180, true);
    expect(actions.completeSet).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(/Back squat, set 1, 90 kilograms, 5 reps, pick an RPE to finish it/),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'RPE 8, your target' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Skip RPE' })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'RPE 8, your target' }));
    expect(actions.completeSet).toHaveBeenCalledWith({ setLogId: 'q1', rpe: 8 });
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
  });

  it('completes an accessory set at once, with an optional picker that Skip dismisses', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark barbell row set 1 done' }));
    expect(actions.completeSet).toHaveBeenCalledWith({ setLogId: 'r1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip RPE' }));
    expect(actions.updateSet).not.toHaveBeenCalled();
  });

  it('adds an RPE to a completed accessory set when one is picked', async () => {
    show(session({ exercises: [row] }));
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark barbell row set 1 done' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'RPE 7' }));
    expect(actions.updateSet).toHaveBeenCalledWith({ setLogId: 'r1', rpe: 7 });
  });
});

describe('AC-38 Warm-ups and failed sets', () => {
  it('asks no RPE for a warm-up', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark back squat warm-up done' }));
    expect(actions.completeSet).toHaveBeenCalledWith({ setLogId: 'w1' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('marks a set failed from its menu', async () => {
    show(session());
    await render(<SessionScreen />);

    const q1 = screen.getByLabelText('Back squat, set 1, 90 kilograms, 5 reps, not done');
    await fireEvent(q1, 'accessibilityAction', { nativeEvent: { actionName: 'menu' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Mark as failed' }));
    expect(actions.markFailed).toHaveBeenCalledWith('q1', true);
  });
});

describe('AC-43 Term explanations', () => {
  it('shows a one-time tip with the first RPE picker, and records it once seen', async () => {
    show(session({ tips: { rpePicker: true, topSet: false } }));
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark back squat set 1 done' }));
    expect(screen.getByRole('header', { name: /^Tip:/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'RPE 8, your target' }));
    expect(actions.dismissTip).toHaveBeenCalledWith('tip_rpe_picker');
  });

  it('shows no tip once it has been seen', async () => {
    show(session());
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark back squat set 1 done' }));
    expect(screen.queryByRole('header', { name: /^Tip:/ })).toBeNull();
  });

  it('explains TM beside the exercise with an ⓘ', async () => {
    show(session());
    await render(<SessionScreen />);
    expect(screen.getByText('TM 112.5 kg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What is Training max (TM)?' })).toBeTruthy();
  });
});

describe('the session screen (§7.6)', () => {
  it('shows the header with elapsed time, and keeps the screen awake', async () => {
    const { useKeepAwakeWhile } = jest.requireMock('@/features/device');
    show(session());
    await render(<SessionScreen />);
    expect(screen.getByRole('header', { name: 'Full body A' })).toBeTruthy();
    expect(screen.getByText('24:13')).toBeTruthy();
    expect(useKeepAwakeWhile).toHaveBeenCalledWith(true);
  });

  it('asks for the reps first on an AMRAP set (§7.6)', async () => {
    const amrap = exercise('curl', 'Curl', [
      set('a1', { isAmrap: true, reps: null, prompt: 'optional', targetRpe: null }),
    ]);
    show(session({ exercises: [amrap] }));
    await render(<SessionScreen />);

    expect(screen.getByText('AMRAP')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark curl set 1 done' }));
    expect(actions.completeSet).not.toHaveBeenCalled();
    for (const key of ['1', '2']) await fireEvent.press(screen.getByRole('button', { name: key }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(actions.updateSet).toHaveBeenCalledWith({ setLogId: 'a1', reps: 12 }),
    );
    await waitFor(() => expect(actions.completeSet).toHaveBeenCalledWith({ setLogId: 'a1' }));
  });

  it('edits a load in the display unit and stores kilograms (FR-9.3)', async () => {
    show(session({ unit: 'lb', exercises: [row] }));
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit barbell row set 1 load' }));
    expect(screen.getByLabelText('198.42 lb')).toBeTruthy();
    for (let i = 0; i < 7; i += 1)
      await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    for (const key of ['2', '0', '0'])
      await fireEvent.press(screen.getByRole('button', { name: key }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(actions.updateSet).toHaveBeenCalledWith({ setLogId: 'r1', loadKg: 200 * 0.45359237 }),
    );
  });

  it('fills a timed set from the stopwatch sheet (§7.6)', async () => {
    const plank = exercise('plank', 'Plank', [
      set('p1', { reps: null, loadKg: null, timeSec: 60, prompt: 'none', targetRpe: null }),
    ]);
    plank.exercise.trackingType = 'time';
    show(session({ exercises: [plank] }));
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit plank set 1 time' }));
    expect(screen.getByRole('button', { name: 'Start stopwatch' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enter it instead' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 5 s' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(actions.updateSet).toHaveBeenCalledWith({ setLogId: 'p1', timeSec: 55 }),
    );
  });

  it('rests only after the last exercise of a superset round (§7.6)', async () => {
    const a = exercise('a', 'Curl', [set('a1', { prompt: 'none' })], { supersetGroup: 'g' });
    const b = exercise('b', 'Pushdown', [set('b1', { prompt: 'none' })], { supersetGroup: 'g' });
    show(session({ exercises: [a, b] }));
    await render(<SessionScreen />);

    const first = screen.getByRole('checkbox', { name: 'Mark curl set 1 done' });
    const second = screen.getByRole('checkbox', { name: 'Mark pushdown set 1 done' });
    await fireEvent.press(first);
    await waitFor(() => expect(actions.completeSet).toHaveBeenCalledTimes(1));
    expect(startRest).not.toHaveBeenCalled();
    await fireEvent.press(second);
    await waitFor(() => expect(startRest).toHaveBeenCalledWith(180, true));
  });

  it('shows the rest timer while a rest runs, and skips it', async () => {
    (useRestTimerStore as unknown as { state: { endsAt: string } }).state.endsAt =
      '2026-09-14T17:55:55.000Z';
    show(session());
    await render(<SessionScreen />);
    expect(screen.getByText('Rest 1:42')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
    expect(stopRest).toHaveBeenCalled();
  });

  it('says in plain words when a set cannot be logged', async () => {
    actions.completeSet.mockResolvedValueOnce({ ok: false, message: 'Enter the weight you used.' });
    show(session({ exercises: [row] }));
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark barbell row set 1 done' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the weight you used.');
  });

  it('adds a set, and swaps or adds an exercise from the Skill picker (FR-9.4)', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: '+ Add set' })[0]!);
    expect(actions.addSet).toHaveBeenCalledWith('squat');

    await fireEvent.press(screen.getByRole('button', { name: 'More for Back squat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Swap exercise' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Front squat' }));
    expect(actions.swapExercise).toHaveBeenCalledWith('squat', 'skill_front_squat');

    await fireEvent.press(screen.getByRole('button', { name: '+ Add exercise' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Front squat' }));
    expect(actions.addExercise).toHaveBeenCalledWith('skill_front_squat');
  });

  it('saves an exercise note and the session effort (FR-9.7)', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'More for Back squat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add note' }));
    await fireEvent.changeText(screen.getByLabelText('Note for Back squat'), 'Belt on');
    await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    expect(actions.exerciseNote).toHaveBeenCalledWith('squat', 'Belt on');

    await fireEvent.press(screen.getByRole('radio', { name: 'Effort 7 of 10' }));
    expect(actions.details).toHaveBeenCalledWith({ rpe: 7 });
  });
});

describe('finishing and leaving (FR-9.8, FR-9.9, FR-9.11)', () => {
  it('asks before finishing with sets left, then shows the summary', async () => {
    show(session());
    await render(<SessionScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByText('4 sets aren’t done.')).toBeTruthy();
    await fireEvent.press(
      within(screen.getByRole('header', { name: 'Finish anyway?' }).parent!.parent!).getByRole(
        'button',
        { name: 'Finish workout' },
      ),
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/session/summary/s1'));
    expect(actions.finish).toHaveBeenCalled();
    expect(stopRest).toHaveBeenCalled();
  });

  it('finishes straight away when every set is done', async () => {
    show(session({ setsIncomplete: 0 }));
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    await waitFor(() => expect(actions.finish).toHaveBeenCalled());
  });

  it('lists sets still waiting for an RPE before finishing', async () => {
    show(session({ setsIncomplete: 0 }));
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark back squat set 1 done' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByText('Still waiting for an RPE: Back squat set 1.')).toBeTruthy();
  });

  it('saves and exits, keeping the session in progress', async () => {
    show(session());
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save and exit' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(actions.discard).not.toHaveBeenCalled();
  });

  it('discards only after confirming (FR-9.11)', async () => {
    show(session());
    await render(<SessionScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
    expect(actions.discard).not.toHaveBeenCalled();
    expect(screen.getByText(/Every set you logged in it will be deleted/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
    await waitFor(() => expect(actions.discard).toHaveBeenCalled());
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('says so when the session has already finished', async () => {
    show(session({ status: 'completed' }));
    await render(<SessionScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/isn’t in progress any more/);
  });
});
