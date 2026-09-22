import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  usePlans,
  type ActivePlanView,
  type PlanListItemView,
  type TemplateListItemView,
} from '@/features/plans';
import { Button } from '@/ui/components/Button';
import { PlanRibbon } from '@/ui/components/PlanRibbon';
import { useColors } from '@/ui/theme';
import { radius, spacing } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// Plans (FR-2.1, FR-2.2, DESIGN §7.4): the active plan, my plans, and the built-in templates.
// "Build a plan" arrives with the builder (Slice 12).
export default function PlansScreen() {
  const c = useColors();
  const type = useTypography();
  const view = usePlans();

  if (view.status === 'loading') return null;
  if (view.status === 'failed') {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text accessibilityRole="alert" style={[type.body, styles.padded, { color: c.ink }]}>
          Couldn&apos;t load your plans. Close the app and open it again.
        </Text>
      </SafeAreaView>
    );
  }

  const { active, myPlans, templates } = view;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[type.display, { color: c.ink }]}>
          Plans
        </Text>

        {active ? (
          <Section title="Active">
            <ActiveCard plan={active} />
          </Section>
        ) : (
          <Text style={[type.body, { color: c.inkMuted }]}>
            No active plan. Pick a ready-made plan below to get started.
          </Text>
        )}

        {myPlans.length > 0 && (
          <Section title="My plans">
            {myPlans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} />
            ))}
          </Section>
        )}

        <Section title="Templates">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </Section>

        <Button label="Build a plan" variant="ghost" disabled onPress={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[type.label, { color: c.inkMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ActiveCard({ plan }: { plan: ActivePlanView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.row}>
        <Text style={[type.title, styles.grow, { color: c.ink }]}>{plan.name}</Text>
        <Text style={[type.label, { color: c.inkMuted }]}>{plan.header}</Text>
      </View>
      <PlanRibbon phases={plan.ribbon} currentWeek={plan.currentWeek} />
    </View>
  );
}

function PlanRow({ plan }: { plan: PlanListItemView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[type.body, { color: c.ink }]}>{plan.name}</Text>
      <Text style={[type.label, { color: c.inkMuted }]}>{plan.subtitle}</Text>
    </View>
  );
}

function TemplateRow({ template }: { template: TemplateListItemView }) {
  const c = useColors();
  const type = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.name}, ${template.summary}`}
      accessibilityHint="Opens the template"
      onPress={() => router.push(`/template/${template.id}`)}
      style={({ pressed }) => [
        styles.card,
        styles.row,
        { backgroundColor: pressed ? c.surfaceSunk : c.surface, borderColor: c.line },
      ]}
    >
      <Text style={[type.body, styles.grow, { color: c.ink }]}>{template.name}</Text>
      <Text style={[type.label, { color: c.inkMuted }]}>{template.summary}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  section: { gap: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  grow: { flexGrow: 1, flexShrink: 1 },
});
