---
name: git-commit-push
description: "MANDATORY commit and push protocol for groundwork. Conventional commit format (feat/fix/chore with a scope), one commit per finished unit of work — never a single 500-file dump — and push to origin when the unit is green. Load before the first commit of any session and re-read whenever you are about to stage files."
---

# Commit and Push Protocol

This is not advice. It is the standing rule for this repo. Work that is finished and
uncommitted is work that can be lost, and a commit that spans fifteen unrelated changes
cannot be reviewed, reverted or bisected. Both failures are avoidable, so neither is allowed.

## 1. The message format

```
<type>(<scope>): <subject>
```

Lowercase type, lowercase scope, lowercase subject, no trailing period. Imperative mood —
"add the daily report endpoint", not "added" or "adds".

**Types** — use exactly these:

| type       | when                                                                  |
| ---------- | --------------------------------------------------------------------- |
| `feat`     | new behaviour a user or API consumer can observe                      |
| `fix`      | a defect in existing behaviour is corrected                           |
| `chore`    | dependency bumps, config, tooling, file moves, cleanup — no behaviour |
| `refactor` | internal restructuring, behaviour provably unchanged                  |
| `test`     | tests only, no production code touched                                |
| `docs`     | documentation only                                                    |
| `ci`       | `.github/workflows`, pipeline config                                  |
| `build`    | Docker, compose, deploy plumbing                                      |

**Scope is where the change lives.** It is required unless the change genuinely spans the
whole repo. Valid scopes in this repo:

`template` · `hooks` · `skills` · `installer` · `global` · `docs`

Narrow further when it helps a reader find the change: `feat(api/reports)`,
`fix(web/billing)`. Prefer the narrower form for feature work.

Examples that are correct:

```
feat(api): daily report endpoint scoped to the viewer's account
feat(web/today): summary card and running total
fix(web/inbox): unread badge ignored the account filter
chore(ui): drop the unused card variant
ci: fail the build on any lint finding
```

Examples that are not:

```
Refactor code structure for improved readability     # no type, no scope, says nothing
feat: stuff                                          # subject is not a description
feat(web): add page and fix api bug and bump deps    # three commits wearing a trench coat
```

### Body

Add a body only when the subject cannot carry it: a non-obvious reason, a trade-off, a
migration a reader must know about. Wrap at 72 columns, blank line after the subject. Most
commits need no body.

### Attribution

Commits are the user's: their git identity and **no assistant attribution** — no
`Co-Authored-By` trailer for any assistant, no "Generated with …" line. `.claude/settings.json`
sets `attribution` to empty so the harness adds none either.

## 2. Commit size — one finished unit, one commit

A commit is a single coherent change that leaves the tree working. Finished a page? Commit.
Finished an endpoint plus its tests? Commit. Fixed a bug? Commit — on its own, not folded
into the feature you were building when you noticed it.

Concretely:

- **Commit as you go, not at the end.** When a unit is done and green, commit it before
  starting the next one. Do not accumulate a session's worth of work and stage it in one go.
- **Never `git add -A` across unrelated work.** Stage explicit paths: `git add web/app/reports`.
  If `git status` shows changes you did not make this unit, they do not belong in this commit.
- **A migration + model + controller + test for one feature is one commit.** Splitting a
  single feature across four commits that each break the build is the opposite failure.
- **Mechanical changes commit separately.** A file move, a formatter pass or a dependency
  bump goes in its own `chore` commit, never mixed into feature work — it drowns the real
  diff.

The test: could someone revert this commit alone and end up in a sensible state? If no,
it is too big or too small.

## 3. Never commit red

Run the checks that cover what you touched, before committing. Do not commit code you have
not verified.

```bash
npm test
```

While iterating, run only the tests near the change. The whole suite is for CI and the release
pre-flight.

If a check fails, fix it before committing. If you cannot, say so and leave the work
uncommitted rather than committing something broken.

## 4. A branch per feature, a pull request, then main

**Nothing is committed straight onto `main`.** Every feature gets its own branch, its own
pull request and its own green CI run before it lands. The pull request is the last place
anything can be caught before it reaches everyone else — and production, where a merge deploys.

1. **Branch before the first commit**, named after the feature, `type/short-name` with the
   same types as §1:

   ```bash
   git checkout main && git pull --ff-only
   git checkout -b feat/document-requirements
   ```

2. **Commit onto the branch** in the units §2 describes. Several commits on one branch is
   normal and right — one commit per finished unit, not one per branch.

3. **Push the branch and open the pull request**:

   ```bash
   git push -u origin feat/document-requirements
   gh pr create --base main --title "feat(web/documents): …" --body "…"
   ```

   The body says what changed, why, and what was verified. If the change needs a look at a
   screen, say which screen.

4. **Review the branch before merging it.** Read `git diff main...HEAD` as a whole, not just
   the commits you remember writing — the local gate in §3 proves it runs, the read proves it
   belongs. Wait for CI: `gh pr checks <n> --watch`.

5. **Merge only when CI is green**, and never with a failing or pending check:

   ```bash
   gh pr merge <n> --merge --delete-branch
   ```

   Red CI is not merged and not overridden. Fix it on the branch and let CI run again.

Never `push --force` to `main`. If a push to a branch is rejected,
`git pull --rebase origin <branch>`, re-run the checks, then push.

**The rule is enforced locally as well as on the host.** Branch protection is not available on
every plan, so `.githooks/pre-push` refuses any push to `refs/heads/main`, force or not. It
is tracked in the repo but hooks are not installed by `git clone`, so a fresh checkout needs one
command:

```bash
git config core.hooksPath .githooks
```

`GROUNDWORK_ALLOW_MAIN_PUSH=1 git push origin main` is the deliberate override, for the case where the
pipeline itself is what is broken.

Do not let work pile up locally across a session — an unpushed commit is as lost as an
uncommitted one if the machine goes away. Push the branch early; the pull request can sit
open while the work continues.

## 5. What is never committed

- Secrets, `.env` files, tokens, real credentials. `.env.example` only.
- Build output and caches — `tsconfig.tsbuildinfo`, `.next/`, `dist/`, `vendor/`, `node_modules/`.
  If one shows up in `git status`, fix `.gitignore` in a `chore(repo)` commit instead of
  committing it.
- Screenshots, scratch scripts and measurement output from the QA loop. Those live in the
  scratchpad, not the repo.
- Commented-out code. Delete it; git remembers.

## 6. Procedure

Every time:

1. `git status` — if you are on `main`, branch first (§4). Work never starts on `main`.
2. `git diff` — know exactly what changed and why each file is there.
3. Stage explicit paths for this one unit.
4. `git diff --staged` — confirm the staged set is the unit and nothing else.
5. Commit with the format in §1 — the user's identity, no assistant attribution.
6. Push the branch.
7. If other changes remain in the tree, repeat from 2 for the next unit.
8. When the feature is finished: open the pull request, read `git diff main...HEAD`, wait for
   CI, merge (§4). 

Use a heredoc for the message so the body survives:

```bash
git commit -m "$(cat <<'EOF'
feat(api/reports): daily report with signature capture

A legal record, so the row is append-only and the signer is
pinned at write time rather than resolved on read.
EOF
)"
```
