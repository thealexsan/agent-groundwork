# HANDOVER — groundwork

The memory of this repository: what it is, why it is shaped this way and what has bitten. Every
session that learns something a later one needs writes it here before it ends.

## 1. What this is

The agent working method as an installable template: the rule files, handover documents, Claude Code hooks, git hooks, skills and path rules that make a coding agent work the same way in every project.

## 2. How it is put together

| Path | Holds |
|---|---|
| `template/` | everything `install.mjs` copies into a project, with `{{PLACEHOLDERS}}` |
| `template/.claude/hooks/` | the five Claude Code hooks and their `lib/` — session start and end, git guard, write guard, worktree setup |
| `template/.claude/agent.json` | what those hooks check, per project |
| `template/.claude/standing-rules.md` | the text reinjected at every session start and after every compaction |
| `template/.claude/skills/` | `git-commit-push`, `ask-first`, `no-inline-comments`, and `release` for a library |
| `template/.claude/rules/` | security and performance rules |
| `template/.githooks/` | the same guards for any agent and a bare terminal |
| `rules/<name>/` | the optional path rules, installed by `--rules <name>` |
| `plans/all/`, `plans/deploy/` | the plan documents, installed by `--plans` (and `--deploys` for `DEPLOY.md`) |
| `ops/ci/`, `ops/deploy/` | CI, security and deploy files, installed by `--ops` (and `--deploys` for the second) |
| `install.mjs` | copies the template, fills the placeholders, turns the git hooks on |
| `global/` | what belongs to the person, not a project: `~/.claude` hooks, and the our-stack rule, skill, sync and new-machine setup |
| `test/` | installs into throwaway repositories and drives the real hooks |

The root of this repository carries its own installed copy (`CLAUDE.md`, `.claude/`,
`.githooks/`), so the method is used on itself.

## 3. Decisions

Each of these was a choice. Read the reason before reversing one. Add the date and who decided.

1. **Extracted from the original project on 2026-10-07**, where the method grew over months: `CLAUDE.md`, its hooks, `.githooks/` and the skills. Everything that named that product was removed or became a placeholder.
2. **Two layers of enforcement on purpose.** The Claude Code hooks stop an agent before the command runs and explain the alternative; the git hooks stop every other agent and a person at a terminal. Neither is enough alone.
3. **The hooks read `.claude/agent.json`** instead of carrying project constants, so one copy of the code serves every project and a project changes behaviour without editing a hook.
4. **The standing rules are a file**, `.claude/standing-rules.md`, injected verbatim. The original project's were lines of JavaScript inside the hook.
5. **Each override is named after the project** (`ACME_ALLOW_MAIN_COMMIT`), so a variable exported for one repository does not unlock another.
6. **The installer never overwrites** without `--force`. A project's own `CLAUDE.md` is worth more than the template's.
7. **Security and performance rules were rewritten, not copied.** the original project's were lists of its own classes and tables; these keep the principles.
8. **`who-is-asking` was left out.** It encodes two specific people sharing one assistant. A project with that situation writes its own. Replaced by decision 27.
9. **`global/` is not installed by the installer.** It changes a person's own `~/.claude`, which is theirs to edit.
10. **CI, deploy and ops are opt-in (`--ops`), 2026-10-07.** They assume GitHub Actions, and for the deploy one box with nginx, pm2 and Cloudflare; the rule files assume nothing. The deploy files come only with `--deploys` as well.
11. **The deploy reads Actions variables and secrets, not placeholders.** A host, key or address is not something to commit, and changing the box should not need a pull request. The workflow refuses with the missing names.
12. **The project's own build lives in `scripts/deploy/release.sh` on the box, not in the workflow.** the original project's workflow built and restarted each block inline; that part differs per project, and a rollback reruns the same script on the previous commit.
13. **The Neon restore point is made on every ship when `NEON_PROJECT_ID` is set,** not only when a migration is pending: knowing what is pending is the project's own migrator's business. The last five are kept.
14. **File names take placeholders too** (`{{SLUG}}-edge.conf`), so two projects' nginx files can sit in one `/etc/nginx` without colliding; nginx variables use the snake form (`$acme_shop_via_cloudflare`).
15. **The plans are skeletons with the method in them, not the original project's content, 2026-10-07.** the original project's `SECURITY_PLAN.md`, `SCALING.md`, `SEO_PLAN.md` and `DEPLOY.md` were mostly facts about one product; what carries over is the shape — dated checks, triggers before work, a refusal list, questions for the owner before content.
16. **The installer indexes what it installed.** `{{WHERE_INDEX}}` and `{{READ_INDEX}}` become lines in `CLAUDE.md` and `AGENTS.md` for each plan or optional file installed; a placeholder alone on its line whose value is empty is removed with its line, so a project without them shows no gap.

