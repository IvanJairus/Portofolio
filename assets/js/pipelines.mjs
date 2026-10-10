/*
  The two-engine run view.

  Every status on this page is computed by release-rules.mjs, a port of the Groovy
  in IvanJairus/Pipeline, and that port is checked against a fixture the Groovy
  authors. The Source tab shows repository files vendored verbatim and pinned by
  SHA-256; the highlight ranges come from assets/data/sources.json.

  Two rules this file holds itself to:

  1. Durations are shown only where the landing page publishes a measured one with
     its sample size. Everywhere else the slot stays empty rather than guessing,
     because a plausible number is the one kind of lie a page like this can tell.
  2. No innerHTML and no inline styles. The CSP is script-src 'self' style-src
     'self', and the rest of the site already builds its DOM this way.
*/

import * as R from './release-rules.mjs';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MANIFEST = {
  releaseTag: 'v1.4.2',
  services: [
    { id: 'web', name: 'portal', artifact: 'web', owners: ['digital'] },
    { id: 'api', name: 'core-api', artifact: 'jar', owners: ['core'], commit: 'a1b2c3d' },
    { id: 'img', name: 'svc-image', artifact: 'image', registry: 'registry.example.internal', owners: ['core'] },
  ],
};

const FIVE = { team: 'dev@x', business: 'biz@x', product: 'prod@x', architecture: 'arch@x', engineering: 'eng@x' };

const gateInput = (scan) => ({
  deploy: { result: 'success' },
  quality: { status: 'passed', coverage: 71.5, duplication: 3.1 },
  scan,
});

const RUNS = {
  passed: {
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    scan: { sbom: true, findings: [{ severity: 'LOW' }, { severity: 'medium' }, { severity: 'HIGH' }] },
    hops: [['sit', 'uat'], ['uat', 'prod']],
    title: "Merge branch 'fix/471-timeout' into 'master'",
  },
  refused: {
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    scan: { sbom: true, findings: [{ severity: 'CRITICAL' }, { severity: 'HIGH' }, { severity: 'medium' }] },
    hops: [['sit', 'uat'], ['uat', 'prod']],
    title: "Merge branch 'fix/471-timeout' into 'master'",
  },
};

/* The two measured numbers the landing page publishes with sample sizes. */
const MEASURED = { 'sonarqube-checks': '80 s', 'deploy-sit': '93 s' };

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/* ---------- the run, computed ---------- */

