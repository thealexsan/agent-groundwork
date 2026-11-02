#!/usr/bin/env bash
set -uo pipefail

usage() {
	cat <<'USAGE'
check-mail-dns.sh — what the world can see about a domain's mail, and what is missing.

    scripts/check-mail-dns.sh [domain]

Asks a public resolver directly, not the machine's own, and says which one it asked: answers
differ by resolver and by how long ago a record was edited. Run it before changing a record and
again afterwards. Exits 1 when a required record is missing.

    RESOLVER        the resolver asked                 (default 1.1.1.1)
    SPF_HOST        the name holding the SPF record    (default send.<domain>, Resend's)
    DKIM_SELECTOR   the DKIM selector                  (default resend)
    BIMI_LOGO_URL   the BIMI logo to check             (default the l= of the BIMI record)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

DOMAIN="${1:-{{DOMAIN}}}"
RESOLVER="${RESOLVER:-1.1.1.1}"
SPF_HOST="${SPF_HOST:-send.${DOMAIN}}"
DKIM_SELECTOR="${DKIM_SELECTOR:-resend}"

green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }
dim() { printf '\033[2m%s\033[0m' "$1"; }

missing=0

txt() { dig +short TXT "$1" "@${RESOLVER}" 2>/dev/null | tr -d '"' | tr '\n' ' ' | sed 's/ *$//'; }

row() {
	local label="$1" value="$2" required="$3"
	printf '  %-26s ' "${label}"
	if [ -z "${value}" ]; then
		if [ "${required}" = "required" ]; then
			red "missing"
			missing=$((missing + 1))
		else
			dim "not set"
		fi
		printf '\n'
	else
		green "${value}"
		printf '\n'
	fi
}

dmarc="$(txt "_dmarc.${DOMAIN}")"
bimi="$(txt "default._bimi.${DOMAIN}")"

printf '\n%s\n' "Mail DNS for ${DOMAIN}  $(dim "(asked ${RESOLVER})")"
printf '%s\n\n' "────────────────────────────────────────────────────────────"

row "SPF (${SPF_HOST%%.*}.)" "$(txt "${SPF_HOST}")" required
row "DKIM (${DKIM_SELECTOR}.)" "$(txt "${DKIM_SELECTOR}._domainkey.${DOMAIN}" | cut -c1-34)" required
row "DMARC" "${dmarc}" required
row "BIMI" "${bimi}" optional
row "MX (for reports)" "$(dig +short MX "${DOMAIN}" "@${RESOLVER}" | tr '\n' ' ' | sed 's/ *$//')" optional

if [ -n "${bimi}" ]; then
	logo="${BIMI_LOGO_URL:-$(printf '%s' "${bimi}" | sed -n 's/.*l=\([^;]*\).*/\1/p' | tr -d ' ')}"
	printf '\n  %-26s ' "BIMI logo reachable"
	code=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 10 "${logo}" 2>/dev/null)
	case "${code}" in
		"200 image/svg+xml"*) green "200 image/svg+xml" ;;
		"")
			red "unreachable"
			missing=$((missing + 1))
			;;
		*)
			red "${code}"
			missing=$((missing + 1))
			;;
	esac
	printf '\n'
fi

printf '\n%s\n' "Next"
printf '%s\n' "────────────────────────────────────────────────────────────"

if [ -z "${dmarc}" ]; then
	printf '  %s\n' "Publish DMARC at p=none and read the reports for a fortnight."
elif [[ "${dmarc}" == *"p=none"* ]]; then
	printf '  %s\n' "DMARC is observing. Once a fortnight of reports is clean, move to"
	printf '  %s\n' "p=quarantine — BIMI ignores anything softer than that."
elif [ -z "${bimi}" ]; then
	printf '  %s\n' "DMARC is enforcing. BIMI can go in now."
else
	printf '  %s\n' "Everything is published. Gmail still needs a VMC before it shows the mark."
fi

printf '\n'
exit $((missing > 0 ? 1 : 0))
