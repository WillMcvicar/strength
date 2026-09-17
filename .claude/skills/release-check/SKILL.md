---
name: release-check
description: Pre-release gate for a store build. Runs every automated check, then lists the manual device checks.
allowed-tools: Bash(grep *), Bash(npm run *), Read, Glob, Grep
disable-model-invocation: true
argument-hint: <release, e.g. 1.0>
---

# Release check for v$ARGUMENTS

Run each step and report pass or fail with evidence. Don't fix anything unless asked.

1. `npm run check`
2. `npm run check:ac -- --strict`: every AC for v$ARGUMENTS and earlier releases must have a test.
3. `npm run check:licences`, then confirm every runtime dependency and bundled font appears in `THIRD_PARTY_NOTICES.md`.
4. `grep -rn "TODO(OQ-1)" src`: this must return nothing.
5. **Versions:** `src/config/release.ts`, `app.json` / `app.config.ts` and `package.json` all agree with v$ARGUMENTS, and `CHANGELOG.md` has an entry for it.
6. **Feature flags:** no feature from a later release is enabled.
7. **No network access:** `grep -rn "fetch(\|axios\|XMLHttpRequest" src app` finds nothing outside the approved backup module (NFR-11).
8. **Store requirements:**
   - the privacy policy URL is live
   - the store privacy answers are "Data Not Collected"
   - the Play closed-test requirement is met (NFR-15)
9. **Manual device checks.** List the items from `docs/RELEASE_CHECKLIST.md` for the user to tick off: offline use, background notifications (including Android timing), OS backup restore, 200% text, and VoiceOver and TalkBack.