function compute(engine, key) {
  const sc = RUNS[key];
  const branch = R.validateBranch(sc.branch);
  const tag = R.validateTag(sc.tag);
  const manifest = R.validateManifest(MANIFEST);
  const plan = R.buildPlan(MANIFEST, 'sit');
  const gate = R.evaluateGate(gateInput(sc.scan));
  const approvals = R.approvalChainProblems(sc.approvals);
  const counts = R.severityCounts(sc.scan.findings);
  const hops = sc.hops.map(([from, to]) => ({ from, to, problems: R.validatePromotion(from, to) }));

  const scanFail = gate.failures.filter((f) => /scan|sbom|vulnerabilit/i.test(f));
  const qualityFail = gate.failures.filter((f) => /quality|coverage|duplication/i.test(f));

  const jobs = [
    { id: 'maven-package', stage: 'build', problems: [...branch, ...tag],
      log: [{ c: 'cmd', t: '$ mvn -B -DskipTests package' },
            { c: 'dim', t: `  artifact jar  ledger-service-${sc.tag}.jar` },
            { c: 'dim', t: `  branch ${sc.branch} matched the rulebook pattern` }] },
    { id: 'docker-build', stage: 'build', problems: [],
      log: [{ c: 'cmd', t: '$ docker build -t $IMAGE .' },
            { c: 'dim', t: '  pushed to registry.example.internal (digest pinned)' }] },
    { id: 'unit-test', stage: 'test', problems: [],
      log: [{ c: 'cmd', t: '$ mvn -B test' },
            { c: 'dim', t: '  128 tests · 0 failures · 0 skipped' }] },
    { id: 'contract-test', stage: 'test', problems: [...manifest],
      log: [{ c: 'cmd', t: '$ release-rules validate-manifest --manifest release.json' },
            { c: 'dim', t: `  ${plan.length} services in plan · ${R.ARTIFACTS.join(' ')}` }] },
    { id: 'container-trivy', stage: 'scan', problems: scanFail,
      log: [{ c: 'cmd', t: '$ trivy image --exit-code 1 --severity CRITICAL,HIGH $IMAGE' },
            { c: 'dim', t: `  Total: ${counts.critical + counts.high + counts.medium + counts.low} (CRITICAL: ${counts.critical}, HIGH: ${counts.high}, MEDIUM: ${counts.medium}, LOW: ${counts.low})` },
            ...(counts.critical ? [{ c: 'err', t: `  CRITICAL  jackson-databind  allowed ${R.THRESHOLDS.criticalVulnerabilities}` }] : []),
            ...(counts.high && !counts.critical ? [{ c: 'warn', t: `  HIGH      jackson-databind  ${counts.high} of ${R.THRESHOLDS.highVulnerabilities} allowed` }] : []),
            ...(scanFail.length ? scanFail.map((f) => ({ c: 'err', t: `  ${f}` })) : [{ c: 'ok', t: '  ✓ within thresholds' }])] },
    { id: 'sast-semgrep', stage: 'scan', problems: [],
      log: [{ c: 'cmd', t: '$ semgrep scan --config .semgrep/ --sarif -o gl-sast-report.sarif' },
            { c: 'dim', t: '  1 finding (medium) · block threshold 0' }] },
    { id: 'secret-detect', stage: 'scan', problems: [],
      log: [{ c: 'cmd', t: '$ secret-detect' }, { c: 'dim', t: '  0 findings across 218 files' }] },
    { id: 'sonarqube-checks', stage: 'quality', problems: qualityFail,
      log: [{ c: 'cmd', t: '$ sonar-check --wait-for-quality-gate 300' },
            { c: 'dim', t: `  coverage ${gateInput(sc.scan).quality.coverage}% (floor ${R.THRESHOLDS.coverageFloor}%) · duplication ${gateInput(sc.scan).quality.duplication}% (ceiling ${R.THRESHOLDS.duplicationCeiling}%)` },
            { c: qualityFail.length ? 'err' : 'ok', t: qualityFail.length ? `  ${qualityFail.join('; ')}` : '  ✓ quality gate passed' }] },
    { id: 'release-rules', stage: 'gate', problems: [...approvals, ...(gate.passed ? [] : ['composite gate refused'])],
      log: [{ c: 'cmd', t: '$ release-rules evaluate --manifest release.json' },
            { c: 'dim', t: `  THRESHOLDS critical=${R.THRESHOLDS.criticalVulnerabilities} high=${R.THRESHOLDS.highVulnerabilities} coverageFloor=${R.THRESHOLDS.coverageFloor} duplicationCeiling=${R.THRESHOLDS.duplicationCeiling}` },
            { c: gate.passed ? 'ok' : 'err', t: `  ${gate.summary}` },
            ...gate.warnings.map((w) => ({ c: 'warn', t: `  warning: ${w}` }))] },
    { id: 'deploy-sit', stage: 'deploy', problems: [], manual: false,
      log: [{ c: 'cmd', t: '$ vault write auth/jwt/login … (lease 10m)' },
            ...plan.map((p) => ({ c: 'dim', t: `  ${p.id}: deployed ${sc.tag} to rel/sit (wm ${p.watermark.slice(0, 8)})` })),
            { c: 'dim', t: '$ vault token revoke -self' }] },
    { id: 'promote-uat', stage: 'deploy', problems: hops[0].problems, manual: true,
      log: [{ c: 'cmd', t: `$ release-rules promote sit -> uat (${R.ENV_TARGET_BRANCH.uat})` },
            { c: hops[0].problems.length ? 'err' : 'dim', t: hops[0].problems.length ? `  ${hops[0].problems.join('; ')}` : '  waiting for a human. The ladder is not automatic.' }] },
    { id: 'promote-prod', stage: 'deploy', problems: hops[1].problems, manual: true,
      log: [{ c: 'cmd', t: `$ release-rules promote uat -> prod (${R.ENV_TARGET_BRANCH.prod})` },
            { c: 'dim', t: '  waiting for a human, and for the tag rule: vMAJOR.MINOR.PATCH' }] },
  ];

  const stopped = jobs.some((j) => j.problems.length);
  const firstBad = jobs.findIndex((j) => j.problems.length);
  jobs.forEach((j, i) => {
    j.hollow = stopped && firstBad >= 0 && i > firstBad;
    if (j.manual && !j.problems.length) j.state = 'manual';
    else if (j.problems.length) j.state = 'bad';
    else if (j.hollow) j.state = 'hollow';
    else j.state = 'ok';
  });

  const stages = engine === 'jenkins'
    ? [
        { id: 'Trigger Jobs', jobs: ['maven-package'] },
        { id: 'Resolve Plan', jobs: ['contract-test'] },
        { id: 'Build', jobs: ['maven-package', 'docker-build'] },
        { id: 'Scan', jobs: ['container-trivy', 'sast-semgrep', 'secret-detect'] },
        { id: 'Quality Gate', jobs: ['sonarqube-checks'] },
        { id: 'Gate', jobs: ['release-rules'] },
        { id: 'Deploy SIT', jobs: ['deploy-sit'] },
        { id: 'Promote UAT', jobs: ['promote-uat'] },
      ]
    : ['build', 'test', 'scan', 'quality', 'gate', 'deploy'].map((s) => ({ id: s, jobs: jobs.filter((j) => j.stage === s).map((j) => j.id) }));

  return { jobs, stages, gate, plan, stopped, counts, approvals, branch, tag, manifest };
}

