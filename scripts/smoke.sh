#!/usr/bin/env sh
# Smoke: server must report itself + core ok
set -e
URL="${1:-http://localhost:8080/api/ping}"
OUT=$(curl -sf "$URL")
echo "$OUT"
echo "$OUT" | grep -q '"server":"ok"' && echo "$OUT" | grep -q '"status":"ok"' \
  && echo "SMOKE OK" || { echo "SMOKE FAILED"; exit 1; }
