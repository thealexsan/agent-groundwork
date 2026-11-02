# groundwork

The way of working with coding agents, as something a project installs: the rule files, the
handover documents, the hooks that enforce the rules instead of hoping they are remembered, the
skills, and the guards that let several agents share one repository.

It was grown in one product over months and extracted so the next project starts with it.

## Install it into a project

```bash
git clone https://github.com/thealexsan/agent-groundwork.git groundwork
node groundwork/install.mjs path/to/project \
  --name "Acme Shop" \
  --description "An online shop for small bakeries." \
  --checks "npm run typecheck && npm test" \
  --scopes "api,web,ui,docs,ci,repo" \
  --domain shop.example.org \
  --rules go,nextjs,ui,page-weight \
  --deploys --ops --plans
```

| Option | Default | Sets |
|---|---|---|
| `--name` | the directory's name | the project name used throughout |
| `--description` | a reminder to write one | the opening of `AGENTS.md` and `HANDOVER.md` |
| `--main` | `main` | the protected branch |
| `--prefix` | the name, upper-cased | the override variables, `<PREFIX>_ALLOW_…` |
| `--checks` | a command that fails with a reminder | the gate run before every commit |
| `--scopes` | `repo` | the commit scopes |
| `--extensions` | `ts,tsx,js,jsx,mjs,cjs,go,py` | which files are checked for comments |
| `--domain` | `example.com` | the production address, in the deploy files |
| `--deploys` | off | says a merge to the main branch deploys to production |
| `--ops` | off | adds the CI and security workflows; with `--deploys`, the deploy files too |
| `--plans` | off | adds the security, scaling and SEO plans; with `--deploys`, `DEPLOY.md` too |
| `--rules` | none | extra path rules: `go`, `nextjs`, `ui`, `page-weight` |
| `--business` | none | a person who is not a programmer shares the assistant: adds `who-is-asking` |
| `--engineer` | `the engineer` | with `--business`, the engineer's name |
| `--library` | off | adds the `release` skill |
| `--force` | off | replaces files that already exist |

## Update a project installed before: `--update`

```bash
node groundwork/install.mjs path/to/project --update
```

Replaces what groundwork owns — `.claude/hooks/`, `.githooks/`, its skills in `.claude/skills/`,
`scripts/new-worktree.mjs` — with this version, filled from the project's `.claude/agent.json`, and
lists every file it changed. A file an earlier version installed and this one no longer ships is
removed, unless the project changed it — `installed` in `.claude/agent.json` records what was
installed and its fingerprint. What the project owns is never touched: `CLAUDE.md`, `AGENTS.md`, both
copies of the standing rules and `.claude/settings.json` get this version beside them to merge,
everything else is kept. `groundwork` in `.claude/agent.json` is the version last installed or updated from, so
`gh release view -R thealexsan/agent-groundwork` against it says whether a project is behind. That copy is offered once: `offered` in `.claude/agent.json` records what
was put beside each kept file, and a later update writes it again only when this version's differs
from that. `--rules`, `--plans` and `--ops` add their files as on a fresh install.

An install before v0.7.0 did not record the gate, the commit scopes or the description in
`.claude/agent.json`; the files that need them are listed and left alone until the update is run
once with `--checks`, `--scopes` and `--description`, which records them there.

## Keeping a project's own files

A file that already exists is kept and listed. A kept `CLAUDE.md`, `AGENTS.md`,
`.claude/standing-rules.md`, `.agents/rules/00-standing-rules.md` or `.claude/settings.json` that
differs from the template gets the template's version beside it — `CLAUDE.groundwork.md`,
`.claude/settings.groundwork.json` — to merge in by hand and delete. Restart any open chat afterwards — the hooks are
read when a chat starts.

## What a project gets

| File | What it is for |
|---|---|
| `CLAUDE.md` | the rules in full — the canonical copy |
| `AGENTS.md` | the same rules, short, for every other agent |
| `HANDOVER.md` | the repository's memory: what it is, decisions, traps, a log |
| `NEXT_STEPS.md` | the ordered list of what is left |
| `.claude/standing-rules.md` | the text injected at the start of every session and after every compaction |
| `.claude/agent.json` | what the hooks check |
| `.claude/hooks/` | the enforcement inside Claude Code |
| `.claude/skills/` | `git-commit-push`, `ask-first`, `no-inline-comments` (+ `release`, + `who-is-asking`) |
| `.claude/rules/` | security and performance rules |
| `.githooks/` | the same enforcement for every other agent and a bare terminal |
| `.agents/rules/` | the pointer other agents read |
| `scripts/new-worktree.mjs` | a second checkout for a second chat (`node scripts/new-worktree.mjs <type>/<topic>`) |

