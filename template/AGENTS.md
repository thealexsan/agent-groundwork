# AGENTS.md — {{PROJECT}}

Portable instructions for any coding agent working in this repository: Antigravity, Cursor,
Copilot, Gemini CLI, Codex, Windsurf, Aider, Claude Code, or a human at a terminal.

This file is the index and the short form. **`CLAUDE.md` holds the rules in full and is
canonical.** When a rule changes, change it there and check that this summary still matches.

## What this is

{{DESCRIPTION}}

## The rules that are not negotiable

1. **Ask before inventing product logic** — `.claude/skills/ask-first/SKILL.md`. Never assume a
   business rule, a workflow step or the purpose of a feature. Read the repo first, then ask,
   batch the questions, and write the answer into a test, a name or `HANDOVER.md`.
2. **No comments in code** — `.claude/skills/no-inline-comments/SKILL.md`. Only toolchain
   directives that name their rule. Explanation goes in a name, a constant, a test or a document.
3. **Commit protocol** — `.claude/skills/git-commit-push/SKILL.md`. `type(scope): subject`, one
   finished unit per commit, a branch and a pull request, never a commit on `{{MAIN}}`, never a
   red or pending check merged, the user's identity and no assistant attribution. `.githooks/`
   enforces it after `git config core.hooksPath .githooks`.
4. **Verify before claiming.** The gate before every commit:

   ```bash
   {{CHECKS}}
   ```
{{WHO_IS_ASKING_RULE}}

## Read before working

| File | When |
|---|---|
| `NEXT_STEPS.md` | first, when picking the repository up |
| `HANDOVER.md` §4 | before changing anything — the traps |
| `HANDOVER.md` §3 | before proposing a different design — it may have been decided |
| `.claude/rules/security.md` | before anything that reads or writes user data |
| `.claude/rules/performance.md` | before a query, a list, a cache or a heavy component |
{{READ_INDEX}}

Working notes go in `.agent/` (git-ignored) and move to `HANDOVER.md` or `NEXT_STEPS.md` when
the change lands.
