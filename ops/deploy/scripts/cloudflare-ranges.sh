#!/usr/bin/env bash
set -euo pipefail

nginx_dir="$(cd "$(dirname "$0")/.." && pwd)/deploy/nginx"
v4=$(curl -fsS --retry 3 --max-time 20 https://www.cloudflare.com/ips-v4)
v6=$(curl -fsS --retry 3 --max-time 20 https://www.cloudflare.com/ips-v6)
ranges=$(printf '%s\n%s\n' "$v4" "$v6" | sed '/^[[:space:]]*$/d')

if ! printf '%s\n' "$ranges" | grep -qE '^[0-9a-f.:]+/[0-9]+$'; then
	echo "Cloudflare's lists did not look like address ranges; nothing written." >&2
	exit 1
fi

{
	echo "geo \$realip_remote_addr \${{SNAKE}}_via_cloudflare {"
	echo '    default 0;'
	echo '    127.0.0.1/32 1;'
	echo '    ::1/128 1;'
	printf '%s\n' "$ranges" | sed 's/^/    /; s/$/ 1;/'
	echo '}'
} > "$nginx_dir/conf.d/{{SLUG}}-cloudflare.conf"

{
	printf '%s\n' "$ranges" | sed 's/^/set_real_ip_from /; s/$/;/'
	echo 'real_ip_header CF-Connecting-IP;'
} > "$nginx_dir/snippets/{{SLUG}}-cloudflare-realip.conf"

echo "wrote $(printf '%s\n' "$ranges" | wc -l | tr -d ' ') ranges into conf.d/{{SLUG}}-cloudflare.conf and snippets/{{SLUG}}-cloudflare-realip.conf"
