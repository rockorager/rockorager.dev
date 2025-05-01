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
FILENAME="$HOME/repos/github.com/rockorager/rockorager.dev/content/log/${SLUG}.smd"

if [ -e "$FILENAME" ]; then
	echo "Error: File '$FILENAME' already exists."
	exit 1
fi

sed \
	-e "s|{{TITLE}}|$TITLE|g" \
	-e "s|{{DATE}}|$DATE|g" \
	$HOME/repos/github.com/rockorager/rockorager.dev/templates/logpost.txt >"$FILENAME"

$EDITOR "$FILENAME"
