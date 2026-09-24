// DESIGN §9: two projects. `core` runs the pure logic layers in plain Node; `app` runs the
// React Native layers under jest-expo. src/core carries a 100% coverage threshold (§9.2).

// drizzle-kit's `.sql` migrations load as strings (see test/sqlTransform.js and babel.config.js).
const sqlMigrations = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'sql'],
  transform: { '\\.sql$': '<rootDir>/test/sqlTransform.js' },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'core',
      preset: 'jest-expo/node',
      testMatch: [
        '<rootDir>/src/core/**/*.test.ts',
        '<rootDir>/src/services/**/*.test.ts',
        '<rootDir>/src/data/**/*.test.ts',
        '<rootDir>/test/**/*.test.ts',
      ],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      ...sqlMigrations,
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/test/ui/warmModules.js'],
      testMatch: [
        // Screen tests: Expo Router would treat a test file under app/ as a route.
        '<rootDir>/test/app/**/*.test.tsx',
        '<rootDir>/src/ui/**/*.test.{ts,tsx}',
        '<rootDir>/src/features/**/*.test.{ts,tsx}',
      ],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      ...sqlMigrations,
    },
  ],
  collectCoverageFrom: ['src/core/**/*.ts', '!src/core/**/*.test.ts'],
  coverageThreshold: {
    'src/core/**/*.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
  },
};
