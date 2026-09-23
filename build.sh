#!/bin/sh
set -eu

if [ "${WORKERS_CI:-}" = "1" ]; then
    echo "Legacy Workers Builds targets the preserved static Worker; automatic deployment is disabled. See README.md." >&2
    exit 1
fi

# Dependencies must already be installed with pnpm install --frozen-lockfile.
exec pnpm build
