#!/usr/bin/env node
/*
  Two checks on the files this site vendors from pipeline-gateway-reference.

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
const BASE = `https://raw.githubusercontent.com/${REPO}/HEAD/`;
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

if (unverified) {
  console.log(`\n${unverified} file(s) could not be compared to upstream. ` +
    `That is expected while ${REPO} is private, and it means the page's claim that ` +
    `these are published rules is currently unverifiable by a visitor too. ` +
    `Make the repository public and this check becomes real.`);
}

process.exit(blocked === 0 ? 0 : 1);
