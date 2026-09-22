// Template detail (FR-2.2, DESIGN §7.4), rendered from view-model states.
import { fireEvent, render, screen } from '@testing-library/react-native';

import TemplateScreen from '../../app/template/[id]';
import { useTemplate, type TemplateDetailView, type TemplateScreenView } from '@/features/plans';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'tpl_beginner_strength' }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/plans', () => ({ useTemplate: jest.fn() }));

const show = (view: TemplateScreenView) => jest.mocked(useTemplate).mockReturnValue(view);

const row = (name: string, sets: number) => ({
  exerciseId: `e-${name}`,
  name,
  sets,
  target: { reps: [5] as const },
  load: null,
  rpe: { min: 7, max: 8 },
  topSet: false,
  restSec: 180,
  inSuperset: false,
});

const TEMPLATE: TemplateDetailView = {
  id: 'tpl_beginner_strength',
  name: 'Beginner Strength',
  description: 'Thirteen weeks of full-body training three days a week.',
  summary: '13 weeks · 3 sessions a week',
  unit: 'kg',
  ribbon: [
    { name: 'Block 1', type: 'training', weeks: 6 },
    { name: 'Deload', type: 'deload', weeks: 1 },
    { name: 'Block 2', type: 'training', weeks: 6 },
  ],
  phases: [
    {
      name: 'Block 1',
      type: 'training',
      length: '6 weeks · 2-week cycle',
      increase: '+2.5 kg each cycle',
    },
    { name: 'Deload', type: 'deload', length: '1 week · 1-week cycle', increase: 'No review' },
  ],
  cycleWeeks: [
    {
      label: 'Week A',
      workouts: [{ id: 'a1', name: 'Full body A', day: 'Monday', rows: [row('Back squat', 5)] }],
    },
    {
      label: 'Week B',
      workouts: [{ id: 'b1', name: 'Full body B', day: 'Monday', rows: [row('Deadlift', 3)] }],
    },
  ],
};

describe('FR-2.2 template detail', () => {
  it('shows the name, description, length, phases and increase rules', async () => {
    show({ status: 'ready', template: TEMPLATE });
    await render(<TemplateScreen />);

    expect(screen.getByText('Beginner Strength')).toBeOnTheScreen();
    expect(screen.getByText(/Thirteen weeks of full-body/)).toBeOnTheScreen();
    expect(screen.getByText('13 weeks · 3 sessions a week')).toBeOnTheScreen();
    expect(screen.getByText('6 weeks · 2-week cycle')).toBeOnTheScreen();
    expect(screen.getByText('+2.5 kg each cycle')).toBeOnTheScreen();
    expect(screen.getByText('No review')).toBeOnTheScreen();
  });

  it('previews Week A, and switches to Week B when its tab is chosen', async () => {
    show({ status: 'ready', template: TEMPLATE });
    await render(<TemplateScreen />);

    expect(screen.getByText('Full body A')).toBeOnTheScreen();
    expect(screen.getByText('Back squat')).toBeOnTheScreen();
    expect(screen.queryByText('Full body B')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Week B'));
    expect(screen.getByText('Full body B')).toBeOnTheScreen();
    expect(screen.getByText('Deadlift')).toBeOnTheScreen();
    expect(screen.queryByText('Back squat')).not.toBeOnTheScreen();
  });

  it('marks the chosen week as the selected tab (NFR-7)', async () => {
    show({ status: 'ready', template: TEMPLATE });
    await render(<TemplateScreen />);
    expect(screen.getByLabelText('Week A').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('Week B').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('offers "Use this template", which Plan setup enables', async () => {
    show({ status: 'ready', template: TEMPLATE });
    await render(<TemplateScreen />);
    expect(screen.getByText('Use this template')).toBeOnTheScreen();
  });

  it('hides the week tabs when the cycle is one week long', async () => {
    show({
      status: 'ready',
      template: { ...TEMPLATE, cycleWeeks: [TEMPLATE.cycleWeeks[0]!] },
    });
    await render(<TemplateScreen />);
    expect(screen.queryByLabelText('Week A')).not.toBeOnTheScreen();
    expect(screen.getByText('Full body A')).toBeOnTheScreen();
  });

  it('explains an unknown template and a failed read', async () => {
    show({ status: 'ready', template: null });
    const { rerender } = await render(<TemplateScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/isn't available/);

    show({ status: 'failed', error: new Error('nope') });
    await rerender(<TemplateScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Close the app/);
  });
});
