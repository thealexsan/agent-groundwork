#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
ci-runner-action-cache.sh — keep the actions the workflows use on a self-hosted runner's own disk.

    scripts/ci-runner-action-cache.sh [cache-directory]

Runs on the runner's machine, as root. Reads every `uses:` in .github/workflows, resolves each
ref to the commit the Actions service resolves it to, and stores the tarball where the runner
looks for it before reaching for codeload.github.com:

    <cache-directory>/<owner>_<repo>/<sha>.tar.gz     default /opt/ci-cache/actions

The runner only looks there when ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE names the directory, so
each runner needs the line once, then a restart of its service:

    echo 'ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE=/opt/ci-cache/actions' >> <runner-directory>/.env
    systemctl restart actions.runner.<owner>-<repo>.<runner-name>

Run this again after bumping an action's version; an entry that is no longer used is dead
weight, not a failure. Nothing here changes what a job does — a cache miss just downloads.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

cache="${1:-/opt/ci-cache/actions}"
workflows="$(cd "$(dirname "$0")/.." && pwd)/.github/workflows"

if [[ ! -d "$workflows" ]]; then
	echo "no workflows at $workflows" >&2
	exit 1
fi

mkdir -p "$cache"

refs=$(grep -rhoE 'uses:[[:space:]]*[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@[A-Za-z0-9._-]+' "$workflows" |
	sed -E 's/^uses:[[:space:]]*//' | sort -u)

for ref in $refs; do
	action="${ref%@*}"
	version="${ref#*@}"
	owner="${action%%/*}"
	rest="${action#*/}"
	repo="${rest%%/*}"

	resolved=""
	for attempt in 1 2 3 4 5; do
		if resolved=$(git ls-remote "https://github.com/$owner/$repo" \
			"refs/tags/$version^{}" "refs/tags/$version" "refs/heads/$version"); then
			break
		fi
		resolved=""
		sleep $((attempt * 3))
	done

	sha=$(awk '$2 ~ /\^\{\}$/ { print $1; exit }' <<<"$resolved")

	if [[ -z "$sha" ]]; then
		sha=$(head -1 <<<"$resolved" | cut -f1)
	fi

	if [[ -z "$sha" ]]; then
		if [[ "$version" =~ ^[0-9a-f]{40}$ ]]; then
			sha="$version"
		else
			echo "could not resolve $ref" >&2
			exit 1
		fi
	fi

	file="$cache/${owner}_${repo}/$sha.tar.gz"

	if [[ -f "$file" ]]; then
		echo "have    $owner/$repo@$version ($sha)"
		continue
	fi

	mkdir -p "$(dirname "$file")"
	curl -fsSL --connect-timeout 20 --retry 5 --retry-delay 3 --retry-all-errors \
		--speed-limit 2048 --speed-time 30 \
		"https://codeload.github.com/$owner/$repo/tar.gz/$sha" -o "$file.tmp"
	gzip -t "$file.tmp"
	mv "$file.tmp" "$file"
	echo "cached  $owner/$repo@$version ($sha)"
done

if id runner >/dev/null 2>&1; then
	chown -R runner:runner "$cache"
fi
