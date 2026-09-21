// The §6.5 components Today is built from: ExerciseCard, WeekStrip, ProgressMeter, PlanRibbon and
// Banner (DESIGN §6.5, §7.2, §7.17, NFR-7).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { flat } from '../../../test/ui/style';
import { colors, touch } from '../tokens';
import { Banner } from './Banner';
import { ExerciseCard } from './ExerciseCard';
import { PlanRibbon } from './PlanRibbon';
import { ProgressMeter } from './ProgressMeter';
import { WeekStrip } from './WeekStrip';

describe('ExerciseCard (§6.5, §7.2)', () => {
  it.each([
    [{ name: 'Squat', sets: 5, target: { reps: [5] } }, '5 × 5', 'Squat, 5 sets of 5 reps'],
    [{ name: 'Squat', sets: 1, target: { reps: [1] } }, '1 × 1', 'Squat, 1 set of 1 rep'],
    [{ name: 'Hang', sets: 1, target: { seconds: 1 } }, '1 × 1 s', 'Hang, 1 set of 1 second'],
    [
      { name: 'Barbell row', sets: 3, target: { reps: [8, 12] } },
      '3 × 8–12',
      'Barbell row, 3 sets of 8 to 12 reps',
    ],
    [
      { name: 'Plank', sets: 3, target: { seconds: 45 } },
      '3 × 45 s',
      'Plank, 3 sets of 45 seconds',
    ],
  ] as const)('%j shows "%s"', async (props, shown, spoken) => {
    await render(<ExerciseCard {...props} />);
    const card = screen.getByLabelText(spoken);
    expect(card).toHaveTextContent(new RegExp(shown));
  });

  it('adds the load to the text and the spoken summary', async () => {
    await render(
      <ExerciseCard name="Squat" sets={5} target={{ reps: [5] }} load={{ kg: 90, unit: 'kg' }} />,
    );
    const card = screen.getByLabelText('Squat, 5 sets of 5 reps, 90 kilograms');
    expect(card).toHaveTextContent(/90 kg/);
  });

  it('marks a superset with a bracket and says so', async () => {
    await render(<ExerciseCard name="Dips" sets={3} target={{ reps: [10] }} inSuperset />);
    expect(screen.getByLabelText('Superset: Dips, 3 sets of 10 reps')).toBeTruthy();
  });
});

describe('WeekStrip (§6.5, §7.2)', () => {
  // Mon 14 – Sun 20 Sep 2026, as in the §7.2 sketch: ✓ · ● · ○ · ·
  const days = [
    { date: '2026-09-14', status: 'completed' },
    { date: '2026-09-15', status: 'rest' },
    { date: '2026-09-16', status: 'today' },
    { date: '2026-09-17', status: 'rest' },
    { date: '2026-09-18', status: 'upcoming' },
    { date: '2026-09-19', status: 'rest' },
    { date: '2026-09-20', status: 'rest' },
  ] as const;

  it('shows the §7.2 sketch: M T W T F S S over ✓ · ● · ○ · ·', async () => {
    await render(<WeekStrip days={days} />);
    const cells = screen.getAllByTestId('week-strip-day');
    expect(cells.map((c) => c.props.accessibilityLabel)).toEqual([
      'Monday 14, done',
      'Tuesday 15, rest day',
      'Wednesday 16, today',
      'Thursday 17, rest day',
      'Friday 18, upcoming',
      'Saturday 19, rest day',
      'Sunday 20, rest day',
    ]);
    for (const [i, text] of ['M✓', 'T·', 'W●', 'T·', 'F○', 'S·', 'S·'].entries()) {
      expect(cells[i]).toHaveTextContent(text);
    }
  });

  it('starts on whichever day it is given, e.g. a Sunday week start (FR-8.1)', async () => {
    await render(
      <WeekStrip days={[{ date: '2026-09-13', status: 'missed' }, ...days.slice(0, 6)]} />,
    );
    const first = screen.getAllByTestId('week-strip-day')[0];
    expect(first.props.accessibilityLabel).toBe('Sunday 13, missed');
    expect(first).toHaveTextContent('S!');
  });

  it('shows a workout under way as in progress (D-34)', async () => {
    await render(<WeekStrip days={[{ date: '2026-09-16', status: 'in_progress' }]} />);
    const cell = screen.getByTestId('week-strip-day');
    expect(cell.props.accessibilityLabel).toBe('Wednesday 16, in progress');
    expect(cell).toHaveTextContent('W▸');
  });
});

