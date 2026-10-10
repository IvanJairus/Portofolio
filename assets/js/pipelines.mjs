/*
  Two engines, one gate.

  Everything a visitor sees as a decision here is computed by release-rules.mjs,
  a port of the Groovy in IvanJairus/Pipeline, and that port is checked against a
  fixture the Groovy writes. The source panels show repository files vendored
  verbatim from one pinned commit; the ranges they mark live in
  assets/data/sources.json, which scripts/sync-sources.mjs validates against those
  files before it writes anything.

  Three rules this file holds itself to:

  1. Durations appear only where the landing page publishes a measured one with a
     sample size: 93 s (n = 13) and 80 s (n = 30). Everywhere else the slot stays
     empty rather than guessing, because a plausible number is the one kind of lie
     a page like this can tell.
  2. The clock in a trace is the visitor's own. Lines are stamped as they are
     drawn, so the time is real: it is the time this replay was watched, not the
     time the original run happened, and the page says so.
  3. No innerHTML and no inline styles. The CSP is script-src 'self' style-src
     'self', and the rest of the site already builds its DOM this way.
*/

import * as R from './release-rules.mjs';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const pad = (n, w = 2) => String(n).padStart(w, '0');

/* RFC3339 with an offset: the shape ci-library/scripts/lib/log.sh defines.
   Split into parts so a narrow screen can drop the date and the zone without
   pretending the line is something it is not. */
