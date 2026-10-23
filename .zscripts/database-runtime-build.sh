#!/bin/bash

set -euo pipefail

# Verify that the production database is reachable and its schema is applied.
#
# This script used to COPY db/custom.db from the working tree into the build
# artifact. That is wrong in two ways:
#   1. It baked whatever inquiries happened to be in the developer's local
#      SQLite file into every deployment package — a data leak.
#   2. It created a per-build copy of the database, so two deployments could
#      serve different data.
#
# The database now lives in PostgreSQL, is migrated explicitly, and is not
# part of the build output at all.

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL is not set."
    echo "   Set it to the PostgreSQL connection string for this environment."
    exit 1
fi

if [[ "$DATABASE_URL" == file:* ]]; then
    echo "❌ DATABASE_URL points at a SQLite file ($DATABASE_URL)."
    echo "   This app runs on multiple instances behind a load balancer and"
    echo "   requires PostgreSQL. Update the deployment configuration."
    exit 1
fi

echo "🗄️  Applying database migrations..."
(
    cd "$PROJECT_DIR"
    # `migrate deploy` applies committed migrations and never generates or
    # drops anything. Deliberately not `db push --accept-data-loss`, which can
    # silently destroy production data when the schema drifts.
    bunx prisma migrate deploy
)

echo "🔎 Verifying database connectivity..."
(
    cd "$PROJECT_DIR"
    bunx prisma migrate status
)

echo "✅ Database is migrated and reachable."
