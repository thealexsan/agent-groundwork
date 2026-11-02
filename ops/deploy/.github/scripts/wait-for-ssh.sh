#!/usr/bin/env bash
set -uo pipefail

attempts=${SSH_WAIT_ATTEMPTS:-6}
pause=${SSH_WAIT_PAUSE:-20}

for attempt in $(seq 1 "$attempts"); do
	if $SSH "$TARGET" true 2>/dev/null; then
		echo "$DEPLOY_HOST answered on attempt $attempt"
		exit 0
	fi
	echo "no answer from $DEPLOY_HOST on attempt $attempt of $attempts"
	[ "$attempt" -lt "$attempts" ] && sleep "$pause"
done

echo "::error::$DEPLOY_HOST did not answer ssh from this runner. A runner's egress can fail while the box is reachable from everywhere else, so check the runner before changing anything on the server."
exit 1
