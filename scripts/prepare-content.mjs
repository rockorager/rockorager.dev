import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";
import { validateSeed } from "emdash/seed";

const root = fileURLToPath(new URL("../", import.meta.url));
const parser = unified().use(remarkParse).use(remarkGfm);

export function parseSource(source) {
  const match = source.match(/^(\+\+\+|---)\r?\n([\s\S]*?)\r?\n\1\r?\n/);
  if (!match) throw new Error("Missing YAML or TOML frontmatter");
  const metadata = (match[1] === "+++" ? parseToml : parseYaml)(match[2]);
  if (!metadata.title || !metadata.date) throw new Error("Missing title or date");
  return { metadata, body: source.slice(match[0].length) };
}

// Use a full CommonMark/GFM parser: EmDash 0.38's convenience converter
// splits wrapped paragraphs and does not understand our tables or HTML.
export function convertMarkdown(markdown, basePath) {
  let serial = 0;
  const key = () => `m${serial++}`;
  const tree = parser.parse(markdown);
  const definitions = new Map(tree.children.filter(n => n.type === "definition").map(n => [n.identifier, n]));
  const localUrl = url => {
    if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return url;
    const resolved = new URL(url, `https://rockorager.dev${basePath}`);
    return resolved.pathname + resolved.search + resolved.hash;
  };
  const html = node => ({ _type: "htmlBlock", _key: key(), html: toHtml(toHast(node, { allowDangerousHtml: true }), { allowDangerousHtml: true }) });

  function inline(nodes, markDefs, marks = []) {
    return nodes.flatMap(node => {
      if (node.type === "text" || node.type === "inlineCode" || node.type === "break") {
        return [{ _type: "span", _key: key(), text: node.type === "break" ? "\n" : node.value.replace(/\n/g, " "), marks: node.type === "inlineCode" ? [...marks, "code"] : marks }];
      }
      const mark = { strong: "strong", emphasis: "em", delete: "strike-through" }[node.type];
      if (mark) return inline(node.children, markDefs, [...marks, mark]);
      if (node.type === "link" || node.type === "linkReference") {
        const link = node.type === "link" ? node : definitions.get(node.identifier);
        if (!link) throw new Error(`Missing link definition: ${node.identifier}`);
        const id = key();
        markDefs.push({ _type: "link", _key: id, href: localUrl(link.url) });
        return inline(node.children, markDefs, [...marks, id]);
      }
      throw new Error(`Unsupported inline Markdown: ${node.type}`);
    });
  }

  function textBlock(node, style = "normal", extra = {}) {
    const markDefs = [];
    const children = inline(node.children, markDefs);
    // Zola's explicit heading IDs are handled by our public heading renderer.
    if (/^h[1-6]$/.test(style) && children.length) {
      children.at(-1).text = children.at(-1).text.replace(/\s*\{#[^}]+\}$/, "");
    }
    return { _type: "block", _key: key(), style, children, markDefs, ...extra };
  }

  function blocks(nodes, level = 1) {
    return nodes.flatMap(node => {
      switch (node.type) {
        case "definition": return [];
        case "paragraph": {
          if (node.children.length === 1 && node.children[0].type === "image") {
            const image = node.children[0];
            return [{ _type: "image", _key: key(), asset: { url: localUrl(image.url) }, alt: image.alt ?? "" }];
          }
          return [textBlock(node)];
        }
        case "heading": return [textBlock(node, `h${node.depth}`)];
        case "code": return [{ _type: "code", _key: key(), code: node.value, language: node.lang || "plaintext" }];
        case "list":
          // Nonstandard starts and loose lists need HTML to preserve semantics.
          if ((node.ordered && node.start !== 1) || node.spread || node.children.some(n => n.checked != null)) return [html(node)];
          return node.children.flatMap(item => item.children.flatMap(child => child.type === "paragraph"
            ? [textBlock(child, "normal", { listItem: node.ordered ? "number" : "bullet", level })]
            : blocks([child], level + 1)));
        case "blockquote": {
          const first = node.children[0]?.children?.[0];
          const alert = first?.value?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
          // Retain the marker in storage; the HTML renderer applies Zola's alert style.
          if (alert) return [html(node)];
          if (node.children.every(n => n.type === "paragraph")) return node.children.map(n => textBlock(n, "blockquote"));
          return [html(node)];
        }
        case "table": return [{
          _type: "table", _key: key(), hasHeaderRow: true,
          rows: node.children.map((row, index) => ({
            _type: "tableRow", _key: key(), cells: row.children.map((cell, column) => {
              const markDefs = [];
              return { _type: "tableCell", _key: key(), content: inline(cell.children, markDefs), markDefs, isHeader: index === 0, ...(node.align[column] ? { textAlign: node.align[column] } : {}) };
            }),
          })),
        }];
        case "html": return [{ _type: "htmlBlock", _key: key(), html: node.value }];
        case "thematicBreak": return [html(node)];
        default: throw new Error(`Unsupported Markdown block: ${node.type}`);
      }
    });
  }
  return blocks(tree.children);
}

export async function makeSeed() {
  const content = { posts: [], notes: [] };
  for (const [section, collection] of [["blog", "posts"], ["misc", "notes"]]) {
    const directory = path.join(root, "content", section);
    const files = (await readdir(directory, { recursive: true })).filter(f => f.endsWith(".md") && path.basename(f) !== "_index.md").sort();
    for (const file of files) {
      const { metadata, body } = parseSource(await readFile(path.join(directory, file), "utf8"));
      const slug = file.endsWith("/index.md") ? path.dirname(file) : file.replace(/\.md$/, "");
      const basePath = `/${section}/${slug}/`;
      // Preserve the existing responsive diagram as an editable HTML block.
      const expanded = body.replace('{% include "shortcodes/ansi_parser.html" %}',
        `<div class="ansi-parser-viewport" tabindex="0" role="region" aria-label="Scrollable ANSI parser state diagram"><picture><source media="(prefers-color-scheme: dark)" srcset="${basePath}ansi-parser-dark.svg"><img class="ansi-parser-diagram" src="${basePath}ansi-parser-light.svg" alt="UTF-8-aware ANSI parser state-machine diagram" loading="lazy" decoding="async"></picture></div>`);
      content[collection].push({
        id: `${collection}:${slug}`, slug,
        status: metadata.draft ? "draft" : "published",
        bylines: [{ byline: "tim" }],
        data: {
          title: metadata.title,
          date: new Date(metadata.date).toISOString(),
          ...(metadata.updated ? { modified: new Date(metadata.updated).toISOString() } : {}),
          description: metadata.description ?? "",
          content: convertMarkdown(expanded, basePath),
        },
      });
    }
  }
  const seed = {
    version: "1",
    meta: { name: "rockorager.dev", author: "Tim Culverhouse", description: "Original posts and reference notes, preserving draft status." },
    settings: { title: "rockorager.dev", timezone: "America/Chicago" },
    bylines: [{ id: "tim", slug: "tim-culverhouse", displayName: "Tim Culverhouse" }],
    collections: [["posts", "Posts", "Post", "blog"], ["notes", "Reference notes", "Reference note", "misc"]].map(([slug, label, labelSingular, section]) => ({
      slug, label, labelSingular, urlPattern: `/${section}/{slug}/`, dateField: "date",
      supports: ["drafts", "revisions", "preview", "scheduling", "search", "seo"], commentsEnabled: false,
      fields: [
        { slug: "title", label: "Title", type: "string", required: true, searchable: true },
        { slug: "date", label: "Article date", type: "datetime" },
        { slug: "modified", label: "Article updated", type: "datetime" },
        { slug: "description", label: "Description", type: "text" },
        { slug: "content", label: "Content", type: "portableText", searchable: true },
      ],
    })),
    content,
  };
  const result = validateSeed(seed);
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
  return seed;
}

export async function prepare() {
  const seed = await makeSeed();
  await mkdir(path.join(root, ".generated"), { recursive: true });
  await writeFile(path.join(root, ".generated/seed.json"), JSON.stringify(seed, null, 2) + "\n");
  await cp(path.join(root, "static"), path.join(root, ".generated/public"), { recursive: true });
  for (const section of ["blog", "misc"]) {
    for (const file of await readdir(path.join(root, "content", section), { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || file.name.endsWith(".md")) continue;
      const source = path.join(file.parentPath, file.name);
      const target = path.join(root, ".generated/public", path.relative(path.join(root, "content"), source));
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target);
    }
  }
  const legacy = path.join(root, ".generated/public/posts/lsr-ls-but-with-io-uring");
  await mkdir(legacy, { recursive: true });
  await cp(path.join(root, "content/blog/lsr-ls-but-with-io-uring/screenshot.webp"), path.join(legacy, "screenshot.webp"));
  console.log(`Prepared ${Object.values(seed.content).flat().length} entries; existing databases are not reseeded.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepare();
