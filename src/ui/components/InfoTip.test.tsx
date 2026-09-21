// The ⓘ next to a term opens its plain-language explanation (FR-6.1, DESIGN §6.5, §7.17).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { flat } from '../../../test/ui/style';
import { touch } from '../tokens';
import { InfoTip } from './InfoTip';

describe('InfoTip and TermSheet (FR-6.1)', () => {
  it('is a 48 dp button named after the term', async () => {
    await render(<InfoTip term="tm" />);
    const tip = screen.getByRole('button', { name: 'What is Training max (TM)?' });
    const style = flat(tip.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(touch.min);
    expect(style.minHeight).toBeGreaterThanOrEqual(touch.min);
  });

  it('opens the explanation and closes it again', async () => {
    await render(<InfoTip term="tm" />);
    expect(screen.queryByText(/slightly reduced version of your 1RM/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'What is Training max (TM)?' }));
    expect(screen.getByRole('header', { name: 'Training max (TM)' })).toBeTruthy();
    expect(screen.getByText(/slightly reduced version of your 1RM/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/slightly reduced version of your 1RM/)).toBeNull();
  });

  it('returns screen-reader focus to the ⓘ when the sheet closes (§7.17)', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await render(<InfoTip term="tm" />);
    const tip = screen.getByRole('button', { name: 'What is Training max (TM)?' });
    // The previous test's sheet closing can report late; only this test's calls count.
    focus.mockClear();

    await fireEvent.press(tip);
    expect(focus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    focus.mockRestore();
  });
});

describe('TermSheet motion (§6.4)', () => {
  let listener: ((reduce: boolean) => void) | undefined;

  beforeEach(() => {
    listener = undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler as unknown as (reduce: boolean) => void;
      return { remove: jest.fn() } as never;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const openSheet = async () => {
    await render(<InfoTip term="deload" />);
    await fireEvent.press(screen.getByRole('button', { name: 'What is Deload?' }));
    return screen.getByTestId('term-sheet', { includeHiddenElements: true });
  };

  it('slides in by default', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    expect((await openSheet()).props.animationType).toBe('slide');
  });

  it('appears without animation when the OS asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    expect((await openSheet()).props.animationType).toBe('none');
  });

  it('follows the setting when it changes while the app is open', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await openSheet();
    await act(async () => listener?.(true));
    expect(
      screen.getByTestId('term-sheet', { includeHiddenElements: true }).props.animationType,
    ).toBe('none');
  });
});
