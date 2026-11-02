#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d)"
project="$scratch/acme"
origin="$scratch/origin.git"
network="groundwork-box-$$"
box="groundwork-box-$$"
runner_image="groundwork-box-runner"
box_image="groundwork-box"
app_dir="/var/www/acme-shop"
smoke="http://127.0.0.1/ http://127.0.0.1/api/health"

cleanup() {
	docker rm -f "$box" >/dev/null 2>&1 || true
	docker network rm "$network" >/dev/null 2>&1 || true
	rm -rf "$scratch"
}
trap cleanup EXIT

say() { printf '\n### %s\n' "$*"; }
fail() {
	echo "REHEARSAL FAILED: $*" >&2
	exit 1
}

say "images"
docker build -q -t "$box_image" -f "$here/test/box/box.Dockerfile" "$here/test/box" >/dev/null
docker build -q -t "$runner_image" -f "$here/test/box/runner.Dockerfile" "$here/test/box" >/dev/null

say "a project installed with --ops --deploys"
mkdir -p "$project"
git -C "$project" init -q -b main
node "$here/install.mjs" "$project" --name "Acme Shop" --checks "npm test" --domain shop.example.org --ops --deploys >/dev/null
cd "$project"
cat >package.json <<'JSON'
{
  "name": "acme-shop",
  "private": true,
  "scripts": {
    "build": "mkdir -p .next/standalone && cp web.js .next/standalone/server.js",
    "test": "true"
  }
}
JSON
cat >web.js <<'JS'
require("node:http").createServer((request, response) => response.end("web")).listen(Number(process.env.PORT), process.env.HOSTNAME);
JS
mkdir -p cmd/api
cat >go.mod <<'MOD'
module example.org/acme

go 1.22
MOD
cat >cmd/api/main.go <<'GO'
package main

import (
	"net/http"
	"os"
)

const healthStatus = http.StatusOK

func main() {
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(healthStatus)
	})
	if err := http.ListenAndServe(os.Getenv("ADDR"), nil); err != nil {
		os.Exit(1)
	}
}
GO
printf 'node_modules/\n.next/\nbin/\n' >>.gitignore
npm install --package-lock-only --silent >/dev/null
git add -A
GROUNDWORK_ALLOW_MAIN_COMMIT=1 ACME_SHOP_ALLOW_MAIN_COMMIT=1 git -c core.hooksPath=/dev/null commit -qm "feat(repo): first"
first=$(git rev-parse HEAD)
git init -q --bare -b main "$origin"
git remote add origin "$origin"
git -c core.hooksPath=/dev/null push -q origin main

say "the box, set up by deploy/README.md §3"
ssh-keygen -q -t ed25519 -N "" -C deploy -f "$scratch/deploy"
docker network create "$network" >/dev/null
docker run -d --name "$box" --hostname box --network "$network" --network-alias box -v "$origin:/srv/origin.git" "$box_image" >/dev/null
docker cp "$scratch/deploy.pub" "$box:/root/.ssh/authorized_keys"
docker cp "$project/deploy/nginx/." "$box:/tmp/nginx/"
docker exec "$box" bash -euo pipefail -c "
	chown root:root /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
	git clone -q /srv/origin.git $app_dir
	cp /tmp/nginx/conf.d/* /etc/nginx/conf.d/
	mkdir -p /etc/nginx/snippets && cp /tmp/nginx/snippets/* /etc/nginx/snippets/
	cp /tmp/nginx/sites/shop.example.org.conf /etc/nginx/sites-available/
	ln -s /etc/nginx/sites-available/shop.example.org.conf /etc/nginx/sites-enabled/
	nginx -t -q && nginx
	install -m 600 /dev/null $app_dir/.env
"
host_key=$(docker run --rm --network "$network" "$runner_image" ssh-keyscan -t ed25519 box 2>/dev/null)
[ -n "$host_key" ] || fail "no host key from the box"

job() {
	local name="$1" sha="$2"
	docker run --rm --network "$network" \
		-v "$project:/work:ro" -v "$here/test/box/run-job.sh:/run-job.sh:ro" -w /work \
		-e DEPLOY_KEY="$(cat "$scratch/deploy")" -e DEPLOY_HOST=box -e DEPLOY_HOST_KEY="$host_key" \
		-e TARGET=root@box -e APP_DIR="$app_dir" -e SMOKE_URLS="$smoke" -e SHA="$sha" \
		-e SSH_WAIT_ATTEMPTS=3 -e SSH_WAIT_PAUSE=2 \
		"$runner_image" bash /run-job.sh .github/workflows/deploy.yml "$name"
}
on_box() { docker exec "$box" bash -c "cd $app_dir && $*"; }

say "1. the first deploy ships the head of main"
guard=$(job guard "$first") || fail "guard refused the head of main"
grep -q '^ship=yes$' <<<"$guard" || fail "guard did not say ship=yes for the head"
job ship "$first" || fail "the first ship failed (exit $?)"
[ "$(on_box git rev-parse HEAD)" = "$first" ] || fail "the box is not at the first commit"
[ "$(on_box curl -s http://127.0.0.1/)" = "web" ] || fail "nginx does not serve the web process"
on_box pm2 jlist | grep -q '"name":"acme-shop-api"' || fail "pm2 does not run the api"

say "2. a deploy whose smoke check fails puts the last good commit back"
sed -i.bak 's/http.StatusOK/http.StatusInternalServerError/' cmd/api/main.go && rm cmd/api/main.go.bak
git commit -qam "feat(api): broken" --no-verify
broken=$(git rev-parse HEAD)
git -c core.hooksPath=/dev/null push -q origin main
if job ship "$broken"; then fail "a broken deploy was reported as a success"; fi
[ "$(on_box git rev-parse HEAD)" = "$first" ] || fail "the box was not put back on the first commit"
[ "$(on_box curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health)" = "200" ] || fail "the api is not healthy after the rollback"

say "3. an older commit is not shipped once main has moved on"
guard=$(job guard "$first") || fail "guard failed on an older commit"
grep -q '^ship=no$' <<<"$guard" || fail "guard would ship a commit that is not the head"

say "4. the fixed commit ships"
git -c core.hooksPath=/dev/null revert --no-edit HEAD >/dev/null
fixed=$(git rev-parse HEAD)
git -c core.hooksPath=/dev/null push -q origin main
job ship "$fixed" || fail "the fixed ship failed"
[ "$(on_box git rev-parse HEAD)" = "$fixed" ] || fail "the box is not at the fixed commit"

say "the deploy template shipped, rolled back and refused as written"
