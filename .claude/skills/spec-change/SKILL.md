---
name: spec-change
description: Proposes and, after approval, applies a change to docs/REQUIREMENTS.md and docs/DESIGN.md, keeping versions, decision IDs, acceptance criteria and release plans in sync. Use when code, a request or a review reveals a gap or conflict in the specs.
allowed-tools: Bash(grep *), Bash(tail *), Read, Glob, Grep, Edit
argument-hint: <short description of the gap>
---

# Spec change: $ARGUMENTS

## Current state

!`grep -n "Document version" docs/REQUIREMENTS.md docs/DESIGN.md`
!`grep -o "^| D-[0-9]*" docs/DESIGN.md | tail -1`
!`grep -o "\*\*AC-[0-9]*" docs/REQUIREMENTS.md | tail -1`

## Steps

1. **Describe the problem.** Quote the conflicting or missing text, citing IDs and line numbers, and say why it matters (which release, which ACs).
2. **Propose the fix and wait for approval.** Don't edit anything yet. Show:
   - the options, with a recommendation
   - the exact wording you'd change in the SRS and design
   - any new or changed ACs, with worked numbers you have verified
3. **Apply it once approved:**
   - **SRS:** bump the minor version in the header, edit the requirement text, update §4 or §5 if affected, update §11 release tags, and add a §12 revision-history row.
   - **Design:** bump the version, update "Implements", add a `D-n` row to §1.1 (next ID after the last one above), edit the affected sections, and update §10 and §11 if needed.
   - Add new ACs after the last existing one, and tag each for a release.
4. **Protect the training rules.** The SRS marks its training rules as evidence-based. Never loosen them for convenience; if a change touches them, call that out explicitly.
5. **Report** the files changed, the new IDs, and any code or tests that now need updating.
