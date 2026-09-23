import rss from "@astrojs/rss";
import { experimental_AstroContainer } from "astro/container";
import RichContent from "../components/RichContent.astro";
import { publishedEntries, articleDate, type Section } from "./content";

export async function feed(sections: Section[], locals: App.Locals) {
  const container = await experimental_AstroContainer.create();
  const items = [];
  for (const section of sections) {
    const { entries } = await publishedEntries(section);
    for (const entry of entries) {
      const link = `/${section}/${entry.id}/`;
      const base = new URL(link, "https://rockorager.dev");
      const html = await container.renderToString(RichContent, { props: { value: entry.data.content }, locals });
      // Feed readers have no page origin against which to resolve these URLs.
      const content = await new HTMLRewriter().on("a[href], img[src]", {
        element(element) {
          const attribute = element.tagName === "a" ? "href" : "src";
          element.setAttribute(attribute, new URL(element.getAttribute(attribute)!, base).href);
        },
      }).transform(new Response(html)).text();
      items.push({
        title: entry.data.title,
        link,
        pubDate: articleDate(entry.data),
        description: entry.data.description || entry.data.title,
        content,
      });
    }
  }
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return rss({
    title: "rockorager.dev",
    description: "Writing about terminals, Zig, and asynchronous I/O by Tim Culverhouse.",
    site: "https://rockorager.dev",
    items,
    customData: "<language>en</language>",
    // RSS consumers need absolute URLs even though the HTML uses same-origin links.
    stylesheet: false,
  });
}