describe('ProgressMeter (§6.5, FR-8.3)', () => {
  const progress = { currentWeek: 9, totalWeeks: 13, pctSessions: 0.62, adherence: 0.96 };

  it('shows the §7.2 compact meter: week, sessions % and adherence', async () => {
    await render(<ProgressMeter progress={progress} />);
    expect(screen.getByText('Week 9 of 13')).toBeTruthy();
    expect(screen.getByText('62% · adherence 96%')).toBeTruthy();
  });

  it('exposes the bar as a progress bar with a spoken summary', async () => {
    await render(<ProgressMeter progress={progress} />);
    const bar = screen.getByRole('progressbar', {
      name: 'Week 9 of 13. 62% of workouts done. Adherence 96%.',
    });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 62 });
  });

  it('leaves adherence out until there is something to measure', async () => {
    await render(<ProgressMeter progress={{ ...progress, adherence: null }} />);
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.queryByText(/adherence/i)).toBeNull();
  });

  it('adds completed and total workouts in the full variant', async () => {
    await render(
      <ProgressMeter progress={{ ...progress, completed: 23, total: 37 }} variant="full" />,
    );
    expect(screen.getByText('23 of 37 workouts done')).toBeTruthy();
  });
});

describe('PlanRibbon (§6.1, §6.5, §7.17)', () => {
  // The §7.17 example: "Phase 3 of 5, Strength, week 9 of 17".
  const phases = [
    { name: 'Hypertrophy', type: 'training', weeks: 4 },
    { name: 'Deload', type: 'deload', weeks: 1 },
    { name: 'Strength', type: 'training', weeks: 6 },
    { name: 'Deload', type: 'deload', weeks: 1 },
    { name: 'Peak', type: 'taper', weeks: 5 },
  ] as const;

  it('has the §7.17 text alternative', async () => {
    await render(<PlanRibbon phases={phases} currentWeek={9} />);
    expect(screen.getByLabelText('Phase 3 of 5, Strength, week 9 of 17')).toBeTruthy();
  });

  it('sizes segments by weeks and colours them by phase type', async () => {
    await render(<PlanRibbon phases={phases} currentWeek={9} />);
    const segments = screen.getAllByTestId('ribbon-segment', { includeHiddenElements: true });
    expect(segments.map((s) => flat(s.props.style).flexGrow)).toEqual([4, 1, 6, 1, 5]);
    expect(segments.map((s) => flat(s.props.style).backgroundColor)).toEqual([
      colors.light.plateBlue,
      colors.light.plateGreen,
      colors.light.plateBlue,
      colors.light.plateGreen,
      colors.light.plateYellow,
    ]);
  });

  it('alternates full and 70% tint for consecutive training phases (§6.2)', async () => {
    await render(
      <PlanRibbon
        phases={[
          { name: 'Hypertrophy', type: 'training', weeks: 4 },
          { name: 'Strength', type: 'training', weeks: 4 },
          { name: 'Power', type: 'training', weeks: 4 },
        ]}
        currentWeek={1}
      />,
    );
    const segments = screen.getAllByTestId('ribbon-segment', { includeHiddenElements: true });
    expect(segments.map((s) => flat(s.props.style).opacity ?? 1)).toEqual([1, 0.7, 1]);
  });

  it('marks "you are here" at the current week', async () => {
    await render(<PlanRibbon phases={phases} currentWeek={9} />);
    const marker = screen.getByTestId('ribbon-marker', { includeHiddenElements: true });
    // The middle of week 9 of 17.
    expect(flat(marker.props.style).left).toBe(`${(8.5 / 17) * 100}%`);
  });

  it('opens Plan Detail when tapped, as a 48 dp button', async () => {
    const onPress = jest.fn();
    await render(<PlanRibbon phases={phases} currentWeek={9} onPress={onPress} />);
    const ribbon = screen.getByRole('button', { name: 'Phase 3 of 5, Strength, week 9 of 17' });

    expect(flat(ribbon.props.style).minHeight).toBeGreaterThanOrEqual(touch.min);
    await fireEvent.press(ribbon);
    expect(onPress).toHaveBeenCalled();
  });

  it('describes a plan that has not started yet', async () => {
    await render(<PlanRibbon phases={phases} currentWeek={null} />);
    expect(screen.getByLabelText('5 phases, 17 weeks')).toBeTruthy();
  });
});

describe('Banner (§6.5, §7.2)', () => {
  it('shows an icon, a message and an action, with the action as a 48 dp button', async () => {
    const onPress = jest.fn();
    await render(
      <Banner
        tone="info"
        icon="⚑"
        message="Back up your data"
        action={{ label: 'Export', onPress }}
      />,
    );

    expect(screen.getByText('Back up your data')).toBeTruthy();
    expect(screen.queryByText('⚑')).toBeNull();
    const action = screen.getByRole('button', { name: 'Export' });
    expect(flat(action.props.style).minHeight).toBeGreaterThanOrEqual(touch.min);
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalled();
  });

  it('fills a pending review in yellow, with dark text (§6.2)', async () => {
    await render(
      <Banner
        tone="attention"
        icon="★"
        message="Cycle 3 review is ready"
        action={{ label: 'Review', onPress: () => {} }}
      />,
    );
    const banner = screen.getByTestId('banner');
    expect(flat(banner.props.style).backgroundColor).toBe(colors.light.plateYellow);
    expect(flat(screen.getByText('Cycle 3 review is ready').props.style).color).toBe(
      colors.light.onPlateYellow,
    );
  });
});