function stampParts(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`,
    zone: `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`,
  };
}

/* Groovy prints a Double as 40.0. The fixture compares strings, so the port has to. */
function gdec(n) {
  const v = Number(n);
  return Number.isInteger(v) ? `${v}.0` : String(n);
}

/* ---------- what a release is made of ---------- */

/* The same manifest the repository ships as ci-library/examples/release.json. */
const MANIFEST = {
  releaseTag: 'v1.4.2',
  services: [
    { id: '1001', name: 'core-api', artifact: 'jar', tier: 'backend', owners: ['be-core'], commit: 'a1b2c3d' },
    { id: '1006', name: 'messaging', artifact: 'image', tier: 'backend', owners: ['be-msg'], registry: 'registry.example.internal/platform' },
    { id: '1020', name: 'portal', artifact: 'web', tier: 'web', owners: ['fe-portal'] },
  ],
};

const FIVE = {
  team: 'be-core-lead', business: 'ops-desk-1', product: 'pm-payments',
  architecture: 'arch-review-2', engineering: 'eng-manager-3',
};

const QUALITY = { status: 'passed', coverage: 81.4, duplication: 3.1 };
const gateInput = (scan) => ({ deploy: { result: 'success' }, quality: QUALITY, scan });

const RUNS = {
  passed: {
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    scan: { sbom: true, findings: [{ severity: 'HIGH' }, { severity: 'MEDIUM' }, { severity: 'LOW' }] },
    hops: [['sit', 'uat'], ['uat', 'prod']],
    gitlabTitle: "Merge branch 'fix/471-timeout' into 'master'",
    jenkinsTitle: 'ledger-service v1.4.2 from tracker FIN-471',
  },
  refused: {
    branch: 'fix/471-timeout', tag: 'v1.4.2', approvals: FIVE,
    scan: { sbom: true, findings: [{ severity: 'CRITICAL' }, { severity: 'HIGH' }, { severity: 'MEDIUM' }] },
    hops: [['sit', 'uat'], ['uat', 'prod']],
    gitlabTitle: "Merge branch 'fix/471-timeout' into 'master'",
    jenkinsTitle: 'ledger-service v1.4.2 from tracker FIN-471',
  },
};

/* The only two durations on this page. Both are published with a sample size. */
const MEASURED = {
  'sonarqube-checks': '80 s · median, n = 30',
  'deploy-sit': '93 s · median, n = 13',
};

const L = (lvl, m, scope) => ({ lvl, m, scope });

/* ---------- the run, computed ---------- */

function compute(engine, key) {
  const sc = RUNS[key];
  const branch = R.validateBranch(sc.branch);
  const tag = R.validateTag(sc.tag);
  const manifest = R.validateManifest(MANIFEST);
  const plan = R.buildPlan(MANIFEST, 'sit');
  const waves = R.planWaves(plan);
  const gate = R.evaluateGate(gateInput(sc.scan));
  const approvals = R.approvalChainProblems(sc.approvals);
  const counts = R.severityCounts(sc.scan.findings);
  const hops = sc.hops.map(([from, to]) => ({ from, to, problems: R.validatePromotion(from, to) }));
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const refused = !gate.passed;

  const scanFail = gate.failures.filter((f) => /scan|sbom|vulnerabilit/i.test(f));
  const qualityFail = gate.failures.filter((f) => /quality|coverage|duplication/i.test(f));
  const planned = plan.map((p) => `  ${p.name} ${p.artifact} ${sc.tag} wm ${p.watermark.slice(0, 8)}`);

  const gitlab = [
    { id: 'release-stamp', stage: 'build', scope: 'build:release-stamp', problems: [], log: [
      L('cmd', '$ python3 ci-library/tools/release_stamp.py --tag-prefix R --output build-info.json'),
      L('log', 'stamped version=R1.4.3 commit=a1b2c3d artifacts=1 status=success'),
      L('log', `audit release=R1.4.3 pipeline=1421 branch=${sc.branch}`),
      L('out', '  one bump rule for five templates; next_version() is on the right'),
    ] },
    { id: 'maven-package', stage: 'build', scope: 'build:maven-package', problems: [...branch, ...tag], log: [
      L('cmd', '$ bash ci-library/scripts/build-maven.sh package'),
      L('out', `  branch ${sc.branch} matched the pattern in ReleaseRules`),
      L('out', `  artifact jar  target/core-api-${sc.tag}.jar`),
      L('out', '  cache key = sha256 of pom.xml, not of the branch name'),
    ] },
    { id: 'docker-image', stage: 'build', scope: 'build:docker-image', problems: [], log: [
      L('cmd', '$ bash ci-library/scripts/publish-artifact.sh push'),
      L('log', 'resolved version=R1.4.3 commit=a1b2c3d'),
      L('log', 'push ref=registry.example.internal/platform/core-api:R1.4.3 kaniko=true'),
      L('log', 'digest written file=image-digest.txt algorithm=sha256'),
      L('out', '  no latest tag is ever written: a deploy you cannot point at is one you cannot repeat'),
    ] },
    { id: 'unit', stage: 'test', scope: 'test:unit', problems: [], log: [
      L('cmd', '$ bash ci-library/scripts/build-maven.sh test'),
      L('out', '  128 tests · 0 failures · 0 skipped'),
      L('out', '  junit handed forward as a report, not as a log line to squint at'),
    ] },
    { id: 'contract', stage: 'test', scope: 'test:contract', problems: [...manifest], log: [
      L('cmd', '$ bash ci-library/scripts/build-maven.sh verify -Pcontracts'),
      L('out', `  ${plan.length} services in the plan · artifacts ${R.ARTIFACTS.join(' ')}`),
      ...planned,
    ] },
    { id: 'sast-semgrep', stage: 'scan', scope: 'scan:sast-semgrep', problems: [], log: [
      L('cmd', '$ semgrep ci --config auto --sarif-file-output semgrep.sarif'),
      L('out', '  1 finding (medium) · allow_failure: true'),
      L('out', '  allowed to fail, not allowed to be silent: the sarif still reaches the gate'),
    ] },
    { id: 'secret-detect', stage: 'scan', scope: 'scan:secret-detect', problems: [], log: [
      L('cmd', '$ gitleaks detect --source . --redact --report-format json'),
      L('out', '  0 findings across 218 files'),
    ] },
    { id: 'container-trivy', stage: 'scan', scope: 'scan:container-trivy', problems: scanFail, log: [
      L('cmd', '$ trivy image --severity CRITICAL,HIGH --format json'),
      L('out', `  Total: ${total} (CRITICAL: ${counts.critical}, HIGH: ${counts.high}, MEDIUM: ${counts.medium}, LOW: ${counts.low})`),
      ...(refused ? [L('err', `  CRITICAL  jackson-databind 2.9.10  allowed ${R.THRESHOLDS.criticalVulnerabilities}`)] : []),
      ...(!refused && counts.high ? [L('warn', `  HIGH      jackson-databind 2.13.4  ${counts.high} of ${R.THRESHOLDS.highVulnerabilities} allowed`)] : []),
      ...(scanFail.length ? scanFail.map((f) => L('err', `  ${f}`)) : [L('ok', '  ✓ within thresholds')]),
    ] },
    { id: 'sbom-index', stage: 'scan', scope: 'scan:sbom-index', problems: [], log: [
      L('cmd', '$ syft "dir:target" -o cyclonedx-json=sbom.json'),
      L('cmd', '$ python3 ci-library/tools/release_stamp.py --verify-sbom sbom.json'),
      L('log', 'verify-sbom file=sbom.json problems=0'),
      L('out', '  an SBOM with zero components is a refusal here, not a clean bill'),
    ] },
    { id: 'sonarqube-checks', stage: 'quality', scope: 'quality:sonarqube-checks', problems: qualityFail, log: [
      L('cmd', '$ sonar-scanner -Dsonar.host.url=$SONAR_HOST'),
      L('out', `  coverage ${QUALITY.coverage}% (floor ${gdec(R.THRESHOLDS.coverageFloor)}%) · duplication ${QUALITY.duplication}% (ceiling ${gdec(R.THRESHOLDS.duplicationCeiling)}%)`),
      L(qualityFail.length ? 'err' : 'ok', qualityFail.length ? `  ${qualityFail.join('; ')}` : '  ✓ quality gate passed'),
    ] },
    { id: 'release-rules', stage: 'gate', scope: 'gate:release-rules', problems: [...approvals, ...(gate.passed ? [] : ['composite gate refused'])], log: [
      L('cmd', '$ groovy -cp shared-library/src ci-library/scripts/run-gate.groovy --manifest release.json'),
      L('log', `validateManifest problems=${manifest.length}`),
      L('log', `GateResult.evaluate passed=${gate.passed} failures=${gate.failures.length} warnings=${gate.warnings.length}`),
      L('log', `DeploymentPlan.build env=sit services=${plan.length} waves=${waves.length}`),
      L(gate.passed ? 'ok' : 'err', `  ${gate.summary}`),
      ...gate.warnings.map((w) => L('warn', `  warning: ${w}`)),
    ] },
    { id: 'ticket-sync', stage: 'gate', scope: 'gate:ticket-sync', problems: [], log: [
      L('cmd', '$ bash ci-library/scripts/ticket-sync.sh post'),
      L('log', 'resolve gitlab_issue=471 jira_issue=FIN-471 source=commit'),
      L('log', 'posted target=gitlab status=201 attempt=1'),
      L('out', refused ? `  the comment is the verdict: ${gate.summary}` : '  a retry of this job will not post the same comment twice'),
    ] },
    { id: 'deploy-sit', stage: 'deploy', scope: 'deploy:sit', problems: [], log: [
      L('cmd', '$ bash ci-library/scripts/deploy.sh apply --env sit --digest $(cat image-digest.txt)'),
      L('log', 'verdict checked file=gate-verdict.json env=sit allowed=true'),
      L('log', 'rendered template=jenkins/templates/deployment.yaml out=rendered/sit.yaml env=sit namespace=ci-sit-ledger-service'),
      L('log', 'applied env=sit digest=6f1a2c34d5e6 namespace=ci-sit-ledger-service'),
      L('log', 'ready env=sit timeout=300s'),
    ] },
    { id: 'promote-uat', stage: 'promote', scope: 'promote:uat', manual: true, problems: hops[0].problems, log: [
      L('cmd', `$ release-rules promote ${hops[0].from} -> ${hops[0].to} (${R.ENV_TARGET_BRANCH.uat})`),
      L(hops[0].problems.length ? 'err' : 'out', hops[0].problems.length ? `  ${hops[0].problems.join('; ')}` : '  waiting for a human. The ladder is not automatic.'),
    ] },
    { id: 'promote-prod', stage: 'promote', scope: 'promote:prod', manual: true, problems: [...hops[1].problems], log: [
      L('cmd', `$ release-rules promote ${hops[1].from} -> ${hops[1].to} (${R.ENV_TARGET_BRANCH.prod})`),
      L('out', '  and inside deploy.sh: a change window of Mon-Thu 09:00-17:00, checked before anything is applied'),
    ] },
    { id: 'observability', stage: 'feedback', scope: 'feedback:observability', problems: [], log: [
      L('cmd', '$ bash ci-library/scripts/observability-push.sh pipeline'),
      L('log', `audit release=R1.4.3 project=core-api passed=${gate.passed ? 1 : 0} warnings=${gate.warnings.length} pipeline=1421`),
      L('warn', 'skipped metric=duration_seconds reason=not_reported_by_runner'),
      L('out', '  a metric is never written for a number nobody measured'),
    ] },
  ];

  const jenkins = [
    { id: 'trigger', stage: 'Trigger Jobs', scope: 'Trigger Jobs', problems: [], log: [
      L('cmd', "stage('Trigger Jobs') { readJSON text: DATA }"),
      L('out', '  issue.key        FIN-471'),
      L('out', '  changelog[0]     "In Development" -> "Ready for SIT"'),
      L('out', '  customfield_10744 SIT'),
      L('log', 'the run identity comes from the webhook body, not from someone typing it twice'),
    ] },
    { id: 'route', stage: 'Route transition', scope: 'Route transition', problems: [], log: [
      L('cmd', 'def jobKey = "${FROM_STATUS}:${TO_STATUS}"'),
      L('out', '  "in development:ready for sit" -> GatewaySITDeploy'),
      L('out', '  build job: GatewaySITDeploy, string(ISSUE_KEY, FIN-471), wait: false'),
      L('log', 'a transition with no row in the table stops here, with a printed reason'),
    ] },
    { id: 'ticket', stage: 'Validate ticket', scope: 'Validate ticket', problems: [], log: [
      L('cmd', 'validateTicket(issueKey: ISSUE_KEY, env: "sit")'),
      L('out', '  ticket open · labels include R1.4 · assignee is not the approver'),
    ] },
    { id: 'labels', stage: 'Release labels', scope: 'Release labels', problems: [], log: [
      L('cmd', 'getReleaseLabels(allLabels)'),
      L('out', '  /^R1\\.\\d+$/ matched R1.4'),
      L('out', '  which release this ticket belongs to, read off the ticket itself'),
    ] },
    { id: 'credentials', stage: 'Issue credentials', scope: 'Issue credentials', problems: [], log: [
      L('cmd', 'vaultCredentials(role: "sit-deploy") { ... }'),
      L('log', 'lease issued ttl=10m renewable=false'),
      L('log', 'lease revoked in finally'),
    ] },
    { id: 'quality', stage: 'Quality gate', scope: 'Quality gate', problems: qualityFail, log: [
      L('cmd', 'qualityGate(projectKey: "core-api")'),
      L('out', `  coverage ${QUALITY.coverage}% (floor ${gdec(R.THRESHOLDS.coverageFloor)}%) · duplication ${QUALITY.duplication}% (ceiling ${gdec(R.THRESHOLDS.duplicationCeiling)}%)`),
      L(qualityFail.length ? 'err' : 'ok', qualityFail.length ? `  ${qualityFail.join('; ')}` : '  ✓ quality gate passed'),
    ] },
    { id: 'scan', stage: 'Scan', scope: 'Scan', problems: scanFail, log: [
      L('cmd', 'trivy image --severity CRITICAL,HIGH --format json'),
      L('out', `  Total: ${total} (CRITICAL: ${counts.critical}, HIGH: ${counts.high}, MEDIUM: ${counts.medium}, LOW: ${counts.low})`),
      ...(refused ? [L('err', `  CRITICAL  jackson-databind 2.9.10  allowed ${R.THRESHOLDS.criticalVulnerabilities}`)] : []),
      ...(scanFail.length ? scanFail.map((f) => L('err', `  ${f}`)) : [L('ok', '  ✓ within thresholds')]),
    ] },
    { id: 'gate', stage: 'Composite gate', scope: 'Composite gate', problems: [...approvals, ...(gate.passed ? [] : ['composite gate refused'])], log: [
      L('cmd', 'GateResult.evaluate(deploy: deployResult, quality: sq, scan: scan)'),
      L('log', `THRESHOLDS critical=${R.THRESHOLDS.criticalVulnerabilities} high=${R.THRESHOLDS.highVulnerabilities} coverageFloor=${gdec(R.THRESHOLDS.coverageFloor)} duplicationCeiling=${gdec(R.THRESHOLDS.duplicationCeiling)}`),
      L(gate.passed ? 'ok' : 'err', `  ${gate.summary}`),
      ...gate.warnings.map((w) => L('warn', `  warning: ${w}`)),
    ] },
    { id: 'plan', stage: 'Deploy SIT', scope: 'Deploy SIT', problems: [], log: [
      L('cmd', 'deployPlan(manifest: release.json, env: "sit")'),
      L('out', `  ${plan.length} services in ${waves.length} waves, ordered by tier`),
      ...planned,
      L('out', '  rendered from jenkins/templates/deployment.yaml into ci-sit-ledger-service'),
    ] },
    { id: 'promote', stage: 'Promote UAT', scope: 'Promote UAT', manual: true, problems: hops[0].problems, log: [
      L('cmd', `ReleaseRules.validatePromotion("${hops[0].from}", "${hops[0].to}")`),
      L(hops[0].problems.length ? 'err' : 'out', hops[0].problems.length ? `  ${hops[0].problems.join('; ')}` : '  the button is here; the right to press it is the approval chain'),
    ] },
    { id: 'notify', stage: 'Notify', scope: 'Notify', problems: [], log: [
      L('cmd', 'mergeApprove(ticket: ISSUE_KEY, approvals: chain)'),
      L('log', `layers team business product architecture engineering · distinct=${approvals.length === 0}`),
      L('log', refused ? `refused ${gate.summary}` : `posted verdict to ${RUNS[key].jenkinsTitle.split(' from ')[1]}`),
    ] },
  ];

  const jobs = engine === 'jenkins' ? jenkins : gitlab;
  const firstBad = jobs.findIndex((j) => j.problems.length);
  const stopped = firstBad >= 0;
  jobs.forEach((j, i) => {
    j.hollow = stopped && i > firstBad;
    if (j.problems.length) j.state = 'bad';
    else if (j.manual && !j.hollow) j.state = 'manual';
    else if (j.hollow) j.state = 'hollow';
    else j.state = 'ok';
  });

  const stages = engine === 'jenkins'
    ? jobs.map((j) => ({ id: j.stage, jobs: [j.id] }))
    : [...new Set(jobs.map((j) => j.stage))].map((s) => ({ id: s, jobs: jobs.filter((j) => j.stage === s).map((j) => j.id) }));

  return {
    key, jobs, stages, gate, plan, waves, counts, hops, approvals, stopped,
    runId: engine === 'jenkins' ? '#2214' : '#1421',
    title: engine === 'jenkins' ? sc.jenkinsTitle : sc.gitlabTitle,
    meta: `a1b2c3d · ${sc.branch}`,
  };
}

/* ---------- the gate panel ---------- */

function gateLines(run) {
  const t = R.THRESHOLDS;
  const g = run.gate;
  return [
    L('cmd', '$ release-rules evaluate --manifest release.json'),
    L('out', `THRESHOLDS  critical=${t.criticalVulnerabilities}  high=${t.highVulnerabilities}  coverageFloor=${gdec(t.coverageFloor)}  duplicationCeiling=${gdec(t.duplicationCeiling)}`),
    L('out', `scan.findings   critical ${run.counts.critical}  high ${run.counts.high}  medium ${run.counts.medium}  low ${run.counts.low}`),
    L('out', 'approvals       team business product architecture engineering  (distinct identities required)'),
    L('out', `plan            ${run.plan.map((p) => `${p.name} tier ${p.tier}`).join('  ')}`),
    L(g.passed ? 'ok' : 'err', g.summary),
    ...g.failures.map((f) => L('err', `  ${f}`)),
    ...g.warnings.map((w) => L('warn', `  warning: ${w}`)),
    L('out', ''),
    L('out', 'the same lines are what GateResult.evaluate returns in Groovy'),
  ];
}

/* ---------- panels ---------- */

const SOURCES = { data: null };
const FILE_TEXT = {};
const STATE_LABEL = { bad: 'failed', manual: 'waiting for input', hollow: 'not run', ok: 'passed' };

/* A strip that scrolls sideways has to look like it. The class is set from the
   real numbers, not from a breakpoint, because whether the stage columns
   overflow depends on how many there are. */
function markScrollable(...els) {
  els.forEach((n) => {
    if (n) n.classList.toggle('scrolling', n.scrollWidth > n.clientWidth + 2);
  });
}

class Panel {
  constructor(card, engine) {
    this.card = card;
    this.engine = engine;
    this.r = {};
    card.querySelectorAll('[data-role]').forEach((n) => { this.r[n.dataset.role] = n; });
    this.selected = null;
    this.srcKey = null;
    this.srcPick = null;
    this.loaded = false;
    this.draw = 0;
    this.run = null;
  }

  tree() {
    if (!SOURCES.data) return [];
    return this.engine === 'gate' ? SOURCES.data.gate.tree : SOURCES.data.engines[this.engine].tree;
  }

  jobMap() {
    if (!SOURCES.data) return {};
    return this.engine === 'gate' ? (SOURCES.data.gate.jobs || {}) : SOURCES.data.engines[this.engine].jobs;
  }

  paintHeader(run) {
    /* The gate card has no run header: it shows a decision, not a run. */
    if (!this.r.sttxt) return;
    const bad = run.stopped;
    const st = this.r.st;
    st.textContent = bad ? '✕' : '✓';
    st.className = `pv-st${bad ? ' bad' : ''}`;
    this.r.sttxt.textContent = bad ? 'refused' : 'passed';
    this.r.sttxt.className = `pv-sttxt${bad ? ' bad' : ''}`;
    this.r.id.textContent = run.runId;
    this.r.title.textContent = run.title;
    this.r.meta.textContent = run.meta;
    const stats = this.r.stats;
    stats.textContent = '';
    const cell = (label, value, cls) => {
      const d = el('div');
      d.append(el('span', '', label), el('b', cls, value));
      return d;
    };
    stats.append(cell('pipeline', bad ? 'refused' : 'passed', bad ? 'bad' : 'ok'));
    stats.append(cell('jobs', String(run.jobs.length), ''));
    stats.append(cell('services', String(run.plan.length), ''));
  }

  paintSkin(run) {
    const skin = this.r.skin;
    skin.textContent = '';
    if (this.engine === 'jenkins') {
      const flow = el('div', 'bo-flow');
      run.stages.forEach((s) => {
        const first = run.jobs.find((j) => j.id === s.jobs[0]);
        if (!first) return;
        const cls = first.state === 'bad' ? ' bad' : first.state === 'hollow' ? ' hollow' : first.state === 'manual' ? ' man' : '';
        const b = el('button', `bo-node${cls}`);
        b.type = 'button';
        b.append(el('span', 'bo-ic', first.state === 'bad' ? '✕' : first.state === 'manual' ? '▷' : first.state === 'hollow' ? '·' : '✓'));
        b.append(el('div', 'bo-nm', s.id));
        b.append(el('div', 'bo-du', MEASURED[first.id] ? MEASURED[first.id].split(' ')[0] : (first.manual ? 'input' : '')));
        b.title = s.id;
        if (this.selected === first.id) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => this.select(first.id));
        flow.append(b);
      });
      skin.append(flow);
      const meta = el('div', 'bo-meta');
      ['ledger-service', RUNS[run.key].branch, RUNS[run.key].tag, 'started by a Jira webhook', `${run.jobs.length} stages`]
        .forEach((t) => meta.append(el('span', '', t)));
      skin.append(meta);
      return;
    }

    const cols = el('div', 'gl-cols');
    run.stages.forEach((s) => {
      const c = el('div', 'gl-col');
      c.append(el('p', 'gl-stage', s.id));
      s.jobs.forEach((id) => {
        const j = run.jobs.find((x) => x.id === id);
        if (!j) return;
        const b = el('button', `gl-job${j.state === 'bad' ? ' bad' : ''}`);
        b.type = 'button';
        const glyph = j.state === 'bad' ? '✕' : j.state === 'manual' ? '▷' : j.state === 'hollow' ? '·' : '✓';
        b.append(el('span', `ic ${j.state === 'bad' ? 'bad' : j.state === 'manual' ? 'man' : j.state === 'hollow' ? 'none' : 'ok'}`, glyph));
        b.append(el('span', 'gl-nm', j.id));
        b.append(el('span', 'gl-du', MEASURED[j.id] ? MEASURED[j.id].split(' ')[0] : (j.manual ? 'manual' : '')));
        b.title = j.id;
        if (this.selected === j.id) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => this.select(j.id));
        c.append(b);
      });
      cols.append(c);
    });
    skin.append(cols);
  }

  paintConsole(run) {
    const log = this.r.log;
    log.textContent = '';
    const job = run.jobs.find((j) => j.id === this.selected) || run.jobs[0];
    const lines = this.engine === 'gate' ? gateLines(run) : (job ? job.log : []);
    const state = this.engine === 'gate' ? (run.gate.passed ? 'ok' : 'bad') : (job ? job.state : 'ok');

    this.r.jname.textContent = this.engine === 'gate' ? 'GateResult.evaluate' : (job ? job.id : '');
    this.r.jstate.textContent = STATE_LABEL[state];
    this.r.jstate.className = `mono pv-cstate ${state}`;
    /* A measured duration belongs to a job that ran. Showing "93 s" on a job the
       gate never let start would be the page's own version of the lie the whole
       repository exists to prevent. */
    this.r.jmeas.textContent = this.engine !== 'gate' && job && state === 'ok' && MEASURED[job.id] ? MEASURED[job.id] : '';

    const foot = this.r.logfoot;
    foot.textContent = '';
    foot.append(el('span', state === 'bad' ? 'bad' : state === 'ok' ? 'ok' : '',
      state === 'bad' ? 'exit code 1'
        : state === 'manual' ? 'waiting for input'
          : state === 'hollow' ? 'skipped: nothing runs after a refusal'
            : 'exit code 0'));
    if (job && state === 'ok' && MEASURED[job.id]) foot.append(el('span', '', `${MEASURED[job.id]} · published on the landing page`));
    const map = this.jobMap()[this.selected];
    foot.append(el('span', 'sp', map ? `file: ${map.file}` : 'file: not mapped'));

    /* The stamp is taken as each line is drawn. Under reduced motion every line
       is drawn in the same tick, so the times collapse into one instant, which
       is the honest version of the same statement. */
    const token = ++this.draw;
    const put = (line) => {
      if (token !== this.draw) return;
      const row = el('div', `pv-ll ${line.lvl}`);
      const ts = el('span', 'ts');
      const p = stampParts(new Date());
      ts.append(el('span', 'dt', p.date), el('span', 'tm', p.time), el('span', 'tz', p.zone));
      row.append(ts);
      const tag = line.lvl === 'err' ? 'ERROR' : line.lvl === 'warn' ? 'WARN' : line.lvl === 'log' ? 'INFO' : '';
      const scope = this.engine === 'jenkins' ? (job ? job.scope : '') : (job ? job.id : '');
      /* A command line keeps its own "$" in the message: that is how the runner
         echoes it, and a second one in a column would be the page decorating. */
      row.append(el('span', 'lv', tag));
      row.append(el('span', 'sc', tag ? scope : ''));
      row.append(el('span', 't', line.m.length ? line.m : ' '));
      log.append(row);
      log.scrollTop = log.scrollHeight;
    };

    if (REDUCED) { lines.forEach(put); }
    else lines.forEach((line, i) => setTimeout(() => put(line), 60 * (i + 1)));
    const now = stampParts(new Date());
    if (this.r.clock) this.r.clock.textContent = `${now.date} ${now.zone} · your browser's clock`;
  }

  paintSource() {
    if (!this.loaded) return;
    const map = this.jobMap();
    const job = this.selected ? map[this.selected] : null;
    if (!this.srcPick && job) this.srcKey = job.file;
    if (!this.srcKey) this.srcKey = (this.tree().find((n) => n.k) || {}).k;

    const tree = this.r.tree;
    tree.textContent = '';
    this.tree().forEach((n) => {
      if (n.d) { tree.append(el('div', 'pv-tdir', n.d)); return; }
      const on = n.k === this.srcKey;
      const b = el('button', `pv-tfile${on ? ' on' : ''}`);
      b.type = 'button';
      /* aria-current, not role="option": a listbox would demand that every child
         be an option, and this strip also carries directory labels. */
      if (on) b.setAttribute('aria-current', 'true');
      b.append(el('span', '', n.f), el('span', 'm', String(n.lines)));
      b.addEventListener('click', () => { this.srcKey = n.k; this.srcPick = n.k; this.paintSource(); });
      tree.append(b);
    });

    const entry = this.tree().find((n) => n.k === this.srcKey) || {};
    const text = FILE_TEXT[this.srcKey] || '';
    const lines = text.split('\n');
    const hl = new Set();
    if (job && job.file === this.srcKey) job.hl.forEach(([a, b]) => { for (let i = a; i <= b; i++) hl.add(i); });

    const body = this.r.cbody;
    body.textContent = '';
    lines.forEach((t, i) => {
      const row = el('div', `pv-cl${hl.has(i + 1) ? ' hit' : ''}`);
      row.append(el('span', 'n', String(i + 1)), el('span', 't', t.length ? t : ' '));
      body.append(row);
    });

    this.r['code-name'].textContent = entry.f || this.srcKey || '';
    this.r['code-why'].textContent = job && job.file === this.srcKey ? job.why
      : this.engine === 'gate' ? 'both engines compile these' : 'no job mapped to this file';
    this.r['code-count'].textContent = `${lines.length} lines · ${hl.size ? `${hl.size} marked` : 'nothing marked'}`;
  }

  select(id) {
    if (this.selected === id) return;
    this.selected = id;
    this.srcPick = null;
    this.paint(this.run);
  }

  paint(run) {
    this.run = run;
    if (!this.selected || !run.jobs.some((j) => j.id === this.selected)) {
      this.selected = this.engine === 'jenkins' ? 'trigger' : this.engine === 'gate' ? 'release-rules' : 'container-trivy';
    }
    /* The gate card carries only a console and a source: it has no run header and
       no stage skin, because a decision does not have stages. */
    if (this.r.sttxt) this.paintHeader(run);
    if (this.r.skin) this.paintSkin(run);
    this.paintConsole(run);
    this.paintSource();
    markScrollable(this.r.skin, this.r.tree);
  }

  async ensureSources() {
    if (this.loaded || !SOURCES.data) return;
    /* A job can point at a file the strip does not list (the gate classes are
       compiled by both engines), so the union is what has to be fetched. */
    const keys = new Set(this.tree().filter((n) => n.k).map((n) => n.k));
    Object.values(this.jobMap()).forEach((m) => keys.add(m.file));
    const wanted = [...keys].filter((k) => !(k in FILE_TEXT));
    await Promise.all(wanted.map(async (k) => {
      FILE_TEXT[k] = await (await fetch(`../assets/data/src/${k}`, { cache: 'no-store' })).text();
    }));
    this.loaded = true;
    this.paintSource();
  }
}

