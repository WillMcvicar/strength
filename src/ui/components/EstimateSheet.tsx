// "Estimate it for me" (FR-3.3a, DESIGN §7.5): a full-screen modal in four steps — safety and
// warm-up, choose a load, log the set, then the result to use or edit. The maths and the bounds
// are in src/core (§3.5); this screen only collects and shows.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { toDisplay, toKg, type Unit } from '@/core';
import { useEstimate } from '@/features/estimateOneRm';

import { useColors } from '../theme';
import { radius, spacing, touch } from '../tokens';
import { useTypography } from '../typography';
import { BottomBar } from './BottomBar';
import { Button } from './Button';
import { NumberField } from './NumberField';

const REPS = [1, 2, 3, 4, 5];
const RPES = [7, 7.5, 8, 8.5, 9, 9.5, 10];

export interface EstimateSheetProps {
  visible: boolean;
  skillName: string;
  unit: Unit;
  increment: number;
  onClose: () => void;
  /** The confirmed 1RM, in stored kilograms (DESIGN §3.1). */
  onUse: (oneRmKg: number) => void;
}

export function EstimateSheet({
  visible,
  skillName,
  unit,
  increment,
  onClose,
  onUse,
}: EstimateSheetProps) {
  const c = useColors();
  const type = useTypography();
  const [step, setStep] = useState(0);
  const [load, setLoad] = useState('');
  const [reps, setReps] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);

  // The user types in their display unit; the maths is in kg, and kg is what leaves here.
  const estimate = useEstimate(
    {
      loadKg: load === '' ? undefined : toKg(Number(load), unit),
      reps: reps ?? undefined,
      rpe: rpe ?? undefined,
    },
    unit,
    increment,
  );

  const close = () => {
    setStep(0);
    setLoad('');
    setReps(null);
    setRpe(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false}>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
            Estimate your {skillName.toLowerCase()} 1RM
          </Text>
          <Text accessibilityLiveRegion="polite" style={[type.label, { color: c.inkMuted }]}>
            Step {step + 1} of 4
          </Text>

          {step === 0 && (
            <View style={styles.section}>
              <Text style={[type.body, { color: c.ink }]}>
                You&apos;ll do one hard set to work out your one-rep max. Stop if anything hurts.
              </Text>
              <Text style={[type.body, { color: c.ink }]}>
                Warm up first: a few light sets, adding weight each time, until the bar feels ready
                to move fast. Rest a couple of minutes before the test set.
              </Text>
            </View>
          )}

          {step === 1 && (
            <View style={styles.section}>
              <Text style={[type.body, { color: c.ink }]}>
                Pick a weight you can lift for 3 to 5 reps with good form — hard, but not a grinder.
              </Text>
              <NumberField
                label={`Test set weight in ${unit}`}
                value={load}
                onChange={setLoad}
                suffix={unit}
                placeholder="0"
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <Text style={[type.body, { color: c.ink }]}>
                Do the set, then tell us how it went.
              </Text>
              <Choice
                label="Reps you completed"
                options={REPS}
                value={reps}
                onChange={setReps}
                suffix=""
              />
              <Choice
                label="How hard it felt (RPE)"
                options={RPES}
                value={rpe}
                onChange={setRpe}
                suffix=""
              />
              {estimate.message !== null && (
                <Text accessibilityRole="alert" style={[type.body, { color: c.plateRedText }]}>
                  {estimate.message}
                </Text>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.section}>
              <Text style={[type.title, { color: c.ink }]}>
                Estimated 1RM: {estimate.oneRmKg === null ? '—' : toDisplay(estimate.oneRmKg, unit)}{' '}
                {unit}
              </Text>
              <Text style={[type.body, { color: c.inkMuted }]}>
                It&apos;s an estimate, not a test. You can change it any time before your first
                session.
              </Text>
            </View>
          )}
        </ScrollView>

        <BottomBar>
          {step < 3 ? (
            <Button
              label="Next"
              disabled={
                (step === 1 && !(Number(load) > 0)) || (step === 2 && estimate.oneRmKg === null)
              }
              onPress={() => setStep(step + 1)}
            />
          ) : (
            <Button
              label="Use this"
              onPress={() => {
                if (estimate.oneRmKg !== null) onUse(estimate.oneRmKg);
                close();
              }}
            />
          )}
          <Button
            label={step === 3 ? 'Edit' : 'Cancel'}
            variant="ghost"
            onPress={() => (step === 3 ? setStep(2) : close())}
          />
        </BottomBar>
      </View>
    </Modal>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
  suffix,
}: {
  label: string;
  options: readonly number[];
  value: number | null;
  onChange: (value: number) => void;
  suffix: string;
}) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.section}>
      <Text style={[type.label, { color: c.ink }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${option}${suffix}`}
              onPress={() => onChange(option)}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? c.plateBlue : c.surface,
                  borderColor: selected ? c.plateBlue : c.line,
                },
              ]}
            >
              <Text style={[type.label, { color: selected ? c.onPlate : c.ink }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    borderWidth: 1,
    borderRadius: radius.button,
    minHeight: touch.min,
    minWidth: touch.min,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
