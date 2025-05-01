#!/bin/bash

set -e

# Check for title argument
if [ -z "$1" ]; then
	echo "Usage: $0 \"Post Title\""
	exit 1
fi

TITLE="$1"
DATE=$(date -Iseconds) # ISO 8601 format
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
FILENAME="content/log/${SLUG}.smd"

sed \
	-e "s|{{TITLE}}|$TITLE|g" \
	-e "s|{{DATE}}|$DATE|g" \
	templates/logpost.txt >"$FILENAME"

$EDITOR "$FILENAME"
