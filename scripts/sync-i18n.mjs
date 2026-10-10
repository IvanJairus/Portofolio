/*
  The page repeats its own text in two places: as values in i18n.js and
  config.js, and as the fallback a visitor sees before those files run. Keeping
  them equal by hand is how they drift, and the drift was real: the timeline
  fallback had six bullets against seven in config.js, and the contact links
  had two anchors against four.

  So the fallback is generated. i18n.js and config.js stay the only places text
  is written.

  Dev-only. The deployed site still has no build step.

    node scripts/sync-i18n.mjs            rewrite index.html from both sources
    node scripts/sync-i18n.mjs --check    exit non-zero on drift, change nothing
*/
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const STRINGS = new Function("window", read("assets/js/i18n.js") + "; return window.I18N;")({}).en;
const PROFILE = new Function("window", read("assets/js/config.js") + "; return window.PROFILE;")({});

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pick = (obj) => (obj && (obj.en ?? obj)) || "";

let file = read("index.html");
let touched = 0;
const missing = [];

const value = (key, replacement) => {
  const before = file;
  file = file.replace(key, replacement);
  if (file !== before) touched += 1;
};

/* ---------- 1. text bound by i18n key ---------- */

const PLAIN = /<([a-z][a-z0-9]*)((?:\s[^<>]*?)?)\sdata-i18n="([a-z0-9_.]+)"((?:\s[^<>]*?)?)>([^<]*)<\/\1>/g;
const HTML = /<([a-z][a-z0-9]*)((?:\s[^<>]*?)?)\sdata-i18n-html="([a-z0-9_.]+)"((?:\s[^<>]*?)?)>([\s\S]*?)<\/\1>/g;

function bindI18n(re, render, suffix) {
  file = file.replace(re, (match, tag, pre, key, post, content) => {
    const v = STRINGS[key];
    if (v === undefined) { missing.push(key); return match; }
    const next = render(v);
    if (next === content) return match;
    touched += 1;
    return `<${tag}${pre} data-i18n${suffix}="${key}"${post}>${next}</${tag}>`;
  });
}

bindI18n(PLAIN, escape, "");
bindI18n(HTML, (v) => v, "-html");

/* ---------- 2. scalars filled from PROFILE ---------- */

const SCALAR = {
  name: () => PROFILE.name,
  "brand-name": () => PROFILE.name,
  monogram: () => PROFILE.monogram,
  role: () => pick(PROFILE.role),
  email: () => PROFILE.email,
  location: () => PROFILE.location,
};

for (const [attr, get] of Object.entries(SCALAR)) {
  const re = new RegExp(`<(span|div|a)((?:\\s[^<>]*?)?)\\sdata-profile="${attr}"((?:\\s[^<>]*?)?)>([^<]*)</\\1>`, "g");
  file = file.replace(re, (match, tag, pre, post, content) => {
    const next = escape(get());
    if (next === content) return match;
    touched += 1;
    return `<${tag}${pre} data-profile="${attr}"${post}>${next}</${tag}>`;
  });
}

const mail = /<a([^>]*data-profile="email-link"[^>]*)>([^<]*)<\/a>/;
file = file.replace(mail, (match, attrs, content) => {
  const href = `mailto:${PROFILE.email}`;
  const kept = attrs.replace(/\s+href="[^"]*"/, "");
  const next = `<a${kept} href="${href}">${escape(PROFILE.email)}</a>`;
  if (next !== match) touched += 1;
  return next;
});

/* ---------- 3. containers rebuilt the way main.js builds them ---------- */

// Mencari penutup yang cocok untuk sebuah div bersarang, karena blok timeline
// berisi div di dalam div dan pola non-greedy akan berhenti terlalu cepat.
function innerBlock(startTag) {
  const at = file.indexOf(startTag);
  if (at < 0) return null;
  let i = at + startTag.length;
  let depth = 1;
  const token = /<\/?(div|ul)\b[^>]*>/g;
  token.lastIndex = i;
  let m;
  while ((m = token.exec(file))) {
    const closing = m[0][1] === "/";
    depth += closing ? -1 : 1;
    if (depth === 0) return { from: i, to: m.index, close: m[0] };
  }
  return null;
}

function rebuild(startTag, build) {
  const block = innerBlock(startTag);
  if (!block) { missing.push(startTag.slice(0, 40)); return; }
  const next = build();
  if (next === file.slice(block.from, block.to)) return;
  file = file.slice(0, block.from) + next + file.slice(block.to);
  touched += 1;
}

rebuild(`<div class="timeline" data-profile="experience">`, () => {
  const items = (PROFILE.experience || []).map((e) => [
    "          <div class=\"tl-item\">",
    `            <div class="tl-period">${escape(pick(e.period))}</div>`,
    `            <h3 class="tl-title">${escape(pick(e.title))}</h3>`,
    `            <div class="tl-company">${escape(pick(e.company))}</div>`,
    ...((pick(e.points) || []).length ? [
      "            <ul class=\"tl-points\">",
      ...pick(e.points).map((p) => `              <li>${escape(p)}</li>`),
      "            </ul>",
    ] : []),
    "          </div>",
  ].join("\n"));
  return "\n" + items.join("\n") + "\n        ";
});

rebuild(`<div class="cm-v profile-links" data-profile="links">`, () => "\n" +
  (PROFILE.links || []).map((l) =>
    `            <a href="${escape(l.href)}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ↗</a>`).join("\n") +
  "\n          ");

/* ---------- report ---------- */

if (missing.length) {
  console.error(`tidak ada sumbernya: ${missing.join(", ")}`);
  process.exit(1);
}

if (check && touched) {
  console.error(`drift: ${touched} tempat berbeda dari i18n.js atau config.js`);
  process.exit(1);
}

if (!check && touched) fs.writeFileSync(path.join(root, "index.html"), file);
console.log(`${check ? "parity ok" : "synced"}: ${touched} tempat diubah, ${Object.keys(STRINGS).length} kunci i18n, ${PROFILE.experience.length} entri pengalaman, ${PROFILE.links.length} tautan`);
