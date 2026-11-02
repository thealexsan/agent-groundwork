#!/usr/bin/env bash
set -uo pipefail

workflow="$1"
job="$2"

export GITHUB_OUTPUT GITHUB_ENV
GITHUB_OUTPUT="$(mktemp)"
GITHUB_ENV="$(mktemp)"

while IFS= read -r line; do
	export "${line?}"
done < <(yq -r '.env | to_entries | .[] | select(.value | test("\$\{\{") | not) | .key + "=" + (.value | tostring)' "$workflow")

load_env() {
	while IFS= read -r line; do
		[ -n "$line" ] && export "${line?}"
	done <"$GITHUB_ENV"
}

run_step() {
	local index="$1" name script
	name=$(yq -r ".jobs.$job.steps[$index].name // \"step $index\"" "$workflow")
	script=$(yq -r ".jobs.$job.steps[$index].run" "$workflow")
	# shellcheck disable=SC2016
	if grep -qF '${{' <<<"$script"; then
		echo "!! $name: a run block holds a \${{ }} expression this rehearsal cannot fill" >&2
		return 1
	fi
	echo "== $job: $name"
	bash --noprofile --norc -eo pipefail -c "$script"
	local status=$?
	load_env
	return "$status"
}

count=$(yq -r ".jobs.$job.steps | length" "$workflow")
failed=0
for index in $(seq 0 $((count - 1))); do
	[ "$(yq -r ".jobs.$job.steps[$index].run // \"\"" "$workflow")" = "" ] && continue
	condition=$(yq -r ".jobs.$job.steps[$index].if // \"\"" "$workflow")
	case "$condition" in
		"") [ "$failed" = 0 ] && { run_step "$index" || failed=1; } ;;
		*failure\(\)*) [ "$failed" = 1 ] && { run_step "$index" || echo "!! the failure step failed too" >&2; } ;;
		*) echo "== $job: skipping, as its condition is not met here: $condition" ;;
	esac
done

cat "$GITHUB_OUTPUT"
exit "$failed"
