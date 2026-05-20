#!/usr/bin/env bash
# Link @hot-dev/sdk via pnpm for local SDK development.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="$(cd "$ROOT/../../hot-js/packages/sdk" && pwd)"

if [[ ! -f "$SDK/package.json" ]]; then
  echo "SDK not found at $SDK" >&2
  echo "Clone hot-js next to hot-demos under hot-dev/." >&2
  exit 1
fi

PNPM="npx --yes pnpm@9"
if command -v pnpm >/dev/null 2>&1 && pnpm --version >/dev/null 2>&1; then
  PNPM="pnpm"
fi

echo "Building SDK..."
(cd "$SDK" && $PNPM run build)

echo "Linking @hot-dev/sdk into hot-chat (pnpm link)..."
(cd "$ROOT" && $PNPM link "$SDK")
rm -f "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml"

echo "Done. @hot-dev/sdk -> $SDK"
echo "Rebuild after SDK edits: cd $SDK && pnpm build"
