/*
  The board a recruiter opens has to say exactly what the site says, so its cards
  are generated from i18n.js instead of typed a second time. This is the same
  reason sync-i18n.mjs generates the HTML fallback: a second copy of a sentence is
  where drift starts.

  A number that cannot be traced to a published string does not become a card.
  check-traces.mjs already refuses a console line no statement prints; a project
  card held to a lower standard would be the weakest claim on a page sold as
  measured.

  Dev-only. scripts/ is not served, so nothing here reaches the deployed site.

    node scripts/sync-board.mjs --mode=plan     print the 12 cards, no network
*/
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

export const STRINGS = new Function("window", read("assets/js/i18n.js") + "; return window.I18N;")({}).en;
export const PROFILE = new Function("window", read("assets/js/config.js") + "; return window.PROFILE;")({});

export const SITE = "https://www.ivanjairus.xyz/portfolio";

const PROJECTS = [
  { n: 1, area: "ChatOps", evidence: "" },
  { n: 2, area: "CI Platform", evidence: "pipeline" },
  { n: 3, area: "Control Plane", evidence: "dashboard" },
];

const hrefOf = (id) => (id ? (PROFILE.links || []).find((l) => l.id === id)?.href || "" : "");

export const FIELDS = [
  { name: "Key", dataType: "TEXT" },
  {
    name: "Card",
    dataType: "SINGLE_SELECT",
    options: [
      { name: "Project", color: "BLUE", description: "One of the three portfolio projects." },
      { name: "Proof", color: "GREEN", description: "One measurable claim from a project." },
    ],
  },
  {
    name: "Area",
    dataType: "SINGLE_SELECT",
    options: [
      { name: "ChatOps", color: "PURPLE", description: "Orchestration driven from issue boards." },
      { name: "CI Platform", color: "ORANGE", description: "The pipeline standard and its gateway." },
      { name: "Control Plane", color: "YELLOW", description: "The release management platform." },
    ],
  },
  { name: "Source", dataType: "TEXT" },
  { name: "Evidence", dataType: "TEXT" },
];

export const VIEWS = [
  { name: "Recruiter showcase", layout: "TABLE_LAYOUT", visible: ["Card", "Area", "Key", "Source", "Evidence"] },
  { name: "Proof by figure", layout: "BOARD_LAYOUT", visible: ["Card", "Area", "Source"] },
];

/* One card per published sentence: three projects, then the three figures each
   one carries. A proof card keeps the bullet verbatim as its title, because the
   wording is what was measured. */
export function buildCards() {
  const cards = [];
  for (const p of PROJECTS) {
    const titleKey = `work.${p.n}.title`;
    const source = `${SITE}/#proj-${p.n}`;
    const evidence = hrefOf(p.evidence);
    cards.push({
      key: titleKey,
      card: "Project",
      area: p.area,
      title: STRINGS[titleKey],
      body: [STRINGS[`work.${p.n}.desc`], `Published: ${source}`, evidence && `Reference: ${evidence}`].filter(Boolean).join("\n\n"),
      source,
      evidence,
      parentKey: null,
    });
    for (const i of [1, 2, 3]) {
      const key = `work.${p.n}.i${i}`;
      cards.push({
        key,
        card: "Proof",
        area: p.area,
        title: STRINGS[key],
        body: [`Part of ${STRINGS[titleKey]}.`, `Published: ${source}`].join("\n\n"),
        source,
        evidence,
        parentKey: titleKey,
      });
    }
  }
  return cards;
}

/* A card title is only a claim about the site if the site really prints it.
   i18n.js is where the sentence is written and index.html is what a visitor
   reads before the scripts run, so both sides have to carry it. assert-copy.mjs
   already bans a dash used as a connector across every tracked file, including
   these two, so the rendered value is checked for the character itself and the
   source is not scanned twice. */
const DASH = String.fromCharCode(0x2014);

/* Nothing internal may reach a board strangers read. The site is already
   sanitized; the board is a new copy of those sentences in a new place, so the
   check runs again rather than trusting where the text came from. */
