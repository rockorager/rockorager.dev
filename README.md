# rockorager.dev

Astro + EmDash 0.38 on Cloudflare Workers, with D1 for content and R2 for
uploaded media. The original Zola sources remain as the migration snapshot.
Local development uses isolated emulation; deployment requires explicit
Cloudflare credentials and approval. No analytics are enabled.

## Local development

Use Node.js 22+ and the pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
# Once per checkout; keep this private and stable, never commit it:
umask 077
test -e .env || { printf 'EMDASH_ENCRYPTION_KEY='; openssl rand -hex 32; } > .env
pnpm dev --host 0.0.0.0 --port 4322
```

In Amp, use `amp orb services ensure` instead of the last command. It runs
the configured service and prints authenticated portal links for the site
and development login. The built-in login endpoint is
`/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`; it signs in as
`dev@emdash.local` without registering a passkey. It requires `astro dev`
and is not available in a production build. Do not expose this development
server publicly outside an authenticated portal.

D1 and R2 are emulated locally in `.wrangler/state/`. No Cloudflare account
or remote database is used. State survives process restarts, but **this is
temporary orb-local storage, not a deployment or a durable backup**.

## Content ownership and initial import

`content/`, `static/`, `templates/` and `zola.toml` retain the original site
sources. `pnpm prepare:content` parses the Markdown and generates a validated
EmDash seed at `.generated/seed.json`, plus public assets. EmDash's automatic
production initialization applies the seed's structure, **not its content**.
The built-in development login includes content; production requires an explicit
content import (see deployment below). Builds and restarts do not overwrite an
initialized database.

The import preserves the ten entries (five published and five drafts), URLs,
article dates, descriptions, text, tables, code, links and images. Standard
content becomes editable Portable Text. Complex HTML, the ANSI diagram and
nonstandard lists remain HTML blocks. Imported images keep their original
public paths; they are not duplicated into the media library. Newly uploaded
images are stored in R2. As with the static site, assets are public by URL even
when the article is a draft; don't put confidential material in public assets.

After import, **the database is the editorial source of truth**. Saving in
EmDash does not commit Markdown, and changing Markdown does not update an
existing database. Preserve the original sources as the migration snapshot;
new writing needs database and media backups. The separate disposable trial's
database is not imported by this repository.

Public pages and feeds use the imported `Article date` field; EmDash's own
created/published timestamps initially reflect the import. New entries without
an article date fall back to the publication timestamp. The `Article updated`
field retains original update dates where present.

The blog feed is `/blog/index.xml`; `/posts/index.xml`, `/misc/index.xml`
and `/index.xml` remain available with full article content. Old `/posts/`
page URLs redirect to `/blog/`. Original heading anchors and asset URLs remain.
Code highlighting uses server-side Shiki with light/dark themes, explicit
Zig/bash/C/C++/Rust/JS/TS/JSON/diff grammars and plain-text fallback.

## Verification

```sh
pnpm test                  # Import, highlighting and HTML safety checks
pnpm typecheck
pnpm build                 # Worker build; does not deploy
pnpm test:site             # HTTP checks against the dev server on port 4322
```

Set `SITE_URL` to test a different local server. To compare article text, code
and anchors against the old site, first build the original Zola revision into
a separate directory, then run `ZOLA_BASELINE=/path/to/build pnpm test:site`.
HTTP tests expect the original published entries; use a freshly initialized
local database for migration verification rather than a live editorial site.
Stop the dev service before typecheck/build and restart it afterwards: Astro
and Vite share generated files and dependency caches in this checkout.

## Cloudflare deployment

The originally isolated `staging` environment in `wrangler.toml` now serves
**production at https://rockorager.dev**. It retains the existing Worker name
`rockorager-emdash-staging`, with its own D1 database, R2 bucket and session KV.
The environment name is historical: commands targeting it now affect live data.
The old `rockorager-dev` static Worker remains intact for rollback.

The **EmDash staging** Access application protects only the alternate
`workers.dev` hostname. Its sole policy allows `tim@timculverhouse.com`;
everyone else is denied. Preview URLs remain disabled.
On `rockorager.dev`, public pages are unrestricted and the editor uses EmDash's
built-in passkey authentication without Cloudflare Access. The unused
`CF_ACCESS_AUDIENCE` Worker secret is retained for rollback to the earlier
Access-authenticated build. Local development retains the built-in dev login,
which is unavailable in a production build.

The original ten entries have been imported explicitly, with their five draft
and five published statuses preserved. No local development users or trial
uploads were transferred.

For an approved initial content import after the collections exist:

```sh
pnpm prepare:content
node scripts/import-staging-content.mjs          # Read-only missing-entry check
node scripts/import-staging-content.mjs --apply  # Remote writes; requires approval
```

The script requires `CLOUDFLARE_API_TOKEN` and is pinned to the approved account
and database, which now hold production content. It uses Wrangler's remote D1 proxy
and EmDash's `applySeed` with `includeContent: true` and `onConflict: "skip"`. Only
content and referenced bylines are included: it never imports settings, users,
collections, or menus. Repeating it skips existing entries, including edited
entries, rather than duplicating or overwriting them. This is not Git sync and
is deliberately separate from deployment.

Workers Builds connects this repository's `main` branch to
`rockorager-emdash-staging`, with these settings:

| Setting | Value |
| --- | --- |
| Build command | `CLOUDFLARE_ENV=staging pnpm build` |
| Deploy command | `pnpm wrangler deploy` |
| Root directory | Repository root |
| Non-production branch builds | Disabled |

The old `rockorager-dev` Git build integration is disconnected. Pushes to
`main` now build and deploy EmDash. The standard Astro build writes
`.wrangler/deploy/config.json`, which directs Wrangler to the generated
`dist/server/wrangler.json`; no custom deployment wrapper is needed.

For an authorized manual production update, stop the local service and run
the same commands:

```sh
CLOUDFLARE_ENV=staging pnpm build
pnpm wrangler deploy
```

EmDash's default automatic migration mode applies pending core migrations on
the first request. Deployments do not rerun the explicit content import or
overwrite existing editorial content.

These commands require Cloudflare credentials and change **production** state.
Before deploying, confirm `dist/server/wrangler.json` names
`rockorager-emdash-staging`, the resource IDs in `wrangler.toml`, and only the
`rockorager.dev` custom domain. Never deploy an ordinary
local build: its default Worker name matches the existing static deployment.
Do not enable preview hostnames unless they are also protected by Access.
`release.sh` refuses the obsolete rsync deployment. Restart local development
with `amp orb services ensure`.

## Editor authentication

Open `https://rockorager.dev/_emdash/admin` and sign in with a passkey.
The owner enrolled a passkey on the final hostname and confirmed a fresh
private-window login before the temporary Access gate was removed.
Manage passkeys at `/_emdash/admin/settings/security`. Local development uses
the separate development account and needs no passkey.

## Recovery and content backups

Rollback the website by reassigning the `rockorager.dev` Worker custom domain
to `rockorager-dev`. Do not redeploy a local build over that preserved Worker.
This restores the original static site, not any new EmDash writing; the EmDash
database and media bucket remain available separately.

D1 Time Travel provides database recovery within Cloudflare's retention window.
Before cutover, a recovery bookmark, schema, and all 60 non-search application
tables were saved privately in the orb. A full `wrangler d1 export` is blocked
by EmDash's FTS5 virtual tables; do not assume that command produced a backup.
The application-table snapshot excludes the rebuildable search index and is
not a tested SQL restore. Orb files are temporary, not durable backups.

Keep independent backups of content, R2 media, and the encryption secret, and
test recovery before relying on them. Git alone cannot recover new writing.
Do not delete `.wrangler/state/` until any local writing you want is exported.
