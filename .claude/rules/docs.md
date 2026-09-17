---
paths:
  - "docs/**"
---

# Documentation rules

- Change `docs/REQUIREMENTS.md` or `docs/DESIGN.md` only through the `/spec-change` workflow, and only after the user approves the proposed change.
- **Keeping the docs in sync:**
  - bump the version in the header
  - add a revision-history row (SRS §12)
  - log a new `D-n` decision in DESIGN §1.1
  - update SRS §11 and DESIGN §10 together
- **Verify worked examples** (rounding, e1RM, volume) by calculation before writing them.
- Keep the docs' existing style: short sentences, IDs in bold, and ASCII sketches exactly 37 characters wide inside their borders.
- Prettier doesn't format Markdown here (see `.prettierignore`), because the docs' tables and diagrams are hand-aligned.
