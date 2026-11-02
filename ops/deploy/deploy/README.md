# Deploying {{PROJECT}}

A merge to `{{MAIN}}` deploys to production by itself. `.github/workflows/deploy.yml` does it;
this file says what it needs and what to do when it fails.

## 1. How a deploy runs

| Job | Does |
|---|---|
| `tested` | looks for a green `ci` run on the merged branch whose tree is the same as the merge, so the gate is not run twice |
| `verify` | otherwise runs `ci.yml` on the merge |
| `guard` | ships only the head of `{{MAIN}}`; an older commit is skipped, since the run for the newer one ships it |
| `ship` | pulls `{{MAIN}}` on the box, runs `scripts/deploy/release.sh`, then `scripts/deploy/smoke.sh` |
| `alert` | opens an issue assigned to the repository owner when any job failed |

When `release.sh` or the smoke check fails, the box is reset to the commit it was running and
`release.sh` runs again with `ROLLBACK=1`. **A migration that already ran is not undone.**

## 2. The repository's Actions settings

| Name | Kind | Holds |
|---|---|---|
| `DEPLOY_SSH_KEY` | secret | a private key whose public half is in the box user's `authorized_keys`, used for nothing else |
| `DEPLOY_HOST` | variable | the box's address |
| `DEPLOY_HOST_KEY` | variable | the box's line from `ssh-keyscan -t ed25519 <host>` — checked, never trusted on first use |
| `DEPLOY_USER` | variable | the user on the box; `root` when unset |
| `DEPLOY_DIR` | variable | the checkout on the box; `/var/www/{{SLUG}}` when unset |
| `SMOKE_URLS` | variable | space-separated addresses that must answer 2xx or 3xx after a deploy, asked from the box |
| `RUNNER` | variable | the runner label; `ubuntu-latest` when unset. Set it to a self-hosted runner's label to run there |
| `NODE_VERSION` | variable | Node for `ci.yml`; the current LTS when unset |
| `NEON_PROJECT_ID` | variable | when set, a Neon branch `pre-deploy-<sha>` is made before every ship and the last five kept |
| `NEON_API_KEY` | secret | needed with `NEON_PROJECT_ID` |

Create a `production` environment too; `ship` runs in it, so a required reviewer or a wait timer
set there holds every deploy.

## 3. The box, once

1. A clone of this repository at `DEPLOY_DIR` on `{{MAIN}}`, able to `git fetch` (a read-only
   deploy key on the repository).
2. Node, pm2 and Go if the project builds them; `pm2 startup` so the processes survive a reboot.
3. The runtime configuration the processes read (`.env`), owned by the deploy user, mode 600.
4. nginx with the files from `deploy/nginx/` (§5) and a certificate for `{{DOMAIN}}`.

## 4. `scripts/deploy/release.sh`

The project's own build-and-restart, run on the box from the checkout. The template installs
dependencies, builds, compiles `./cmd/...` into `bin/` and restarts everything in
`ecosystem.config.js`. Edit it to fit; keep it safe to run twice, because a rollback runs it
again on the previous commit.

It receives `BEFORE_SHA` (the commit the box ran before) on a normal deploy and `ROLLBACK=1` on
a rollback, so it can skip a build whose inputs did not change
(`git diff --quiet "$BEFORE_SHA" HEAD -- web/`) or skip migrations when rolling back.

`ecosystem.config.js` lists the processes. Each listens on loopback only; nginx is the only
thing that faces the internet.

## 5. nginx

| File | Goes to | Is |
|---|---|---|
| `conf.d/{{SLUG}}-cloudflare.conf` | `/etc/nginx/conf.d/` | `${{SNAKE}}_via_cloudflare`: 1 for Cloudflare's ranges and loopback |
| `conf.d/{{SLUG}}-timing.conf` | `/etc/nginx/conf.d/` | the `{{SNAKE}}_timing` log format: time at nginx and at the upstream, per request |
| `snippets/{{SLUG}}-cloudflare-realip.conf` | `/etc/nginx/snippets/` | the real visitor address from `CF-Connecting-IP` |
| `snippets/{{SLUG}}-edge.conf` | `/etc/nginx/snippets/` | refuses anything not through Cloudflare, HSTS, `nosniff` |
| `snippets/{{SLUG}}-proxy.conf` | `/etc/nginx/snippets/` | the headers and timeout every `proxy_pass` shares |
| `sites/{{DOMAIN}}.conf` | `/etc/nginx/sites-available/`, linked from `sites-enabled/` | the site |

Then `nginx -t && systemctl reload nginx`, and `certbot --nginx -d {{DOMAIN}}` for the
certificate. Keep the edited files here, not only on the box.

**The site is reachable only through Cloudflare.** Without that, every visitor looks like a
Cloudflare address, so a per-address sign-in lockout locks out everyone behind the same edge,
and the origin can be hit directly. The check reads `$realip_remote_addr`, not `$remote_addr`,
on purpose: by the time it runs, realip has already replaced `$remote_addr` with the visitor's.

**Turning a DNS record to DNS-only (grey cloud) then answers 403 to every visitor.** Remove the
`include` first, then change DNS. Certbot's HTTP challenge also arrives through Cloudflare, so
the record must be proxied while the certificate is issued.

**Cloudflare's ranges are written into the files.** They change rarely; when they do,
`scripts/cloudflare-ranges.sh` rewrites both from `https://www.cloudflare.com/ips-v4` and
`ips-v6`. Copy them to the box and reload.

The timing log answers "is it slow at nginx or at the process": `rt` is the whole request at
nginx, `urt` the upstream's part, `uct` the connect.

## 6. After a failed deploy

The `alert` job opened an issue with the run's address.

1. Read the run. A failure before **Release** changed nothing on the box.
2. A failure in **Release** or **Smoke check** was rolled back: the box runs the previous
   commit. Check the **Put the code back** step answered every smoke URL.
3. If a migration ran in the failed release, the schema is ahead of the code that is running.
   Decide whether the previous code works on it; if not, restore from the Neon branch
   `pre-deploy-<sha>` or write a forward fix. Never re-run the deploy blindly.
4. Fix on a branch, through a pull request, like everything else.

## 7. Other scripts

- `scripts/check-mail-dns.sh [domain]` — SPF, DKIM, DMARC, BIMI and MX as a public resolver
  sees them, and the next step.
- `scripts/ci-runner-action-cache.sh` — for a self-hosted runner: keeps every action the
  workflows use on the runner's disk, so a slow `codeload.github.com` does not fail a run.
