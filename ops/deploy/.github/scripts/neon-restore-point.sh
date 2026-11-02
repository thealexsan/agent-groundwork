#!/usr/bin/env bash
set -euo pipefail

: "${NEON_API_KEY:?NEON_API_KEY is not set}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is not set}"
: "${SHA:?SHA is not set}"

keep=${NEON_RESTORE_POINTS_KEPT:-5}
prefix=pre-deploy-
name="$prefix${SHA:0:12}"
api="https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID"

neon() {
	curl -fsS --retry 3 --max-time 30 -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" "$@"
}

branches=$(neon "$api/branches")

if printf '%s' "$branches" | python3 -c 'import json,sys; sys.exit(0 if any(b["name"] == sys.argv[1] for b in json.load(sys.stdin)["branches"]) else 1)' "$name"; then
	echo "restore point $name already exists"
else
	neon -X POST "$api/branches" -d "{\"branch\":{\"name\":\"$name\"}}" >/dev/null
	echo "restore point $name created from the default branch, no compute attached"
fi

branches=$(neon "$api/branches")
printf '%s' "$branches" | python3 -c '
import json, sys
prefix, keep = sys.argv[1], int(sys.argv[2])
points = sorted((b for b in json.load(sys.stdin)["branches"] if b["name"].startswith(prefix)), key=lambda b: b["created_at"], reverse=True)
for b in points[keep:]:
    print(b["id"], b["name"])
' "$prefix" "$keep" | while read -r id old; do
	neon -X DELETE "$api/branches/$id" >/dev/null
	echo "pruned $old"
done
