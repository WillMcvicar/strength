// Current release and feature flags (DESIGN §10). Read by scripts/check-ac-coverage.mjs.
export const RELEASE = '1.0' as const;

export type Release = '1.0' | '1.1' | '1.2';

/** The release in which each gated feature ships. */
const FLAGS = {
  deloadNow: '1.1', // FR-4.6a
  activeDeloadInsert: '1.1', // FR-2.12, D-23
  multiPhaseBuilder: '1.1', // FR-2.11
  taperAndTestDay: '1.1', // FR-2.14
  repinDays: '1.1', // FR-4.8
  pauseResume: '1.1', // FR-4.10
  phaseLength: '1.1', // FR-2.10
  personalTemplates: '1.1', // FR-2.8
  endedPlanStats: '1.1', // FR-11.4
  cloudBackup: '1.1', // FR-12.9 (blocked on OQ-2)
  volumePanel: '1.2', // FR-2.13
  deloadHint: '1.2', // FR-2.12
  loadTable: '1.2', // FR-3.13
  exerciseCharts: '1.2', // FR-10.4
  manualPr: '1.2', // FR-10.6
  historyFilters: '1.2', // FR-11.2
} as const satisfies Record<string, Release>;

export type Flag = keyof typeof FLAGS;

const order = (r: Release): number => ['1.0', '1.1', '1.2'].indexOf(r);

export function isEnabled(flag: Flag, current: Release = RELEASE): boolean {
  return order(FLAGS[flag]) <= order(current);
}
