// RestTimerBar (DESIGN §6.5, §7.6; FR-9.6): the pinned rest countdown with −15 s, +15 s and Skip.
// The caller computes the remaining time from the stored end time (§2.6). For screen readers it
// announces only at 10 s and at the end, not every second (§7.17).
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock, spokenClock } from '../format';
import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';

export interface RestTimerBarProps {
  remainingSec: number;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
}

export function RestTimerBar({ remainingSec, onAdjust, onSkip }: RestTimerBarProps) {
  const c = useColors();
  const type = useTypography();
  const previous = useRef(remainingSec);

  useEffect(() => {
    const before = previous.current;
    previous.current = remainingSec;
    if (before > 10 && remainingSec <= 10 && remainingSec > 0) {
      AccessibilityInfo.announceForAccessibility('10 seconds of rest left');
    } else if (before > 0 && remainingSec <= 0) {
      AccessibilityInfo.announceForAccessibility('Rest over');
    }
  }, [remainingSec]);

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text
        accessibilityLabel={`Rest, ${spokenClock(remainingSec)} left`}
        style={[type.title, styles.time, { color: c.ink }]}
      >
        Rest {formatClock(remainingSec)}
      </Text>
      <BarButton label="−15s" spoken="Rest 15 seconds less" onPress={() => onAdjust(-15)} />
      <BarButton label="+15s" spoken="Rest 15 seconds more" onPress={() => onAdjust(15)} />
      <BarButton label="Skip" spoken="Skip rest" onPress={onSkip} />
    </View>
  );
}

function BarButton({
  label,
  spoken,
  onPress,
}: {
  label: string;
  spoken: string;
  onPress: () => void;
}) {
  const c = useColors();
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.button, { borderColor: c.line }]}
    >
      <Text style={[type.label, { color: c.plateBlue }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
  },
  time: { flexGrow: 1, fontVariant: ['tabular-nums'] },
  button: {
    minWidth: touch.min,
    minHeight: touch.min,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
