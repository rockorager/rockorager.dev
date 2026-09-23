#!/bin/sh
set -eu

# Dependencies must already be installed with pnpm install --frozen-lockfile.
exec pnpm build