`.agent/` is added to `.gitignore`: the scratch directory for `progress.md`, `todo.md` and
`decisions.md` while work is in flight.

## CI, deploy and ops: `--ops`

Optional, because they assume a stack: GitHub Actions, and for deploying one box running nginx
and pm2 behind Cloudflare. Every file is a starting point the project then owns and edits.

| File | With | What it is for |
|---|---|---|
| `.github/workflows/ci.yml` | `--ops` | runs the gate (`--checks`) on every pull request; sets up Go and Node when it finds them; callable by the deploy |
| `.github/workflows/security.yml` | `--ops` | govulncheck on every Go module, trivy over dependencies, config and secrets in files, gitleaks over history — on every pull request and weekly |
| `.trivyignore.yaml` | `--ops` | accepted findings, each with a reason and an expiry |
| `scripts/ci-runner-action-cache.sh` | `--ops` | for a self-hosted runner: keeps the actions on its disk |
| `.github/workflows/deploy.yml` | `--ops --deploys` | a merge to the main branch ships to the box; skips a gate already passed on the pull request, ships only the head, rolls back and opens an issue on failure |
| `.github/scripts/` | `--ops --deploys` | the deploy key, waiting for ssh, an optional Neon restore point |
| `scripts/deploy/release.sh`, `smoke.sh` | `--ops --deploys` | the project's build-and-restart on the box, and the addresses that must answer after it |
| `ecosystem.config.js` | `--ops --deploys` | the pm2 processes, each on loopback |
| `deploy/nginx/` | `--ops --deploys` | Cloudflare-only origin, real visitor address, a per-request timing log, shared proxy headers, the site |
| `scripts/cloudflare-ranges.sh` | `--ops --deploys` | rewrites the Cloudflare files from Cloudflare's published ranges |
| `scripts/check-mail-dns.sh` | `--ops --deploys` | SPF, DKIM, DMARC and BIMI as a public resolver sees them |
| `deploy/README.md` | `--ops --deploys` | the Actions variables and secrets, the box, nginx, and what to do after a failed deploy |

The deploy reads its settings from the repository's Actions variables and secrets
(`DEPLOY_HOST`, `DEPLOY_HOST_KEY`, `DEPLOY_SSH_KEY`, `SMOKE_URLS`, …), not from the file, and
refuses with the list of what is missing.

## Plans: `--plans`

Documents for decisions that are easy to make badly in a hurry. Each is a skeleton with the
method already in it; the project fills in its own facts, with the date each was checked.

| File | With | What it is for |
|---|---|---|
| `SECURITY_PLAN.md` | `--plans` | what runs by itself, what a person runs and how often, where a finding goes |
| `SCALING.md` | `--plans` | what is running, and a measured trigger for every scaling step — nothing is built before its trigger fires |
| `SEO_PLAN.md` | `--plans` | the technical foundation, the business questions to answer before writing content, and what the plan refuses to promise |
| `DEPLOY.md` | `--plans --deploys` | what runs in production and where, configuration that is not in the repository, backups and when they were last restored, accounts, traps |

Each installed plan is listed in `CLAUDE.md`'s "Where the rest lives" and in `AGENTS.md`'s
"Read before working", with when to read it.

## Path rules: `--rules`

Rules for one kind of file, loaded by Claude Code only when a file they govern is touched. Every
project gets `security.md` and `performance.md`; these are added by name.

| File | With | What it is for |
|---|---|---|
| `.claude/rules/go.md` | `--rules go` | one module, the standard library, SQL generated by sqlc, migrations as the only schema history, the viewer on every query, errors, time and money, jobs, and the gates |
| `.claude/rules/nextjs.md` | `--rules nextjs` | the installed version's docs before memory, generated route types, the server and client line, `server-only` and `NEXT_PUBLIC_*`, per-person reads never cached, server actions as public endpoints, a layout is not a gate, and every route's states |
| `.claude/rules/ui.md` | `--rules ui` | one primary action, every state, the server decides, phones first, every string translated, tokens and shared patterns |
| `.claude/rules/page-weight.md` | `--rules page-weight` | a JavaScript budget per page, server rendering first, heavy things on demand, and how to measure |

Each installed rule is listed in `CLAUDE.md` and `AGENTS.md` with when to read it. The `paths:`
at the top of each file are a guess at a typical layout; narrow them to the project's folders.

## Two people, one assistant: `--business`

For a project where an engineer and someone who runs the business — not a programmer — share the
assistant. `--business Sam --engineer Robin` adds `.claude/skills/who-is-asking/` and a rule in
`CLAUDE.md`, `AGENTS.md`, the standing rules and `.agents/rules/`: the first line of a message
says who is speaking. "I am Sam", or a message opening with "business logic" or "flow", gets
business mode — screens, people and rules, with the engineering written to `.agent/` instead of
the reply. Anything else is engineer mode.