/* ---------- state ---------- */

let engine = 'gitlab';
let runKey = 'passed';
let selected = 'container-trivy';
let pane = 'trace';
let srcKey = 'gateway.yml';
let srcPick = null;
let SOURCES = null;
let FILE_TEXT = {};

const $ = (id) => document.getElementById(id);

/* ---------- header ---------- */

function paintHeader(run) {
  const bad = run.stopped;
  const st = $('rh-st'); st.textContent = bad ? '✕' : '✓'; st.className = `pv-st${bad ? ' bad' : ''}`;
  const stt = $('rh-sttxt'); stt.textContent = bad ? 'refused' : 'passed'; stt.className = `pv-sttxt${bad ? ' bad' : ''}`;
  $('rh-id').textContent = engine === 'gitlab' ? '#1421' : '#2214';
  $('rh-title').textContent = engine === 'gitlab' ? RUNS[runKey].title : `ledger-service ${RUNS[runKey].tag} from tracker #471`;
  $('rh-meta').textContent = `a1b2c3d · ${RUNS[runKey].branch}`;
  const stats = $('rh-stats'); stats.textContent = '';
  const cell = (label, value, cls) => {
    const d = el('div'); d.append(el('span', '', label), el('b', cls, value)); return d;
  };
  stats.append(cell('pipeline', bad ? 'refused' : 'passed', bad ? 'bad' : 'ok'));
  stats.append(cell('jobs', String(run.jobs.length), ''));
  stats.append(cell('services', String(run.plan.length), ''));
}

/* ---------- skins ---------- */

