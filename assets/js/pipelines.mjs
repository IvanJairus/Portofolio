/*
  The pipeline view. Everything it decides comes from release-rules.mjs, which is
  a port of the Groovy in pipeline-gateway-reference and is checked against that
  Groovy by rules/fixture.json in CI.

  Two rules this file holds itself to:

  1. No invented numbers. The only durations shown are the two published on the
     landing page with their sample sizes. Every other stage reports what it
     decided, not how long it took.
  2. No innerHTML and no inline styles. The CSP on this site is script-src
     'self' and style-src 'self', so both would fail in production, and the
     existing pages already build their DOM the same way.
*/

import * as R from './release-rules.mjs';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Same manifest the fixture carries, so the self-check below is testing the
   data the page actually runs on. */
const MANIFEST = {
  releaseTag: 'v1.4.2',
  services: [
    { id: 'web', name: 'portal', artifact: 'web', owners: ['digital'] },
    { id: 'api', name: 'core-api', artifact: 'jar', owners: ['core'], commit: 'a1b2c3d' },
    { id: 'img', name: 'svc-image', artifact: 'image', registry: 'registry.example.internal', owners: ['core'] },
  ],
};

const FIVE = { team: 'dev@x', business: 'biz@x', product: 'prod@x', architecture: 'arch@x', engineering: 'eng@x' };

const GREEN_GATE = {
  deploy: { result: 'success' },
  quality: { status: 'passed', coverage: 71.5, duplication: 3.1 },
  scan: { sbom: true, findings: [{ severity: 'LOW' }, { severity: 'medium' }] },
};

const SCENARIOS = [
  { id: 'clean', label: 'a normal release', fixture: 'gate-green',
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE, gate: GREEN_GATE, hops: [['sit', 'uat'], ['uat', 'prod']] },
  { id: 'no-sbom', label: 'SBOM missing', fixture: 'gate-no-sbom',
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    gate: { ...GREEN_GATE, scan: { sbom: false, findings: [] } }, hops: [['sit', 'uat'], ['uat', 'prod']] },
  { id: 'critical', label: 'one critical CVE', fixture: 'gate-one-critical',
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    gate: { ...GREEN_GATE, scan: { sbom: true, findings: [{ severity: 'CRITICAL' }] } }, hops: [['sit', 'uat'], ['uat', 'prod']] },
  { id: 'coverage', label: 'coverage never measured', fixture: 'gate-coverage-absent',
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    gate: { ...GREEN_GATE, quality: { status: 'passed', duplication: 2.0 } }, hops: [['sit', 'uat'], ['uat', 'prod']] },
  { id: 'one-signer', label: 'one identity, five layers', fixture: 'approvals-one-signer',
    branch: 'fix/471-timeout', tag: 'v1.4.2',
    approvals: { team: 'a', business: 'a', product: 'a', architecture: 'a', engineering: 'a' },
    gate: GREEN_GATE, hops: [['sit', 'uat'], ['uat', 'prod']] },
  { id: 'backwards', label: 'uat back to sit', fixture: 'promote-backward',
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE, gate: GREEN_GATE, hops: [['uat', 'sit'], ['sit', 'prod']] },
  { id: 'bad-branch', label: 'branch named wrongly', fixture: 'branch-uppercase',
    branch: 'fix/471-Timeout', tag: 'v1.4.2', approvals: FIVE, gate: GREEN_GATE, hops: [['sit', 'uat'], ['uat', 'prod']] },
];

