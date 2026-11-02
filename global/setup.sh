#!/usr/bin/env bash
set -euo pipefail

GROUNDWORK_HOME="${GROUNDWORK_HOME:-$HOME/.groundwork}"

usage() {
	cat <<'USAGE'
setup.sh — give every coding agent on this machine our stack rule and the our-stack skill.

    gh auth login
    gh repo clone thealexsan/agent-groundwork ~/.groundwork && ~/.groundwork/global/setup.sh

Needs git, node and gh. Clones groundwork into ~/.groundwork (GROUNDWORK_HOME to change it),
lets git and Go reach the owner's private repositories, then writes the rule into every agent it finds,
shares the skill, links every ~/.claude_account*, and registers the session-start hook that
keeps all of it current. Safe to run again; run it after installing a new agent.
USAGE
}

case "${1:-}" in
-h | --help)
	usage
	exit 0
	;;
esac

missing=()
for tool in git node gh; do
	command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if [ "${#missing[@]}" -gt 0 ]; then
	echo "Install these first: ${missing[*]}" >&2
	exit 1
fi

gh auth status >/dev/null 2>&1 || gh auth login
gh auth setup-git

if [ -d "$GROUNDWORK_HOME/.git" ]; then
	git -C "$GROUNDWORK_HOME" pull --ff-only -q
else
	gh repo clone thealexsan/agent-groundwork "$GROUNDWORK_HOME" -- -q
fi

if command -v go >/dev/null 2>&1; then
	owner="${GROUNDWORK_OWNER:-$(gh api user --jq .login)}"
	go env -w GOPRIVATE="github.com/$owner/*"
fi

mkdir -p "$HOME/.claude"
node "$GROUNDWORK_HOME/global/sync.mjs"

echo
echo "Done. Restart open agent chats so they read the new rules."
