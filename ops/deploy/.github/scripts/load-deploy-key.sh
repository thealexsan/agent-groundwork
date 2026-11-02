#!/usr/bin/env bash
set -euo pipefail

missing=""
[ -n "${DEPLOY_KEY:-}" ] || missing="$missing secret DEPLOY_SSH_KEY,"
[ -n "${DEPLOY_HOST:-}" ] || missing="$missing variable DEPLOY_HOST,"
[ -n "${DEPLOY_HOST_KEY:-}" ] || missing="$missing variable DEPLOY_HOST_KEY,"

if [ -n "$missing" ]; then
	echo "::error::Deploying needs, in the repository's Actions settings:${missing%,}. deploy/README.md says what each holds."
	exit 1
fi

mkdir -p ~/.ssh
printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/deploy
chmod 600 ~/.ssh/deploy
printf '%s\n' "$DEPLOY_HOST_KEY" > ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
