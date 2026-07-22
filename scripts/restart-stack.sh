#!/usr/bin/env bash
# Reset, update, and rebuild the local docker-compose stack (postgres/core/server/web).
# Applies any pending server migrations once the stack is up.
# Safe by default: never touches the postgres volume unless --clean is passed.
#
# Usage: scripts/restart-stack.sh [--no-pull] [--no-build] [--clean] [--seed]
#   --no-pull   skip `git pull` (use whatever's checked out locally)
#   --no-build  skip `docker compose build` (just recreate containers — use when
#               only compose/env config changed, not app code)
#   --clean     also wipe the postgres volume (fresh DB; irreversible — asks first)
#   --seed      run scripts/seed-demo.mjs against the stack once it's healthy
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DO_PULL=1
DO_BUILD=1
DO_CLEAN=0
DO_SEED=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --no-build) DO_BUILD=0 ;;
    --clean) DO_CLEAN=1 ;;
    --seed) DO_SEED=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

echo "==> reset: stopping the current stack"
if [ "$DO_CLEAN" = "1" ]; then
  read -r -p "This wipes the postgres volume (all local data, including any demo seed). Continue? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "aborted"; exit 1; }
  docker compose down -v
else
  docker compose down
fi

if [ "$DO_PULL" = "1" ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [ -n "$(git status --porcelain)" ]; then
    echo "==> update: skipped — you have uncommitted changes on '$branch'" >&2
  else
    echo "==> update: git pull on '$branch'"
    git pull --ff-only
  fi
else
  echo "==> update: skipped (--no-pull)"
fi

if [ "$DO_BUILD" = "1" ]; then
  echo "==> build: rebuilding images (core takes longest — cargo build inside Docker)"
  docker compose build
else
  echo "==> build: skipped (--no-build)"
fi

echo "==> starting the stack"
docker compose up -d

echo "==> waiting for server + web to answer"
for url in "http://localhost:8080/health" "http://localhost:5173"; do
  for _ in $(seq 1 60); do
    curl -sf "$url" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf "$url" >/dev/null 2>&1 || { echo "!! $url never came up — check: docker compose logs -f" >&2; exit 1; }
done
echo "server + web are up"

echo "==> migrate: applying pending server migrations"
docker compose exec -T server node dist/migrate.js

if [ "$DO_SEED" = "1" ]; then
  echo "==> seeding demo data"
  node scripts/seed-demo.mjs http://localhost:8080
fi

echo
echo "Ready: web http://localhost:5173  |  server http://localhost:8080  |  core http://localhost:8081"
echo "Hard-refresh the browser tab (Cmd+Shift+R) — the old JS bundle is likely still cached."
