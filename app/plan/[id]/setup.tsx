import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDays, type LocalDate } from '@/core';
import {
  trainingMaxKg,
  usePlanSetup,
  useStartPlan,
  type PlanSetupView,
} from '@/features/planSetup';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { DateStepper } from '@/ui/components/DateStepper';
import { InfoTip } from '@/ui/components/InfoTip';
import { NumberField } from '@/ui/components/NumberField';
import { WeekdayPicker } from '@/ui/components/WeekdayPicker';
import { spokenDay } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

const STEPS = ['Start date', 'Training days', 'Your 1RMs'] as const;

// Plan setup (FR-2.3, FR-3.3, DESIGN §7.5): start date, training days and 1RMs, then "Start
// plan". Ending an active plan to start another needs endPlan (Slice 11), so until then this
// explains the block rather than offering the §7.5 ConfirmSheet.
export default function PlanSetupScreen() {
  const c = useColors();
  const type = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = usePlanSetup(id);

  if (view.status === 'loading') return null;
  if (view.status === 'failed' || view.setup === null) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="alert" style={[type.body, styles.padded, { color: c.ink }]}>
          {view.status === 'failed'
            ? "Couldn't load this plan. Close the app and open it again."
            : "This plan isn't waiting to be set up."}
        </Text>
      </SafeAreaView>
    );
  }
  return <Setup setup={view.setup} />;
}

function Setup({ setup }: { setup: PlanSetupView }) {
  const c = useColors();
  const type = useTypography();
  const { start, busy } = useStartPlan();

  const [step, setStep] = useState(0);
  const [startDate, setStartDate] = useState<LocalDate>(setup.defaultStartDate);
  const [pins, setPins] = useState<Record<string, number>>(
    Object.fromEntries(setup.slots.map((s) => [s.id, s.weekday])),
  );
  const [oneRms, setOneRms] = useState<Record<string, string>>(
    Object.fromEntries(
      setup.skills.map((s) => [s.skillId, s.oneRmKg === null ? '' : String(s.oneRmKg)]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const endDate = addDays(startDate, setup.totalWeeks * 7 - 1);
  const clash = useMemo(() => {
    const seen = new Map<string, number[]>();
    for (const slot of setup.slots) {
      const week = slot.label.split(' · ')[0] ?? '';
      seen.set(week, [...(seen.get(week) ?? []), pins[slot.id] ?? slot.weekday]);
    }
    return [...seen.values()].some((days) => new Set(days).size !== days.length);
  }, [pins, setup.slots]);

  const missing = setup.skills.find((s) => !isPositive(oneRms[s.skillId]));

  const onStart = async () => {
    setError(null);
    const reason = await start({
      planId: setup.planId,
      startDate,
      weekdayPins: pins,
      oneRms: Object.fromEntries(setup.skills.map((s) => [s.skillId, Number(oneRms[s.skillId])])),
    });
    if (reason === null) {
      router.replace('/');
      return;
    }
    setError(
      reason === 'plan_already_current'
        ? `${setup.activePlanName ?? 'Another plan'} is still running. Ending a plan to start another one is coming soon.`
        : "That didn't work. Check the dates and 1RMs and try again.",
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          {setup.planName}
        </Text>
        <Text accessibilityLiveRegion="polite" style={[type.label, { color: c.inkMuted }]}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </Text>

        {step === 0 && (
          <View style={styles.section}>
            <DateStepper
              label="Start date"
              value={startDate}
              onChange={setStartDate}
              min={setup.today}
            />
            <Text style={[type.body, { color: c.inkMuted }]}>
              Ends {spokenDay(endDate)} · {setup.totalWeeks} weeks
            </Text>
            {startDate === setup.defaultStartDate && (
              <Text style={[type.label, { color: c.inkMuted }]}>
                Plan weeks line up with calendar weeks.
              </Text>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            {setup.slots.map((slot) => (
              <View key={slot.id} style={styles.field}>
                <Text style={[type.body, { color: c.ink }]}>{slot.label}</Text>
                <WeekdayPicker
                  label={slot.label}
                  value={pins[slot.id] ?? slot.weekday}
                  weekStart={setup.weekStart}
                  onChange={(weekday) => setPins((p) => ({ ...p, [slot.id]: weekday }))}
                />
              </View>
            ))}
            {clash && <Notice message="Two workouts share a day. You can still continue." />}
            <Text style={[type.label, { color: c.inkMuted }]}>
              Tip: leave a day between full-body sessions.
            </Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            {setup.skills.map((skill) => (
              <OneRmRow
                key={skill.skillId}
                name={skill.name}
                unit={setup.unit}
                tmPercent={setup.tmPercent}
                value={oneRms[skill.skillId] ?? ''}
                onChange={(value) => setOneRms((v) => ({ ...v, [skill.skillId]: value }))}
              />
            ))}
            {setup.activePlanName !== null && (
              <Notice
                message={`${setup.activePlanName} is still running. Only one plan can be active at a time.`}
              />
            )}
            {error !== null && <Notice message={error} alert />}
          </View>
        )}
      </ScrollView>

      <BottomBar>
        {step < STEPS.length - 1 ? (
          <Button label="Next" onPress={() => setStep(step + 1)} />
        ) : (
          <Button
            label={missing ? `Add a 1RM for ${missing.name}` : 'Start plan'}
            disabled={missing !== undefined || busy}
            onPress={() => void onStart()}
          />
        )}
        {step > 0 && <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />}
      </BottomBar>
    </SafeAreaView>
  );
}

/** A short warning with no action of its own, so not a Banner (DESIGN §6.5). */
function Notice({ message, alert = false }: { message: string; alert?: boolean }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.notice, { borderColor: c.line, backgroundColor: c.surfaceSunk }]}>
      <Text
        accessibilityRole={alert ? 'alert' : undefined}
        style={[type.body, { color: alert ? c.plateRedText : c.ink }]}
      >
        {alert ? 'Can\u2019t start yet: ' : 'Heads up: '}
        {message}
      </Text>
    </View>
  );
}

function OneRmRow({
  name,
  unit,
  tmPercent,
  value,
  onChange,
}: {
  name: string;
  unit: 'kg' | 'lb';
  tmPercent: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  const type = useTypography();
  const tm = isPositive(value) ? trainingMaxKg(Number(value), tmPercent) : null;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.row}>
        <Text style={[type.body, styles.grow, { color: c.ink }]}>{name}</Text>
        <InfoTip term="one_rm" />
      </View>
      <NumberField
        label={`${name} one rep max in ${unit}`}
        value={value}
        onChange={onChange}
        suffix={unit}
        placeholder="0"
      />
      <View style={styles.row}>
        <Text style={[type.label, { color: c.inkMuted }]}>
          {tm === null
            ? 'Enter your best single, or an estimate.'
            : `→ TM ${round(tm)} ${unit} (${Math.round(tmPercent * 100)}%)`}
        </Text>
        <InfoTip term="tm" />
      </View>
    </View>
  );
}

const isPositive = (value: string | undefined) => value !== undefined && Number(value) > 0;
const round = (kg: number) => Number(kg.toFixed(2));

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  section: { gap: spacing.cardGap },
  field: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  notice: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card },
  grow: { flexGrow: 1, flexShrink: 1 },
});
