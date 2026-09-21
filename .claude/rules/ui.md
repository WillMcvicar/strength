---
paths:
  - "app/**"
  - "src/ui/**"
  - "src/features/**"
---

# UI rules (DESIGN §6, §7)

- **Styling:** colours, type and spacing come only from `src/ui/tokens.ts`; no raw hex values in components.
  - Phase colours: training is blue, deload green, taper yellow.
  - Red means missed or destructive, nothing else.
  - Colour never carries meaning alone: pair it with an icon and a label.
- **Touch:** targets are at least 48 × 48 dp; the set "done" check is 56. Primary actions sit in `BottomBar`, in the thumb zone.
- **Accessibility (§7.17):**
  - every icon-only control has an `accessibilityLabel`
  - set rows are read as a single element
  - layouts survive 200% text size
- **Copy (§6.6):** plain words. Every jargon term has an `InfoTip` (ⓘ) whose text comes from `content/explanations.json`. Buttons say what happens.
- **Data flow:** screens use `src/features` hooks. They never import `src/data`, and all writes go through `src/services`.
- **Release gating:** features for later releases are hidden with `isEnabled(...)` from `src/config/release.ts`.
- **Sketches:** match the §7 sketches for content and order. Visual polish can differ once the gym test (`docs/BUILD_PLAN.md`, after Slice 6) has fed back.
