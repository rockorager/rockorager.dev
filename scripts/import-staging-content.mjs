import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { parse } from "smol-toml";
import { getPlatformProxy } from "wrangler";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { applySeed, validateSeed } from "emdash/seed";

// An explicit, one-time content import, separate from schema migrations and
// builds. Never pass settings, collections, menus, or accounts to this import.
const { version, bylines, content } = JSON.parse(await readFile(new URL("../.generated/seed.json", import.meta.url), "utf8"));
const seed = { version, bylines, content };
const validation = validateSeed(seed);
if (!validation.valid) throw new Error(validation.errors.join("\n"));

const config = parse(await readFile(new URL("../wrangler.toml", import.meta.url), "utf8"));
const target = config.env.staging;
const binding = target.d1_databases.find(db => db.binding === "DB");
if (target.name !== "rockorager-emdash-staging" ||
    target.account_id !== "7026bdfd47696bdbd844ae8830af977f" ||
    binding?.database_id !== "16e10a86-d3ca-48be-99e1-781c91d2b5ad") {
  throw new Error("Refusing import: configuration does not match the approved staging database.");
}
if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is required.");
if (process.argv.slice(2).some(arg => arg !== "--apply")) throw new Error("Usage: node scripts/import-staging-content.mjs [--apply]");

const proxyConfig = new URL("../.generated/import-staging.wrangler.json", import.meta.url);
await mkdir(new URL("../.generated/", import.meta.url), { recursive: true });
await writeFile(proxyConfig, JSON.stringify({
  // Wrangler's temporary, API-token-authenticated binding proxy is separate
  // from the website, whose hostname requires an interactive Access login.
  name: `${target.name}-import`,
  account_id: target.account_id,
  compatibility_date: config.compatibility_date,
  d1_databases: [{ ...binding, remote: true }],
}));

let proxy;
let db;
try {
  proxy = await getPlatformProxy({ configPath: proxyConfig.pathname, envFiles: [], persist: false, remoteBindings: true });
  db = new Kysely({ dialect: new D1Dialect({ database: proxy.env.DB }) });
  console.log(`Target: ${target.name} / ${binding.database_id}`);
  const missing = [];
  for (const [collection, entries] of Object.entries(content)) {
    for (const entry of entries) {
      const existing = await db.selectFrom(`ec_${collection}`).select("id")
        .where("slug", "=", entry.slug).where("locale", "=", entry.locale ?? "en").executeTakeFirst();
      if (!existing) missing.push(`${collection}/${entry.slug} (${entry.status})`);
    }
  }
  console.log(`Missing original entries: ${missing.length}\n${missing.join("\n")}`);
  if (process.argv.includes("--apply")) {
    const result = await applySeed(db, seed, { includeContent: true, onConflict: "skip" });
    console.log(JSON.stringify({ content: result.content, bylines: result.bylines, settings: result.settings }));
  } else {
    console.log("Read-only check. Pass --apply to import missing entries; existing entries are never overwritten.");
  }
} finally {
  await db?.destroy();
  await proxy?.dispose();
  await rm(proxyConfig, { force: true });
}
