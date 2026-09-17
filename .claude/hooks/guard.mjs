#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit).
// Blocks edits that break rules the docs treat as non-negotiable.
// Exit 2 blocks the tool call; stderr is shown to Claude so it can correct course.
import { readFileSync, existsSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const t = input.tool_input ?? {};
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const abs = t.file_path ?? '';
const file = (isAbsolute(abs) ? relative(root, abs) : abs).split('\\').join('/');
if (!file) process.exit(0);

// Text being written: Write → content; Edit → new_string; MultiEdit → edits[].new_string
const text = [t.content, t.new_string, ...(t.edits ?? []).map((e) => e.new_string)]
  .filter(Boolean)
  .join('\n');

const block = (msg) => {
  process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${msg}\n`);
  process.exit(2);
};

// 1. Secrets
if (/(^|\/)\.env(\.|$)/.test(file)) block(`don't edit ${file}; environment files are private.`);

// 2. Generated migrations are append-only (DESIGN §4.6)
if (file.startsWith('src/data/migrations/') && existsSync(abs)) {
  block(
    `${file} is an existing migration. Never edit a shipped migration: change src/data/schema.ts, ` +
      `run \`npx drizzle-kit generate\`, and add the matching JSON migrator (DESIGN §5).`,
  );
}

// 3. src/core stays pure and deterministic (DESIGN §2.1, NFR-10)
if (file.startsWith('src/core/') && /\.(ts|tsx)$/.test(file)) {
  const rules = [
    [/\bDate\.now\s*\(/, 'Date.now() — pass `now` in as an argument'],
    [/new Date\(\s*\)/, 'new Date() — pass `today`/`now` in as arguments'],
    [/\bMath\.random\s*\(/, 'Math.random() — core must be deterministic'],
    [
      /from\s+['"](react|react-native|expo[^'"]*|drizzle-orm[^'"]*|expo-sqlite)['"]/,
      'framework/DB imports',
    ],
    [/from\s+['"][^'"]*\/(data|services|features|ui)\//, 'imports from outer layers'],
    [/\brandomUUID\s*\(/, 'ID generation — pass new IDs in as arguments'],
  ];
  for (const [re, what] of rules)
    if (re.test(text)) block(`src/core must stay pure: found ${what}.`);
}

// 4. Only clock.ts reads the clock in services (DESIGN §3.15)
if (file.startsWith('src/services/') && !file.endsWith('clock.ts') && /\.(ts|tsx)$/.test(file)) {
  if (/\bDate\.now\s*\(|new Date\(\s*\)/.test(text)) {
    block(
      'services must get today/now from src/services/clock.ts (or as arguments), not the device clock.',
    );
  }
}

// 5. Screens never touch the data layer directly (NFR-3)
if (
  /^(app|src\/ui)\//.test(file) &&
  /from\s+['"][^'"]*src\/data\/|from\s+['"]@\/data\//.test(text)
) {
  block(
    'screens and UI components must not import src/data; go through src/features and src/services.',
  );
}

process.exit(0);
