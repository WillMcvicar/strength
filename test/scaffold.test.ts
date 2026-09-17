// Scaffold check (DESIGN §11, step 1): proves the `core` Jest project transforms TypeScript and
// resolves the `@/` alias. Database access is covered by test/db/adapter.test.ts.
// Replace with real AC-named tests as the core modules land.
import { isEnabled, RELEASE } from '@/config/release';

describe('scaffold: core test project', () => {
  it('resolves the @/ path alias and strict TypeScript', () => {
    expect(RELEASE).toBe('1.0');
    expect(isEnabled('cloudBackup')).toBe(false);
  });
});
