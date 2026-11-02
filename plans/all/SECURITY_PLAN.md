# Security plan — {{PROJECT}}

What gets scanned, with which tool, how often, and what each pass found. The rules the code must
follow are in `.claude/rules/security.md`; this file is about finding where it does not. Every
manual pass gets a date when it is done.

## 0. Do first

What a pass turned up that does not wait for any tool. Delete a row when it is done and write
the date in `HANDOVER.md`.

| # | What | Why |
|---|------|-----|
| 1 | List every credential that has ever been pasted into a chat, an issue or a ticket, and rotate it | A transcript is not a vault |
| 2 | Turn on Dependabot alerts and secret scanning for the repository | The second pair of eyes for the scanners below |

## 1. What runs by itself

`.github/workflows/security.yml` (groundwork `--ops`) runs on every pull request, every Monday and
on demand. A red job is a red check: the pull request is not merged until it is fixed or the
finding is accepted in `.trivyignore.yaml` with a statement and an `expired_at` date — never
without both.

| Job | Tool | Covers | Fails on |
|-----|------|--------|----------|
| Go vulnerabilities | `govulncheck` | Go modules and the standard library, only where the code calls the vulnerable function | any called vulnerability |
| Dependencies, config and secrets in files | `trivy fs` | lockfiles, `go.mod`, Dockerfiles, compose and config files, secrets in tracked files | HIGH or CRITICAL |
| Secrets in git history | `gitleaks` | every commit ever pushed | any secret |

When a scanner is added in report-only mode (gosec, semgrep), say here why it does not fail the
build and what has to be true before it does.

## 2. What a person runs, and how often

| Area | How | When |
|------|-----|------|
| **Isolation between customers** — the one that matters most for any multi-tenant product | A contract test per endpoint: signed in as customer A, every id of customer B answers 403 or 404, for every role | Built once, then in CI forever |
| Authorization inside one customer | The same matrix: the least-privileged role asks for a colleague's data | With the isolation matrix |
| Front ends | `semgrep --config p/react --config p/nextjs --config p/typescript`; a grep for `dangerouslySetInnerHTML` | Quarterly, and before a release that adds rich text |
| Running site, passive | OWASP ZAP baseline against `{{DOMAIN}}`: headers, cookies, CSP, mixed content | Monthly |
| Running site, active | ZAP full scan against a copy, never production | Before each major release |
| TLS and headers | `testssl.sh` against every host; securityheaders.com | Monthly |
| Open ports | `nmap -Pn -p-` against every box from outside; write down what is expected open and from where | Monthly, and after any change on a box |
| Servers | pending upgrades, unattended upgrades on, `sshd -T` (no password login), which processes run as root, `.env` files `0600` | Monthly |
| Container images | `trivy image` on every image compose and CI pull | Monthly |
| GitHub | 2FA on, deploy keys read-only, each Actions secret still needed, self-hosted runners only on private repositories, workflow permissions `contents: read` unless a job needs more; `zizmor .github/workflows` | Quarterly |
| Cloud accounts | API keys scoped to what they need, no public storage bucket, the CDN's origin guard still matches its published ranges | Quarterly |
| Personal data | No personal data in logs (read a day of them); backups in the region the customers were promised; deleting a person reaches their files | Quarterly |
| Penetration test | An outside firm, against a copy | Yearly, or before the first large customer asks |

## 3. Where a finding goes

- A fix: a pull request like any other, `fix(<scope>): …`.
- Accepted risk in a dependency: `.trivyignore.yaml`, with the statement and an expiry.
- Accepted risk anywhere else, or a manual pass done: one dated line in `HANDOVER.md`.
- A secret that leaked: rotate first, then clean up. Rewriting git history does not un-leak it.
