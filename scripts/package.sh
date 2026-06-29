#!/bin/bash
# Build the shareable job-applier package (job-applier-mac.tar.gz).
# Bundles the app source WITHOUT node_modules / build output / personal data,
# so the recipient just extracts and double-clicks start-mac.command.
#
# Usage:  npm run package        (or: bash scripts/package.sh)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/job-applier-mac.tar.gz"
STAGE="$(mktemp -d)"
APP="$STAGE/job-applier"
mkdir -p "$APP"

# Files & folders that make up the shippable app (NO personal data, NO installs).
INCLUDE=(
  src scripts templates public
  package.json package-lock.json
  next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs
  .env.example job-applier.config.example.json
  .gitignore .gitattributes
  start-mac.command start-windows.bat
  README.md GUIDE.md START-HERE-MAC.txt ASK-CLAUDE.md CLAUDE.md AGENTS.md LICENSE
)

for item in "${INCLUDE[@]}"; do
  if [ -e "$ROOT/$item" ]; then
    cp -R "$ROOT/$item" "$APP/$item"
  else
    echo "  (skip missing: $item)"
  fi
done

# Never ship the packaging script's own staging cruft or stray installs.
rm -rf "$APP/scripts/__pycache__" 2>/dev/null || true

# The macOS launcher must have LF line endings + the executable bit, or the
# shebang breaks / double-click fails. Enforce both explicitly.
if [ -f "$APP/start-mac.command" ]; then
  perl -pi -e 's/\r$//' "$APP/start-mac.command"
  chmod +x "$APP/start-mac.command"
fi

# Build the archive (top-level folder: job-applier/).
rm -f "$OUT"
tar -czf "$OUT" -C "$STAGE" job-applier
rm -rf "$STAGE"

echo
echo "Built: $OUT"
ls -la "$OUT"
echo "Contents:"
tar -tzf "$OUT" | head -40
