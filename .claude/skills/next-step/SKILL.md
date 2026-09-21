---
name: next-step
description: Works out where the build is against docs/BUILD_PLAN.md and proposes the next concrete task.
allowed-tools: Bash(sed *), Bash(git log *), Bash(ls *), Bash(npm run *), Bash(head *), Bash(tail *), Bash(echo *), Read, Glob, Grep
disable-model-invocation: true
---

# Where are we?

## Build plan

!`cat docs/BUILD_PLAN.md`

## Recent history

!`git log --oneline -20 2>/dev/null || echo "no git history yet"`

## Repository state

!`ls src src/core src/services 2>/dev/null | head -40`
!`npm run --silent check:ac 2>/dev/null | tail -25 || echo "check:ac not available yet"`

## Steps

1. **Find the current step.** Using the evidence above, identify the first slice whose "Done when" check isn't met. Don't trust the status table alone: check it against the evidence, and say what you used. If the table is out of date, say so.
2. **Propose 1–3 tasks** that move that step forward, each small enough for one branch or PR. For each, give the IDs involved and the tests that prove it.
3. **Flag blockers**, such as open questions (OQ-1, OQ-2), spikes carried forward, ACs in "Not yet placed" that belong to this slice, or accounts that need to be set up.
4. **Wait** for the user to pick a task, then use `/implement`.