17. **Go, UI and page-weight rules are opt-in by name, 2026-10-07** (`--rules go,ui,page-weight`): unlike security and performance they assume a language or a front end. Like those, they were rewritten from the original project's — its blocks, components, dictionary size and measured kilobytes are gone; the principles and the gates stay. A new rule is a folder under `rules/` and an entry in `INDEXED`.

18. **One comment checker, `.claude/hooks/lib/comments.mjs`, 2026-10-07.** The git guard and `pre-commit` each carried their own rules and had drifted; `pre-commit` now runs the same module with node, so it reads `comments.paths` and `comments.ignore` too. Without node it says so and lets the commit through. PHP is checked for `//`, `/* */` and `#`, but `#[Attribute]` is code.

19. **A kept `CLAUDE.md` or `AGENTS.md` gets the template's version beside it, 2026-10-07** (`CLAUDE.groundwork.md`), not merged in. A project's own rules are worth more than the template's (decision 6), but keeping them silently left the installed `AGENTS.md` calling a `CLAUDE.md` canonical that held none of its rules. Merging prose is a person's or an agent's job; the installer only says what to merge. Other kept files get nothing beside them.

20. **The installer guesses the vendored folders and writes them into `comments.ignore`, 2026-10-07**, rather than asking: it runs without a prompt, and a wrong guess is one line of `.claude/agent.json` to delete, while a missed one refuses the first commit that touches upstream code. The signals are a folder's own licence file, a `vendor`-style name, and the agent skill folders; only tracked folders holding a checked extension count, and only the topmost of nested ones.

21. **`--update` owns the machinery, never the writing, 2026-10-07.** Hooks, git hooks, groundwork's skills and the worktree script are replaced; the rule files a project edits get the new version beside them (decision 19); everything else is kept. The settings come from `.claude/agent.json`, which now records the description, the gate and the commit scopes too, because the files that need them could otherwise only be filled with the reminder text. A file needing a setting that was never recorded is skipped and named, not filled with a guess; giving the setting once records it in `.claude/agent.json`, the one project file an update writes.

22. **`--update` removes only what it can prove it installed, 2026-10-07.** `installed` in `.claude/agent.json` maps each machinery file to a fingerprint of what was written. A file the new version no longer ships is deleted when it still matches, and named and left when the project changed it; a file never in the manifest — the project's own hook or skill — is never touched. An install before v0.8.0 has no manifest, so its first update removes nothing and records one.

23. **One stack rule for every agent on a machine, 2026-10-07 (the user).** Use our parts from the owner's GitHub account before writing anything they do, build on our stack (Go, Postgres, Next.js, one box behind Cloudflare, groundwork), and leave it only when the user firmly asks, the data does not fit Postgres, or the kind of app does not fit. The stack was read from the original project and the parts. `global/sync.mjs` is the one thing that applies it, from `setup.sh` and from a Claude Code session-start hook, so a new agent or account is covered without anyone remembering; it writes only between its markers and never replaces a file an account keeps of its own.

