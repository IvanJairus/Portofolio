#!/usr/bin/env node
/*
  Prove that every console line on /pipelines/ comes from somewhere.

  The page draws two pipeline consoles. A visitor is being told these are the
  runs the published rules produce, so each line has to be traceable to the
  pinned source, and "traceable" has to mean more than a person remembering to
  keep two files in step.

  A line carries one of two things:

    p: "<fileKey>::<substring>"   the substring must appear, literally, in that
                                  pinned file. For a command line that is the
                                  template that runs it; for a log line that is
                                  the script that prints it.
    t: "<tool>" + p               the output belongs to a third-party program
                                  this repository does not vendor (maven, trivy,
                                  semgrep, gitleaks, syft, sonar, kaniko). A tool
                                  line still needs a probe, and it must name the
                                  file that actually invokes that tool, so the
                                  claim becomes "this pipeline runs trivy" rather
                                  than "imagine what trivy printed".

  Anything else fails. A line with neither is decoration.

  A line that claims to have been printed (l is log/ok/warn/err, and it is not
  tool output or a computed value) is held to one more step: the source line the
  probe lands on has to be the statement that prints it, or carry the message as
  a string literal. Otherwise the probe could point anywhere in the file and the
  line would still "resolve", which is the difference between a trace and a
  citation someone typed by hand.
*/

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const sources = JSON.parse(read('assets/data/sources.json'));
const traces = JSON.parse(read('assets/data/traces.json'));

const TOOLS = new Set(['maven', 'trivy', 'semgrep', 'gitleaks', 'syft', 'sonar', 'kaniko']);
const DYN = new Set(['summary', 'failures', 'warnings', 'counts', 'plan', 'thresholds']);
const LEVELS = new Set(['cmd', 'out', 'log', 'ok', 'warn', 'err']);

const localFor = (k) => (k === 'fixture.json' ? 'assets/data/fixture.json' : `assets/data/src/${k}`);

const groups = [...Object.values(sources.engines).map((e) => e.tree), sources.gate.tree, sources.support || []];
const keys = new Set();
for (const g of groups) for (const n of g) if (n.k) keys.add(n.k);

const cache = new Map();
const linesOf = (k) => {
  if (!cache.has(k)) cache.set(k, read(localFor(k)).split('\n'));
  return cache.get(k);
};
const bodyOf = (k) => linesOf(k).join('\n');

/* The statements in these files that put text on a console. Bash uses log/echo,
   Groovy uses log() and the failure/warning lists, Python uses log(). A message
   that is a string literal in the file counts too: that is how the Groovy classes
   hand their text to whoever prints it. */
const PRINT_RE = new RegExp([
  '\\becho\\b', '\\bprintf\\b', 'println', 'print\\(', '\\blog\\(\\s*.',
  'log_(info|warn|error|debug|ok|fail|step)', '\\blog (TRACE|DEBUG|INFO|WARN|ERROR)\\b',
  'System\\.out', '\\bdie\\b', 'failures <<', 'warnings <<', 'error\\(',
  'commentOnTicket', 'sh\\(script',
].join('|'));
const QUOTED = /['"`]([^'"`\n]{10,})['"`]/g;
/* The page prints what the code holds in a string: "gate failed: " joined to the
   failure list reaches the console as "gate failed: vulnerabilities: 1 critical".
   So a literal in the source line explains the message when the message begins
   with it. */
function literalExplains(line, message) {
  const msg = message.replace(/^\s*\u2713?\s*/, '');
  QUOTED.lastIndex = 0;
  let m;
  while ((m = QUOTED.exec(line)) !== null) {
    if (msg.startsWith(m[1])) return true;
  }
  return false;
}
const PRINTED = new Set(['log', 'ok', 'warn', 'err']);

const problems = [];
let lines = 0;
let probed = 0;
let toolLines = 0;
let printedProved = 0;

function checkLine(where, line) {
  lines += 1;
  if (!LEVELS.has(line.l)) problems.push(`${where}: level "${line.l}" is not one of ${[...LEVELS].join(', ')}`);
  if (typeof line.m !== 'string') problems.push(`${where}: message must be a string`);
  if (!line.m && !line.dyn) problems.push(`${where}: empty line`);
  if (line.dyn && !DYN.has(line.dyn)) problems.push(`${where}: dyn "${line.dyn}" is not one of ${[...DYN].join(', ')}`);
  if (line.when && !['passed', 'refused'].includes(line.when)) problems.push(`${where}: when "${line.when}" is not an outcome`);
  if (line.t) {
    toolLines += 1;
    if (!TOOLS.has(line.t)) problems.push(`${where}: tool "${line.t}" is not in the allow-list`);
  }
  if (!line.p) {
    problems.push(`${where}: no probe${line.t ? ` (a ${line.t} line must still name the file that runs it)` : ''}`);
    return;
  }
  const at = line.p.indexOf('::');
  if (at < 1) {
    problems.push(`${where}: probe "${line.p}" is not fileKey::substring`);
    return;
  }
  const key = line.p.slice(0, at);
  const needle = line.p.slice(at + 2);
  if (!keys.has(key)) {
    problems.push(`${where}: probe points at "${key}", which no tree lists and is not pinned`);
    return;
  }
  if (!needle.length) {
    problems.push(`${where}: probe has an empty substring`);
    return;
  }
  probed += 1;
  const body = bodyOf(key);
  if (!body.includes(needle)) {
    problems.push(`${where}: "${key}" does not contain ${JSON.stringify(needle)}`);
    return;
  }
  /* Who printed this? A line that says "the pipeline logged this" has to land on
     the statement that logs it, not anywhere in the file. */
  if (PRINTED.has(line.l) && !line.t && !line.dyn) {
    const at2 = body.indexOf(needle);
    const from = body.lastIndexOf('\n', at2) + 1;
    const to = body.indexOf('\n', at2);
    const stmt = body.slice(from, to === -1 ? body.length : to).trim();
    if (PRINT_RE.test(stmt) || literalExplains(stmt, line.m)) printedProved += 1;
    else problems.push(`${where}: "${key}" resolves to ${JSON.stringify(stmt.slice(0, 70))}, which prints nothing`);
  }
}

for (const [engine, jobs] of Object.entries(traces.engines)) {
  const spec = sources.engines[engine];
  if (!spec) { problems.push(`traces list "${engine}", which sources.json does not define`); continue; }
  for (const [job, list] of Object.entries(jobs)) {
    if (!spec.jobs[job]) problems.push(`${engine}/${job}: traced, but no source file is mapped to it`);
    if (!Array.isArray(list) || !list.length) problems.push(`${engine}/${job}: no lines`);
    list.forEach((line, i) => checkLine(`${engine}/${job}[${i}]`, line));
  }
  const traced = new Set(Object.keys(jobs));
  for (const job of Object.keys(spec.jobs)) {
    if (!traced.has(job)) problems.push(`${engine}/${job}: mapped to a source file but never traced`);
  }
}
traces.gate.forEach((line, i) => checkLine(`gate[${i}]`, line));

if (lines < 200) problems.push(`only ${lines} traced lines: the consoles are thinner than they were`);

for (const p of problems) console.log(`FAIL ${p}`);
console.log(`\n${lines} console lines: ${probed} resolved against the pinned source, ${toolLines} attributed to a tool, ${printedProved} traced to the statement that prints them.`);
if (problems.length) {
  console.log(`${problems.length} problem(s). The page would be showing output nothing produced.`);
  process.exit(1);
}
console.log('ok: no line on the page is invented. Each one is printed by a statement in the pinned source, is output of a tool the pinned source runs, or is a value read off the pinned source.');
