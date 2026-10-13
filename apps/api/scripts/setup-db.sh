#!/usr/bin/env bash
# setup-db.sh – initializes the PostgreSQL database for local development & CI.
# Usage: bash apps/api/scripts/setup-db.sh
# Env:   DATABASE_URL (defaults to postgres://chatbot:chatbot@localhost:5432/chatbot)

set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://chatbot:chatbot@localhost:5432/chatbot}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[db] Using DATABASE_URL: ${DB_URL}"

# Wait for PostgreSQL to be ready (useful in CI / Docker)
for i in $(seq 1 30); do
  if psql "$DB_URL" -c "SELECT 1" &>/dev/null; then
    echo "[db] PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[db] ERROR: PostgreSQL not reachable at $DB_URL after 30s" >&2
    exit 1
  fi
  sleep 1
done

echo "[db] Running schema..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/db/schema.sql"

echo "[db] Seeding products..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/db/seed.sql"

COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM products;")
echo "[db] Done. $COUNT products in database."
