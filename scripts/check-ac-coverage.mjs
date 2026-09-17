#!/usr/bin/env node
// Checks that every acceptance criterion tagged for the current release (and earlier releases)
// has a test named after it: describe/it/test('AC-25 ...'). DESIGN §9.3.
//
//   node scripts/check-ac-coverage.mjs            report mode: lists gaps, always exits 0
//   node scripts/check-ac-coverage.mjs --strict   exits 1 if any required AC has no test (release branches)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const srs = readFileSync(join(root, 'docs/REQUIREMENTS.md'), 'utf8');

// 1. Current release
const releaseFile = join(root, 'src/config/release.ts');
const release = existsSync(releaseFile)
  ? (readFileSync(releaseFile, 'utf8').match(/RELEASE\s*=\s*['"](\d+\.\d+)['"]/) ?? [])[1]
  : undefined;
if (!release) {
  console.error('Could not read RELEASE from src/config/release.ts');
  process.exit(1);
}

// 2. AC IDs per release, from SRS §11 "**Acceptance tests:**" lines
const plan = srs.slice(srs.indexOf('## 11. Release Plan'));
const sections = [
  ...plan.matchAll(/^### v(\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm),
];
const expand = (line) => {
  const ids = new Set();
  for (const m of line.matchAll(/AC-(\d+)(?:\s*(?:to|–|-)\s*AC-(\d+))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= b; i++) ids.add(i);
  }
  return ids;
};
const byRelease = new Map();
for (const [, ver, body] of sections) {
  const line = body.split('\n').find((l) => l.includes('**Acceptance tests:**'));
  if (line) byRelease.set(ver, expand(line));
}
if (!byRelease.has(release)) {
  console.error(`No "Acceptance tests" line found for v${release} in SRS §11`);
  process.exit(1);
}
const cmp = (a, b) =>
  a
    .split('.')
    .map(Number)
    .reduce((acc, n, i) => acc || n - Number(b.split('.')[i]), 0);
const required = new Set();
for (const [ver, ids] of byRelease) if (cmp(ver, release) <= 0) ids.forEach((i) => required.add(i));

// 3. Lettered sub-criteria defined in §7 (e.g. AC-14b) are required with their parent
const defined = [...srs.matchAll(/^- \*\*AC-(\d+)([a-z]?) /gm)].map((m) => ({
  n: Number(m[1]),
  s: m[2],
}));
const requiredIds = defined.filter((d) => required.has(d.n)).map((d) => `AC-${d.n}${d.s}`);

// 4. Test titles
const tested = new Set();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.expo', 'dist', 'build', 'coverage'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.test\.(ts|tsx|js)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(
        /\b(?:describe|it|test)(?:\.(?:each\([\s\S]*?\)|only|skip))?\s*\(\s*[`'"]AC-(\d+[a-z]?)[\s:`'"]/g,
      )) {
        tested.add(`AC-${m[1]}`);
      }
    }
  }
};
walk(root);

const missing = requiredIds.filter((id) => !tested.has(id));
console.log(
  `Release v${release}: ${requiredIds.length} acceptance criteria required, ${requiredIds.length - missing.length} have tests.`,
);
if (missing.length) {
  console.log(`Missing (${missing.length}): ${missing.join(', ')}`);
  if (strict) {
    console.error(
      'check:ac --strict failed: every AC for this release needs a test named "AC-n <title>".',
    );
    process.exit(1);
  }
} else {
  console.log('All acceptance criteria for this release have tests.');
}
