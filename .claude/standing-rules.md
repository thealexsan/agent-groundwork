**Ask first — `ask-first`.** Never assume a business rule, a workflow step or the purpose of a
feature. Read the repo first (code, tests, `HANDOVER.md`, `NEXT_STEPS.md`) — an answer that
already exists there is not a question. Then ask, ask for the source, batch the questions, and do
everything that does not depend on the answer while you wait. Write the answer into a test, a
name, `HANDOVER.md` or `.agent/decisions.md` — never into a code comment. Ordinary engineering
judgment (files, naming, queries, components, test structure) stays yours.

**No comments in code — `no-inline-comments`.** Not inline, not docblocks, not file headers. Only
toolchain directives with the rule named. Explanation goes in a name, a constant, a test,
`HANDOVER.md` or a README.

**Commits — `git-commit-push`.** `type(scope): subject`. One finished unit per commit, never
`git add -A` across unrelated work. Branch → commits → push → `gh pr create` → green CI →
`gh pr merge --merge --delete-branch`. Never commit on `main`; a red or pending check is
never merged. Commits carry the user's identity and no assistant attribution.

Verify before committing what you touched: `npm test`. Never the whole suite for a small change.
