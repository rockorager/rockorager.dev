import type { APIRoute } from "astro";
import { publishedEntries, type Section } from "../lib/content";

export const GET: APIRoute = async () => {
  const paths = ["/", "/blog/", "/misc/"];
  for (const section of ["blog", "misc"] as Section[]) {
    const { entries } = await publishedEntries(section);
    paths.push(...entries.map(entry => `/${section}/${encodeURIComponent(entry.id)}/`));
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>https://rockorager.dev${path}</loc></url>`).join("")}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
