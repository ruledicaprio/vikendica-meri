#!/bin/bash
# Cloud-session bootstrap: install npm deps so `npm run build` and wrangler work.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# `npm install` (not `ci`) reuses the cached node_modules; `--no-save` keeps
# npm 10 from rewriting the lockfile written by the local (newer) npm.
npm install --no-audit --no-fund --no-save
