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

## Cloudflare Pages Git integration

Connect the `rockorager/rockorager.dev` GitHub repository to a Pages project
with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `./build.sh` |
| Build output directory | `public` |
| Root directory | Repository root (leave blank) |
| Environment variable, production and preview | `ZOLA_VERSION=0.23.6` |

Pages builds and deploys automatically on push. The build script uses
`CF_PAGES_URL` for non-`main` branch previews, so images, feeds, and redirects
stay within the preview. Production builds keep `https://rockorager.dev`.

Connecting Git does not move the live domain. Verify the Pages deployment
before adding `rockorager.dev` as a custom domain and replacing its existing
DNS record. Until then, `release.sh` remains the manual deployment path to
the current server; Pages must run `build.sh`, not `release.sh`.
