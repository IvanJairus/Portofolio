/*
  The page ships readable text in the HTML and translated text in i18n.js, and
  the two must agree or the first paint differs from the settled page. Editing
  both by hand is how they drift, so i18n.js is the single source and this
  script writes the HTML fallback from it.

  Dev-only. The deployed site still has no build step.

    node scripts/sync-i18n.mjs            rewrite index.html from i18n.js
    node scripts/sync-i18n.mjs --check    exit non-zero on drift, change nothing
*/
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

// i18n.js assigns to window.I18N, so load it with a window stand-in.
const src = fs.readFileSync(path.join(root, "assets/js/i18n.js"), "utf8");
const loaded = new Function("window", `${src}; return window.I18N;`);
const STRINGS = loaded({}).en;

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let file = fs.readFileSync(path.join(root, "index.html"), "utf8");
let touched = 0;
const missing = [];

// Content is matched as "no raw angle bracket" because a data-i18n element is
// written as text; anything that needs markup belongs on data-i18n-html.
const PLAIN = /<([a-z][a-z0-9]*)((?:\s[^<>]*?)?)\sdata-i18n="([a-z0-9_.]+)"((?:\s[^<>]*?)?)>([^<]*)<\/\1>/g;
const HTML = /<([a-z][a-z0-9]*)((?:\s[^<>]*?)?)\sdata-i18n-html="([a-z0-9_.]+)"((?:\s[^<>]*?)?)>([\s\S]*?)<\/\1>/g;

function replace(re, render) {
  file = file.replace(re, (match, tag, pre, key, post, content) => {
    const value = STRINGS[key];
    if (value === undefined) { missing.push(key); return match; }
    const next = render(value);
    if (next === content) return match;
    touched += 1;
    return `<${tag}${pre} data-i18n${re === HTML ? "-html" : ""}="${key}"${post}>${next}</${tag}>`;
  });
}

replace(PLAIN, escape);
replace(HTML, (v) => v);

if (missing.length) {
  console.error(`keys with no value in i18n.js: ${[...new Set(missing)].join(", ")}`);
  process.exit(1);
}

const bound = (file.match(/data-i18n(-html)?="/g) || []).length;
const known = Object.keys(STRINGS).length;

if (check && touched) {
  console.error(`drift: ${touched} element(s) differ from i18n.js`);
  process.exit(1);
}

if (!check && touched) fs.writeFileSync(path.join(root, "index.html"), file);
console.log(`${check ? "parity ok" : "synced"}: ${bound} bound elements, ${known} keys, ${touched} changed`);
