// The logging components: RpePicker, NumberSheet, SetRow and RestTimerBar (DESIGN §6.5, §7.6,
// §7.17; FR-9.2, FR-9.2a, FR-9.3, FR-9.6, NFR-7).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { flat } from '../../../test/ui/style';
import type { RowExercise, RowSet } from '../setText';
import { touch } from '../tokens';
import { NumberSheet } from './NumberSheet';
import { RestTimerBar } from './RestTimerBar';
import { RPE_VALUES, RpePicker } from './RpePicker';
import { SetRow } from './SetRow';

const barbell: RowExercise = {
  trackingType: 'weight_reps',
  loadConvention: 'total',
  isUnilateral: false,
};

const pending = (over: Partial<RowSet> = {}): RowSet => ({
  isWarmup: false,
  isTopSet: false,
  isAmrap: false,
  reps: 5,
  loadKg: 90,
  timeSec: null,
  rpe: null,
  status: 'pending',
  ...over,
});

describe('AC-31 Per-set RPE', () => {
  it('pre-highlights the target on a main lift and offers no way to skip it', async () => {
    const onPick = jest.fn();
    await render(<RpePicker target={8} required onPick={onPick} onSkip={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'RPE 8, your target' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Skip RPE' })).toBeNull();
    // One tap on the pre-highlighted value logs it.
    await fireEvent.press(screen.getByRole('radio', { name: 'RPE 8, your target' }));
    expect(onPick).toHaveBeenCalledWith(8);
  });

  it('lets an accessory set dismiss the picker with the RPE left empty', async () => {
    const onSkip = jest.fn();
    await render(<RpePicker target={null} required={false} onPick={jest.fn()} onSkip={onSkip} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Skip RPE' }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('RpePicker (§6.5)', () => {
  it('offers 6 to 10 in half steps as 48 dp chips', async () => {
    await render(<RpePicker target={null} required onPick={jest.fn()} />);
    const chips = screen.getAllByRole('radio');
    expect(chips).toHaveLength(9);
    expect(RPE_VALUES).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
    for (const chip of chips) {
      expect(flat(chip.props.style).minHeight).toBeGreaterThanOrEqual(touch.min);
    }
  });
});

describe('SetRow (§7.6)', () => {
  it('is read as one element, with the actions exposed (§7.17)', async () => {
    const onDone = jest.fn();
    const onEditLoad = jest.fn();
    await render(
      <SetRow
        number={2}
        set={pending({ loadKg: 100 })}
        exercise={barbell}
        unit="kg"
        onDone={onDone}
        onEditLoad={onEditLoad}
        onEditReps={jest.fn()}
      />,
    );
    const row = screen.getByLabelText('Set 2, 100 kilograms, 5 reps, not done');
    expect(row.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
      'Mark done',
      'Edit load',
      'Edit reps',
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'markDone' } });
    expect(onDone).toHaveBeenCalled();
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'editLoad' } });
    expect(onEditLoad).toHaveBeenCalled();
  });

  it('marks the set done with one tap on a 56 dp check (FR-9.2)', async () => {
    const onDone = jest.fn();
    await render(
      <SetRow number={2} set={pending()} exercise={barbell} unit="kg" onDone={onDone} />,
    );
    const check = screen.getByRole('checkbox', { name: 'Mark set 2 done' });
    expect(flat(check.props.style)).toMatchObject({ width: touch.setDone, height: touch.setDone });

    await fireEvent.press(check);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('opens the editors from the load and reps cells, before or after ✓ (FR-9.3)', async () => {
    const onEditLoad = jest.fn();
    const onEditReps = jest.fn();
    await render(
      <SetRow
        number={1}
        set={pending({ status: 'completed', rpe: 8 })}
        exercise={barbell}
        unit="kg"
        onDone={jest.fn()}
        onEditLoad={onEditLoad}
        onEditReps={onEditReps}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Edit set 1 load' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit set 1 reps' }));
    expect(onEditLoad).toHaveBeenCalled();
    expect(onEditReps).toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Mark set 1 done' })).toBeChecked();
  });

  it('shows "Pick RPE" while a required RPE is outstanding', async () => {
    await render(
      <SetRow
        number={1}
        set={pending()}
        exercise={barbell}
        unit="kg"
        awaitingRpe
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByText('RPE?')).toBeTruthy();
    expect(screen.getByLabelText(/pick an RPE to finish it/)).toBeTruthy();
  });

  it('labels a top set "TOP" with its target underneath (FR-9.2b)', async () => {
    await render(
      <SetRow
        number={1}
        set={pending({ isTopSet: true, loadKg: 97.5, reps: 1 })}
        exercise={barbell}
        unit="kg"
        target="Work up to 1–3 @ RPE 8"
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByText('TOP')).toBeTruthy();
    expect(screen.getByText('Work up to 1–3 @ RPE 8')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mark top set done' })).toBeTruthy();
  });

  it('shows per-side, unilateral and weighted bodyweight sets as §7.6 says', async () => {
    await render(
      <>
        <SetRow
          number={1}
          set={pending({ loadKg: 22.5 })}
          exercise={{ ...barbell, loadConvention: 'per_side' }}
          unit="kg"
          onDone={jest.fn()}
        />
        <SetRow
          number={1}
          set={pending({ loadKg: 20, reps: 8 })}
          exercise={{ ...barbell, isUnilateral: true }}
          unit="kg"
          onDone={jest.fn()}
        />
        <SetRow
          number={1}
          set={pending({ loadKg: 20 })}
          exercise={{ ...barbell, trackingType: 'bodyweight_plus_load' }}
          unit="kg"
          onDone={jest.fn()}
        />
      </>,
    );
    expect(screen.getByText('22.5 kg × 2')).toBeTruthy();
    expect(screen.getByText('8 each side')).toBeTruthy();
    expect(screen.getByText('BW +20 kg')).toBeTruthy();
  });

  it('is a single large checkbox for a completion-only item (AC-37)', async () => {
    const onDone = jest.fn();
    await render(
      <SetRow
        number={1}
        set={pending({ reps: null, loadKg: null })}
        exercise={{ ...barbell, trackingType: 'completion_only' }}
        unit="kg"
        name="Easy run"
        onDone={onDone}
      />,
    );
    expect(screen.getByLabelText('Easy run, not done')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Easy run done' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('marks failed sets with a word as well as a symbol', async () => {
    await render(
      <SetRow
        number={1}
        set={pending({ status: 'failed', loadKg: 150, reps: 1 })}
        exercise={barbell}
        unit="kg"
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByLabelText('Set 1, 150 kilograms, 1 rep, failed')).toBeTruthy();
  });
});

describe('NumberSheet (§6.5)', () => {
  const sheet = (over: Partial<Parameters<typeof NumberSheet>[0]> = {}) => {
    const onDone = jest.fn();
    const props = {
      visible: true,
      title: 'Squat, set 2 load',
      value: 90,
      suffix: 'kg',
      step: 2.5,
      onDone,
      onClose: jest.fn(),
      ...over,
    };
    return { props, onDone };
  };

  it('steps the value by the increment and saves it', async () => {
    const { props, onDone } = sheet();
    await render(<NumberSheet {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 2.5 kg' }));
    expect(screen.getByLabelText('92.5 kg')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onDone).toHaveBeenCalledWith(92.5);
  });

  it('types on its own keypad, keeping a part-typed decimal', async () => {
    const { props, onDone } = sheet({ value: null });
    await render(<NumberSheet {...props} />);
    for (const key of ['9', '2', 'Decimal point', '5']) {
      await fireEvent.press(screen.getByRole('button', { name: key }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByLabelText('92. kg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onDone).toHaveBeenCalledWith(92.5);
  });

  it('allows whole numbers only for reps, and never steps below zero', async () => {
    const { props, onDone } = sheet({ value: 1, suffix: 'reps', step: 1, integer: true });
    await render(<NumberSheet {...props} />);
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 1 reps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 1 reps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onDone).toHaveBeenCalledWith(0);
  });

  it('can log an assisted (negative) load when asked to', async () => {
    const { props, onDone } = sheet({ value: 10, allowNegative: true });
    await render(<NumberSheet {...props} />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Switch between added and assisted' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onDone).toHaveBeenCalledWith(-10);
  });

  it('shows last cycle’s top set for reference (FR-9.2b)', async () => {
    const { props } = sheet({ note: 'Last: 100 kg × 2 @ RPE 8' });
    await render(<NumberSheet {...props} />);
    expect(screen.getByText('Last: 100 kg × 2 @ RPE 8')).toBeTruthy();
  });

  it('renders nothing while closed', async () => {
    const { props } = sheet({ visible: false });
    await render(<NumberSheet {...props} />);
    expect(screen.queryByRole('header')).toBeNull();
  });
});

describe('RestTimerBar (§7.6, §7.17)', () => {
  it('shows the countdown and adjusts or skips it', async () => {
    const onAdjust = jest.fn();
    const onSkip = jest.fn();
    await render(<RestTimerBar remainingSec={102} onAdjust={onAdjust} onSkip={onSkip} />);
    expect(screen.getByText('Rest 1:42')).toBeTruthy();
    expect(screen.getByLabelText('Rest, 1 minute 42 seconds left')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Rest 15 seconds less' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rest 15 seconds more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
    expect(onAdjust.mock.calls).toEqual([[-15], [15]]);
    expect(onSkip).toHaveBeenCalled();
  });

  it('announces only at 10 seconds and at the end', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const props = { onAdjust: jest.fn(), onSkip: jest.fn() };
    const view = await render(<RestTimerBar remainingSec={12} {...props} />);
    for (const sec of [11, 10, 9, 1, 0]) {
      await act(async () => {
        await view.rerender(<RestTimerBar remainingSec={sec} {...props} />);
      });
    }
    expect(announce.mock.calls).toEqual([['10 seconds of rest left'], ['Rest over']]);
  });
});
