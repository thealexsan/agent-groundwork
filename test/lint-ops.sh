#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
project="$(mktemp -d)/acme"
trap 'rm -rf "$(dirname "$project")"' EXIT

mkdir -p "$project"
git -C "$project" init -q -b main
node "$here/install.mjs" "$project" --name "Acme Shop" --checks "npm test" --domain shop.example.org --ops --deploys >/dev/null
echo '{"name":"acme","private":true,"scripts":{"test":"true"}}' > "$project/package.json"

cd "$project"

echo "== actionlint"
docker run --rm -v "$project:/repo" -w /repo rhysd/actionlint:1.7.12

echo "== shellcheck"
docker run --rm -v "$project:/mnt" -w /mnt koalaman/shellcheck:v0.11.0 .github/scripts/*.sh scripts/*.sh scripts/deploy/*.sh
docker run --rm -v "$here:/mnt" -w /mnt koalaman/shellcheck:v0.11.0 test/box.sh test/box/run-job.sh

echo "== nginx -t"
nginx="$project/deploy/nginx"
docker run --rm \
	-v "$nginx/conf.d/acme-shop-cloudflare.conf:/etc/nginx/conf.d/acme-shop-cloudflare.conf:ro" \
	-v "$nginx/conf.d/acme-shop-timing.conf:/etc/nginx/conf.d/acme-shop-timing.conf:ro" \
	-v "$nginx/sites/shop.example.org.conf:/etc/nginx/conf.d/shop.example.org.conf:ro" \
	-v "$nginx/snippets:/etc/nginx/snippets:ro" \
	nginx:1.28-alpine nginx -t

echo "== ecosystem.config.js"
node -e 'const { apps } = require(process.argv[1]); if (apps.length === 0) process.exit(1); console.log(apps.map((app) => app.name).join(", "))' "$project/ecosystem.config.js"
