# rockorager.dev

A static site built with Zola 0.23.6. No JavaScript toolchain is required.

```sh
zola serve                  # Local preview
zola serve --drafts         # Include unpublished posts
./build.sh                  # Production build, including legacy feed/assets
python3 tests/check_site.py # Check the production output
./release.sh                # Build and deploy over SSH/rsync
```

Posts live in `content/blog/`; reference notes live in `content/misc/`.
For a post with images, use `content/blog/<slug>/index.md` and put its
assets beside it. Start a new post with:

```toml
+++
title = "Post title"
date = 2026-09-22
draft = true
+++
```

Set `draft = false` when ready to publish. The blog index and RSS
feed pick up published posts automatically. Preview drafts without deploying them.

The blog feed is `/blog/index.xml`. The site-wide `/index.xml`, misc feed,
and old `/posts/index.xml` remain available. Page aliases generate static
redirect pages for old `/posts/` links; no server configuration is required.
`build.sh` also preserves the old published image URL. Use it rather than a
bare `zola build` when preparing a deployment.

For a preview hosted on another domain, set its base URL so colocated assets
point at that preview rather than the production site:

```sh
zola build --base-url https://your-preview-domain --output-dir <preview-directory>
```
