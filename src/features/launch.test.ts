// §7.1 launch rule 4: the in-progress session reopens once per launch (FR-9.10).
import { takeLaunchReopen } from './launch';

describe('takeLaunchReopen', () => {
  it('is true once, then false for the rest of the launch', () => {
    expect(takeLaunchReopen()).toBe(true);
    expect(takeLaunchReopen()).toBe(false);
    expect(takeLaunchReopen()).toBe(false);
  });
});
