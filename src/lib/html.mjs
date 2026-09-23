import sanitize from "sanitize-html";

export function sanitizeArticleHtml(html) {
  // Imported GFM alerts retain their marker in storage. Match the original
  // Zola rendering without rewriting existing database content or code blocks.
  html = html.replace(
    /^<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \t]*\r?\n|[ \t]*<\/p>\s*<p>)/,
    (_, kind) => `<blockquote class="markdown-alert-${kind.toLowerCase()}">\n<p>`,
  );
  return sanitize(html, {
    allowedTags: [...sanitize.defaults.allowedTags, "img", "picture", "source"],
    allowedAttributes: {
      ...sanitize.defaults.allowedAttributes,
      "*": ["class", "id", "aria-label", "role", "tabindex"],
      img: ["src", "alt", "width", "height", "loading", "decoding", "class"],
      source: ["srcset", "media", "type"],
      aside: ["style"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedStyles: { aside: { "font-style": [/^italic$/], color: [/^var\(--text-muted\)$/], "margin-bottom": [/^2rem$/] } },
  });
}
