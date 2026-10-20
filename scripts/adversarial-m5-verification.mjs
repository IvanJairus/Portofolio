// Adversarial M5 Verification Harness
// Empirical Challenger: Stress-testing Dual-Engine Console & Fail-Closed Toggle
import { spawn } from 'node:child_process';

const TARGET_URL = 'http://127.0.0.1:8731/pipelines/index.html';
const CDP_PORT = 9250;

async function runAdversarialTests() {
  console.log('========================================================================');
  console.log('  CHALLENGER M5 ADVERSARIAL VERIFICATION: DUAL-ENGINE CONSOLE & GATES  ');
  console.log('========================================================================\n');

  const userDataDir = `/tmp/chrome-adv-m5-${Date.now()}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  const report = {
    consoleErrors: [],
    exceptions: [],
    assertions: []
  };

  function assert(cond, msg) {
    if (!cond) {
      console.error(`  [FAIL] ${msg}`);
      report.assertions.push({ status: 'FAIL', msg });
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(`  [PASS] ${msg}`);
      report.assertions.push({ status: 'PASS', msg });
    }
  }

  try {
    let connected = false;
    for (let i = 0; i < 35; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) { connected = true; break; }
      } catch (e) {}
    }
    if (!connected) throw new Error('Could not connect to Chrome debugging port ' + CDP_PORT);

    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    const ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.removeEventListener('message', handler);
          reject(new Error(`CDP ${method} timed out (${id})`));
        }, 12000);

        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (type === 'error') {
          console.error(`  [CONSOLE ERROR] ${text}`);
          report.consoleErrors.push(text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
        console.error(`  [UNCAUGHT EXCEPTION] ${desc}`);
        report.exceptions.push(desc);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || ''));
      }
      return res.result ? res.result.value : res;
    }

    // Set standard desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait for replay to complete and sources to load
    await new Promise(r => setTimeout(r, 2500));

    console.log('--- TEST 1: Initial Baseline & Pass State Verification ---');
    const initCheck = await evaluate(`(() => {
      const selfcheck = document.getElementById('selfcheck');
      const pin = document.getElementById('pin');
      const activeSeg = document.querySelector('#run-seg button[aria-pressed="true"]');
      const legend = document.getElementById('legend')?.textContent;

      const glStatus = document.querySelector('.pv-card[data-engine="gitlab"] [data-role="sttxt"]')?.textContent;
      const glBadCount = document.querySelectorAll('.pv-card[data-engine="gitlab"] .gl-job.bad').length;
      const glHollowCount = document.querySelectorAll('.pv-card[data-engine="gitlab"] .ic.none').length;

      const jkStatus = document.querySelector('.pv-card[data-engine="jenkins"] [data-role="sttxt"]')?.textContent;
      const jkBadCount = document.querySelectorAll('.pv-card[data-engine="jenkins"] .bo-node.bad').length;
      const jkHollowCount = document.querySelectorAll('.pv-card[data-engine="jenkins"] .bo-node.hollow').length;

      const gateStatus = document.querySelector('.pv-card[data-engine="gate"] [data-role="jstate"]')?.textContent;
      const gateFoot = document.querySelector('.pv-card[data-engine="gate"] [data-role="logfoot"]')?.textContent;

      return {
        selfcheckOk: selfcheck?.classList.contains('ok'),
        selfcheckText: selfcheck?.textContent,
        pinText: pin?.textContent,
        activeRun: activeSeg?.textContent.trim(),
        legend,
        glStatus, glBadCount, glHollowCount,
        jkStatus, jkBadCount, jkHollowCount,
        gateStatus, gateFoot
      };
    })()`);

    assert(initCheck.selfcheckOk && initCheck.selfcheckText.includes('golden checks match the Groovy'),
      `Golden checks pass: "${initCheck.selfcheckText}"`);
    assert(initCheck.activeRun === 'passed', `Initial toggle is "passed"`);
    assert(initCheck.glStatus === 'passed' && initCheck.glBadCount === 0 && initCheck.glHollowCount === 0,
      'GitLab pipeline is completely green (0 bad, 0 hollow)');
    assert(initCheck.jkStatus === 'passed' && initCheck.jkBadCount === 0 && initCheck.jkHollowCount === 0,
      'Jenkins pipeline is completely green (0 bad, 0 hollow)');
    assert(initCheck.gateStatus === 'passed', 'Composite quality gate is passed');
    assert(initCheck.gateFoot.includes('exit code 0'), 'Gate footer displays exit code 0');

    console.log('\n--- TEST 2: Fail-Closed Refuse State & Cascade Stops ---');
    // Click Refused button
    await evaluate(`(() => {
      document.querySelector('#run-seg button:nth-child(2)').click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const refuseCheck = await evaluate(`(() => {
      const legend = document.getElementById('legend')?.textContent;

      // GitLab evaluation
      const gitlab = document.querySelector('.pv-card[data-engine="gitlab"]');
      const glStatus = gitlab.querySelector('[data-role="sttxt"]')?.textContent;
      const glHeaderBad = gitlab.querySelector('[data-role="st"]')?.classList.contains('bad');
      const glJobs = Array.from(gitlab.querySelectorAll('.gl-job')).map(b => ({
        id: b.title,
        isBad: b.classList.contains('bad'),
        isHollow: Boolean(b.querySelector('.ic.none')),
        isOk: Boolean(b.querySelector('.ic.ok'))
      }));

      // Jenkins evaluation
      const jenkins = document.querySelector('.pv-card[data-engine="jenkins"]');
      const jkStatus = jenkins.querySelector('[data-role="sttxt"]')?.textContent;
      const jkHeaderBad = jenkins.querySelector('[data-role="st"]')?.classList.contains('bad');
      const jkNodes = Array.from(jenkins.querySelectorAll('.bo-node')).map(b => ({
        id: b.title,
        isBad: b.classList.contains('bad'),
        isHollow: b.classList.contains('hollow'),
        glyph: b.querySelector('.bo-ic')?.textContent
      }));

      // Gate Card evaluation
      const gate = document.querySelector('.pv-card[data-engine="gate"]');
      const gateState = gate.querySelector('[data-role="jstate"]')?.textContent;
      const gateFoot = gate.querySelector('[data-role="logfoot"]')?.textContent;
      const gateFootBad = Boolean(gate.querySelector('[data-role="logfoot"] .bad'));

      return {
        legend,
        glStatus, glHeaderBad, glJobs,
        jkStatus, jkHeaderBad, jkNodes,
        gateState, gateFoot, gateFootBad
      };
    })()`);

    assert(refuseCheck.legend.includes('gate refused'), `Legend reports gate refused: "${refuseCheck.legend}"`);
    assert(refuseCheck.glStatus === 'refused' && refuseCheck.glHeaderBad, 'GitLab header marks refused with danger badge');
    assert(refuseCheck.jkStatus === 'refused' && refuseCheck.jkHeaderBad, 'Jenkins header marks refused with danger badge');
    assert(refuseCheck.gateState === 'failed', 'Gate card state badge reports "failed"');
    assert(refuseCheck.gateFoot.includes('exit code 1') && refuseCheck.gateFootBad, 'Gate footer reports "exit code 1" with .bad styling');

    // GitLab Cascade stop check:
    const trivyIdx = refuseCheck.glJobs.findIndex(j => j.id === 'container-trivy');
    assert(trivyIdx >= 0, 'container-trivy job found in GitLab pipeline');
    assert(refuseCheck.glJobs[trivyIdx].isBad, 'container-trivy is marked bad (failed)');

    const glJobsBefore = refuseCheck.glJobs.slice(0, trivyIdx);
    assert(glJobsBefore.every(j => j.isOk), `All ${glJobsBefore.length} jobs preceding container-trivy passed`);

    const glJobsAfter = refuseCheck.glJobs.slice(trivyIdx + 1);
    const glHollowJobs = glJobsAfter.filter(j => j.isHollow);
    assert(glHollowJobs.length >= 7,
      `Cascade stop verified: ${glHollowJobs.length} downstream jobs marked hollow/skipped (${glHollowJobs.map(j => j.id).join(', ')})`);

    // Jenkins Cascade stop check:
    const jkGateIdx = refuseCheck.jkNodes.findIndex(n => n.id === 'Composite gate');
    assert(jkGateIdx >= 0, 'Composite gate found in Jenkins Blue Ocean nodes');
    assert(refuseCheck.jkNodes[jkGateIdx].isBad, 'Composite gate stage is marked bad');
    const jkNodesAfter = refuseCheck.jkNodes.slice(jkGateIdx + 1);
    assert(jkNodesAfter.length === 3 && jkNodesAfter.every(n => n.isHollow),
      `Jenkins cascade stop verified: All ${jkNodesAfter.length} stages after Composite gate (Deploy SIT, Promote UAT, Notify) are hollow`);

    // Click hollow job: assert skipped footer
    const hollowClick = await evaluate(`(() => {
      const gitlab = document.querySelector('.pv-card[data-engine="gitlab"]');
      const sitJob = Array.from(gitlab.querySelectorAll('.gl-job')).find(b => b.title === 'deploy-sit');
      sitJob.click();
      return {
        state: gitlab.querySelector('[data-role="jstate"]')?.textContent,
        foot: gitlab.querySelector('[data-role="logfoot"]')?.textContent
      };
    })()`);
    assert(hollowClick.state === 'not run', `Hollow job state badge is "not run" (got "${hollowClick.state}")`);
    assert(hollowClick.foot.includes('skipped: nothing runs after a refusal'),
      `Hollow job footer declares: "${hollowClick.foot}"`);

    // Click failed job: assert exit code 1
    const badClick = await evaluate(`(() => {
      const gitlab = document.querySelector('.pv-card[data-engine="gitlab"]');
      const trivy = Array.from(gitlab.querySelectorAll('.gl-job')).find(b => b.title === 'container-trivy');
      trivy.click();
      return {
        state: gitlab.querySelector('[data-role="jstate"]')?.textContent,
        foot: gitlab.querySelector('[data-role="logfoot"]')?.textContent,
        hasBadCls: Boolean(gitlab.querySelector('[data-role="logfoot"] .bad'))
      };
    })()`);
    assert(badClick.state === 'failed', `Failed job state badge is "failed" (got "${badClick.state}")`);
    assert(badClick.foot.includes('exit code 1') && badClick.hasBadCls,
      `Failed job footer declares "exit code 1" with .bad class (got "${badClick.foot}")`);

    console.log('\n--- TEST 3: GateResult.groovy THRESHOLDS & Failure Reasons Highlights ---');
    // Ensure Gate panel is scrolled and loaded
    await evaluate(`(() => {
      document.querySelector('.pv-card[data-engine="gate"]').scrollIntoView();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const gateDetails = await evaluate(`(() => {
      const gate = document.querySelector('.pv-card[data-engine="gate"]');
      const logRows = Array.from(gate.querySelectorAll('.pv-ll')).map(r => ({
        msg: r.querySelector('.t')?.textContent || '',
        tag: r.querySelector('.lv')?.textContent || '',
        cls: r.className
      }));

      const codeName = gate.querySelector('[data-role="code-name"]')?.textContent;
      const hitLines = Array.from(gate.querySelectorAll('.pv-cl.hit')).map(l => ({
        n: parseInt(l.querySelector('.n')?.textContent || '0', 10),
        text: l.querySelector('.t')?.textContent || ''
      }));

      return {
        logRows,
        codeName,
        hitLinesCount: hitLines.length,
        thresholdHits: hitLines.filter(h => h.n >= 15 && h.n <= 21),
        scanHits: hitLines.filter(h => h.n >= 52 && h.n <= 62)
      };
    })()`);

    assert(gateDetails.codeName === 'GateResult.groovy', `Gate code viewer displays GateResult.groovy (got "${gateDetails.codeName}")`);
    assert(gateDetails.thresholdHits.length >= 7,
      `GateResult.groovy lines 15-21 (THRESHOLDS map) are highlighted with .hit (found ${gateDetails.thresholdHits.length} lines)`);
    assert(gateDetails.scanHits.length >= 10,
      `GateResult.groovy lines 52-62 (scan failure & critical check) are highlighted with .hit (found ${gateDetails.scanHits.length} lines)`);

    const thresholdLog = gateDetails.logRows.find(r => r.msg.includes('THRESHOLDS'));
    assert(Boolean(thresholdLog), `Gate console prints THRESHOLDS statement: "${thresholdLog?.msg}"`);
    const failureLog = gateDetails.logRows.find(r => r.msg.includes('vulnerabilities: 1 critical'));
    assert(Boolean(failureLog), `Gate console prints critical vulnerability failure: "${failureLog?.msg}"`);

    console.log('\n--- TEST 4: Log Level Property Fix (.pv-ll.err, .pv-ll.warn, .pv-ll.cmd & tags) ---');
    const logCheck = await evaluate(`(() => {
      const allRows = Array.from(document.querySelectorAll('.pv-ll'));
      const hasUndefinedClass = allRows.some(r => r.classList.contains('undefined'));

      const errRow = allRows.find(r => r.classList.contains('err'));
      const warnRow = allRows.find(r => r.classList.contains('warn'));
      const cmdRow = allRows.find(r => r.classList.contains('cmd'));
      const logRow = allRows.find(r => r.classList.contains('log'));

      function getStyles(node) {
        if (!node) return null;
        const cs = window.getComputedStyle(node);
        return { color: cs.color, fontWeight: cs.fontWeight };
      }

      return {
        totalRows: allRows.length,
        hasUndefinedClass,
        errRow: errRow ? {
          tag: errRow.querySelector('.lv')?.textContent,
          textStyle: getStyles(errRow.querySelector('.t')),
          tagStyle: getStyles(errRow.querySelector('.lv'))
        } : null,
        warnRow: warnRow ? {
          tag: warnRow.querySelector('.lv')?.textContent,
          textStyle: getStyles(warnRow.querySelector('.t')),
          tagStyle: getStyles(warnRow.querySelector('.lv'))
        } : null,
        cmdRow: cmdRow ? {
          textStyle: getStyles(cmdRow.querySelector('.t'))
        } : null,
        logRow: logRow ? {
          tag: logRow.querySelector('.lv')?.textContent
        } : null
      };
    })()`);

    assert(!logCheck.hasUndefinedClass, 'Zero log rows carry class .undefined (the line.l || line.lvl property bug is eliminated)');
    assert(Boolean(logCheck.errRow), 'DOM contains .pv-ll.err rows');
    assert(logCheck.errRow.tag === 'ERROR', `Error row displays "ERROR" tag in .lv (got "${logCheck.errRow.tag}")`);
    assert(logCheck.errRow.textStyle.color === 'rgb(255, 157, 148)',
      `Error text styled with #ff9d94 (got ${logCheck.errRow.textStyle.color})`);

    assert(Boolean(logCheck.warnRow), 'DOM contains .pv-ll.warn rows');
    assert(logCheck.warnRow.tag === 'WARN', `Warn row displays "WARN" tag in .lv (got "${logCheck.warnRow.tag}")`);
    assert(logCheck.warnRow.textStyle.color === 'rgb(240, 180, 106)',
      `Warn text styled with #f0b46a (got ${logCheck.warnRow.textStyle.color})`);

    assert(Boolean(logCheck.cmdRow), 'DOM contains .pv-ll.cmd rows');
    assert(logCheck.cmdRow.textStyle.color === 'rgb(154, 212, 143)',
      `Cmd text styled with #9ad48f (got ${logCheck.cmdRow.textStyle.color})`);

    console.log('\n--- TEST 5: Source Code Viewer Auto-Scroll into Visible Viewport ---');
    await evaluate(`(() => {
      document.querySelector('.pv-card[data-engine="gitlab"]').scrollIntoView();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const testJobs = ['container-trivy', 'maven-package', 'docker-image', 'unit'];
    for (const jid of testJobs) {
      // Trigger click
      const clickRes = await evaluate(`(() => {
        const gl = document.querySelector('.pv-card[data-engine="gitlab"]');
        const btn = Array.from(gl.querySelectorAll('.gl-job')).find(b => b.title === '${jid}');
        if (!btn) return { error: 'Job not found: ${jid}' };
        btn.click();
        return { ok: true };
      })()`);
      assert(clickRes.ok, `Clicked job "${jid}"`);

      // Wait 700ms for smooth scroll animation to settle
      await new Promise(r => setTimeout(r, 700));

      const scrollResult = await evaluate(`(() => {
        const gl = document.querySelector('.pv-card[data-engine="gitlab"]');
        const cbody = gl.querySelector('.pv-cbody');
        const firstHit = cbody.querySelector('.hit');
        if (!firstHit) return { hasHits: false };

        const bodyRect = cbody.getBoundingClientRect();
        const hitRect = firstHit.getBoundingClientRect();

        // Check if hit line is within visible viewport of cbody container
        const isVisibleInViewport = (hitRect.top >= bodyRect.top - 15) && (hitRect.bottom <= bodyRect.bottom + 15);
        const hitLineNum = firstHit.querySelector('.n')?.textContent;

        return {
          hasHits: true,
          hitLineNum: parseInt(hitLineNum, 10),
          scrollTop: cbody.scrollTop,
          isVisibleInViewport
        };
      })()`);

      assert(scrollResult.hasHits, `Job "${jid}" produces highlighted hits in source viewer`);
      assert(scrollResult.isVisibleInViewport,
        `Auto-scroll verified: Job "${jid}" scrolled line ${scrollResult.hitLineNum} into visible viewport of .pv-cbody (scrollTop=${scrollResult.scrollTop})`);
    }

    console.log('\n--- TEST 6: Rapid Clicking & State Thrashing ---');
    console.log('  Executing 50 rapid Pass/Refuse toggles...');
    const thrashToggle = await evaluate(`(async () => {
      const passBtn = document.querySelector('#run-seg button:nth-child(1)');
      const refuseBtn = document.querySelector('#run-seg button:nth-child(2)');

      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) refuseBtn.click();
        else passBtn.click();
        await new Promise(r => setTimeout(r, 12));
      }

      // Settle on refused
      refuseBtn.click();
      await new Promise(r => setTimeout(r, 100));

      const glStatus = document.querySelector('.pv-card[data-engine="gitlab"] [data-role="sttxt"]')?.textContent;
      const jkStatus = document.querySelector('.pv-card[data-engine="jenkins"] [data-role="sttxt"]')?.textContent;
      const legend = document.getElementById('legend')?.textContent;

      return { glStatus, jkStatus, legend };
    })()`);

    assert(thrashToggle.glStatus === 'refused', `Post-thrash GitLab status intact: "refused"`);
    assert(thrashToggle.jkStatus === 'refused', `Post-thrash Jenkins status intact: "refused"`);
    assert(thrashToggle.legend.includes('gate refused'), `Post-thrash legend intact: "${thrashToggle.legend}"`);

    // Settle back on passed
    await evaluate(`(() => {
      document.querySelector('#run-seg button:nth-child(1)').click();
    })()`);
    await new Promise(r => setTimeout(r, 100));

    console.log('  Executing 40 rapid job switches...');
    const thrashJobs = await evaluate(`(async () => {
      const jobs = Array.from(document.querySelectorAll('.pv-card[data-engine="gitlab"] .gl-job'));
      for (let i = 0; i < 40; i++) {
        jobs[i % jobs.length].click();
        await new Promise(r => setTimeout(r, 10));
      }
      const activeJob = document.querySelector('.pv-card[data-engine="gitlab"] .gl-job[aria-current="true"]')?.title;
      const jname = document.querySelector('.pv-card[data-engine="gitlab"] [data-role="jname"]')?.textContent;
      return { activeJob, jname };
    })()`);

    assert(Boolean(thrashJobs.activeJob) && thrashJobs.activeJob === thrashJobs.jname,
      `Post-thrash active job matches console header ("${thrashJobs.activeJob}")`);

    console.log('\n--- TEST 7: Weekly Scanner Reports Verification ---');
    const reportsCheck = await evaluate(`(() => {
      const sec = document.getElementById('reports');
      const pills = Array.from(document.querySelectorAll('.rp-jump-pill')).map(p => ({
        href: p.getAttribute('href'),
        text: p.textContent.trim()
      }));

      const sync = document.getElementById('sync');
      const sast = document.getElementById('sast');
      const sonar = document.getElementById('sonar');

      const anyHidden = Array.from(document.querySelectorAll('.mail-card')).some(c => c.hasAttribute('hidden'));
      const tables = Array.from(document.querySelectorAll('.mail-tbl-wrap')).map(t => ({
        overflowX: window.getComputedStyle(t).overflowX,
        tabIndex: t.getAttribute('tabindex')
      }));

      const e11Pill = sonar?.querySelector('.pill.dim')?.textContent || '';

      return {
        secFound: Boolean(sec),
        pills,
        syncFound: Boolean(sync),
        sastFound: Boolean(sast),
        sonarFound: Boolean(sonar),
        anyHidden,
        tablesCount: tables.length,
        tablesResponsive: tables.every(t => t.overflowX === 'auto'),
        tablesAccessible: tables.every(t => t.tabIndex === '0'),
        e11Pill
      };
    })()`);

    assert(reportsCheck.secFound, 'Weekly Scanner Reports section (#reports) present');
    assert(reportsCheck.pills.length === 3, 'Jump bar provides 3 pill links (#sync, #sast, #sonar)');
    assert(reportsCheck.syncFound && reportsCheck.sastFound && reportsCheck.sonarFound,
      'All 3 scanner reports (#sync, #sast, #sonar) present');
    assert(!reportsCheck.anyHidden, 'Zero scanner report cards carry hidden attribute');
    assert(reportsCheck.tablesCount >= 3 && reportsCheck.tablesResponsive && reportsCheck.tablesAccessible,
      `All ${reportsCheck.tablesCount} tables wrapped in responsive, keyboard-accessible containers (overflow-x:auto, tabindex=0)`);
    assert(reportsCheck.e11Pill.includes('NO ANALYSIS'),
      `SonarQube sweep features explicit NO ANALYSIS schedule failure pill: "${reportsCheck.e11Pill}"`);

    console.log('\n--- TEST 8: Extreme Viewport Overflow & Touch Targets ---');
    const viewports = [360, 375, 768, 1024, 1280, 1440];
    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await new Promise(r => setTimeout(r, 100));

      const ov = await evaluate(`(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const bodyW = document.body.scrollWidth;
        const maxScroll = Math.max(scrollW, bodyW);
        return {
          docW, maxScroll,
          delta: maxScroll - docW,
          hasOverflow: maxScroll > docW
        };
      })()`);

      assert(!ov.hasOverflow, `Viewport ${w}px: 0px horizontal scroll leak (docW=${ov.docW}, maxScroll=${ov.maxScroll})`);
    }

    // Touch targets audit across all standalone controls
    const touchAudit = await evaluate(`(() => {
      const els = Array.from(document.querySelectorAll(
        'a[href], button, select, [role="button"], .pv-seg button, .gl-job, .bo-node, .pv-tfile, .rp-jump-pill'
      ));
      const fails = [];
      let evaluated = 0;
      for (const el of els) {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;

        const isInlineLink = el.tagName === 'A' && el.closest('p, .pv-fine, .pv-enote, .pv-note, .lead, .rp-where');
        if (isInlineLink) continue;

        evaluated++;
        const width = Math.round(r.width * 10) / 10;
        const height = Math.round(r.height * 10) / 10;
        if (width < 43.5 || height < 43.5) {
          fails.push({
            tag: el.tagName,
            cls: el.className,
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
            w: width, h: height
          });
        }
      }
      return { evaluated, failCount: fails.length, fails };
    })()`);

    assert(touchAudit.failCount === 0,
      `All ${touchAudit.evaluated} standalone interactive controls satisfy >= 44x44px touch target requirement`);

    console.log('\n--- TEST 9: Browser Console Errors & Uncaught Exceptions Audit ---');
    assert(report.consoleErrors.length === 0,
      `Zero browser console errors detected (got ${report.consoleErrors.length}: ${report.consoleErrors.join('; ')})`);
    assert(report.exceptions.length === 0,
      `Zero uncaught JavaScript exceptions detected (got ${report.exceptions.length}: ${report.exceptions.join('; ')})`);

    console.log('\n========================================================================');
    console.log(`  ALL ${report.assertions.length} ADVERSARIAL ASSERTIONS PASSED EMPIRICALLY!`);
    console.log('  VERDICT: APPROVE');
    console.log('========================================================================\n');

    ws.close();
  } catch (err) {
    console.error('\n*** TEST FAILURE ***\n', err);
    process.exit(1);
  } finally {
    chrome.kill();
  }
}

runAdversarialTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
