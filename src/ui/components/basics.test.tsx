// Core §6.5 components: Button, BottomBar, StatusChip, LoadText, EmptyState (DESIGN §6.2–6.5,
// §7.17, NFR-7).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { flat } from '../../../test/ui/style';
import { colors, touch } from '../tokens';
import { BottomBar } from './BottomBar';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { LoadText } from './LoadText';
import { STATUS_LOOK, StatusChip, type ChipStatus } from './StatusChip';
import type { EffectiveStatus } from '@/core';

describe('Button (§6.5)', () => {
  it('is an accessible button named by its label, and runs its action', async () => {
    const onPress = jest.fn();
    await render(<Button label="Start workout" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is 52 high, above the 48 dp minimum target (§6.4)', async () => {
    await render(<Button label="Start workout" onPress={() => {}} />);
    const style = flat(screen.getByRole('button').props.style);
    expect(style.minHeight).toBe(52);
    expect(style.minHeight).toBeGreaterThanOrEqual(touch.min);
  });

  it('fills primary with plate blue and destructive with plate red', async () => {
    await render(
      <>
        <Button label="Increase all" onPress={() => {}} />
        <Button label="Delete plan" variant="destructive" onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getByRole('button', { name: 'Increase all' }).props.style)).toMatchObject({
      backgroundColor: colors.light.plateBlue,
    });
    expect(flat(screen.getByRole('button', { name: 'Delete plan' }).props.style)).toMatchObject({
      backgroundColor: colors.light.plateRed,
    });
  });

  it('reports and honours the disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button label="Apply" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Apply' });

    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('lets its label wrap at large text sizes rather than truncating', async () => {
    await render(<Button label="Do now and push the rest back" onPress={() => {}} />);
    const label = screen.getByText('Do now and push the rest back');
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.maxFontSizeMultiplier).toBeUndefined();
  });
});

describe('BottomBar (§6.5)', () => {
  it("holds a screen's main actions", async () => {
    await render(
      <BottomBar>
        <Button label="Start workout" onPress={() => {}} />
      </BottomBar>,
    );
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy();
  });
});

describe('StatusChip (§6.2: icon + label, never colour alone)', () => {
  it.each([
    ['completed', '✓', 'Done', colors.light.plateGreen],
    ['missed', '!', 'Missed', colors.light.plateRedText],
    ['skipped', '↷', 'Skipped', colors.light.inkMuted],
    ['today', '●', 'Today', colors.light.plateBlue],
    ['upcoming', '○', 'Upcoming', colors.light.ink],
    ['not_done', '–', 'Not done', colors.light.inkMuted],
    ['in_progress', '▸', 'In progress', colors.light.plateBlue],
    ['paused', '‖', 'Paused', colors.light.inkMuted],
  ] as const)('%s shows %s %s', async (status, icon, label, color) => {
    await render(<StatusChip status={status} />);

    const chip = screen.getByLabelText(label);
    expect(chip).toHaveTextContent(`${icon} ${label}`);
    // The icon is decoration: hidden from screen readers, so the label alone is read aloud.
    expect(screen.queryByText(icon)).toBeNull();
    expect(screen.getByText(icon, { includeHiddenElements: true })).toBeTruthy();
    expect(flat(screen.getByText(label).props.style)).toMatchObject({ color });
  });
});

describe('StatusChip covers every status core derives (D-34)', () => {
  it('has a chip for each EffectiveStatus', () => {
    // Compile-time: the two types must be the same set.
    const same: [ChipStatus] extends [EffectiveStatus]
      ? [EffectiveStatus] extends [ChipStatus]
        ? true
        : false
      : false = true;
    expect(same).toBe(true);
    expect(Object.keys(STATUS_LOOK)).toHaveLength(8);
  });
});

describe('LoadText (§6.5)', () => {
  it.each([
    [{ kg: 82.5, unit: 'kg' }, '82.5 kg', '82.5 kilograms'],
    [{ kg: 79.3786647, unit: 'lb' }, '175 lb', '175 pounds'],
    [{ kg: 22.5, unit: 'kg', perSide: true }, '22.5 kg × 2', '22.5 kilograms each side'],
    [{ kg: 20, unit: 'kg', added: true }, '+20 kg', 'plus 20 kilograms'],
    [{ kg: -10, unit: 'kg', added: true }, '−10 kg', 'minus 10 kilograms'],
    [{ kg: null, unit: 'kg' }, 'BW', 'bodyweight'],
  ] as const)('%j reads "%s", spoken as "%s"', async (props, text, spoken) => {
    await render(<LoadText {...props} />);
    const load = screen.getByLabelText(spoken);
    expect(load).toHaveTextContent(text);
  });

  it('uses tabular figures in the scoreboard style', async () => {
    await render(<LoadText kg={100} unit="kg" variant="scoreboard" />);
    expect(flat(screen.getByText('100 kg').props.style)).toMatchObject({
      fontVariant: ['tabular-nums'],
      fontSize: 40,
    });
  });
});

describe('EmptyState (§6.5)', () => {
  it('shows one sentence and the action that fixes it', async () => {
    const browse = jest.fn();
    await render(
      <EmptyState
        message="No plan yet. Pick a ready-made plan or build your own."
        actions={[{ label: 'Browse templates', onPress: browse }]}
      />,
    );

    expect(screen.getByText('No plan yet. Pick a ready-made plan or build your own.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Browse templates' }));
    expect(browse).toHaveBeenCalled();
  });

  it('makes only the first action primary', async () => {
    await render(
      <EmptyState
        message="No plan yet."
        actions={[
          { label: 'Browse templates', onPress: () => {} },
          { label: 'Build a plan', onPress: () => {} },
        ]}
      />,
    );
    const second = flat(screen.getByRole('button', { name: 'Build a plan' }).props.style);
    expect(second.backgroundColor).not.toBe(colors.light.plateBlue);
  });
});
