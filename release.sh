#!/bin/sh

set -e

./build.sh

REMOTE_USER="tim"
REMOTE_HOST="rockorager.dev"
REMOTE_PATH="/var/www/rockorager.dev"

rsync --archive \
  --verbose \
  --compress \
  --delete \
  public/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
