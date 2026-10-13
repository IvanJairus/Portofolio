#!/usr/bin/env node
/*
  Content that ships invisible is a defect, not a state.

  /reports/ exists because three report emails were hidden behind tabs, and the
  first build of it reproduced the bug exactly: two of the cards were copied out of
  the widget with their `hidden` attribute still on them, so the page printed two
  headings and nothing under them. A markup count said "3 cards present". Only a
  rendered pixel disagreed.

  So: no card on this site may carry `hidden`. Controls that fold (the decision
  cards on /decisions/) use `data-fold`, which is a state a reader can leave and
  come back from; `hidden` on content is content that never arrives.
*/

import { readFileSync } from 'node:fs';

const PAGES = ['index.html', '404.html', 'pipelines/index.html', 'reports/index.html', 'decisions/index.html', 'diagrams/index.html'];
const CARD = /class="[^"]*\b(mail-card|dec-card|pf-card|wv)\b[^"]*"([^>]*)>/g;

const problems = [];
for (const page of PAGES) {
  let text;
  try { text = readFileSync(page, 'utf8'); } catch { problems.push(`${page}: not readable`); continue; }
  const stripped = text.replace(/<!--[\s\S]*?-->/g, '');
  let m;
  CARD.lastIndex = 0;
  while ((m = CARD.exec(stripped)) !== null) {
    if (/\bhidden\b/.test(m[2])) {
      const line = stripped.slice(0, m.index).split('\n').length;
      problems.push(`${page}:${line}: a card carries hidden, so it renders as nothing`);
    }
  }
}

for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length) {
  console.log(`${problems.length} problem(s). The page would show a heading with no content under it.`);
  process.exit(1);
}
console.log(`ok: no card is shipped hidden across ${PAGES.length} pages`);
