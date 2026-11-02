#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -f package-lock.json ]; then
	npm ci
	npm run build --if-present
fi

if [ -f go.mod ]; then
	mkdir -p bin
	CGO_ENABLED=0 go build -trimpath -o bin/ ./cmd/...
fi

pm2 startOrRestart ecosystem.config.js --update-env
pm2 save