const ENGINES = {
  gitlab: { name: 'GitLab CI', job: (s) => `section_start:${s}`, stage: (s) => `Running ${s} on the project runner` },
  jenkins: { name: 'Jenkins', job: (s) => `[Pipeline] stage ({$S})`, stage: (s) => `[Pipeline] { ${s} }` },
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/* ---------- the run, computed ---------- */

function compute(sc) {
  const branchProblems = R.validateBranch(sc.branch);
  const tagProblems = R.validateTag(sc.tag);
  const manifestProblems = R.validateManifest(MANIFEST);
  const plan = R.buildPlan(MANIFEST, 'sit');
  const gate = R.evaluateGate(sc.gate);
  const approvals = R.approvalChainProblems(sc.approvals);
  const hops = sc.hops.map(([from, to]) => ({ from, to, problems: R.validatePromotion(from, to) }));

  const scanFail = gate.failures.filter((f) => /scan|sbom|vulnerabilit/i.test(f));
  const qualityFail = gate.failures.filter((f) => /quality|coverage|duplication/i.test(f));
  const deployFail = gate.failures.filter((f) => /^deploy/i.test(f));
  // Decided before the hop lines are written, so a stage that will not be
  // reached says so in its log and not only in its dot.
  const stopped = [...branchProblems, ...tagProblems, ...manifestProblems,
                   ...scanFail, ...qualityFail, ...approvals, ...deployFail].length > 0;

  const stages = [
    { key: 'commit', label: 'commit', problems: [...branchProblems, ...tagProblems],
      cmd: `git push origin ${sc.branch}`,
      lines: [...branchProblems, ...tagProblems].map((p) => ({ m: p, cls: 'err' })) },
    { key: 'build', label: 'build', problems: manifestProblems,
      cmd: `resolve release manifest ${sc.tag}`,
      lines: plan.map((p) => ({ m: `${p.id.padEnd(5)} ${p.artifact.padEnd(6)} tier ${p.tier}  wm ${p.watermark}`, cls: 'dim' })),
      duration: null },
    { key: 'scan', label: 'scan', problems: [...scanFail, ...qualityFail],
      cmd: 'trivy image && semgrep && sonar',
      lines: [...scanFail, ...qualityFail].map((p) => ({ m: p, cls: 'err' })),
      duration: '80 s median · n=30' },
    { key: 'gate', label: 'gate', problems: [...approvals, ...deployFail],
      cmd: 'evaluate the composite gate',
      lines: [
        ...approvals.map((p) => ({ m: p, cls: 'err' })),
        { m: gate.summary, cls: gate.passed ? 'cmd' : 'err' },
        ...gate.warnings.map((w) => ({ m: `warning: ${w}`, cls: 'warn' })),
      ] },
    { key: 'sit', label: 'SIT', problems: [], blocked: stopped, cmd: 'deploy to the app-server VMs',
      lines: stopped
        ? [{ m: 'not reached: the gate refused before anything shipped', cls: 'dim' }]
        : plan.filter((p) => !p.skip).map((p) => ({ m: `${p.id}: deployed ${sc.tag} (median 93 s, n=13)`, cls: 'dim' })),
      duration: '93 s median · n=13' },
  ];

  hops.forEach((h) => {
    const label = h.to === 'prod' ? 'PROD' : 'UAT';
    stages.push({
      key: label.toLowerCase(), label,
      problems: h.problems,
      blocked: !h.problems.length && stopped,
      cmd: `promote ${h.from} -> ${h.to} (${ENV_BRANCH[h.to]})`,
      lines: h.problems.length
        ? h.problems.map((p) => ({ m: p, cls: 'err' }))
        : stopped
          ? [{ m: 'not reached: an earlier stage refused the release', cls: 'dim' }]
          : [{ m: `${h.to} moved to ${ENV_BRANCH[h.to]}`, cls: 'dim' }],
    });
  });

  return stages;
}

const ENV_BRANCH = { sit: 'rel/sit', uat: 'rel/uat', prod: 'release' };

/* ---------- rendering ---------- */

let current = SCENARIOS[0];
let engine = 'gitlab';
let selected = 0;
let timers = [];

const rail = document.getElementById('rail');
const consoleBody = document.getElementById('console-body');
const summary = document.getElementById('summary');
const verdict = document.getElementById('verdict');
const sourceBody = document.getElementById('source-body');

function renderRail(stages) {
  timers.forEach(clearTimeout);
  timers = [];
  rail.textContent = '';
  stages.forEach((s, i) => {
    const li = el('li', 'pl-stage');
    const btn = el('button', 'pl-stage-btn');
    btn.type = 'button';
    btn.append(el('span', 'pl-stage-name', s.label));
    const meta = el('span', 'pl-stage-meta');
    const state = s.problems.length ? 'refused' : s.blocked ? 'not reached' : 'ok';
    meta.append(el('i', '', s.problems.length ? '✕' : s.blocked ? '·' : '✓'));
    meta.append(el('span', '', state));
    btn.append(meta);
    btn.addEventListener('click', () => { selected = i; render(stages); });
    li.append(btn);
    li.dataset.key = s.key;
    if (i === selected) li.classList.add('sel');
    if (s.problems.length) li.classList.add('failed');
    else if (s.blocked) li.classList.add('blocked');
    else li.classList.add('done');
    rail.append(li);
  });
}

function renderSummary(stages) {
  const failed = stages.filter((s) => s.problems.length);
  summary.textContent = '';
  const cell = (label, value, cls) => {
    const d = el('div', cls ? `pl-cell ${cls}` : 'pl-cell');
    d.append(el('b', '', value), el('span', '', label));
    return d;
  };
  summary.append(
    cell('stages', String(stages.length), ''),
    cell('refused', String(failed.length), failed.length ? 'fail' : 'pass'),
    cell('services in plan', String(MANIFEST.services.length), ''),
    cell('engine', ENGINES[engine].name.split(' ')[0], ''),
  );
  verdict.textContent = failed.length
    ? `gate refused the release at ${failed.map((s) => s.label).join(', ')}`
    : 'gate passed. The release would have gone out.';
  verdict.className = `pl-verdict ${failed.length ? 'fail' : 'pass'}`;
}

function renderConsole(stages) {
  consoleBody.textContent = '';
  const s = stages[selected];
  if (!s) return;
  const all = [{ t: '00:00', m: `$ ${s.cmd}`, cls: 'cmd' }, ...s.lines];
  const nodes = all.map((line, i) => {
    const row = el('div', `pl-line ${line.cls || ''}`);
    row.append(el('span', 't', line.t || `00:${String(i).padStart(2, '0')}`));
    row.append(el('span', 'm', line.m));
    return row;
  });
  if (REDUCED) { nodes.forEach((n) => consoleBody.append(n)); return; }
  nodes.forEach((n, i) => {
    timers.push(setTimeout(() => {
      consoleBody.append(n);
      consoleBody.parentElement.scrollTop = consoleBody.parentElement.scrollHeight;
    }, i * 130));
  });
}

function renderSource(stages) {
  const s = stages[selected];
  sourceBody.textContent = '';
  const grid = el('div', 'pl-src-grid');
  SOURCE_BLOCKS.forEach((block) => {
    const box = el('div', 'pl-src');
    box.append(el('h3', '', block.file));
    const pre = el('pre');
    const code = el('code');
    block.lines.forEach((ln) => {
      const line = el('span', ln === s.sourceLine ? 'hit' : '', `${ln}\n`);
      code.append(line);
    });
    pre.append(code);
    box.append(pre);
    grid.append(box);
  });
  sourceBody.append(grid);
}

/* Verbatim excerpts from the three Groovy classes. These are the only files in
   the reference repository that carry no internal identifier. */
const SOURCE_BLOCKS = [
  { file: 'ReleaseRules.groovy', lines: [
      "static final List<String> ARTIFACTS = ['jar', 'image', 'apk', 'ipa', 'web']",
      "static final String FEATURE_BRANCH_PATTERN =",
      "    '^(feat|fix|chore|hotfix)/[a-z0-9][a-z0-9._-]{2,60}$'",
      "if (!(branch ==~ FEATURE_BRANCH_PATTERN)) {",
      "    problems << \"branch: '${branch}' is not <type>/<slug> ...\"",
      '}',
    ] },
  { file: 'GateResult.groovy', lines: [
      'static final Map THRESHOLDS = [',
      '    criticalVulnerabilities: 0,',
      '    highVulnerabilities    : 5,',
      '    coverageFloor          : 40.0d,',
      '    duplicationCeiling     : 8.0d,',
      ']',
      "if (!scan.sbom) failures << 'sbom: not produced, a release nobody can inventory'",
    ] },
  { file: 'DeploymentPlan.groovy', lines: [
      "static final Map<String, Integer> TIER =",
      '    [database: 0, backend: 1, gateway: 2, web: 3, mobile: 4]',
      "static String watermark(String releaseTag, String env, Map svc) {",
      "    def raw = [releaseTag, env, svc.id, svc.artifact, svc.commit ?: 'HEAD'].join('|')",
      "    return MessageDigest.getInstance('SHA-256').digest(raw.bytes).encodeHex().toString().take(16)",
      '}',
    ] },
];

function render(stages) {
  renderRail(stages);
  renderSummary(stages);
  renderConsole(stages);
  renderSource(stages);
}

function run(sc) {
  current = sc;
  // Open on the gate, not on the commit. The page is called The gate, running,
  // and the commit stage of a clean release has nothing to show.
  const stages = compute(sc);
  const gateIdx = stages.findIndex((s) => s.key === 'gate');
  selected = gateIdx >= 0 ? gateIdx : 0;
  render(stages);
  document.querySelectorAll('#case-buttons .pl-chip').forEach((b) => {
    const on = b.dataset.case === sc.id;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('failing', on && stages.some((s) => s.problems.length));
  });
}

function buildControls() {
  const box = document.getElementById('case-buttons');
  SCENARIOS.forEach((sc) => {
    const b = el('button', 'pl-chip', sc.label);
    b.type = 'button';
    b.dataset.case = sc.id;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => run(sc));
    box.append(b);
  });
  const ebox = document.getElementById('engine-buttons');
  Object.keys(ENGINES).forEach((k) => {
    const b = el('button', 'pl-chip', ENGINES[k].name);
    b.type = 'button';
    b.dataset.engine = k;
    b.setAttribute('aria-pressed', String(k === engine));
    b.addEventListener('click', () => {
      engine = k;
      ebox.querySelectorAll('.pl-chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.engine === k)));
      run(current);
    });
    ebox.append(b);
  });
}

/* Keyboard: the rail is a list of buttons, so arrows move the selection without
   trapping the reader inside it. */
function keys() {
  document.addEventListener('keydown', (e) => {
    if (!e.target.closest || !e.target.closest('.pl-rail')) return;
    const stages = compute(current);
    if (e.key === 'ArrowRight') selected = Math.min(stages.length - 1, selected + 1);
    else if (e.key === 'ArrowLeft') selected = Math.max(0, selected - 1);
    else return;
    e.preventDefault();
    render(stages);
  });
}

function toggleSource() {
  const btn = document.getElementById('source-toggle');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    btn.textContent = open ? 'show source' : 'hide source';
    sourceBody.hidden = open;
  });
}

