# groundwork — repo rules

## Committing is mandatory

**Load the `git-commit-push` skill before your first commit in any session, and follow it for
every commit after.** Work is not left uncommitted.

The short form, in full in `.claude/skills/git-commit-push/SKILL.md`:

- **Format:** `type(scope): subject`. Types: `feat` `fix` `chore` `refactor` `test` `docs` `ci`
  `build`. Scopes: `template` · `hooks` · `skills` · `installer` · `global` · `docs`.
- **One finished unit per commit.** Never one commit spanning unrelated changes; never
  `git add -A` across work that is not one unit.
- **A branch per feature, then a pull request.** Never commit onto `main`. Branch, commit the
  units, push, `gh pr create`, read `git diff main...HEAD`, wait for CI, then
  `gh pr merge --merge --delete-branch`. A red or pending check is never merged. `.githooks/`
  enforces it for every agent and a bare terminal — `pre-commit` refuses a commit on `main`
  and a staged diff that adds comments, `commit-msg` refuses assistant attribution, `pre-push`
  refuses a push to `main`. A fresh clone needs `git config core.hooksPath .githooks` once.
- **Commit as you go**, and **push** each unit once its checks pass.
- **Never commit red.** Run the gate first:

  ```bash
  npm test
  ```

- **Commits are the user's.** Their git identity, no assistant attribution.

## Asking about product logic is mandatory

**Load the `ask-first` skill before any work that touches business logic, the workflow of a
feature, or the idea behind a feature.**

- **Never assume a business rule, a workflow step or the purpose of a feature.**
- **Read the repo first.** An answer that already exists in code, a test, `HANDOVER.md` or
  `NEXT_STEPS.md` is not a question.
- **Then ask, and ask for the source** — a screenshot, a diagram, a document, a real example.
- **Batch the questions, ask them first, do everything that does not depend on the answer.**
- **Write the answer down** in a test, a name, `HANDOVER.md` or `.agent/decisions.md`.
- Ordinary engineering judgment — file layout, naming, queries, test structure — stays yours.

## No comments in code

**Write no comments in code files** — not inline, not docblocks, not file headers. Load the
`no-inline-comments` skill before writing or editing code. The only exception is a toolchain
directive with the rule named. Explanation goes in a name, a constant, a test, `HANDOVER.md` or a
README.

## Engineering principles

Produce correct, maintainable software while spending as little as necessary on context, tool
calls, files, dependencies and architecture. In order: correctness, simplicity, maintainability,
security, performance. Do the necessary work well — not more work.

**Where anything in this section disagrees with the sections above, those win.**

- **Before changing code:** find the relevant files, read the relevant parts, learn the existing
  pattern, choose the smallest correct change, implement it, verify it. Never make a claim about
  code you have not opened.
- **Scope:** stay on the task. No unrelated refactor, rename or upgrade, no abstraction for a
  hypothetical need. An unrelated problem is fixed only if it blocks the task; otherwise it goes
  in `.agent/todo.md`.
- **Context is a limited resource.** Targeted searches and reads; no re-reading, no huge logs,
  no generated files. A fresh chat for an unrelated task.
- **Long-running work** continues from the repository, not from conversation history. Working
  state lives in `.agent/` (git-ignored): `progress.md`, `todo.md`, `decisions.md`. It is never
  the only record — when work lands, the story and any trap move to `HANDOVER.md`, leftover work
  to `NEXT_STEPS.md`.
- **Subagents: zero is the default.** Delegate only genuinely independent work.
- **Verification:** never claim something works without a check that fits the change. While
  iterating, the smallest check that proves it; before committing, the gate. Never edit a test
  to make it pass unless the test is demonstrably wrong.
- **Code quality:** boring, obvious code in the project's conventions. No premature abstraction,
  no magic constants, no dead code, no dependency for something trivial.
- **Architecture:** respect what is there. Explain before a large change; migrate incrementally.
- **Git:** check `git status` before major work, read the diff before every commit, never
  rewrite or delete someone else's work, never force-push `main`.
- **Security is correctness** — `.claude/rules/security.md`.
- **Report** what changed, how it was verified and what is unresolved, briefly.

## Several chats at once

The rules are enforced, not remembered. `.claude/settings.json` is committed, so every chat gets
the hooks: a `SessionStart` hook reinjects `.claude/standing-rules.md` and the map of live agents
on every start and after every compaction; guards refuse a commit on `main`, assistant
attribution, and a staged diff that adds comments. Each refusal names its override:
`GROUNDWORK_ALLOW_MAIN_COMMIT`, `GROUNDWORK_ALLOW_BRANCH_SWITCH`, `GROUNDWORK_ALLOW_COMMENTS`.

**When another agent is already in this checkout, take a worktree — call `EnterWorktree`.** This
paragraph authorises that tool: the working tree and `HEAD` are shared state, so a `git checkout`
here moves every chat reading this directory. A hook then prepares the worktree and shares
`.agent/` with the primary checkout. `node scripts/new-worktree.mjs <type>/<topic>` does the same from
a terminal. When you are the only agent, an ordinary branch is fine — the session-start map says
which case you are in.

## Where the rest lives

- `AGENTS.md` — these rules in the portable format other agents read. This file is canonical.
- `NEXT_STEPS.md` — the ordered list of what is left. Start there when picking the repo up.
- `HANDOVER.md` — what this is, the decisions, the traps, the log.
- `.claude/agent.json` — what the hooks check: main branch, override prefix, comment paths,
  what a worktree copies.
- `.claude/standing-rules.md` — the text injected at the start of every session.
- `.claude/rules/` — security and performance rules, loaded for the paths they govern.
- `.claude/skills/` — `git-commit-push`, `ask-first`, `no-inline-comments`.
- `.agents/rules/` — thin pointers for other agents. Note the plural: `.agent/` is the
  git-ignored scratch directory.
