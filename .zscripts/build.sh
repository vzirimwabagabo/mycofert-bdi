#!/bin/bash
# MYCOFERT build script.
#
# Builds the Next.js standalone artifact, collects output files, and
# packages them into a tar.gz for deployment.
#
# DATABASE_URL is NOT needed at build time — Prisma generates types from
# the schema file, not from the live database.

exec 2>&1
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXTJS_PROJECT_DIR="${NEXTJS_PROJECT_DIR:-/home/z/my-project}"

if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
  echo "❌ Next.js project directory not found: $NEXTJS_PROJECT_DIR"
  exit 1
fi

echo "🚀 Building MYCOFERT..."
echo "📁 Project: $NEXTJS_PROJECT_DIR"

cd "$NEXTJS_PROJECT_DIR" || exit 1

export NEXT_TELEMETRY_DISABLED=1
BUILD_DIR="/tmp/build_fullstack_${BUILD_ID:-$(date +%s)}"
echo "📁 Build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build Next.js
echo "🔨 Building Next.js..."
npm run build

# Validate standalone output exists
if [ ! -f ".next/standalone/server.js" ]; then
  NEXT_CONFIG_FILE="$(ls next.config.ts next.config.js next.config.mjs next.config.cjs 2>/dev/null | head -1)"

  if [ -z "$NEXT_CONFIG_FILE" ]; then
    echo "❌ Build failed: no next.config.* found."
    exit 1
  fi

  if grep -Eq "output\s*:\s*['\"]standalone['\"]" "$NEXT_CONFIG_FILE"; then
    echo "❌ Build failed: output:\"standalone\" declared but server.js not generated."
    exit 1
  fi

  # Inject output: "standalone" and rebuild
  echo "🔧 Injecting output:\"standalone\" into $NEXT_CONFIG_FILE..."
  cp "$NEXT_CONFIG_FILE" "${NEXT_CONFIG_FILE}.zbak"
  perl -0pi -e 's/((?:const\s+\w+[^=]*=|export\s+default|module\.exports\s*=)\s*\{)/$1\n  output: "standalone",/' "$NEXT_CONFIG_FILE"

  echo "🔨 Rebuilding with standalone output..."
  npm run build

  if [ ! -f ".next/standalone/server.js" ]; then
    mv "${NEXT_CONFIG_FILE}.zbak" "$NEXT_CONFIG_FILE"
    echo "❌ Build failed after standalone injection."
    exit 1
  fi
  echo "✅ Standalone output generated after injection."
fi

# Collect artifacts
echo "📦 Collecting build artifacts..."

cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
mkdir -p "$BUILD_DIR/next-service-dist/.next"
cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
[ -d public ] && cp -r public "$BUILD_DIR/next-service-dist/"

# Copy Caddyfile and start script
[ -f Caddyfile ] && cp Caddyfile "$BUILD_DIR/"
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

# Package
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo "📦 Packaging to $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null

echo ""
echo "✅ Build complete: $PACKAGE_FILE"
ls -lh "$PACKAGE_FILE"