function paintSkin(run) {
  const skin = $('skin'); skin.textContent = '';
  if (engine === 'gitlab') {
    const cols = el('div', 'gl-cols');
    run.stages.forEach((s) => {
      const c = el('div', 'gl-col');
      c.append(el('h4', '', s.id));
      s.jobs.forEach((id) => {
        const j = run.jobs.find((x) => x.id === id); if (!j) return;
        const b = el('button', 'gl-job' + (j.state === 'bad' ? ' bad' : ''));
        b.type = 'button';
        b.append(el('span', `ic ${j.state === 'bad' ? 'bad' : j.state === 'manual' ? 'man' : j.state === 'hollow' ? 'none' : 'ok'}`,
          j.state === 'bad' ? '✕' : j.state === 'manual' ? '▷' : j.state === 'hollow' ? '·' : '✓'));
        b.append(el('span', 'gl-nm', j.id));
        b.append(el('span', 'gl-du', MEASURED[j.id] || (j.state === 'manual' ? 'manual' : '')));
        b.addEventListener('click', () => { selected = j.id; srcPick = null; paint(run); });
        if (selected === j.id) b.setAttribute('aria-current', 'true');
        c.append(b);
      });
      cols.append(c);
    });
    skin.append(cols);
    return;
  }
  const flow = el('div', 'bo-flow');
  run.stages.forEach((s) => {
    const ids = s.jobs.map((id) => run.jobs.find((j) => j.id === id)).filter(Boolean);
    const worst = ids.some((j) => j.state === 'bad') ? 'bad' : ids.every((j) => j.state === 'hollow') ? 'hollow' : 'ok';
    const b = el('button', 'bo-node' + (worst === 'bad' ? ' bad' : worst === 'hollow' ? ' hollow' : ''));
    b.type = 'button';
    b.append(el('div', 'bo-nm', s.id));
    const dur = ids.map((j) => MEASURED[j.id]).filter(Boolean)[0];
    b.append(el('div', 'bo-du', dur || (ids[0] && ids[0].state === 'manual' ? 'input' : '')));
    b.addEventListener('click', () => { selected = ids[0] ? ids[0].id : s.id; paint(run); });
    if (s.jobs.includes(selected)) b.setAttribute('aria-current', 'true');
    flow.append(b);
  });
  skin.append(flow);
  const meta = el('div', 'bo-meta');
  ['ledger-service', RUNS[runKey].branch, RUNS[runKey].tag, 'started by Ivan Jairus', `${run.jobs.length} jobs on 1 runner`]
    .forEach((t) => meta.append(el('span', '', t)));
  skin.append(meta);
}

/* ---------- trace ---------- */

function paintTrace(run) {
  const log = $('log'); log.textContent = '';
  const stage = run.stages.find((x) => x.id === selected);
  const wanted = stage ? stage.jobs[0] : selected;
  const j = run.jobs.find((x) => x.id === wanted) || run.jobs[0];
  const pre = engine === 'gitlab'
    ? [{ c: 'dim', t: 'Running with gitlab-runner 17.x on the openshift executor' },
       { c: 'dim', t: 'section_start:prepare_executor' },
       { c: 'dim', t: `  namespace ci-ledger-service-47 · job ${j ? j.id : 'unknown'}` },
       { c: 'dim', t: 'section_end:prepare_executor' }]
    : [{ c: 'dim', t: `[Pipeline] Load shared library pipeline-gateway@v0.1.0` },
       { c: 'dim', t: `[Pipeline] node { agent linux-node-01 }` },
       { c: 'dim', t: `[Pipeline] stage (${j ? j.id : 'unknown'})` }];
  const lines = [...pre, ...(j ? j.log : [])];
  lines.forEach((ln, i) => {
    const row = el('div', `pv-ll ${ln.c || ''}`);
    row.append(el('span', 'n', String(i + 1)));
    row.append(el('span', 't', ln.t));
    log.append(row);
  });
  const foot = $('logfoot'); foot.textContent = '';
  const bad = j && j.state === 'bad';
  foot.append(el('span', bad ? 'bad' : 'ok', bad ? 'exit code 1' : j && j.state === 'manual' ? 'waiting for input' : 'exit code 0'));
  if (MEASURED[j && j.id]) foot.append(el('span', '', `${MEASURED[j.id]} · measured, n published on the landing page`));
  foot.append(el('span', 'sp', j ? `rules: ${SOURCES.jobs[j.id] ? SOURCES.jobs[j.id].file : 'unmapped'}` : ''));
  $('note-trace').textContent = j ? j.id : '';
}

