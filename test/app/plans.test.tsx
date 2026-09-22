// The Plans tab (FR-2.1, FR-2.2, DESIGN §7.4), rendered from view-model states.
import { fireEvent, render, screen } from '@testing-library/react-native';

import PlansScreen from '../../app/(tabs)/plans';
import { usePlans, type PlansScreenView } from '@/features/plans';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/features/plans', () => ({ usePlans: jest.fn() }));

const show = (view: PlansScreenView) => jest.mocked(usePlans).mockReturnValue(view);

const TEMPLATES = [
  { id: 'tpl_beginner_strength', name: 'Beginner Strength', summary: '13 wk · 3/wk' },
  { id: 'tpl_beginner_hypertrophy', name: 'Beginner Hypertrophy', summary: '13 wk · 3/wk' },
];

const ready = (over: Partial<Omit<PlansScreenView & { status: 'ready' }, 'status'>> = {}) =>
  show({ status: 'ready', active: null, myPlans: [], templates: TEMPLATES, ...over });

beforeEach(() => {
  mockPush.mockClear();
});

describe('FR-2.1 the Plans tab', () => {
  it('lists the built-in templates with their length and sessions a week', async () => {
    ready();
    await render(<PlansScreen />);
    expect(screen.getByText('Beginner Strength')).toBeOnTheScreen();
    expect(screen.getByText('Beginner Hypertrophy')).toBeOnTheScreen();
    expect(screen.getAllByText('13 wk · 3/wk')).toHaveLength(2);
  });

  it('FR-2.2 opens a template when its row is tapped', async () => {
    ready();
    await render(<PlansScreen />);
    await fireEvent.press(screen.getByLabelText('Beginner Strength, 13 wk · 3/wk'));
    expect(mockPush).toHaveBeenCalledWith('/template/tpl_beginner_strength');
  });

  it('points at the templates when there is no active plan', async () => {
    ready();
    await render(<PlansScreen />);
    expect(screen.getByText(/No active plan/)).toBeOnTheScreen();
    expect(screen.queryByText('Active')).not.toBeOnTheScreen();
  });

  it('shows the active plan with its week, and no "My plans" section when empty', async () => {
    ready({
      active: {
        id: 'plan',
        name: 'Beginner Strength',
        header: 'Week 9 of 13',
        currentWeek: 9,
        ribbon: [
          { name: 'Block 1', type: 'training', weeks: 6 },
          { name: 'Deload', type: 'deload', weeks: 1 },
          { name: 'Block 2', type: 'training', weeks: 6 },
        ],
      },
    });
    await render(<PlansScreen />);
    expect(screen.getByText('Active')).toBeOnTheScreen();
    expect(screen.getByText('Week 9 of 13')).toBeOnTheScreen();
    expect(screen.queryByText('My plans')).not.toBeOnTheScreen();
  });

  it('lists drafts and ended plans under "My plans"', async () => {
    ready({
      myPlans: [
        { id: 'a', name: 'Beginner Hypertrophy', status: 'draft', subtitle: 'Draft · 13 weeks' },
        { id: 'b', name: 'Old plan', status: 'completed', subtitle: 'Completed · 13 weeks' },
      ],
    });
    await render(<PlansScreen />);
    expect(screen.getByText('My plans')).toBeOnTheScreen();
    expect(screen.getByText('Draft · 13 weeks')).toBeOnTheScreen();
    expect(screen.getByText('Completed · 13 weeks')).toBeOnTheScreen();
  });

  it('renders nothing while loading and an alert when the read fails', async () => {
    show({ status: 'loading' });
    const { rerender } = await render(<PlansScreen />);
    expect(screen.queryByText('Plans')).not.toBeOnTheScreen();

    show({ status: 'failed', error: new Error('nope') });
    await rerender(<PlansScreen />);
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});
