#!/bin/sh
# MYCOFERT production startup script.
#
# Requires DATABASE_URL to be set to a PostgreSQL connection string.
# SQLite fallback has been REMOVED — the schema is PostgreSQL-only and
# a sqlite URL would fail at the Prisma level anyway.
#
# Usage: sh start.sh (run from the artifact root directory)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --------------------------------------------------------------------------
# Validate required environment
# --------------------------------------------------------------------------

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set."
  echo "   Set it to a PostgreSQL connection string (e.g. Supabase pooler URL)."
  echo "   See docs/supabase-setup-guide.md for instructions."
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    echo "❌ DATABASE_URL is a file: URL — SQLite is not supported."
    echo "   Set DATABASE_URL to a postgresql:// connection string."
    exit 1
    ;;
esac

echo "🗄️  Database: ${DATABASE_URL%%@*}@..." # log host without password

# --------------------------------------------------------------------------
# Start Next.js
# --------------------------------------------------------------------------

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
# The bundled Caddyfile fronts this process and OVERWRITES X-Forwarded-For
# from the socket address, so trusting it is safe here — it enables correct
# client IPs for rate limiting. Leave unset if you run without that proxy.
export TRUST_PROXY="${TRUST_PROXY:-1}"

if [ -f "./next-service-dist/server.js" ]; then
  echo "🚀 Starting Next.js on :$PORT ..."
  cd next-service-dist/ || exit 1
  exec node server.js
else
  echo "❌ ./next-service-dist/server.js not found. Run the build first."
  exit 1
fi
