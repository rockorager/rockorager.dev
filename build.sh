#!/bin/sh
set -eu

if [ "${CF_PAGES:-}" = "1" ] && [ "${CF_PAGES_BRANCH:-}" != "main" ]; then
    zola build --base-url "$CF_PAGES_URL"
else
    zola build
fi

# Keep existing blog subscribers and embedded images working after the move.
cp public/blog/index.xml public/posts/index.xml
cp public/blog/lsr-ls-but-with-io-uring/screenshot.webp public/posts/lsr-ls-but-with-io-uring/screenshot.webp