/* ---------- the self-check the badge in the hero reports ---------- */

async function selfCheck() {
  const badge = document.getElementById('selfcheck');
  try {
    const res = await fetch('../assets/data/fixture.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fx = await res.json();
    let bad = 0;
    fx.cases.forEach((c) => {
      let out;
      switch (c.fn) {
        case 'validateBranch': out = R.validateBranch(c.input[0]); break;
        case 'validateTag': out = R.validateTag(c.input[0]); break;
        case 'validatePromotion': out = R.validatePromotion(c.input[0], c.input[1]); break;
        case 'validateService': out = R.validateService(c.input[0]); break;
        case 'validateManifest': out = R.validateManifest(c.input[0]); break;
        case 'approvalChain': out = R.approvalChainProblems(c.input[0]); break;
        case 'evaluateGate': out = R.evaluateGate(c.input[0]); break;
        case 'buildPlan': out = R.buildPlan(c.input[0], c.input[1], c.input[2] || {}); break;
        case 'planWaves': out = R.planWaves(R.buildPlan(c.input[0], c.input[1])).map((w) => w.map((m) => m.id)); break;
        default: out = 'unknown fn';
      }
      if (JSON.stringify(out) !== JSON.stringify(c.expect)) bad++;
    });
    const n = fx.cases.length;
    if (bad === 0) {
      badge.textContent = `${n}/${n} golden checks pass in this browser, against answers written by the Groovy`;
      badge.classList.add('ok');
    } else {
      badge.textContent = `${bad} of ${n} golden checks disagree with the Groovy. The page is wrong, not the test.`;
      badge.classList.add('bad');
    }
  } catch (e) {
    badge.textContent = `golden checks unavailable (${e.message}); the CI job still runs them`;
    badge.classList.add('bad');
  }
}

buildControls();
toggleSource();
keys();
// Deep link so the landing page can point straight at a run that refuses:
// /pipelines/?case=critical
const wanted = new URLSearchParams(location.search).get('case');
run(SCENARIOS.find((s) => s.id === wanted) || SCENARIOS[0]);
selfCheck();
