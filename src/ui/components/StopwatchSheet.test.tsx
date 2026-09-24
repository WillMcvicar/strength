// StopwatchSheet (DESIGN §7.6 `time` rows): a count-up stopwatch that fills a timed set's value.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StopwatchSheet } from './StopwatchSheet';

let mockNow = '2026-09-14T17:30:00.000Z';
jest.mock('@/features/device', () => ({
  useNow: () => mockNow,
  secondsBetween: (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 1000),
}));

describe('StopwatchSheet (§7.6)', () => {
  it('counts up from Start and saves the time at Stop', async () => {
    const onDone = jest.fn();
    const view = await render(
      <StopwatchSheet
        visible
        title="Plank, set 1 time"
        value={60}
        onDone={onDone}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Start stopwatch' }));

    mockNow = '2026-09-14T17:30:47.400Z';
    await act(async () => {
      await view.rerender(
        <StopwatchSheet
          visible
          title="Plank, set 1 time"
          value={60}
          onDone={onDone}
          onClose={jest.fn()}
        />,
      );
    });
    expect(screen.getByLabelText('47 seconds')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save 0:47' }));
    expect(onDone).toHaveBeenCalledWith(47);
  });

  it('lets the time be typed instead', async () => {
    const onDone = jest.fn();
    await render(
      <StopwatchSheet
        visible
        title="Plank, set 1 time"
        value={60}
        onDone={onDone}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enter it instead' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 5 s' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onDone).toHaveBeenCalledWith(65);
  });
});
