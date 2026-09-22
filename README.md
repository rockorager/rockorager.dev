# rockorager.dev

A static site built with Zola 0.23.6, configured for Cloudflare Workers
Static Assets. Local builds need only Zola; Wrangler uses Node.js for deployment.

```sh
zola serve                  # Local preview
zola serve --drafts         # Include unpublished posts
./build.sh                  # Production build, including legacy feed/assets
python3 tests/check_site.py # Check the production output
./release.sh                # Legacy deployment over SSH/rsync
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

## Cloudflare Workers Git integration

Use **Create application → Continue with GitHub** and connect
`rockorager/rockorager.dev` with these settings:

| Setting | Value |
| --- | --- |
| Worker name | `rockorager-dev` (must match `wrangler.toml`) |
| Production branch | `main` |
| Build command | `./build.sh` |
| Deploy command | `npx wrangler deploy` |
| Root directory | Repository root (leave blank) |

No custom build environment variables are required. Cloudflare sets
`WORKERS_CI=1`; the build script then downloads Zola 0.23.6 into a temporary
directory. `wrangler.toml` tells Wrangler to upload `public/` without any
Worker script. Pushes to `main` build and deploy automatically once connected.

The HTML uses same-origin navigation and asset URLs. When adding images,
use root-relative Markdown paths such as `/blog/<slug>/image.webp` to keep
them on the deployment's hostname. Cloudflare's `_redirects` rules keep old
`/posts/` links on that hostname too. Canonical URLs and RSS article links
continue to point to `https://rockorager.dev`.

Verify the initial `workers.dev` deployment before connecting
`rockorager.dev` as a custom domain and replacing its existing DNS record.
Until then, `release.sh` remains the manual deployment path to the current
server; Workers Builds must run `build.sh`, not `release.sh`.

For a local deployment check without uploading anything:

```sh
./build.sh
npx wrangler deploy --dry-run
```