The names are recorded in `.claude/agent.json`. The skill belongs to the project: add the ways
each person really opens a message, in their language, to its table. `--update` keeps it and
writes the template's version beside it when they differ, like `CLAUDE.md`.

## What is enforced

| Rule | In Claude Code | For everyone else |
|---|---|---|
| no commit on the main branch | `git-guard` refuses the command and names the branch-and-PR steps | `pre-commit` |
| no push to the main branch | — | `pre-push` |
| no assistant attribution in a commit or pull request | `git-guard`, and `attribution` is empty in settings | `commit-msg` |
| no comments added to code | `git-guard` reads the staged diff | `pre-commit`, through the same `.claude/hooks/lib/comments.mjs` (needs node) |
| the rules survive a long chat | `session-start` reinjects them after every compaction | — |
| two agents do not write in one checkout | `write-guard` refuses the write, `git-guard` the branch switch | — |

Every refusal says what to do instead and names its override — `ACME_ALLOW_MAIN_COMMIT=1`,
`ACME_ALLOW_COMMENTS=1`, `ACME_ALLOW_BRANCH_SWITCH=1`, `ACME_ALLOW_MAIN_PUSH=1`,
`ACME_ALLOW_ATTRIBUTION=1` — for the rare time it is meant.

## Several agents in one repository

Each chat registers itself in `.git/agent-claims.json` at session start. The map of who is where
is shown to every new chat. While another agent is live in the same checkout, a write or a
branch switch there is refused and the agent is told to take its own worktree with
`EnterWorktree`; a hook then copies what `.claude/agent.json` lists under `worktree.copy`
(`node_modules` by default) and symlinks `.agent/` so every agent reads the same notes.

## Tuning a project: `.claude/agent.json`

```json
{
  "project": "Acme Shop",
  "mainBranch": "main",
  "overridePrefix": "ACME_SHOP",
  "mainDeploys": true,
  "comments": {
    "paths": ["api/", "web/"],
    "extensions": ["ts", "tsx", "go"],
    "ignore": ["web/generated/"]
  },
  "worktree": {
    "copy": ["node_modules", "web/node_modules"],
    "share": [".agent"]
  }
}
```

`owned` lists paths the project has made its own although groundwork ships them — a skill
rewritten for the project, say. A path ending in `/` covers a folder. Neither an install nor
`--update` ever writes one: an owned file that exists is kept, with groundwork's version written
beside it when the two differ and that version was not offered before, and one that does not exist
stays absent.

`comments.paths` empty means the whole repository. A file marked generated in Go's way — a
`// Code generated … DO NOT EDIT.` line, as sqlc, protoc and stringer write — is never checked. The installer fills `comments.ignore` with the
tracked folders that look like someone else's code — one holding its own `LICENSE` or `COPYING`, a
`vendor`, `third_party` or `third-party` folder, `.agents/skills/` and `.claude/skills/` — when they
hold files of a checked extension, and lists them. The standing rules are plain Markdown in
`.claude/standing-rules.md`; keep them short, they are read at the start of every session.

## Our stack, for every agent on a machine: `global/setup.sh`

macOS and Linux:

```bash
gh auth login
gh repo clone thealexsan/agent-groundwork ~/.groundwork && ~/.groundwork/global/setup.sh
```

Windows, in PowerShell:

```powershell
gh auth login
gh repo clone thealexsan/agent-groundwork $HOME\.groundwork
powershell -ExecutionPolicy Bypass -File $HOME\.groundwork\global\setup.ps1
```

One rule and one skill, for every coding agent on the machine and every one installed later:

