#!/bin/sh
set -eu

# Workers Builds does not preinstall Zola. Keep local builds dependency-free.
if [ "${WORKERS_CI:-}" = "1" ]; then
    tools=$(mktemp -d)
    trap 'rm -rf "$tools"' 0
    curl --fail --location --retry 3 \
        https://github.com/getzola/zola/releases/download/v0.23.6/zola-v0.23.6-x86_64-unknown-linux-gnu.tar.gz \
        --output "$tools/zola.tar.gz"
    tar -xzf "$tools/zola.tar.gz" -C "$tools" zola
    PATH="$tools:$PATH"
    export PATH
fi

zola build

# Keep existing blog subscribers and embedded images working after the move.
cp public/blog/index.xml public/posts/index.xml
cp public/blog/lsr-ls-but-with-io-uring/screenshot.webp public/posts/lsr-ls-but-with-io-uring/screenshot.webp
