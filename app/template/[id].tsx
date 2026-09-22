import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTemplate, type TemplateCycleWeekView, type TemplatePhaseView } from '@/features/plans';
import { BottomBar } from '@/ui/components/BottomBar';
import { Button } from '@/ui/components/Button';
import { ExerciseCard } from '@/ui/components/ExerciseCard';
import { PlanRibbon } from '@/ui/components/PlanRibbon';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Template detail (FR-2.2, DESIGN §7.4): description, ribbon, phases, sessions per week and a
// preview of each cycle week. "Use this template" opens Plan setup (§7.5), built next.
export default function TemplateScreen() {
  const c = useColors();
  const type = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useTemplate(id);
  const [week, setWeek] = useState(0);

  if (view.status === 'loading') return null;
  if (view.status === 'failed' || view.template === null) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="alert" style={[type.body, styles.padded, { color: c.ink }]}>
          {view.status === 'failed'
            ? "Couldn't load this template. Close the app and open it again."
            : "This template isn't available."}
        </Text>
      </SafeAreaView>
    );
  }

  const t = view.template;
  const shown = t.cycleWeeks[Math.min(week, t.cycleWeeks.length - 1)];
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          {t.name}
        </Text>
        <Text style={[type.body, { color: c.inkMuted }]}>{t.description}</Text>
        <Text style={[type.label, { color: c.ink }]}>{t.summary}</Text>
        <PlanRibbon phases={t.ribbon} currentWeek={1} />

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
            Phases
          </Text>
          {t.phases.map((phase, i) => (
            <PhaseRow key={`${phase.name}-${i}`} phase={phase} />
          ))}
        </View>

        {shown && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
              What a cycle looks like
            </Text>
            {t.cycleWeeks.length > 1 && (
              <View style={styles.tabs}>
                {t.cycleWeeks.map((cycleWeek, i) => (
                  <WeekTab
                    key={cycleWeek.label}
                    label={cycleWeek.label}
                    selected={i === week}
                    onPress={() => setWeek(i)}
                  />
                ))}
              </View>
            )}
            <CycleWeek week={shown} unit={t.unit} />
          </View>
        )}
      </ScrollView>
      <BottomBar>
        {/* Enabled by Plan setup (DESIGN §7.5, §8.1). */}
        <Button label="Use this template" disabled onPress={() => {}} />
      </BottomBar>
    </SafeAreaView>
  );
}

function PhaseRow({ phase }: { phase: TemplatePhaseView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[type.body, { color: c.ink }]}>{phase.name}</Text>
      <Text style={[type.label, { color: c.inkMuted }]}>{phase.length}</Text>
      <Text style={[type.label, { color: c.inkMuted }]}>{phase.increase}</Text>
    </View>
  );
}

function WeekTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.tab,
        {
          borderColor: selected ? c.plateBlue : c.line,
          backgroundColor: selected ? c.plateBlue : c.surface,
        },
      ]}
    >
      <Text style={[type.label, { color: selected ? c.onPlate : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function CycleWeek({ week, unit }: { week: TemplateCycleWeekView; unit: 'kg' | 'lb' }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.section}>
      {week.workouts.map((workout) => (
        <View
          key={workout.id}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
            {workout.name}
          </Text>
          <Text style={[type.label, { color: c.inkMuted }]}>{workout.day}</Text>
          {workout.rows.map((row) => (
            <ExerciseCard
              key={row.exerciseId}
              name={row.name}
              sets={row.sets}
              target={row.target}
              load={row.load ? { ...row.load, unit } : undefined}
              rpe={row.rpe}
              topSet={row.topSet}
              inSuperset={row.inSuperset}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  section: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: {
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
});
