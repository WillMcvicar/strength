import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  usePlanOverview,
  type OverviewCellView,
  type OverviewRowView,
  type PlanOverviewView,
} from '@/features/week';
import { BackHeader } from '@/ui/components/BackHeader';
import { phaseFills, PlanRibbon } from '@/ui/components/PlanRibbon';
import { ProgressMeter } from '@/ui/components/ProgressMeter';
import { STATUS_LOOK, statusBorder } from '@/ui/components/StatusChip';
import { spokenDay } from '@/ui/format';
import { useColors } from '@/ui/theme';
import { radius, spacing, touch } from '@/ui/tokens';
import { useTypography } from '@/ui/typography';

// The plan overview grid (FR-8.4, DESIGN §7.3): a row per plan week with its phase colour on the
// left edge, deload and taper weeks labelled, and a cell per workout showing its status. A cell
// opens Workout detail. The full progress meter sits on top (FR-8.3).
export default function PlanOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = usePlanOverview(id);
  const c = useColors();
  const type = useTypography();

  if (view.status === 'loading') return null;
  const overview = view.status === 'ready' ? view.overview : null;
  if (!overview) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <BackHeader title="Whole plan" />
          <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>
            {view.status === 'failed'
              ? 'Couldn’t load this plan. Close the app and open it again.'
              : 'This plan no longer exists.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return <Overview overview={overview} />;
}

function Overview({ overview }: { overview: PlanOverviewView }) {
  const c = useColors();
  const fills = phaseFills(overview.ribbon);
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title={overview.name} />
        <PlanRibbon phases={overview.ribbon} currentWeek={overview.progress.currentWeek} />
        <ProgressMeter progress={overview.progress} variant="full" />
        <View style={[styles.grid, { backgroundColor: c.surface, borderColor: c.line }]}>
          {overview.rows.map((row, i) => {
            const fill = fills[row.phaseIndex];
            return (
              <WeekRow
                key={row.weekIndex}
                row={row}
                current={row.weekIndex === overview.progress.currentWeek}
                edge={fill ? { backgroundColor: c[fill.color], opacity: fill.opacity } : {}}
                first={i === 0}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekRow({
  row,
  current,
  edge,
  first,
}: {
  row: OverviewRowView;
  current: boolean;
  edge: { backgroundColor?: string; opacity?: number };
  first: boolean;
}) {
  const c = useColors();
  const type = useTypography();
  const heading = `Week ${row.weekIndex}${row.label ? ` · ${row.label}` : ''}`;
  return (
    <View
      testID="overview-row"
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: c.line }]}
    >
      <View style={[styles.edge, edge]} />
      <View style={styles.rowBody}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={current ? `${heading}, this week` : heading}
          style={[type.label, { color: current ? c.plateBlue : c.ink }]}
        >
          {heading}
          {current ? ' · now' : ''}
        </Text>
        <View style={styles.cells}>
          {row.cells.map((cell) => (
            <Cell key={cell.workoutId} cell={cell} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Cell({ cell }: { cell: OverviewCellView }) {
  const c = useColors();
  const type = useTypography();
  const look = STATUS_LOOK[cell.status];
  const tone = { color: c[look.color] };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cell.name}, ${spokenDay(cell.date)}, ${look.label}`}
      accessibilityHint="Opens the workout"
      onPress={() => router.push(`/workout/${cell.workoutId}`)}
      style={[styles.cell, { borderColor: statusBorder(cell.status, c) }]}
    >
      <Text style={[type.title, tone]}>{look.icon}</Text>
      <Text numberOfLines={2} style={[type.caption, styles.cellName, { color: c.ink }]}>
        {cell.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.cardGap },
  grid: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  edge: { width: 6 },
  rowBody: { flex: 1, padding: spacing.sm, gap: spacing.xs },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    minWidth: touch.min * 1.5,
    minHeight: touch.min,
    flexBasis: 0,
    flexGrow: 1,
    maxWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.xs,
  },
  cellName: { textAlign: 'center' },
});
