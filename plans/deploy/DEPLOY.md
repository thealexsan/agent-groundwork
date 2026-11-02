# Deploying {{PROJECT}}

What runs in production, where, and how to get it back. A merge to `{{MAIN}}` deploys by itself;
with groundwork `--ops`, `deploy/README.md` describes that pipeline and its settings. This file
is the record of the boxes and accounts it lands on — everything that is **not** in the
repository and would otherwise live only in someone's head.

Every claim here carries the date it was checked. When the box changes, this file changes in the
same pull request, or the same day.

## 0. What is actually running (checked YYYY-MM-DD)

| Part | Where | Notes |
|---|---|---|
| DNS and edge | | proxied or not; which records |
| Box | provider, size, address, OS | who else runs on it |
| Processes | pm2 / systemd names and ports | each on loopback |
| Web server | nginx, which sites | |
| Database | managed or on the box, version, region | |
| Cache, sessions, queue | | |
| File storage | bucket, region, who may read it | never a public domain on a bucket holding private files |
| Mail | provider, sending domain | `scripts/check-mail-dns.sh` |
| Monitoring and alerts | what pages whom | |
| CI runners | hosted or self-hosted, where | |

### How production ships

One paragraph: what triggers a deploy, what it builds, what it restarts, what it checks after,
what it does on failure. With groundwork `--ops`, `deploy/README.md` §1.

### After a failed deploy

`deploy/README.md` §6, plus anything particular to this project — which steps are not undone by
a rollback, and how to undo them.

### Redeploying by hand

The exact commands, for the day CI cannot reach the box. Test them once.

```bash
ssh <user>@<box>
cd /var/www/{{SLUG}}
git checkout {{MAIN}} && git pull --ff-only
scripts/deploy/release.sh
```

## 1. Configuration that is not in the repository

Every file on the box that changes behaviour and is not tracked: `.env` files (names of the
keys, never the values), nginx files edited in place, cron and systemd timers, firewall rules,
`/etc/hosts` pins, kernel and database settings. Each with why it exists and how to roll it back.

## 2. Backups

| What | How | Where it goes | Kept | Last restored |
|---|---|---|---|---|
| Database | | | | never — do it |
| Files | | | | |
| Box configuration | | | | |

A backup that has never been restored is a belief, not a backup. Write the restore steps here and
the date they last worked.

## 3. Accounts

Who owns each account (registrar, DNS, box, database, storage, mail, monitoring, GitHub), where
its credentials live, and who else can get in. Never the credentials themselves.

## 4. Traps

What looked right on a server and was wrong. One entry each: what happens, why, how to avoid it.

1. **A proxied DNS record switched to DNS-only answers 403 to every visitor** when nginx only
   accepts the CDN's addresses. Remove the origin guard first, then change DNS.
2. **A pin in `/etc/hosts` outlives the reason for it.** It silently sends one box's traffic
   around the CDN. Write every pin here, with its reason.
