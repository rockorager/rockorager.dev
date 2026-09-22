#!/bin/sh
set -eu

zola build

# Keep existing blog subscribers and embedded images working after the move.
cp public/blog/index.xml public/posts/index.xml
cp public/blog/lsr-ls-but-with-io-uring/screenshot.webp public/posts/lsr-ls-but-with-io-uring/screenshot.webp
