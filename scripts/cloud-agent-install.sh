#!/usr/bin/env bash
# Prepares a Cursor cloud agent VM (Ubuntu) so `bun run verify` works.
# Referenced by `install` in .cursor/environment.json. Safe to re-run.
#
# - Bun at the version package.json pins (the VM does not ship it).
# - The native libraries `canvas` builds against, same as .github/workflows/test.yml.
# - Dependencies from the lockfile.
set -euo pipefail

cd "$(dirname "$0")/.."

BUN_VERSION="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json)"
if [ -z "$BUN_VERSION" ]; then
  echo "package.json has no bun@ packageManager pin" >&2
  exit 1
fi

sudo apt-get update -qq
sudo apt-get install --no-install-recommends -y \
  build-essential ca-certificates curl unzip \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

if [ "$(bun --version 2>/dev/null || true)" != "$BUN_VERSION" ]; then
  # /usr/local/bin is on every shell's PATH, unlike ~/.bun/bin.
  curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash -s "bun-v${BUN_VERSION}"
fi

bun install --frozen-lockfile