/* ---------- source ---------- */

function paintSource(run) {
  const job = SOURCES.jobs[selected];
  if (!srcPick && job) srcKey = job.file;
  const entry = SOURCES.tree.find((n) => n.k === srcKey) || {};

  const tree = $('tree'); tree.textContent = '';
  SOURCES.tree.forEach((n) => {
    if (n.d) { tree.append(el('div', 'pv-tdir', n.d)); return; }
    const b = el('button', 'pv-tfile' + (n.k === srcKey ? ' on' : ''));
    b.type = 'button'; b.setAttribute('role', 'option');
    b.append(el('span', '', n.f));
    b.append(el('span', 'm', String(n.lines)));
    b.addEventListener('click', () => { srcKey = n.k; srcPick = n.k; paint(run); });
    tree.append(b);
  });

  const text = FILE_TEXT[srcKey] || '';
  const lines = text.split('\n');
  const hl = new Set();
  if (job && job.file === srcKey) job.hl.forEach(([a, b]) => { for (let i = a; i <= b; i++) hl.add(i); });

  const body = $('cbody'); body.textContent = '';
  lines.forEach((t, i) => {
    const row = el('div', 'pv-cl' + (hl.has(i + 1) ? ' hit' : ''));
    row.append(el('span', 'n', String(i + 1)));
    row.append(el('span', 't', t.length ? t : ' '));
    body.append(row);
  });
  $('code-name').textContent = entry.f || srcKey;
  $('code-why').textContent = job && job.file === srcKey ? job.why : 'no job mapped to this file';
  $('code-count').textContent = `${lines.length} lines · ${hl.size ? hl.size + ' marked' : 'nothing marked'}`;
  $('pathlbl').textContent = entry.path || srcKey;
  $('note-source').textContent = entry.f || '';
}

/* ---------- rules pane ---------- */

function paintRules(run) {
  const log = $('ruleslog'); log.textContent = '';
  const t = R.THRESHOLDS;
  const lines = [
    { c: 'cmd', t: '$ release-rules evaluate --manifest release.json' },
    { c: 'dim', t: `THRESHOLDS  critical=${t.criticalVulnerabilities}  high=${t.highVulnerabilities}  coverageFloor=${t.coverageFloor}  duplicationCeiling=${t.duplicationCeiling}` },
    { c: 'dim', t: `scan.findings   critical ${run.counts.critical}  high ${run.counts.high}  medium ${run.counts.medium}  low ${run.counts.low}` },
    { c: 'dim', t: 'approvals       team business product architecture engineering  (distinct identities required)' },
    { c: 'dim', t: `plan            ${run.plan.map((p) => `${p.id} tier ${p.tier}`).join('  ')}` },
    { c: run.gate.passed ? 'ok' : 'err', t: run.gate.summary },
    ...run.gate.failures.map((f) => ({ c: 'err', t: `  ${f}` })),
    ...run.gate.warnings.map((w) => ({ c: 'warn', t: `  warning: ${w}` })),
    { c: 'dim', t: '' },
    { c: 'dim', t: 'the same eight lines are what GateResult.evaluate returns in Groovy' },
  ];
  lines.forEach((ln, i) => {
    const row = el('div', `pv-ll ${ln.c || ''}`);
    row.append(el('span', 'n', String(i + 1)));
    row.append(el('span', 't', ln.t || ' '));
    log.append(row);
  });
}

/* ---------- paint ---------- */

