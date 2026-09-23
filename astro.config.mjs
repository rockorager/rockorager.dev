import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
  site: "https://rockorager.dev",
  output: "server",
  publicDir: "./.generated/public",
  adapter: cloudflare(),
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto" }),
      storage: r2({ binding: "MEDIA" }),
      // Default auth uses passkeys in production and the supported dev login locally.
    }),
  ],
  vite: {
    optimizeDeps: {
      // EmDash 0.38's lazy admin imports otherwise load thousands of icon modules.
      include: [
        "emdash > @emdash-cms/admin > @cloudflare/kumo",
        "emdash > @emdash-cms/admin > @phosphor-icons/react",
      ],
    },
  },
  devToolbar: { enabled: false },
});
