---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.css"
---

# UI rules — simple enough that nobody gets stuck

Build for the tired, interrupted person: on a phone, between two other things, with one hand. The
project's design system wins on tokens and components; these rules are the judgment around it.

## Every screen

1. **One primary action.** Everything else is visually quieter. A destructive action is
   separated, looks destructive, and is confirmed with its consequence in words.
2. **Every control does what its label says**, against a real endpoint. No toast without a
   request, no button without a handler, no link without a page.
3. **The server decides every state** — overdue, locked, expired, scores, visibility. A component
   shows it and never recomputes it.
4. **Loading, empty and error exist**, not only the happy path. An empty state says what is
   missing, why it matters and the next step. "No data found" never ships.
5. **Forbidden is a state.** A panel the viewer may not see is left out; a screen they may not see
   says what happened and whom to ask. Never a blank page, never a raw error.
6. **Feedback has weights:** a toast confirms something already visible; a result worth reading
   stays on the screen; a condition that is still true stays until it is not.

## Getting things done without thinking

7. **The next step is visible.** A person's one next action is a button where they look, not
   behind a row click or a `⋯` menu. Dense tables for managers keep row actions in a menu.
8. **Ask for the minimum.** Preselect what the context already knows; never ask for a value the
   server can derive.
9. **Errors appear beside the field**, in the words the server sent, and clear as the person types.
10. **Tabs and filters live in the URL**, so reload, back and a shared link all work. Names are
    links to what they name.
11. **Search forgives typos and accents.**

## Phones first

12. **Every tap target is at least 40px**, counting an enlarged hit area. A primary button is full
    width only where a thumb wants it.
13. **Inputs are 16px on small screens**, or iOS zooms on focus.
14. **No horizontal page scroll at 390px or 320px.** A wide table scrolls inside its own container.

## Words

15. **Every visible string goes through the dictionary**, typed so a missing key fails the build.
    Counted nouns have singular and plural forms. A hardcoded string on a translated screen is a
    bug.
16. **Say what happened and what follows**, in the past tense for a confirmation: "Absence
    approved — Anna is off 3–5 March." Not "Success".

## Consistency

17. **Tokens only** — no colour, size or radius literal outside the theme file.
18. **Shared patterns only.** A second version of an existing pattern is a bug, not a variant.

## Proving it

- Typecheck, lint and build pass.
- Screenshots at desktop width and at 390px, light and dark — and look at them.
- Drive every create, edit and delete flow in a real browser until the server answers 2xx and the
  screen shows the new state. A dialog opening is not proof.
