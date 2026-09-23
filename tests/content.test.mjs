import test from "node:test";
import assert from "node:assert/strict";
import { convertMarkdown, makeSeed, parseSource } from "../scripts/prepare-content.mjs";
import { highlight } from "../src/lib/highlight.mjs";
import { sanitizeArticleHtml } from "../src/lib/html.mjs";

test("migration preserves wrapped paragraphs, inline marks, links, tables and literal code", () => {
  const blocks = convertMarkdown("One wrapped\nparagraph with **strong _nested_** and [local](image.svg?raw=1#part).\n\n| A | B |\n| :-- | --: |\n| `x` | 42 |\n\n```zig\nconst x = 1;\n  // keep whitespace <>&\n```", "/blog/example/");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].children.map(s => s.text).join(""), "One wrapped paragraph with strong nested and local.");
  assert.deepEqual(blocks[0].children.find(s => s.text === "nested").marks, ["strong", "em"]);
  assert.equal(blocks[0].markDefs[0].href, "/blog/example/image.svg?raw=1#part");
  assert.equal(blocks[1].rows[1].cells[1].content[0].text, "42");
  assert.equal(blocks[1].rows[1].cells[1].textAlign, "right");
  assert.equal(blocks[1].rows[0]._type, "tableRow");
  assert.equal(blocks[1].rows[1].cells[0]._type, "tableCell");
  assert.deepEqual(blocks[1].rows[1].cells[0].content[0].marks, ["code"]);
  assert.equal(blocks[2].language, "zig");
  assert.equal(blocks[2].code, "const x = 1;\n  // keep whitespace <>&");
});

test("frontmatter and initial seed preserve dates, slugs and unpublished content", async () => {
  for (const source of ["+++\ntitle = 'Example'\ndate = 2025-01-02\n+++\nBody", "---\ntitle: Example\ndate: 2025-01-02\n---\nBody"]) {
    assert.equal(parseSource(source).body, "Body");
    assert.equal(new Date(parseSource(source).metadata.date).toISOString(), "2025-01-02T00:00:00.000Z");
  }
  const seed = await makeSeed();
  assert.equal(seed.content.posts.length, 6);
  assert.equal(seed.content.notes.length, 4);
  assert.deepEqual(seed.content.posts.filter(p => p.status === "published").map(p => p.slug), ["lsr-ls-but-with-io-uring"]);
  const post = seed.content.posts.find(p => p.slug === "lsr-ls-but-with-io-uring");
  assert.equal(post.data.date, "2025-05-06T16:15:50.000Z");
  const draft = seed.content.posts.find(p => p.slug === "ansi-parser");
  assert.equal(draft.status, "draft");
  const diagram = draft.data.content.find(b => b._type === "htmlBlock" && b.html.includes("ansi-parser-viewport"));
  assert.match(diagram.html, /tabindex="0"/);
  assert.match(diagram.html, /ansi-parser-dark\.svg/);
  assert.match(diagram.html, /ansi-parser-light\.svg/);
  assert.ok(seed.content.notes.every(n => n.status === "published"));
  assert.match(convertMarkdown("> [!NOTE]\n> Keep this text", "/")[0].html, /\[!NOTE\]/);
});

test("imported alerts render like Zola without consuming literal markers", () => {
  for (const separator of ["", ">\n"]) {
    const [block] = convertMarkdown(`> [!IMPORTANT]\n${separator}> Keep **this** text.\n>\n> Second paragraph.`, "/");
    assert.equal(sanitizeArticleHtml(block.html), '<blockquote class="markdown-alert-important">\n<p>Keep <strong>this</strong> text.</p>\n<p>Second paragraph.</p>\n</blockquote>');
  }
  const [note] = convertMarkdown("> [!NOTE]\n> Note body.", "/");
  assert.equal(sanitizeArticleHtml(note.html), '<blockquote class="markdown-alert-note">\n<p>Note body.</p>\n</blockquote>');
  for (const literal of ['<blockquote><p>Literal [!NOTE]</p></blockquote>', '<blockquote><p>[!NOTE] Same line</p></blockquote>', '<pre><code>[!NOTE]\nExample</code></pre>']) {
    assert.equal(sanitizeArticleHtml(literal), literal);
  }
});

test("highlighting escapes code, supplies both themes and falls back for unknown languages", async () => {
  const zig = await highlight('const x: u8 = 42; // <script>alert(1)</script>', "zig");
  assert.match(zig, /class="shiki/);
  assert.match(zig, /--shiki-dark:/);
  assert.match(zig, /(?:&lt;|&#x3C;)script(?:>|&gt;)/);
  assert.doesNotMatch(zig, /<script>/);
  assert.ok((zig.match(/<span style=/g) ?? []).length > 3);
  assert.equal(await highlight("echo hi", "sh"), await highlight("echo hi", "bash"));
  assert.equal(await highlight("<unknown>", "not-a-language"), await highlight("<unknown>", "text"));
});

test("HTML blocks keep the original diagram and aside without executable markup", () => {
  const html = sanitizeArticleHtml('<script>alert(1)</script><a href="javascript:alert(1)">link</a><div class="ansi-parser-viewport" tabindex="0"><picture><source media="(prefers-color-scheme: dark)" srcset="/dark.svg"><img src="/light.svg" onerror="alert(1)"></picture></div><aside style="font-style:italic;color:var(--text-muted);position:fixed">Note</aside>');
  assert.doesNotMatch(html, /script|onerror|position/);
  assert.match(html, /<a>link<\/a>/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /srcset="\/dark.svg"/);
  assert.match(html, /font-style:italic/);
  assert.match(html, /color:var\(--text-muted\)/);
});
