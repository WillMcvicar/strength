#!/usr/bin/env node
// Stop hook: before Claude finishes, typecheck and run tests related to changed files.
// On failure, exit 2 sends the errors back so Claude keeps working.
// `stop_hook_active` prevents an endless loop if the failure can't be fixed.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (input.stop_hook_active) process.exit(0);
if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'node_modules')))
  process.exit(0);

const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf8' });

let changed = '';
try {
  changed = sh('git status --porcelain');
} catch {
  process.exit(0);
}
if (!/\.(ts|tsx)\s*$/m.test(changed)) process.exit(0); // no TypeScript changes this turn

const failures = [];
for (const [name, cmd] of [
  ['Typecheck', 'npm run --silent typecheck'],
  ['Related tests', 'npx jest --onlyChanged --passWithNoTests --silent'],
]) {
  try {
    sh(cmd);
  } catch (e) {
    failures.push(`${name} failed:\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.trim().slice(-3000)}`);
  }
}

if (failures.length) {
  process.stderr.write(
    `${failures.join('\n\n')}\n\nFix these before finishing, or explain why they can't be fixed.\n`,
  );
  process.exit(2);
}
process.exit(0);