const INTERNAL = [
  [/gitlab-dc/i, "internal hostname"],
  [/\bbni\b/i, "employer name"],
  [/\b9965\b/, "internal project id"],
  [/[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "email address"],
];

export function guard(cards) {
  const problems = [];
  const html = read("index.html");
  for (const c of cards) {
    if (typeof c.title !== "string" || !c.title.length) problems.push(`${c.key}: empty title`);
    if (!STRINGS[c.key]) problems.push(`${c.key}: nothing published under this key`);
    else if (STRINGS[c.key] !== c.title) problems.push(`${c.key}: title is not the published string`);
    if (!html.includes(String(c.title))) problems.push(`${c.key}: title is not printed in index.html`);
    if (!String(c.source || "").startsWith(SITE)) problems.push(`${c.key}: no source URL back to the published page`);
    for (const [field, value] of [["title", c.title], ["body", c.body]]) {
      if (String(value).includes(DASH)) problems.push(`${c.key}.${field}: em dash`);
      for (const [re, why] of INTERNAL) if (re.test(String(value))) problems.push(`${c.key}.${field}: ${why}`);
    }
  }
  return problems;
}

const verbose = process.env.BOARD_VERBOSE === "1";
export const log = (msg) => console.log(msg);
export const vlog = (msg) => { if (verbose) console.log(`  . ${msg}`); };

/* One transport for every call, so the retry, the rate-limit line and the rule
   that a token never reaches a log live in a single place. Two tokens are used
   on purpose: the board PAT carries only the project scope, and the workflow's
   own GITHUB_TOKEN carries issues. A run that asks for the wrong one fails at
   the call that needed it rather than needing a broader secret. */
function tokenFor(kind) {
  if (kind === "project") return process.env.PORTFOLIO_BOARD_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.PORTFOLIO_BOARD_PAT;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(url, body, { kind, label, method = "POST" }) {
  const token = tokenFor(kind);
  if (!token) throw new Error(`${label}: no token for the ${kind} call (set ${kind === "project" ? "PORTFOLIO_BOARD_PAT" : "GITHUB_TOKEN"})`);
  let wait = 1000;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    /* fetch rejects a body on GET, and most of what this script reads is GET. */
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
        "User-Agent": "portfolio-board-sync",
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const used = res.headers.get("x-ratelimit-used");
    if (res.status === 401 || res.status === 403) {
      throw new Error(`${label}: auth rejected (HTTP ${res.status}). Check the token scopes.`);
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const sleepMs = retryAfter ? retryAfter * 1000 : wait;
      log(`FAIL ${label}: HTTP ${res.status}, retry ${attempt}/3 in ${sleepMs}ms`);
      await sleep(sleepMs);
      wait *= 2;
      continue;
    }
    const payload = await res.json();
    if (payload.errors) {
      const first = payload.errors[0];
      throw new Error(`${label}: ${first.message}${first.extensions?.code ? ` (${first.extensions.code})` : ""}`);
    }
    /* A REST failure answers with { message, errors }, and the reason is in there.
       Logging only the status code would leave the next person guessing. */
    if (!res.ok && !payload.data) {
      const detail = (payload.errors || []).map((e) => `${e.field || e.resource}:${e.code || e.message}`).join(", ");
      throw new Error(`${label}: HTTP ${res.status} ${payload.message || ""}${detail ? ` [${detail}]` : ""}`.trim());
    }
    log(`${method} ${label} http=${res.status} used=${used ?? "?"} remaining=${remaining ?? "?"} attempt=${attempt}`);
    vlog(`body=${JSON.stringify(body).slice(0, 200)}`);
    return payload.data ?? payload;
  }
  throw new Error(`${label}: gave up after 3 attempts`);
}

export function gql(query, variables = {}, kind = "project") {
  const m = /(?:mutation|query)\s+(\w+)/.exec(query);
  return send("https://api.github.com/graphql", { query, variables }, { kind, label: m ? m[1] : "anonymous" });
}

export function rest(pathname, { method = "GET", body } = {}, kind = "issue") {
  const label = pathname.split("?")[0];
  return send(`https://api.github.com${pathname}`, body ?? {}, { kind, label, method });
}

export const repoOwner = "IvanJairus";
export const repoName = "Portofolio";
