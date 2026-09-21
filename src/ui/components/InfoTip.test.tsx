// The ⓘ next to a term opens its plain-language explanation (FR-6.1, DESIGN §6.5, §7.17).
import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
