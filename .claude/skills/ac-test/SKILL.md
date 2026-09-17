---
name: ac-test
description: Writes the automated test for one acceptance criterion from docs/REQUIREMENTS.md, at the lowest layer that can prove it (core, service or component). Use when an AC has no test yet or check:ac reports it missing.
allowed-tools: Bash(grep *), Bash(npm run *), Bash(head *), Read, Glob, Grep, Edit, Write
argument-hint: <AC-n>
---

# Test for $ARGUMENTS

## The criterion

!`grep -n -A16 -- "\*\*$ARGUMENTS " docs/REQUIREMENTS.md | head -24`

## Design notes that mention it

!`grep -n -- "$ARGUMENTS" docs/DESIGN.md | head -12`

## Release tags

!`grep -n "Acceptance tests" docs/REQUIREMENTS.md`

## Steps

1. Check that $ARGUMENTS is in the current release's list. If it isn't, say so before continuing.
2. **Choose the layer:**
   - `src/core` for pure maths and scheduling
   - `src/services` with in-memory SQLite for flows that touch the database
   - a React Native Testing Library component test only when the criterion is about UI behaviour (e.g. AC-31, AC-43)
3. **Write the test:**
   - Name it `describe('$ARGUMENTS <exact title from the SRS>', ...)`.
   - Map each Given / When / Then / And to arrange, act and assert steps.
   - Use the SRS figures verbatim.
   - Build plans with `test/fixtures/plans.ts`, and pass `today` and `now` explicitly.
   - Lettered sub-criteria (e.g. AC-14b) get their own `describe` with their own ID.
4. **Run it.**
   - If the feature exists and the test fails, report the bug. Don't weaken the test.
   - If the feature doesn't exist yet, leave the test failing and say which FRs it needs.
5. Run `npm run check:ac` and report what is still missing.
