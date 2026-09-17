---
name: next-step
description: Works out where the build is against the DESIGN §11 build plan and proposes the next concrete task.
allowed-tools: Bash(sed *), Bash(git log *), Bash(ls *), Bash(npm run *), Bash(head *), Bash(tail *), Bash(echo *), Read, Glob, Grep
disable-model-invocation: true
---

# Where are we?

## Build plan

!`sed -n '/^## 11. Build Plan/,$p' docs/DESIGN.md`

## Recent history

!`git log --oneline -20 2>/dev/null || echo "no git history yet"`

## Repository state

!`ls src src/core src/services 2>/dev/null | head -40`
!`npm run --silent check:ac 2>/dev/null | tail -25 || echo "check:ac not available yet"`

## Steps

1. **Find the current step.** Using the evidence above, identify the first build-plan step whose "Done when" check isn't met. Say what evidence you used.
2. **Propose 1–3 tasks** that move that step forward, each small enough for one branch or PR. For each, give the IDs involved and the tests that prove it.
3. **Flag blockers**, such as open questions (OQ-1, OQ-2) or accounts that need to be set up.
4. **Wait** for the user to pick a task, then use `/implement`.
