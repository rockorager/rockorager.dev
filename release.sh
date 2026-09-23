#!/bin/sh
set -e

echo "EmDash is a Worker with D1/R2, not a static rsync build." >&2
echo "Production provisioning, data migration and deployment require a separate approved cutover. See README.md." >&2
exit 1
