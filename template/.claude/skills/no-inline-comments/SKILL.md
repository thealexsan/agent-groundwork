---
name: no-inline-comments
description: The standing rule for this repo — no comments in code files. Load before writing or editing any code file, and follow it for every line you write.
---

# No comments in code

**Write no comments in code files.** Not inline, not prose docblocks, not file headers,
not TODOs, not commented-out code. It is an absolute.

## The only exception

**Toolchain directives**, on the line they govern, with the rule named:
`// eslint-disable-next-line <rule>`, `// @ts-expect-error`, `// prettier-ignore`, and in Go
`//go:` directives, `//lint:ignore <check>`, `# shellcheck disable=<code>`, and whatever a generator requires to find its input
(the `-- name:` lines of sqlc, for example). Lines we add to
a config file get no comment.

A docblock that explains _why_ is a comment. Delete it.

## Where the explanation goes instead

1. A better name — `touchesPay`, `TOKEN_MISMATCH`, `ADMIN_ONLY_COLUMNS`.
2. A small named function or constant.
3. A test whose name is the sentence.
4. `HANDOVER.md` for why a decision was made and the trap behind it; a package `README.md`
   for a library's contract.

## Applying it

- New code: none.
- Touched code: remove every comment in the lines and declarations you touch.
- Reviewing: any comment in a diff is a change request.

## Checking a diff

```bash
git diff --cached -U0 | grep -nE '^\+\s*(//|#|/\*|\*|\{/\*)' | grep -vE 'eslint-disable|@ts-expect-error|prettier-ignore|//go:|//lint:ignore'
```

Anything that prints is a violation.
