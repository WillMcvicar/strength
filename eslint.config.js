// Flat config. Enforces the DESIGN §2.1 layer boundaries and the §3 determinism rules for
// everyone; .claude/hooks/guard.mjs enforces the same rules while Claude edits.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** Layers, outermost first. A layer may not import from any layer above it (DESIGN §2.1). */
const noRestrictedPaths = {
  zones: [
    // src/core is pure: it imports nothing from any other layer.
    {
      target: './src/core',
      from: ['./src/data', './src/services', './src/features', './src/ui', './app'],
      message: 'src/core is pure (DESIGN §2.1): it must not import from other layers.',
    },
    // src/data may import types from src/core only.
    {
      target: './src/data',
      from: ['./src/services', './src/features', './src/ui', './app'],
      message: 'src/data must not import from the layers above it (DESIGN §2.1).',
    },
    // Screens and design-system components never reach the database (NFR-3).
    {
      target: ['./app', './src/ui'],
      from: './src/data',
      message:
        'Screens and UI components must not import src/data; go through src/features and src/services.',
    },
    // test/ holds dev-only helpers, including the better-sqlite3 driver. Shipped code must not
    // reach them, or a dev-only native module could end up in a release build.
    {
      target: ['./app', './src'],
      from: './test',
      message: 'Shipped code must not import from test/; those helpers are dev-only.',
    },
  ],
};

/** Deterministic layers: no clock reads. src/services/clock.ts is the one exception (D §3.15). */
const noClock = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Pass `now` in as an argument; only src/services/clock.ts reads the device clock.',
  },
  {
    selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
    message:
      'Pass `today`/`now` in as arguments; only src/services/clock.ts reads the device clock.',
  },
];

const noRandom = {
  selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
  message: 'src/core must be deterministic: pass random values and new IDs in as arguments.',
};

module.exports = defineConfig([
  // eslint-config-expo already registers the import, react and @typescript-eslint plugins
  // and the TypeScript resolver, so this config only adds rules on top.
  expoConfig,
  {
    rules: {
      'import/no-restricted-paths': ['error', noRestrictedPaths],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noClock, noRandom] },
  },
  {
    files: ['src/services/**/*.ts'],
    ignores: ['src/services/clock.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noClock] },
  },
  {
    // Tests may construct dates freely when building fixtures.
    files: ['**/*.test.ts', '**/*.test.tsx', 'test/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'coverage/', 'android/', 'ios/', 'expo-env.d.ts'],
  },
]);
