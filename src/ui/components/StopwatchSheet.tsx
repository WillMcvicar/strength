// StopwatchSheet (DESIGN §7.6 `time` rows, FR-9.3): tapping a timed set's time starts a count-up
// stopwatch that fills the value. "Enter it instead" falls back to the keypad for a time done
// away from the phone.
import { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { secondsBetween, useNow } from '@/features/device';

import { formatClock, spokenClock } from '../format';
import { useReduceMotion } from '../motion';
import { useColors } from '../theme';
import { useTypography } from '../typography';
import { Button } from './Button';
import { sheetStyles as styles } from './MenuSheet';
import { NumberSheet } from './NumberSheet';

export interface StopwatchSheetProps {
  visible: boolean;
  title: string;
  /** The target or current time, used by the keypad. */
  value: number | null;
  onDone: (seconds: number | null) => void;
  onClose: () => void;
}

export function StopwatchSheet(props: StopwatchSheetProps) {
  return props.visible ? <OpenStopwatch {...props} /> : null;
}

function OpenStopwatch({ title, value, onDone, onClose }: StopwatchSheetProps) {
  const c = useColors();
  const type = useTypography();
  const reduceMotion = useReduceMotion();
  const now = useNow(250);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [stopped, setStopped] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);

  if (typing) {
    return (
      <NumberSheet
        visible
        title={title}
        value={value}
        suffix="s"
        step={5}
        integer
        onDone={onDone}
        onClose={onClose}
      />
    );
  }

  const elapsed = stopped ?? (startedAt ? Math.max(0, secondsBetween(startedAt, now)) : 0);
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      visible
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {title}
          </Text>
          <Text
            accessibilityLabel={spokenClock(elapsed)}
            style={[type.scoreboard, { color: c.ink, textAlign: 'center' }]}
          >
            {formatClock(elapsed)}
          </Text>
          {startedAt === null ? (
            <Button label="Start stopwatch" onPress={() => setStartedAt(now)} />
          ) : stopped === null ? (
            <Button label="Stop" onPress={() => setStopped(elapsed)} />
          ) : (
            <Button label={`Save ${formatClock(stopped)}`} onPress={() => onDone(stopped)} />
          )}
          <Button label="Enter it instead" variant="secondary" onPress={() => setTyping(true)} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