function paint(run) {
  paintHeader(run);
  paintSkin(run);
  paintTrace(run);
  paintSource(run);
  paintRules(run);
  document.querySelectorAll('.pv-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.pane === pane)));
  document.querySelectorAll('.pv-pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${pane}`));
}

function current() { return compute(engine, runKey); }

function paintAll() { paint(current()); }

/* ---------- controls ---------- */

function seg(box, items, get, set) {
  items.forEach(([label, value]) => {
    const b = el('button', '', label); b.type = 'button';
    b.setAttribute('aria-pressed', String(get() === value));
    b.addEventListener('click', () => {
      set(value);
      [...box.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      paintAll();
    });
    box.append(b);
  });
}

seg($('engine-seg'), [['GitLab CI', 'gitlab'], ['Jenkins', 'jenkins']],
  () => engine, (v) => { engine = v; });
seg($('run-seg'), [['passed', 'passed'], ['refused', 'refused']],
  () => runKey, (v) => { runKey = v; });

document.querySelectorAll('.pv-tab').forEach((t) => t.addEventListener('click', () => { pane = t.dataset.pane; paintAll(); }));

document.addEventListener('keydown', (e) => {
  if (!e.target.closest || !e.target.closest('.pv-skin')) return;
  const run = current();
  const ids = run.jobs.map((j) => j.id);
  const i = ids.indexOf(selected);
  if (e.key === 'ArrowRight' && i < ids.length - 1) selected = ids[i + 1];
  else if (e.key === 'ArrowLeft' && i > 0) selected = ids[i - 1];
  else return;
  e.preventDefault(); paint(run);
});

/* ---------- self-check ---------- */

async function selfCheck() {
  const badge = $('selfcheck');
  try {
    const fx = await (await fetch('../assets/data/fixture.json', { cache: 'no-store' })).json();
    const call = (fn, i) => {
      switch (fn) {
        case 'validateBranch': return R.validateBranch(i[0]);
        case 'validateTag': return R.validateTag(i[0]);
        case 'validatePromotion': return R.validatePromotion(i[0], i[1]);
        case 'validateService': return R.validateService(i[0]);
        case 'validateManifest': return R.validateManifest(i[0]);
        case 'approvalChain': return R.approvalChainProblems(i[0]);
        case 'evaluateGate': return R.evaluateGate(i[0]);
        case 'buildPlan': return R.buildPlan(i[0], i[1], i[2] || {});
        case 'planWaves': return R.planWaves(R.buildPlan(i[0], i[1])).map((w) => w.map((m) => m.id));
        default: return 'unknown';
      }
    };
    let bad = 0;
    fx.cases.forEach((c) => { if (JSON.stringify(call(c.fn, c.input)) !== JSON.stringify(c.expect)) bad++; });
    if (bad === 0) {
      badge.textContent = `${fx.cases.length}/${fx.cases.length} golden checks pass in this browser, against answers written by the Groovy`;
      badge.classList.add('ok');
    } else {
      badge.textContent = `${bad} of ${fx.cases.length} golden checks disagree with the Groovy. This page is wrong, not the test.`;
      badge.classList.add('bad');
    }
  } catch (e) {
    badge.textContent = `golden checks unavailable (${e.message}); CI still runs them`;
    badge.classList.add('bad');
  }
}

/* ---------- boot ---------- */

try {
  SOURCES = await (await fetch('../assets/data/sources.json', { cache: 'no-store' })).json();
  await Promise.all(SOURCES.tree.filter((n) => n.k).map(async (n) => {
    FILE_TEXT[n.k] = await (await fetch(`../assets/data/src/${n.k}`, { cache: 'no-store' })).text();
  }));
} catch (e) {
  $('code-why').textContent = `source files unavailable (${e.message})`;
}

paintAll();
selfCheck();

/* Deep link so the landing page can point at one exact state:
   /pipelines/?engine=jenkins&run=refused&tab=source&job=release-rules */
const Q = new URLSearchParams(location.search);
if (Q.get('engine') === 'jenkins') {
  engine = 'jenkins';
  [...$('engine-seg').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1)));
}
if (Q.get('run') === 'refused') {
  runKey = 'refused';
  [...$('run-seg').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1)));
}
if (['trace', 'source', 'rules'].includes(Q.get('tab'))) pane = Q.get('tab');
if (Q.get('job')) selected = Q.get('job');
if (Q.get('engine') || Q.get('run') || Q.get('tab') || Q.get('job')) paintAll();
