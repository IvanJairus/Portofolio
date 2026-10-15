#!/usr/bin/env node
/*
  The board is read by people who are not this repository, so its card set is
  checked here, offline, before any token is involved. This gate answers one
  question: is every card a sentence the published site already prints?

  A gate that only ever passes proves nothing, so --selftest feeds the checker
  cards it must reject. The em dash is built by code point rather than written
  out: assert-copy.mjs scans every tracked file, and a copy of the character in
  this source would make the copy gate fail on the tool that enforces it.

    node scripts/check-board.mjs            fail on any problem
    node scripts/check-board.mjs --selftest  also prove the checks fire
*/
import { buildCards, guard } from "./board-lib.mjs";

const selftest = process.argv.includes("--selftest");
const cards = buildCards();
const problems = guard(cards);

const EXPECTED = { total: 12, project: 3, proof: 9 };
const counts = {
  total: cards.length,
  project: cards.filter((c) => c.card === "Project").length,
  proof: cards.filter((c) => c.card === "Proof").length,
};

const keys = new Set(cards.map((c) => c.key));
if (keys.size !== cards.length) problems.push(`${cards.length} cards but only ${keys.size} distinct keys`);

for (const [name, want] of Object.entries(EXPECTED)) {
  if (counts[name] !== want) problems.push(`${name} cards: ${counts[name]}, expected ${want}`);
}

for (const c of cards) {
  if (c.card === "Proof" && !c.parentKey) problems.push(`${c.key}: a proof card without a project parent`);
  if (c.card === "Project" && c.parentKey) problems.push(`${c.key}: a project card claiming a parent`);
}

console.log(`cards: ${counts.project} project + ${counts.proof} proof = ${counts.total}`);
for (const c of cards) console.log(`  ${c.key.padEnd(12)} ${c.card.padEnd(8)} ${c.area.padEnd(13)} "${c.title}"`);

for (const p of problems) console.log(`FAIL ${p}`);

if (selftest) {
  const DASH = String.fromCharCode(0x2014);
  const bad = [
    { key: "work.2.i1", card: "Proof", area: "CI Platform", title: `53 services onboarded; source repositories carry no CI file at all ${DASH} 61 in practice`, body: "runs on gitlab-dc.example.internal", parentKey: "work.2.title", source: "" },
    { key: "work.9.i1", card: "Proof", area: "Nowhere", title: "A figure nobody published", body: "contact me@example.com", parentKey: null, source: "https://example.invalid" },
  ];
  const caught = guard(bad);
  console.log(`selftest: ${bad.length} fabricated card(s) produced ${caught.length} problem(s)`);
  for (const c of caught) console.log(`  caught: ${c}`);
  const mustSee = ["em dash", "internal hostname", "email address", "not the published string", "not printed in index.html", "nothing published under this key"];
  const missed = mustSee.filter((needle) => !caught.some((c) => c.includes(needle)));
  if (missed.length) console.log(`FAIL selftest: the checker did not fire on ${missed.join(", ")}`);
  else console.log("ok: selftest: the checker rejects an invented number, an internal host, an email and a string the site does not print.");
  if (missed.length) process.exit(1);
}

if (problems.length) {
  console.log(`${problems.length} problem(s). The board would be showing claims the site does not make.`);
  process.exit(1);
}
console.log("ok: every card is a sentence the published page prints, in i18n.js and in the fallback a visitor reads first.");