| File | What it is |
|---|---|
| `global/rules/our-stack.md` | the rule: use our ready parts from the owner's GitHub account first, build on our stack by default, leave it only for a stated reason |
| `global/skills/our-stack/` | the catalog of parts with install lines, the stack layer by layer, and when leaving it is allowed |
| `global/catalog.mjs` | builds the skill's table of parts from the repositories with the `our-part` topic, each at its latest release or else its newest tag |
| `global/sync.mjs` | writes the rule between markers into each agent's global instructions, shares the skill, links every `~/.claude_account*`, registers the hook |
| `global/hooks/our-stack.mjs` | Claude Code session start: pulls groundwork once a day, runs the sync, puts the rule in front of the agent |
| `global/hooks/standing-skills.mjs` | Claude Code session start and every compaction: injects the full text of the standing skills (`short-answers`, `our-stack`, and the project's `ask-first`, `commit-discipline`, `verify-before-done`, `targeted-tests`, `context-handoff`, `no-code-comments` and their template names) and the `Traps` section of `HANDOVER.md`, across eight hook slots because Claude Code caps one hook's output at 10,000 characters; a project sets its own in `.claude/agent.json` `standingSkills` and `standingDocs`. A chat that started without it is told once, on its next prompt, to load them (through `short-answers.mjs`, which every chat already runs) |
| `global/setup.sh`, `global/setup.ps1` | a new machine, macOS and Linux or Windows: checks git, node and gh, signs in, clones to `~/.groundwork`, sets `GOPRIVATE`, runs the sync |

The sync writes to whichever of these exist: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`,
`~/.gemini/GEMINI.md` (Gemini CLI and Antigravity), `~/.copilot/copilot-instructions.md`,
Windsurf's `global_rules.md`, `~/.config/opencode/AGENTS.md`, `~/.qwen/QWEN.md`. The skill lives in
`~/.agents/skills/our-stack`, linked from `~/.claude/skills` and `~/.codex/skills`. Everything
outside the markers is left alone. An agent installed later gets the rule at the next Claude Code
session start, or at once with `node ~/.groundwork/global/sync.mjs`.

The parts table is not edited by hand. A new part is a repository with a description and the
`our-part` topic (`gh repo edit <owner>/<name> --add-topic our-part`); its version is its latest
release, or its newest tag when it has none. The sync fetches the list in one GitHub call and keeps
it in `~/.agents/our-stack-parts.json`; the session-start hook refreshes that file in the background
once a day, so a session never waits on GitHub, and a failed fetch keeps the last list.
`node global/catalog.mjs` writes the same table into the committed skill, the copy a machine
without `gh` sees.

## Hooks for the person, not the project

`global/hooks/` holds hooks that belong in `~/.claude/hooks`, and `global/settings-snippet.json`
the lines that wire them into `~/.claude/settings.json`:

| Hook | Does |
|---|---|
| `chat-length-warning.mjs` | warns at about 200k tokens of context and urges a new chat at 400k |
| `usage-limit-warning.mjs` | warns once at 80, 90 and 95 % of the session limit |
| `usage-handbrake.mjs` | above 90 % refuses everything except reading and writing a handover |
| `usage-state.mjs` | reads the account's usage; shared by the two above |
| `short-answers.mjs` | reminds the agent to answer briefly, and tells a chat that missed the standing skills to load them |

They are not installed by `install.mjs`. The usage hooks read the Claude login from the macOS
keychain and work only there.

## Our parts: whose account

"Our parts" are the repositories of one GitHub account with the `our-part` topic. The account is
`GROUNDWORK_OWNER` when set, else the account `gh` is signed in as. With no parts yet the
catalog is empty and the rule still sets the stack; tag a repository to add one. The stack in
`global/rules/our-stack.md` is an opinion — edit it to yours before running the sync.

## CI

The workflows here and in `--ops` run on GitHub-hosted runners: `ubuntu-latest`, or
`${{ vars.RUNNER || 'ubuntu-latest' }}` in the `--ops` templates, so a project can point them at a
self-hosted runner by setting the `RUNNER` Actions variable.

## Windows

A project installed by groundwork works on Windows with Git for Windows and node:

- Claude Code runs every hook as `node` with the script's path (the exec form), with no shell
  between, so it works under Git Bash and under PowerShell alike.
- `.githooks/` are POSIX shell scripts, which Git for Windows runs with its own `sh`. The
  installed `.gitattributes` keeps them, and every `.sh`, at LF line endings; a CRLF checkout
  breaks the `#!/bin/sh` line.
- A worktree's shared `.agent/` is a junction, which needs no administrator rights.
- `scripts/new-worktree.mjs` is node, not bash.

On the machine side, `setup.ps1` does what `setup.sh` does. The sync links the shared skill with
a junction and finds `node.exe` on the path. Linking a single file — an account's `settings.json`
or `CLAUDE.md` — needs Developer Mode on (Settings → System → For developers), and the sync says
so when it is off. The deploy files in `--ops --deploys` run on the Linux box and in Actions, not on
the developer's machine.

## Tests

```bash
npm test
test/lint-ops.sh
```

CI runs `npm test` on Linux, Windows and macOS, and `test/box.sh` on Linux. `test/box.sh` rehearses
a deploy end to end in Docker: a box container (sshd, git, node, Go, pm2, nginx) set up the way
`deploy/README.md` §3 says, and a runner container that executes the `run:` blocks of the installed
`deploy.yml` itself. It ships the head of `main`, ships a commit whose smoke check fails and checks
that the last good commit is back and healthy, refuses an older commit once `main` has moved on,
and ships the fix. `lint-ops.sh` installs `--ops --deploys` into a throwaway project and runs actionlint,
shellcheck and `nginx -t` on the result, in Docker.

Each test installs the template into a throwaway repository and drives the real hooks: a commit
on the main branch, a comment in a staged diff, a push, a session start, and two agents in one
checkout.