24. **The Next.js rule is about the framework, not the screen, 2026-10-07** (`--rules nextjs`). Page weight and UI already cover bundles and screens; this one covers what the original project's `web/` learned about the App Router itself — read the installed version's docs before memory (an error boundary's prop name changed under it), generated route types in CI, `NEXT_PUBLIC_*` fixed at build (a rebuild by hand without one shipped analytics dead), a shared layout not re-rendered on a soft navigation so never the gate for data, and server actions as public endpoints. It names no version's API, so it survives the next major.

25. **The parts catalog is generated from a GitHub topic, 2026-10-07.** A part is a repository of the owner (`GROUNDWORK_OWNER`, else the signed-in `gh` user) with the `our-part` topic; its row is its description and its latest release, or its newest tag when it has no release. A topic was chosen over "has a release" because a product repository can have releases too. The fetch never runs in the session-start path: the hook starts it detached once a day and the next session applies the cache, because the hook has ten seconds and a pull already spends some of them.

26. **The stack has no version numbers, 2026-10-07 (the user).** The user confirmed the default stack and asked that it always take the latest versions, never a static one. The rule and the skill name no version of Go, PostgreSQL, Next.js, React or Tailwind; each is looked up as the newest stable release when it is chosen, and the lockfile, `go.mod` and the Neon project record what was taken. An existing project moves up in its own pull request, which keeps the Next.js rule's "upgrade on purpose" true.

27. **`who-is-asking` is a template now, 2026-10-07; this replaces decision 8.** The situation is not the original project's alone — an engineer and a person who runs the business sharing one assistant is common — so `--business <name>` (and `--engineer <name>`) install it with the names filled in. The two modes, the words business mode never uses, and "the engineering moves to `.agent/`" carry over; the original project's Arabic openers do not, because they are those two people's. That is why the skill is the project's to edit, not machinery: an update keeps it and writes the template's beside, like `CLAUDE.md`. The rule lines in `CLAUDE.md`, `AGENTS.md` and the standing rules are placeholders alone on their line, so a project without `--business` gets the same files as before.

28. **Windows is supported, 2026-10-07 (the user: "make the setup windows compatible, and everything").** Proved, not assumed: CI runs the whole suite on Windows, macOS and Linux. Hooks are registered in Claude Code's exec form (`"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/…"]`) because that is the one form that needs no shell: PowerShell neither understands `PATH=… cmd` nor expands `$CLAUDE_PROJECT_DIR`. The `PATH` prefix for Homebrew goes with it; Claude Code's own `PATH` holds `/opt/homebrew/bin` on this machine, and a machine where it does not must put `node` on the path Claude Code is started with. Git hooks stay POSIX `sh`, which Git for Windows ships; `new-worktree` became node because it was bash; links are junctions on Windows because a symbolic link needs Developer Mode or an administrator. Verified on this machine with Claude Code 2.1.284: the session-start and session-end hooks wrote and removed the claim, and the git guard refused a commit on `main`.

29. **The deploy template is rehearsed in Docker on every pull request, 2026-10-07**, because there is no spare real box and a lint proves only syntax. `test/box.sh` runs the installed `deploy.yml`'s own `run:` blocks — the workflow's text, not a copy — from a runner container against a box container set up by `deploy/README.md` §3. What it cannot cover is listed in NEXT_STEPS: Actions itself (expressions, the `production` environment), TLS and certbot, Cloudflare in front, and a reboot.

30. **A project can own a file groundwork ships, 2026-10-07** (`owned` in `.claude/agent.json`). Moving the original project onto the template showed why: its `git-commit-push` and `no-inline-comments` skills carry its own scopes, gates and history, and `pz-ask-first` replaces the template's `ask-first`. Skills are machinery, so `--update` would have overwritten the first two and re-added the third. An owned path is treated like `CLAUDE.md` (decision 19) when present and left absent when absent; it is never in the manifest, so it is never removed either.

31. **Generated code is recognised by its own marker, not by folder, 2026-10-07.** the original project skipped its sqlc output with an awk rule on `core/**/*db/*.go`; `comments.ignore` is prefixes, so the move would have meant listing seventeen folders and adding one for every new block. The checker instead skips a file whose staged content carries Go's `// Code generated … DO NOT EDIT.` line, which every Go generator writes and which needs no upkeep.

32. **A copy beside a kept file is offered once, 2026-10-07.** Decision 19 wrote `CLAUDE.groundwork.md` whenever the kept file differed from the template, which after a merge by hand is always: the eighteen parts each got five such files on every update, to read and delete again though nothing in them was new. `offered` in `.claude/agent.json` records the fingerprint of what was put beside each kept or owned file, and an update writes the copy only when the template's version is no longer that one. A copy deleted without merging is therefore not offered again until the template changes — deleting it is the answer "not this". A project installed before v0.17.0 has no record, so its first update offers everything once more.

33. **The installed version is recorded, 2026-10-07** (`groundwork` in `.claude/agent.json`). Nothing in a project said which release its hooks came from: finding which of nineteen repositories were behind meant searching each hook for a function a release had added. Every install and update now writes the version it ran from, the one line that makes "pinned to its latest release" checkable.

## 4. Traps

What looked right and was wrong. One entry per trap: what happens, why, and how to avoid it.

1. **Git hooks are not installed by `git clone`.** Every fresh checkout needs `git config core.hooksPath .githooks`; the installer and the worktree hook do it, a plain clone does not.
2. **`.claude/settings.json` is read when a chat starts.** A chat open during the install has no hooks until it is restarted.
3. **A repository with no commits has no `HEAD` to resolve.** The branch is read with `git symbolic-ref` first for that reason; the original project's original used `rev-parse` alone and so did not guard the very first commit.
4. **The comment check sees only added lines of the listed extensions**, and treats `#` as a comment only in `py`, `rb`, `sh`, `yml`, `yaml`. A vendored or generated folder goes in `comments.ignore`.
5. **The write guard compares real paths.** On macOS a temporary directory under `/var` is really `/private/var`; a test that does not resolve it sees the guard allow everything.
6. **Agent claims go stale after 90 minutes** and live in `.git/agent-claims.json`. A chat that crashed keeps blocking others until then; delete the file to clear it.
7. **`global/hooks/usage-*.mjs` read the Claude login from the macOS keychain** and call the account's usage endpoint. They do nothing useful on another system.
8. **`template/` and `ops/` hold placeholders in file contents and names.** Running a template hook or script in place fails or misleads — `${1:-{{DOMAIN}}}` in a shell script reads as a default of `{{DOMAIN` followed by `}}`. Always install first, as the tests do.
9. **`hashFiles()` works only in steps, not in a job's `if`.** The CI templates therefore guard each Go or Node step, not the job.
10. **`gh pr checks N --watch` exits 0 on "no checks reported".** Piped into `tail` it hides that, and a pull request merged before its CI started. Wait until the checks exist, then watch without a pipe.
11. **The installer once did nothing, silently, when reached through a symbolic link** — macOS's `/var` and `/tmp` are links to `/private/…`, so `import.meta.url` never equalled `file://` + `argv[1]`. It compares real paths now; a test runs it through a link.

12. **`scaffold.mjs` once did nothing, silently, from `new-worktree.sh`** when the checkout's path held a space or went through a symbolic link: it compared `import.meta.url`, which percent-encodes, with `file://` + `argv[1]`. Same cause as trap 11; any file that is both a module and a script compares real paths.

13. **The git hook and the Claude guard once disagreed about comments.** `pre-commit` was an awk copy of the guard's rules that knew no `#` comments at all, so a Python `# why` was refused inside Claude Code and committed from a terminal. Found installing into a PHP and Python project; a test now stages the same diff through both and compares what each reports.

14. **`process.execPath` is a versioned path under Homebrew** (`/opt/homebrew/Cellar/node/26.9.0/bin/node`) that the next `brew upgrade` deletes, taking every hook registered with it down. The sync registers the first `node` on `PATH` (`/opt/homebrew/bin/node`, a link that survives upgrades) instead.
15. **Git for Windows checks out with `core.autocrlf=true`**, so a shell script arrives with CRLF line endings and `#!/bin/sh\r` is not a shell: every git hook fails, and only on Windows. The template's `.gitattributes` pins `.githooks/*` and `*.sh` to LF in a project. This repository pins every text file to LF (`* text=auto eol=lf`), because the installer copies the template byte for byte: a Windows checkout of groundwork would otherwise install CRLF files everywhere.
16. **`await import(join(here, …))` works everywhere but Windows.** A Windows absolute path, `D:\a\…`, is read as a URL with the scheme `d:` and refused. Every hook loaded its `lib/` that way, so every hook failed on Windows while macOS and Linux passed. A path given to `import()` goes through `pathToFileURL(…).href`.
17. **The git guard judged every git command by the session's own checkout.** `cd ../other && git checkout x` from a chat started in a repository with a second agent live was refused as a branch switch in the shared checkout, though it moved nothing there; a commit in another repository was checked against this one's branch and override names. The guard now follows `cd`, `pushd` and `git -C` through the command and judges each git command by the repository it runs in, with that repository's own `.claude/agent.json`. A directory it cannot know (`cd "$VAR"`) keeps the one before, so an unknown move never loosens the guard.

## 5. Log

Newest first. What changed, why, and what was verified.

### Public release

Published as a public copy: the self-hosted CI runner setup and the history of the private
projects it was grown in were left out, CI runs on GitHub-hosted runners, and the parts catalog
reads the GitHub account of whoever installs it (`GROUNDWORK_OWNER`).
