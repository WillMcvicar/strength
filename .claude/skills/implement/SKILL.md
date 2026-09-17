---
name: implement
description: Implements a requirement (FR-x), acceptance criterion (AC-x), design decision (D-x) or build-plan step from docs/REQUIREMENTS.md and docs/DESIGN.md, test-first. Use when asked to build, add or fix a feature that has a requirement ID.
allowed-tools: Bash(grep *), Bash(npm run *), Bash(npx jest *), Bash(head *), Bash(echo *), Read, Glob, Grep, Edit, Write
argument-hint: <FR-x | AC-x | D-x>
---

# Implement $ARGUMENTS

## Where the docs mention it

!`grep -n -- "$ARGUMENTS" docs/REQUIREMENTS.md docs/DESIGN.md | head -40`

## Current release

!`grep -n "RELEASE" src/config/release.ts 2>/dev/null || echo "src/config/release.ts not found (assume 1.0)"`

## Steps

1. **Read the spec.** Read the full section around each match above; use the line numbers and read about 40 lines. Follow any FR, D, C or AC cross-references one level deep. Don't read the whole documents.
2. **Check scope.** Confirm the item is tagged for the current release in SRS §11. If it belongs to a later release, stop and ask, or build it behind an `isEnabled(...)` flag if the user agrees.
3. **Check for gaps.** If the docs are ambiguous, contradict each other, or contradict existing code, stop. Explain the problem and offer `/spec-change`.
4. **Plan by layer:** `src/core` → `src/data` → `src/services` → `src/features` → `app/` and `src/ui`. List the files you will touch. For anything bigger than a small change, show the plan and wait for approval.
5. **Write the tests first:**
   - Name them after the ACs, e.g. `describe('AC-25 Estimated suggestion', ...)`.
   - Use the worked numbers from the docs.
   - Run them and confirm they fail for the right reason.
6. **Implement** the smallest change that makes the tests pass. Pure maths goes in `src/core`.
7. **Verify.** Run `npm run check` and fix everything it reports.
8. **Report back:**
   - the IDs covered, files changed and tests added
   - any doc gaps you found
   - a suggested commit message, e.g. `feat(core): estimated 1RM suggestion (FR-3.5, AC-25)`