/* ---------- boot ---------- */

const panels = [...document.querySelectorAll('.pv-card')].map((card) => new Panel(card, card.dataset.engine));
let runKey = 'passed';
const runFor = (engine) => compute(engine === 'jenkins' ? 'jenkins' : 'gitlab', runKey);

function paintAll() {
  panels.forEach((p) => p.paint(runFor(p.engine)));
  legend();
}

function legend() {
  const run = runFor('gitlab');
  document.getElementById('legend').textContent = run.gate.passed
    ? `gate passed · ${run.plan.length} services in ${run.waves.length} waves · one verdict, both engines`
    : `gate refused · ${run.gate.failures.length} reason(s) · the stages after it never ran`;
}

const seg = (box, items, get, set) => {
  items.forEach(([label, value]) => {
    const b = el('button', '', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(get() === value));
    b.addEventListener('click', () => {
      if (get() === value) return;
      set(value);
      [...box.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    box.append(b);
  });
};

seg(document.getElementById('run-seg'), [['passed', 'passed'], ['refused', 'refused']],
  () => runKey, (v) => { runKey = v; paintAll(); });

document.querySelectorAll('.pv-skin').forEach((skin) => {
  skin.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const panel = panels.find((p) => p.r.skin === skin);
    if (!panel || !panel.run) return;
    const ids = panel.run.jobs.map((j) => j.id);
    const i = ids.indexOf(panel.selected);
    if (i < 0) return;
    const next = e.key === 'ArrowRight' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
    e.preventDefault();
    panel.select(ids[next]);
    const buttons = skin.querySelectorAll('button');
    if (buttons[next]) buttons[next].focus();
  });
});

window.addEventListener('resize', () => panels.forEach((p) => markScrollable(p.r.skin, p.r.tree)));

/* The lower two panels sit far down the page. Their files load when they come
   near the viewport instead of ahead of the first paint. */const lazy = new IntersectionObserver((seen) => {
  seen.forEach((en) => {
    if (!en.isIntersecting) return;
    const panel = panels.find((p) => p.card === en.target);
    if (panel) panel.ensureSources();
    lazy.unobserve(en.target);
  });
}, { rootMargin: '300px' });

async function selfCheck() {
  const badge = document.getElementById('selfcheck');
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
    /* One line at every width: a badge that grows a second line pushes the whole
       page down, and Lighthouse calls that a layout shift. */
    badge.textContent = bad === 0
      ? `${fx.cases.length}/${fx.cases.length} golden checks match the Groovy`
      : `${bad} of ${fx.cases.length} golden checks disagree`;
    badge.classList.add(bad === 0 ? 'ok' : 'bad');
  } catch (e) {
    badge.textContent = 'golden checks unavailable; CI runs them';
    badge.classList.add('bad');
  }
}

