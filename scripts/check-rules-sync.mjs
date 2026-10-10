#!/usr/bin/env node
/*
  Two checks on the files this site vendors from IvanJairus/Pipeline.

  1. The local copy must match assets/data/rules.lock.json. This always runs and
     always blocks. It catches the ordinary accident: someone edits the vendored
     copy in place and it silently becomes a second implementation.

  2. The local copy must match what the upstream repository serves. This can only
     run once that repository is public. While it is private the script says so
     out loud and does not pretend the second check passed.

  The distinction matters. A verification step that quietly shrugs when it cannot
  verify is not a verification step, and one that fails forever while the source
  is deliberately private just trains people to ignore CI.
*/

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'assets/data/rules.lock.json'), 'utf8'));

const REPO = lock.upstream;
/*
  The pinned commit, not HEAD. A page that says "this is the source my pipeline
  runs" is making a claim about a specific state of a repository; comparing
  against a moving branch would let that claim rot quietly the day someone
  upstream edits a file. Bumping the ref is an explicit change to
  assets/data/sources.json plus a re-sync.
*/
const REF = lock.ref || 'HEAD';
const BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/`;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let blocked = 0;
let unverified = 0;

for (const [local, spec] of Object.entries(lock.files)) {
  const buf = readFileSync(join(root, local));
  const h = sha(buf);

  if (h !== spec.sha256) {
    console.log(`FAIL ${local} does not match rules.lock.json`);
    console.log(`       local  ${h}`);
    console.log(`       pinned ${spec.sha256}`);
    console.log(`       If the upstream file changed, refresh the copy and re-pin the hash.`);
    blocked++;
    continue;
  }
  console.log(`ok   ${local} matches its pinned hash (${h.slice(0, 12)}, ${buf.length} B)`);

  let remote = null;
  try {
    const res = await fetch(BASE + spec.upstream, { cache: 'no-store' });
    if (res.ok) remote = Buffer.from(await res.arrayBuffer());
    else if (res.status === 404) unverified++;
    else throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.log(`NOTE ${spec.upstream}: upstream check inconclusive (${e.message})`);
    unverified++;
    continue;
  }

  if (remote) {
    const rh = sha(remote);
    if (rh === spec.sha256) {
      console.log(`ok   ${spec.upstream} in ${REPO} is byte-identical`);
    } else {
      console.log(`FAIL ${local} has drifted from ${REPO}/${spec.upstream} (${rh.slice(0, 12)})`);
      blocked++;
    }
  }
}

/*
  The manifest that drives the page's source panels has to agree with the bytes
  on disk: every file it names must exist, every line count must match, and every
  highlight range must land inside its file. Without this, a panel can point at a
  line that is not there and nobody notices until a visitor reads an empty row.
*/
const sources = JSON.parse(readFileSync(join(root, 'assets/data/sources.json'), 'utf8'));
const localFor = (k) => (k === 'fixture.json' ? 'assets/data/fixture.json' : `assets/data/src/${k}`);
const listed = new Map();
for (const group of [...Object.values(sources.engines).map((e) => e.tree), sources.gate.tree]) {
  for (const node of group) if (node.k) listed.set(node.k, node);
}
for (const [k, node] of listed) {
  let text;
  try {
    text = readFileSync(join(root, localFor(k)), 'utf8');
  } catch {
    console.log(`FAIL sources.json names ${k}, which is not on disk`);
    blocked++;
    continue;
  }
  const real = text.replace(/\n$/, '').split('\n').length;
  if (real !== node.lines) {
    console.log(`FAIL ${k}: sources.json says ${node.lines} lines, the file has ${real}`);
    blocked++;
  }
  if (!lock.files[localFor(k)]) {
    console.log(`FAIL ${k} is displayed but not pinned in rules.lock.json`);
    blocked++;
  }
}
for (const [engine, spec] of Object.entries({ ...sources.engines, gate: sources.gate })) {
  for (const [job, m] of Object.entries(spec.jobs)) {
    const node = listed.get(m.file);
    if (!node) { console.log(`FAIL ${engine}/${job} points at ${m.file}, which no tree lists`); blocked++; continue; }
    for (const [from, to] of m.hl) {
      if (from < 1 || to > node.lines) {
        console.log(`FAIL ${engine}/${job} highlights ${from}-${to} in a ${node.lines}-line file`);
        blocked++;
      }
    }
  }
}

if (unverified) {
  console.log(`\n${unverified} file(s) could not be compared to ${REPO}@${REF.slice(0, 7)}. ` +
    `The local-vs-pinned check still ran and still blocks; this one needs the network. ` +
    `A visitor can always fetch the same commit themselves, which is the point of pinning it.`);
}

process.exit(blocked === 0 ? 0 : 1);
