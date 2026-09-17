#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): format and lint-fix the file Claude just changed.
// Unfixable lint errors are reported back to Claude (exit 2 → stderr shown to Claude).
// Markdown is deliberately skipped: the docs use hand-aligned tables and diagrams.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!file || !/\.(ts|tsx|js|mjs|cjs|json|ya?ml)$/.test(file)) process.exit(0);
if (!existsSync(join(root, 'node_modules'))) process.exit(0); // not scaffolded yet

const run = (args) => execFileSync('npx', ['--no-install', ...args], { cwd: root, stdio: 'pipe' });

try {
  run(['prettier', '--write', '--log-level', 'warn', file]);
} catch {
  /* prettier not installed or file ignored: nothing to do */
}

if (/\.(ts|tsx)$/.test(file)) {
  try {
    run(['eslint', '--fix', '--max-warnings', '0', file]);
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
    if (out) {
      process.stderr.write(`ESLint problems remain in ${file}:\n${out.slice(-4000)}\n`);
      process.exit(2);
    }
  }
}
process.exit(0);
