#!/usr/bin/env node
/*
  Pulls the files this site displays from one pinned commit of IvanJairus/Pipeline.

    node scripts/sync-sources.mjs            # write
    node scripts/sync-sources.mjs --dry-run  # report what would change

  Why it fetches over the network instead of copying from a local checkout: the
  claim on the page is "this is what the repository serves". A copy from a dirty
  working tree cannot support that claim. The commit is pinned in
  assets/data/sources.json, so the vendored bytes stay reproducible after the
  default branch has moved on, and bumping the ref is an explicit edit with a
  diff rather than something that happens because a script was run.

  It writes three things and nothing else: the file bodies under
  assets/data/src/, the line counts in sources.json (so a highlight range can be
  checked against a real file), and rules.lock.json with SHA-256 and byte counts.
  Highlight ranges themselves are editorial and stay hand-written.

  Everything is fetched and validated before anything is written. A run that
  aborts halfway must not leave the tree holding half a sync.
*/

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

const sources = JSON.parse(read('assets/data/sources.json'));
const DRY = process.argv.includes('--dry-run');

/* Files the site executes rather than displays. Pinned the same way. */
const PORTED = [
  { local: 'assets/js/release-rules.mjs', upstream: 'rules/release-rules.mjs' },
  { local: 'assets/data/fixture.json', upstream: 'rules/fixture.json' },
];

const localFor = (k) => (k === 'fixture.json' ? 'assets/data/fixture.json' : `assets/data/src/${k}`);

const trees = [...Object.values(sources.engines).map((e) => e.tree), sources.gate.tree];
const entries = [];
for (const group of trees) {
  for (const node of group) if (node.k) entries.push({ local: localFor(node.k), upstream: node.path, node });
}
for (const p of PORTED) entries.push({ local: p.local, upstream: p.upstream, node: null });

const BASE = `https://raw.githubusercontent.com/${sources.upstream}/${sources.ref}/`;

const problems = [];
const fetched = new Map();

for (const e of entries) {
  try {
    const res = await fetch(BASE + e.upstream);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fetched.set(e.local, Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    problems.push(`${e.upstream} could not be fetched from ${sources.ref.slice(0, 7)} (${err.message})`);
  }
}

/* Line counts are derived from the bytes we just fetched, never typed by hand. */
for (const e of entries) {
  const buf = fetched.get(e.local);
  if (buf && e.node) e.node.lines = lineCount(buf.toString('utf8'));
}

/*
  Every highlight range must land inside the file it points at. A job may point
  at a file listed in any tree: the gate classes live in shared-library/src,
  which both engines compile, and duplicating them into two trees would create
  two claims to keep in sync instead of one fact.
*/
const listed = new Map();
for (const group of trees) for (const node of group) if (node.k) listed.set(node.k, node);

for (const [engine, spec] of Object.entries({ ...sources.engines, gate: sources.gate })) {
  const shown = new Set([...spec.tree, ...sources.gate.tree].filter((n) => n.k).map((n) => n.k));
  for (const [job, m] of Object.entries(spec.jobs)) {
    const node = listed.get(m.file);
    if (!node) { problems.push(`${engine}/${job} maps to ${m.file}, which no tree lists`); continue; }
    if (!shown.has(m.file)) { problems.push(`${engine}/${job} maps to ${m.file}, which neither its own panel nor the gate panel shows`); continue; }
    if (typeof m.why !== 'string' || !m.why.length) problems.push(`${engine}/${job} has no reason written`);
    for (const [from, to] of m.hl) {
      if (from < 1 || to > node.lines || to < from) {
        problems.push(`${engine}/${job} highlights ${from}-${to} in a ${node.lines}-line file (${m.file})`);
      }
    }
  }
}

if (problems.length) {
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(`\nsync aborted: ${problems.length} problem(s). Nothing was written.`);
  process.exit(1);
}

const lock = { note: sources.note, upstream: sources.upstream, ref: sources.ref, files: {} };
let changed = 0;

for (const e of entries) {
  const buf = fetched.get(e.local);
  const digest = sha(buf);
  let current = null;
  try { current = readFileSync(join(root, e.local)); } catch { /* first sync */ }
  if (!current || sha(current) !== digest) {
    changed += 1;
    console.log(`${DRY ? 'would write' : 'wrote'} ${e.local} (${buf.length} B)`);
    if (!DRY) writeFileSync(join(root, e.local), buf);
  }
  lock.files[e.local] = { sha256: digest, upstream: e.upstream, bytes: buf.length };
}

if (!DRY) {
  writeFileSync(join(root, 'assets/data/rules.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  writeFileSync(join(root, 'assets/data/sources.json'), JSON.stringify(sources, null, 2) + '\n');
}

console.log(`\n${Object.keys(lock.files).length} files pinned at ${sources.ref.slice(0, 7)}; ${changed} body change(s); 0 problems.`);
