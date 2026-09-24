// §7.1 launch rule 4: a session left in progress reopens once per launch (FR-9.10). Module state,
// so it resets only when the app process starts again.
let reopened = false;

/** True the first time it's called in this launch, false after. */
export function takeLaunchReopen(): boolean {
  if (reopened) return false;
  reopened = true;
  return true;
}
