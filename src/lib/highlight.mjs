import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubLight from "shiki/themes/github-light.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import zig from "shiki/langs/zig.mjs";
import bash from "shiki/langs/bash.mjs";
import c from "shiki/langs/c.mjs";
import cpp from "shiki/langs/cpp.mjs";
import rust from "shiki/langs/rust.mjs";
import javascript from "shiki/langs/javascript.mjs";
import typescript from "shiki/langs/typescript.mjs";
import json from "shiki/langs/json.mjs";
import diff from "shiki/langs/diff.mjs";

// Explicit grammars keep the Worker small; no browser-side highlighter or WASM.
const highlighter = createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: [zig, bash, c, cpp, rust, javascript, typescript, json, diff],
  engine: createJavaScriptRegexEngine(),
});

export async function highlight(code, language = "text") {
  const instance = await highlighter;
  const aliases = { sh: "bash", shell: "bash", js: "javascript", ts: "typescript", rs: "rust", plaintext: "text" };
  const requested = aliases[language] || language;
  const lang = instance.getLoadedLanguages().includes(requested) ? requested : "text";
  return instance.codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" } });
}