(async function boot() {
  paintAll();
  selfCheck();

  try {
    SOURCES.data = await (await fetch('../assets/data/sources.json', { cache: 'no-store' })).json();
  } catch (e) {
    panels.forEach((p) => { if (p.r['code-why']) p.r['code-why'].textContent = `source files unavailable (${e.message})`; });
    return;
  }

  const Q = new URLSearchParams(location.search);
  if (Q.get('run') === 'refused') {
    runKey = 'refused';
    [...document.getElementById('run-seg').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1)));
  }
  const engine = ['gitlab', 'jenkins', 'gate'].includes(Q.get('engine')) ? Q.get('engine') : 'gitlab';
  const target = panels.find((p) => p.engine === engine);
  if (Q.get('job') && target && runFor(engine).jobs.some((j) => j.id === Q.get('job'))) {
    target.selected = Q.get('job');
    target.srcPick = null;
  }
  if (Q.get('file') && target && target.tree().some((n) => n.k === Q.get('file'))) {
    target.srcKey = Q.get('file');
    target.srcPick = Q.get('file');
  }

  paintAll();
  await panels[0].ensureSources();
  panels.slice(1).forEach((p) => {
    if (p.card.getBoundingClientRect().top < window.innerHeight + 300) p.ensureSources();
    else lazy.observe(p.card);
  });
  if (Q.get('engine')) {
    document.getElementById(engine)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }
}());
