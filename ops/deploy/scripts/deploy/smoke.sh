#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -eq 0 ]; then
	echo "::warning::No smoke URLs. Set the SMOKE_URLS variable to the addresses that must answer after a deploy."
	exit 0
fi

failed=0
for url in "$@"; do
	code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)
	echo "$url -> $code"
	case "$code" in
		2* | 3*) ;;
		*)
			echo "::error::$url answered $code"
			failed=1
			;;
	esac
done

exit "$failed"
