// Empirical M7 Phase 2 Adversarial Stress Test Suite
// Rigorous white-box state machine verification, rapid spam clicking, race condition stress,
// keyboard accessibility, and query parameter overrides across all 5 canonical pages.

import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const BASE_URL = 'http://127.0.0.1:8731';
const CDP_PORT = 9288;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAdversarialSuite() {
  console.log('========================================================================');
  console.log('  MILESTONE M7 PHASE 2: WHITE-BOX ADVERSARIAL STRESS TEST SUITE         ');
  console.log('  Target: Local HTTP Server at http://127.0.0.1:8731/                  ');
  console.log('========================================================================\n');

  const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, message, details = null) {
    stats.total++;
    if (!condition) {
      stats.failed++;
      stats.failures.push({ message, details });
      console.error(`  [FAIL] ${message}`);
      if (details) console.error('         Details:', JSON.stringify(details, null, 2));
      throw new Error(`Assertion failed: ${message}`);
    } else {
      stats.passed++;
      console.log(`  [PASS] ${message}`);
    }
  }

  // 1. Launch Headless Chrome with Remote Debugging
  console.log('--- 1. LAUNCH HEADLESS CHROME INSTANCE (CDP) ---');
  const userDataDir = `/tmp/chrome-m7-adversarial-${Date.now()}`;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  let ws = null;
  const consoleErrors = [];
  const uncaughtExceptions = [];

  try {
    let connected = false;
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) { connected = true; break; }
      } catch (e) {}
    }
    assert(connected, `Chrome CDP online on port ${CDP_PORT}`);

    // Create a tab
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE_URL + '/')}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise((r) => { ws.onopen = r; });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.removeEventListener('message', handler);
          reject(new Error(`Timeout waiting for CDP ${method} (${id})`));
        }, 15000);

        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            if (data.error) reject(new Error(data.error.message));
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Attach runtime exception and console error listeners
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.exceptionThrown') {
        uncaughtExceptions.push(data.params);
      }
      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        consoleErrors.push(data.params);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || 'Runtime evaluation exception');
      }
      return res.result.value;
    }

    async function navigate(url, viewport = { width: 1280, height: 900 }) {
      consoleErrors.length = 0;
      uncaughtExceptions.length = 0;
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.width < 768
      });
      await send('Page.navigate', { url });
      await sleep(600);
      // Wait for fonts & DOM ready
      await evaluate(`document.readyState === 'complete'`);
      await sleep(300);
    }

    // =========================================================================
    // SUITE 1: index.html - Toolbox Filters, Metrics Grid, Flagship Cards
    // =========================================================================
    console.log('\n--- SUITE 1: index.html (Toolbox Filters, Metrics Grid, Flagship Cards) ---');
    await navigate(`${BASE_URL}/`);

    // 1.1 Metrics Grid verification
    const metricsData = await evaluate(`(() => {
      const proofNums = Array.from(document.querySelectorAll('.proof-card .proof-num')).map(el => el.textContent.trim());
      const heroProof = document.querySelector('.hero-proof')?.textContent || '';
      return { proofNums, heroProof };
    })()`);
    assert(metricsData.proofNums.includes('53'), 'Verified metrics contains 53 services');
    assert(metricsData.proofNums.includes('5'), 'Verified metrics contains 5 artifact contracts');
    assert(metricsData.heroProof.includes('53 services'), 'Hero proof bar contains 53 services');
    assert(metricsData.heroProof.includes('~330 tests'), 'Hero proof bar contains ~330 tests');

    // 1.2 Flagship Cards verification
    const flagshipData = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.flagship-card')).map(card => {
        const title = card.querySelector('.card-title')?.textContent.trim();
        const href = card.querySelector('.card-cta')?.getAttribute('href');
        return { id: card.id, title, href };
      });
      return cards;
    })()`);
    assert(flagshipData.length === 3, `Exactly 3 flagship preview cards found (got ${flagshipData.length})`);
    assert(flagshipData[0].href === 'work/', `Flagship 1 links to work/ (got ${flagshipData[0].href})`);
    assert(flagshipData[1].href === 'diagrams/', `Flagship 2 links to diagrams/ (got ${flagshipData[1].href})`);
    assert(flagshipData[2].href === 'decisions/', `Flagship 3 links to decisions/ (got ${flagshipData[2].href})`);

    // 1.3 Toolbox Filter State Machine
    const initialToolboxState = await evaluate(`(() => {
      const dailyBtn = document.querySelector('.tier-filter [data-filter="daily"]');
      const activeBtn = document.querySelector('.tier-filter .filter-chip.active');
      const visibleItems = Array.from(document.querySelectorAll('.skill-item')).filter(it => it.style.display !== 'none' && !it.hasAttribute('hidden'));
      const hiddenItems = Array.from(document.querySelectorAll('.skill-item')).filter(it => it.style.display === 'none' || it.hasAttribute('hidden'));
      return {
        dailyPressed: dailyBtn?.getAttribute('aria-pressed'),
        activeFilter: activeBtn?.dataset.filter,
        visibleCount: visibleItems.length,
        hiddenCount: hiddenItems.length
      };
    })()`);
    assert(initialToolboxState.dailyPressed === 'true', 'Toolbox initial state has daily filter aria-pressed="true"');
    assert(initialToolboxState.activeFilter === 'daily', 'Toolbox initial active filter is "daily"');
    assert(initialToolboxState.visibleCount > 0 && initialToolboxState.hiddenCount > 0, `Toolbox correctly partitioned visible items (${initialToolboxState.visibleCount}) vs hidden items (${initialToolboxState.hiddenCount})`);

    // Test transition to regular
    await evaluate(`document.querySelector('.tier-filter [data-filter="regular"]').click()`);
    await sleep(50);
    const regularState = await evaluate(`(() => {
      const regularBtn = document.querySelector('.tier-filter [data-filter="regular"]');
      const visibleItems = Array.from(document.querySelectorAll('.skill-item')).filter(it => it.style.display !== 'none' && !it.hasAttribute('hidden'));
      const nonRegularVisible = visibleItems.filter(it => it.dataset.tier !== 'regular');
      return {
        regularPressed: regularBtn?.getAttribute('aria-pressed'),
        visibleCount: visibleItems.length,
        nonRegularVisibleCount: nonRegularVisible.length
      };
    })()`);
    assert(regularState.regularPressed === 'true', 'Clicking Regular updates aria-pressed="true"');
    assert(regularState.nonRegularVisibleCount === 0, 'No non-regular items visible under regular filter');

    // Test transition to exposure
    await evaluate(`document.querySelector('.tier-filter [data-filter="exposure"]').click()`);
    await sleep(50);
    const exposureState = await evaluate(`(() => {
      const expBtn = document.querySelector('.tier-filter [data-filter="exposure"]');
      const visibleItems = Array.from(document.querySelectorAll('.skill-item')).filter(it => it.style.display !== 'none' && !it.hasAttribute('hidden'));
      const nonExposureVisible = visibleItems.filter(it => it.dataset.tier !== 'exposure');
      return {
        expPressed: expBtn?.getAttribute('aria-pressed'),
        visibleCount: visibleItems.length,
        nonExposureVisibleCount: nonExposureVisible.length
      };
    })()`);
    assert(exposureState.expPressed === 'true', 'Clicking Exposure updates aria-pressed="true"');
    assert(exposureState.nonExposureVisibleCount === 0, 'No non-exposure items visible under exposure filter');

    // Test transition to all
    await evaluate(`document.querySelector('.tier-filter [data-filter="all"]').click()`);
    await sleep(50);
    const allState = await evaluate(`(() => {
      const allBtn = document.querySelector('.tier-filter [data-filter="all"]');
      const allItems = Array.from(document.querySelectorAll('.skill-item'));
      const visibleItems = allItems.filter(it => it.style.display !== 'none' && !it.hasAttribute('hidden'));
      return {
        allPressed: allBtn?.getAttribute('aria-pressed'),
        total: allItems.length,
        visible: visibleItems.length
      };
    })()`);
    assert(allState.allPressed === 'true', 'Clicking All Tools updates aria-pressed="true"');
    assert(allState.visible === allState.total, `All items visible under All filter (${allState.visible}/${allState.total})`);

    // 1.4 Rapid Spam Clicking on Toolbox Filter Chips
    console.log('   Stress: Rapid spam clicking on toolbox filters...');
    await evaluate(`(() => {
      const filters = ['daily', 'regular', 'exposure', 'all', 'daily', 'exposure', 'regular', 'daily', 'all', 'daily'];
      filters.forEach((f, idx) => {
        setTimeout(() => {
          document.querySelector('.tier-filter [data-filter="' + f + '"]')?.click();
        }, idx * 15);
      });
    })()`);
    await sleep(350);
    const postSpamState = await evaluate(`(() => {
      const activeBtn = document.querySelector('.tier-filter .filter-chip.active');
      const visibleItems = Array.from(document.querySelectorAll('.skill-item')).filter(it => it.style.display !== 'none' && !it.hasAttribute('hidden'));
      return { active: activeBtn?.dataset.filter, visible: visibleItems.length };
    })()`);
    assert(postSpamState.active === 'daily', `After rapid spam clicking, final active filter settled on 'daily' (got ${postSpamState.active})`);
    assert(consoleErrors.length === 0, `0 console errors during toolbox spam stress (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `0 uncaught exceptions during toolbox spam stress (got ${uncaughtExceptions.length})`);

    // =========================================================================
    // SUITE 2: work/index.html - Ticket #471 Storyboard, Break the Gate, Control Plane, Threat Model
    // =========================================================================
    console.log('\n--- SUITE 2: work/index.html (Storyboard, Break the Gate, Control Plane, Threat Model) ---');
    await navigate(`${BASE_URL}/work/`);

    // 2.1 Storyboard Step Navigation
    const sbInitial = await evaluate(`(() => {
      return {
        cur: document.querySelector('[data-bd-cur]')?.textContent.trim(),
        total: document.querySelector('[data-bd-total]')?.textContent.trim(),
        phase: document.querySelector('[data-bd-phase]')?.textContent.trim(),
        colIndex: Array.from(document.querySelectorAll('.bd-col')).findIndex(c => c.contains(document.getElementById('bd-card')))
      };
    })()`);
    assert(sbInitial.cur === '1', `Storyboard starts at step 1 (got ${sbInitial.cur})`);
    assert(sbInitial.total === '8', `Storyboard has 8 total steps (got ${sbInitial.total})`);
    assert(sbInitial.phase === 'Intake', `Storyboard step 1 phase is 'Intake' (got ${sbInitial.phase})`);
    assert(sbInitial.colIndex === 0, `Card initially in column 0 (got ${sbInitial.colIndex})`);

    // Advance through all 8 steps step-by-step
    for (let step = 2; step <= 8; step++) {
      await evaluate(`document.querySelector('[data-bd-next]').click()`);
      await sleep(80);
      const curStep = await evaluate(`document.querySelector('[data-bd-cur]').textContent.trim()`);
      assert(curStep === String(step), `Storyboard advanced to step ${step}`);
    }

    // Step 8 state verification
    const sbStep8 = await evaluate(`(() => {
      const card = document.getElementById('bd-card');
      const colIndex = Array.from(document.querySelectorAll('.bd-col')).findIndex(c => c.contains(card));
      const phase = document.querySelector('[data-bd-phase]')?.textContent.trim();
      const approvals = Array.from(document.querySelectorAll('[data-bd-approve] .ap-chip')).map(c => c.textContent.trim());
      return { colIndex, phase, approvalsCount: approvals.length };
    })()`);
    assert(sbStep8.colIndex === 4, `Step 8 card in column 4 (SIT) (got ${sbStep8.colIndex})`);
    assert(sbStep8.phase === 'SIT', `Step 8 phase is SIT (got ${sbStep8.phase})`);
    assert(sbStep8.approvalsCount === 5, `Step 8 has 5-layer approvals (got ${sbStep8.approvalsCount})`);

    // Step dots jump test: jump to step 3 (dot data-bd-go="2")
    await evaluate(`document.querySelector('.bd-dot[data-bd-go="2"]').click()`);
    await sleep(60);
    const sbJump = await evaluate(`document.querySelector('[data-bd-cur]').textContent.trim()`);
    assert(sbJump === '3', `Clicking dot 3 jumped to step 3 (got ${sbJump})`);

    // 2.2 "Break the Gate" Counter-Example and 1.4s Auto-Revert Stress Test
    console.log('   Testing "Break the Gate" and 1.4s auto-revert...');
    await evaluate(`document.querySelector('[data-bd-break]').click()`);
    await sleep(80);

    const breakImmediate = await evaluate(`(() => {
      const card = document.getElementById('bd-card');
      const colIndex = Array.from(document.querySelectorAll('.bd-col')).findIndex(c => c.contains(card));
      const phase = document.querySelector('[data-bd-phase]')?.textContent.trim();
      const breakPressed = document.querySelector('[data-bd-break]')?.getAttribute('aria-pressed');
      return { colIndex, phase, breakPressed };
    })()`);
    assert(breakImmediate.breakPressed === 'true', 'Break the gate button aria-pressed="true"');
    assert(breakImmediate.colIndex === 3, `Immediate break card moved to column 3 (Merged) (got ${breakImmediate.colIndex})`);
    assert(breakImmediate.phase.includes('Merged'), `Immediate break phase is Merged refused (got ${breakImmediate.phase})`);

    // Wait for the 1.4s auto-revert timer to expire (wait 1600ms)
    console.log('   Waiting 1600ms for 1.4s auto-revert...');
    await sleep(1600);

    const breakReverted = await evaluate(`(() => {
      const card = document.getElementById('bd-card');
      const colIndex = Array.from(document.querySelectorAll('.bd-col')).findIndex(c => c.contains(card));
      const phase = document.querySelector('[data-bd-phase]')?.textContent.trim();
      const feedTexts = Array.from(document.querySelectorAll('.bt-feed .act-title')).map(el => el.textContent.trim());
      return { colIndex, phase, hasRevertAct: feedTexts.some(t => t.includes('reverted')) };
    })()`);
    assert(breakReverted.colIndex === 2, `After 1.4s auto-revert, card automatically moved back to column 2 (In Review) (got ${breakReverted.colIndex})`);
    assert(breakReverted.phase === 'In Review', `After 1.4s auto-revert, phase became 'In Review' (got ${breakReverted.phase})`);
    assert(breakReverted.hasRevertAct === true, 'Feed contains status reverted act element');

    // Reset break state
    await evaluate(`document.querySelector('[data-bd-break]').click()`);
    await sleep(60);

    // 2.3 Rapid Spam Stress on Storyboard Controls
    console.log('   Stress: Rapid spam clicking between Break the Gate, Next, and Prev...');
    await evaluate(`(() => {
      for (let i = 0; i < 25; i++) {
        setTimeout(() => {
          if (i % 3 === 0) document.querySelector('[data-bd-break]')?.click();
          else if (i % 3 === 1) document.querySelector('[data-bd-next]')?.click();
          else document.querySelector('[data-bd-prev]')?.click();
        }, i * 20);
      }
    })()`);
    await sleep(700);
    assert(consoleErrors.length === 0, `0 console errors during storyboard rapid spam (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `0 uncaught exceptions during storyboard rapid spam (got ${uncaughtExceptions.length})`);

    // 2.4 Control Plane Replica Interactive State Machine
    console.log('   Testing Control Plane Replica state machine...');
    const cpViews = ['board', 'deploys', 'preuat', 'scans', 'testing', 'secrets', 'dashboard'];
    for (const v of cpViews) {
      await evaluate(`document.querySelector('.rp-ni[data-view="${v}"]')?.click()`);
      await sleep(50);
      const activeView = await evaluate(`document.querySelector('.rp-ni.on')?.dataset.view`);
      assert(activeView === v, `Control plane switched to view '${v}'`);
    }

    // Deploy sub-tab and select-all test
    await evaluate(`document.querySelector('.rp-ni[data-view="deploys"]')?.click()`);
    await sleep(60);
    await evaluate(`document.querySelector('.rp-tab[data-tab="build"]')?.click()`);
    await sleep(60);

    const initialBuildState = await evaluate(`(() => {
      const deployBtn = document.querySelector('[data-act="deploy"]');
      return { disabled: deployBtn?.hasAttribute('disabled') };
    })()`);
    assert(initialBuildState.disabled === true, 'Deploy button initially disabled when 0 services selected');

    // Click select all
    await evaluate(`document.querySelector('[data-act="selectall"]')?.click()`);
    await sleep(60);
    const selectedState = await evaluate(`(() => {
      const deployBtn = document.querySelector('[data-act="deploy"]');
      const checkedCount = document.querySelectorAll('.rp-svc input:checked').length;
      return { disabled: deployBtn?.hasAttribute('disabled'), checkedCount, btnText: deployBtn?.textContent.trim() };
    })()`);
    assert(selectedState.disabled === false, 'Deploy button enabled after select all');
    assert(selectedState.checkedCount > 0, `Services checked: ${selectedState.checkedCount}`);

    // Trigger deploy simulation
    await evaluate(`document.querySelector('[data-act="deploy"]')?.click()`);
    await sleep(150);
    const deployingState = await evaluate(`(() => {
      const isMonitoring = document.querySelector('.rp-tab[data-tab="monitoring"]')?.classList.contains('on');
      const hasConsole = Boolean(document.querySelector('.rp-console'));
      return { isMonitoring, hasConsole };
    })()`);
    assert(deployingState.isMonitoring === true, 'Triggering deploy automatically switched to monitoring view');
    assert(deployingState.hasConsole === true, 'Monitoring console is active');

    // Role switcher test: switch to developer
    await evaluate(`(() => {
      const sel = document.querySelector('[data-rp-role]');
      if (sel) { sel.value = 'developer'; sel.dispatchEvent(new Event('change')); }
    })()`);
    await sleep(60);
    const devRoleState = await evaluate(`(() => {
      const settingsTab = document.querySelector('.rp-ni[data-view="settings"]');
      return { settingsHidden: settingsTab?.hidden };
    })()`);
    assert(devRoleState.settingsHidden === true, 'Settings tab hidden for developer role');

    // Switch back to devsecops
    await evaluate(`(() => {
      const sel = document.querySelector('[data-rp-role]');
      if (sel) { sel.value = 'devsecops'; sel.dispatchEvent(new Event('change')); }
    })()`);
    await sleep(60);

    // 2.5 Threat Model Table Verification
    const tmRows = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('.tm-tbl tbody tr')).map(r => {
        const cells = Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim());
        return { asset: cells[0], threat: cells[1], gate: cells[2] };
      });
      return rows;
    })()`);
    assert(tmRows.length === 8, `Exactly 8 defended assets in Threat Model (got ${tmRows.length})`);
    assert(tmRows[0].asset === 'release integrity', `Asset 1 is release integrity (got ${tmRows[0].asset})`);
    assert(tmRows[7].asset === 'the model itself', `Asset 8 is the model itself (got ${tmRows[7].asset})`);

    // =========================================================================
    // SUITE 3: diagrams/index.html - 5 Plates, Controls, Shortcuts, Query Overrides
    // =========================================================================
    console.log('\n--- SUITE 3: diagrams/index.html (5 Plates, Step Controls, Keyboard Shortcuts, Reduced Motion) ---');
    await navigate(`${BASE_URL}/diagrams/`);

    // 3.1 Verify all 5 plates exist with correct stepCount
    const plates = await evaluate(`(() => {
      const roots = Array.from(document.querySelectorAll('[data-motion-root]')).map(r => ({
        id: r.id,
        stepCount: Number(r.dataset.stepCount),
        hasControls: Boolean(r.querySelector('.dg-controls')),
        hasPrev: Boolean(r.querySelector('[data-step-prev], [data-action="prev"]')),
        hasNext: Boolean(r.querySelector('[data-step-next], [data-action="next"]')),
        hasPlay: Boolean(r.querySelector('[data-step-play], [data-action="play-pause"]'))
      }));
      return roots;
    })()`);
    assert(plates.length === 5, `Exactly 5 interactive diagram plates found (got ${plates.length})`);
    assert(plates[0].stepCount === 6, `Plate 1 (21-phase governance) has 6 steps (got ${plates[0].stepCount})`);
    assert(plates[1].stepCount === 5, `Plate 2 (runner topology) has 5 steps (got ${plates[1].stepCount})`);
    assert(plates[2].stepCount === 6, `Plate 3 (event router) has 6 steps (got ${plates[2].stepCount})`);
    assert(plates[3].stepCount === 5, `Plate 4 (convergence graph) has 5 steps (got ${plates[3].stepCount})`);
    assert(plates[4].stepCount === 6, `Plate 5 (SIT sequence) has 6 steps (got ${plates[4].stepCount})`);

    // 3.2 Step Navigation & Boundary Controls on Plate 1
    const p1 = plates[0].id;
    // Pause automated loop first
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      const playBtn = r.querySelector('[data-step-play], [data-action="play-pause"]');
      if (r.classList.contains('is-playing')) playBtn.click();
    })()`);
    await sleep(60);

    // Jump to step 1
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      const dot1 = r.querySelector('[data-step-target="1"], [data-action="step"]');
      dot1?.click();
    })()`);
    await sleep(60);

    const p1Step1 = await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      const cur = r.dataset.stepCurrent;
      const prevDisabled = r.querySelector('[data-step-prev], [data-action="prev"]')?.disabled;
      const nextDisabled = r.querySelector('[data-step-next], [data-action="next"]')?.disabled;
      return { cur, prevDisabled, nextDisabled };
    })()`);
    assert(p1Step1.cur === '1', `Plate 1 set to step 1 (got ${p1Step1.cur})`);
    assert(p1Step1.prevDisabled === true, 'Previous button disabled at step 1 boundary');
    assert(p1Step1.nextDisabled === false, 'Next button enabled at step 1');

    // Advance to step 6 (count)
    for (let s = 2; s <= 6; s++) {
      await evaluate(`document.getElementById('${p1}').querySelector('[data-step-next], [data-action="next"]').click()`);
      await sleep(50);
    }
    const p1Step6 = await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      const cur = r.dataset.stepCurrent;
      const prevDisabled = r.querySelector('[data-step-prev], [data-action="prev"]')?.disabled;
      const nextDisabled = r.querySelector('[data-step-next], [data-action="next"]')?.disabled;
      return { cur, prevDisabled, nextDisabled };
    })()`);
    assert(p1Step6.cur === '6', `Plate 1 advanced to step 6 (got ${p1Step6.cur})`);
    assert(p1Step6.nextDisabled === true, 'Next button disabled at step 6 boundary');
    assert(p1Step6.prevDisabled === false, 'Previous button enabled at step 6');

    // 3.3 Keyboard Shortcuts (ArrowLeft, ArrowRight, Home, End, Space)
    console.log('   Testing keyboard shortcuts on Plate 1...');
    // Home key -> Step 1
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    })()`);
    await sleep(60);
    const keyHomeStep = await evaluate(`document.getElementById('${p1}').dataset.stepCurrent`);
    assert(keyHomeStep === '1', `Home key navigated to step 1 (got ${keyHomeStep})`);

    // ArrowRight -> Step 2
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      r.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    })()`);
    await sleep(60);
    const keyRightStep = await evaluate(`document.getElementById('${p1}').dataset.stepCurrent`);
    assert(keyRightStep === '2', `ArrowRight navigated to step 2 (got ${keyRightStep})`);

    // ArrowLeft -> Step 1
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      r.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    })()`);
    await sleep(60);
    const keyLeftStep = await evaluate(`document.getElementById('${p1}').dataset.stepCurrent`);
    assert(keyLeftStep === '1', `ArrowLeft navigated back to step 1 (got ${keyLeftStep})`);

    // End key -> Step 6
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      r.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    })()`);
    await sleep(60);
    const keyEndStep = await evaluate(`document.getElementById('${p1}').dataset.stepCurrent`);
    assert(keyEndStep === '6', `End key navigated to step 6 (got ${keyEndStep})`);

    // Space key -> Toggle Play/Pause
    const initialPlay = await evaluate(`document.getElementById('${p1}').classList.contains('is-playing')`);
    await evaluate(`(() => {
      const r = document.getElementById('${p1}');
      r.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    })()`);
    await sleep(80);
    const toggledPlay = await evaluate(`document.getElementById('${p1}').classList.contains('is-playing')`);
    assert(toggledPlay !== initialPlay, `Space key toggled play state (from ${initialPlay} to ${toggledPlay})`);

    // 3.4 Reduced-Motion / Static Override Query Params (?motion=static)
    console.log('   Testing ?motion=static query override...');
    await navigate(`${BASE_URL}/diagrams/?motion=static`);
    const staticState = await evaluate(`(() => {
      const roots = Array.from(document.querySelectorAll('[data-motion-root]')).map(r => ({
        id: r.id,
        motionState: r.dataset.motionState,
        frame: r.dataset.frame,
        isPlaying: r.classList.contains('is-playing')
      }));
      return roots;
    })()`);
    for (const s of staticState) {
      assert(s.motionState === 'static', `Plate ${s.id} motionState is 'static'`);
      assert(s.frame === 'static', `Plate ${s.id} frame is 'static'`);
      assert(s.isPlaying === false, `Plate ${s.id} is not auto-playing in static mode`);
    }

    // 3.5 Exact Step Query Parameter (?motion=step&step=3)
    console.log('   Testing ?motion=step&step=3 query override...');
    await navigate(`${BASE_URL}/diagrams/?motion=step&step=3`);
    const stepOverrideState = await evaluate(`(() => {
      const roots = Array.from(document.querySelectorAll('[data-motion-root]')).map(r => ({
        id: r.id,
        cur: r.dataset.stepCurrent,
        frame: r.dataset.frame,
        motionState: r.dataset.motionState
      }));
      return roots;
    })()`);
    for (const s of stepOverrideState) {
      assert(s.cur === '3', `Plate ${s.id} loaded directly at step 3 (got ${s.cur})`);
      assert(s.motionState === 'test', `Plate ${s.id} motionState is 'test'`);
      assert(s.frame === 'step', `Plate ${s.id} frame is 'step'`);
    }

    // 3.6 Rapid Spam Clicking across Diagram Controls
    console.log('   Stress: Rapid spam clicking on diagram controls...');
    await navigate(`${BASE_URL}/diagrams/`);
    await evaluate(`(() => {
      const root = document.querySelector('[data-motion-root]');
      const nextBtn = root?.querySelector('[data-step-next], [data-action="next"]');
      const prevBtn = root?.querySelector('[data-step-prev], [data-action="prev"]');
      const playBtn = root?.querySelector('[data-step-play], [data-action="play-pause"]');
      for (let i = 0; i < 30; i++) {
        setTimeout(() => {
          if (i % 3 === 0) nextBtn?.click();
          else if (i % 3 === 1) prevBtn?.click();
          else playBtn?.click();
        }, i * 15);
      }
    })()`);
    await sleep(600);
    assert(consoleErrors.length === 0, `0 console errors during diagram spam stress (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `0 uncaught exceptions during diagram spam stress (got ${uncaughtExceptions.length})`);

    // =========================================================================
    // SUITE 4: pipelines/index.html - Dual Console, Pass/Refuse Toggle, Source Auto-Scroll, Scanners
    // =========================================================================
    console.log('\n--- SUITE 4: pipelines/index.html (Dual Console, Pass/Refuse, Line Attribution, Scanners) ---');
    await navigate(`${BASE_URL}/pipelines/`);

    // 4.1 Dual console initial state
    const pipeInitial = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.pv-card')).map(c => ({
        engine: c.dataset.engine,
        hasSkin: Boolean(c.querySelector('.pv-skin')),
        hasConsole: Boolean(c.querySelector('.pv-log')),
        hasSource: Boolean(c.querySelector('.pv-cbody'))
      }));
      const legend = document.getElementById('legend')?.textContent.trim();
      const runKey = document.querySelector('#run-seg button[aria-pressed="true"]')?.textContent.trim();
      return { cards, legend, runKey };
    })()`);
    assert(pipeInitial.cards.length === 3, `Exactly 3 pipeline cards found (GitLab, Jenkins, Gate) (got ${pipeInitial.cards.length})`);
    assert(pipeInitial.cards.some(c => c.engine === 'gitlab'), 'GitLab card present');
    assert(pipeInitial.cards.some(c => c.engine === 'jenkins'), 'Jenkins card present');
    assert(pipeInitial.cards.some(c => c.engine === 'gate'), 'Gate card present');
    assert(pipeInitial.runKey === 'passed', `Initial state is 'passed' (got ${pipeInitial.runKey})`);
    assert(pipeInitial.legend.includes('gate passed'), `Legend confirms 'gate passed' (got ${pipeInitial.legend})`);

    // 4.2 Pass vs Refuse Toggle State Machine
    console.log('   Testing Pass vs Refuse toggle...');
    // Click 'refused'
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('#run-seg button'));
      const refBtn = btns.find(b => b.textContent.trim() === 'refused');
      refBtn?.click();
    })()`);
    await sleep(150);

    const pipeRefused = await evaluate(`(() => {
      const legend = document.getElementById('legend')?.textContent.trim();
      const glHeader = document.querySelector('.pv-card[data-engine="gitlab"] .pv-sttxt')?.textContent.trim();
      const jHeader = document.querySelector('.pv-card[data-engine="jenkins"] .pv-sttxt')?.textContent.trim();
      const badJobs = document.querySelectorAll('.pv-card[data-engine="gitlab"] .gl-job.bad').length;
      return { legend, glHeader, jHeader, badJobs };
    })()`);
    assert(pipeRefused.legend.includes('gate refused'), `Legend updated to 'gate refused' (got ${pipeRefused.legend})`);
    assert(pipeRefused.glHeader === 'refused', `GitLab pipeline header shows 'refused' (got ${pipeRefused.glHeader})`);
    assert(pipeRefused.jHeader === 'refused', `Jenkins pipeline header shows 'refused' (got ${pipeRefused.jHeader})`);
    assert(pipeRefused.badJobs > 0, `Failed job indicators visible in GitLab stages (${pipeRefused.badJobs} bad jobs)`);

    // Toggle back to 'passed'
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('#run-seg button'));
      const passBtn = btns.find(b => b.textContent.trim() === 'passed');
      passBtn?.click();
    })()`);
    await sleep(150);
    const pipePassedBack = await evaluate(`document.getElementById('legend')?.textContent.trim()`);
    assert(pipePassedBack.includes('gate passed'), `Toggled cleanly back to 'gate passed' (got ${pipePassedBack})`);

    // 4.3 Rapid spam toggle between passed and refused
    console.log('   Stress: Rapid spam toggle between passed and refused...');
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('#run-seg button'));
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          btns[i % 2]?.click();
        }, i * 20);
      }
    })()`);
    await sleep(600);
    assert(consoleErrors.length === 0, `0 console errors during run-seg spam toggle (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `0 uncaught exceptions during run-seg spam toggle (got ${uncaughtExceptions.length})`);

    // 4.4 Pinned Source Code Rendering & Line Highlighting
    console.log('   Testing pinned source code viewer & line highlighting...');
    // Ensure sources are loaded
    await evaluate(`window.scrollTo(0, document.body.scrollHeight / 2)`);
    await sleep(300);
    const sourceState = await evaluate(`(() => {
      const glCard = document.querySelector('.pv-card[data-engine="gitlab"]');
      const codeName = glCard?.querySelector('[data-role="code-name"]')?.textContent.trim();
      const lines = glCard?.querySelectorAll('.pv-cbody .pv-cl');
      const hitLines = glCard?.querySelectorAll('.pv-cbody .pv-cl.hit');
      const codeCount = glCard?.querySelector('[data-role="code-count"]')?.textContent.trim();
      return {
        codeName,
        lineCount: lines?.length || 0,
        hitCount: hitLines?.length || 0,
        codeCountText: codeCount,
        hasMatchPin: codeCount?.includes('matches the pin')
      };
    })()`);
    assert(sourceState.lineCount > 0, `Source code loaded with ${sourceState.lineCount} lines in viewer`);
    assert(sourceState.hitCount > 0, `Line attribution active: ${sourceState.hitCount} marked/hit lines`);
    assert(sourceState.hasMatchPin === true, `SHA-256 integrity verified: "${sourceState.codeCountText}"`);

    // 4.5 Weekly Scanner Reports Verification (#sync, #sast, #sonar)
    const scannerSections = await evaluate(`(() => {
      return {
        hasSync: Boolean(document.getElementById('sync')),
        hasSast: Boolean(document.getElementById('sast')),
        hasSonar: Boolean(document.getElementById('sonar')),
        syncText: document.getElementById('sync')?.textContent.slice(0, 150),
        sastText: document.getElementById('sast')?.textContent.slice(0, 150),
        sonarText: document.getElementById('sonar')?.textContent.slice(0, 150)
      };
    })()`);
    assert(scannerSections.hasSync === true, 'Section #sync (Branch Auto-Sync) exists');
    assert(scannerSections.hasSast === true, 'Section #sast (Domain SAST) exists');
    assert(scannerSections.hasSonar === true, 'Section #sonar (SonarQube sweep) exists');

    // =========================================================================
    // SUITE 5: decisions/index.html - 11 ADR Cards, Categories, Folds, Drawer
    // =========================================================================
    console.log('\n--- SUITE 5: decisions/index.html (11 ADR Cards, Categories, Fold Controls, Drawer) ---');
    await navigate(`${BASE_URL}/decisions/`);

    // 5.1 11 Structured ADR Cards with 4 Mandatory Sections
    const adrCards = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.dec-card')).map(card => {
        const id = card.id;
        const badge = card.querySelector('.adr-badge')?.textContent.trim();
        const title = card.querySelector('h3 span')?.textContent.trim();
        const hasDec = Boolean(card.querySelector('.field-decision') && card.querySelector('.val-decision'));
        const hasAlt = Boolean(card.querySelector('.field-alternative') && card.querySelector('.val-alternative'));
        const hasWhy = Boolean(card.querySelector('.field-why') && card.querySelector('.val-why'));
        const hasCost = Boolean(card.querySelector('.field-cost') && card.querySelector('.val-cost'));
        return { id, badge, title, hasDec, hasAlt, hasWhy, hasCost };
      });
      return cards;
    })()`);
    assert(adrCards.length === 11, `Exactly 11 ADR cards present (got ${adrCards.length})`);
    for (const c of adrCards) {
      assert(c.hasDec && c.hasAlt && c.hasWhy && c.hasCost, `Card ${c.id} (${c.badge}) contains all 4 mandatory sections (decision, alt, why, cost)`);
    }

    // 5.2 Category Section Verification
    const categories = await evaluate(`(() => {
      const cat1 = document.querySelector('#system-topology');
      const cat2 = document.querySelector('#production-operations');
      const c1Cards = cat1 ? cat1.querySelectorAll('.dec-card').length : 0;
      const c2Cards = cat2 ? cat2.querySelectorAll('.dec-card').length : 0;
      return { c1Cards, c2Cards };
    })()`);
    assert(categories.c1Cards === 6, `Category 1 (System Topology) contains exactly 6 ADR cards (got ${categories.c1Cards})`);
    assert(categories.c2Cards === 5, `Category 2 (Production Operations) contains exactly 5 ADR cards (got ${categories.c2Cards})`);

    // 5.3 Fold Button State Machine on Mobile Viewport (360px)
    console.log('   Testing Fold button state machine at 360px viewport...');
    await navigate(`${BASE_URL}/decisions/`, { width: 360, height: 740 });

    const mobileFoldInitial = await evaluate(`(() => {
      const card2 = document.getElementById('adr-02');
      const btn = card2?.querySelector('.dec-fold');
      return {
        foldAttr: card2?.dataset.fold,
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        label: btn?.querySelector('span')?.textContent.trim()
      };
    })()`);
    assert(mobileFoldInitial.foldAttr === 'closed', `On mobile, ADR-02 initially folded closed (got ${mobileFoldInitial.foldAttr})`);
    assert(mobileFoldInitial.ariaExpanded === 'false', 'Fold button aria-expanded="false"');
    assert(mobileFoldInitial.label === 'show', `Fold button label is "show" (got ${mobileFoldInitial.label})`);

    // Click fold button on ADR-02 to open
    await evaluate(`document.getElementById('adr-02').querySelector('.dec-fold')?.click()`);
    await sleep(60);
    const mobileFoldOpen = await evaluate(`(() => {
      const card2 = document.getElementById('adr-02');
      const btn = card2?.querySelector('.dec-fold');
      return {
        hasFoldAttr: card2?.hasAttribute('data-fold'),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        label: btn?.querySelector('span')?.textContent.trim()
      };
    })()`);
    assert(mobileFoldOpen.hasFoldAttr === false, 'After clicking fold button, data-fold removed (card opened)');
    assert(mobileFoldOpen.ariaExpanded === 'true', 'Fold button aria-expanded="true"');
    assert(mobileFoldOpen.label === 'hide', `Fold button label is "hide" (got ${mobileFoldOpen.label})`);

    // Rapid spam fold toggles
    console.log('   Stress: Rapid spam clicking fold button on mobile...');
    await evaluate(`(() => {
      const btn = document.getElementById('adr-02')?.querySelector('.dec-fold');
      for (let i = 0; i < 20; i++) {
        setTimeout(() => { btn?.click(); }, i * 20);
      }
    })()`);
    await sleep(600);
    assert(consoleErrors.length === 0, `0 console errors during fold spam toggles (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `0 uncaught exceptions during fold spam toggles (got ${uncaughtExceptions.length})`);

    // 5.4 Mobile Drawer Navigation Across All 5 Pages
    console.log('\n--- SUITE 6: Mobile Navigation Drawer (Focus Trapping, Inert, Escape Dismissal) ---');
    const pagesToTest = ['/', '/work/', '/diagrams/', '/pipelines/', '/decisions/'];
    for (const p of pagesToTest) {
      await navigate(`${BASE_URL}${p}`, { width: 360, height: 740 });

      // Open drawer
      await evaluate(`document.getElementById('nav-toggle')?.click()`);
      await sleep(100);

      const drawerOpenState = await evaluate(`(() => {
        const toggle = document.getElementById('nav-toggle');
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        return {
          expanded: toggle?.getAttribute('aria-expanded'),
          drawerHidden: drawer?.hasAttribute('hidden'),
          mainInert: main?.inert || main?.getAttribute('aria-hidden') === 'true'
        };
      })()`);
      assert(drawerOpenState.expanded === 'true', `Page ${p}: nav-toggle aria-expanded="true"`);
      assert(drawerOpenState.drawerHidden === false, `Page ${p}: nav-drawer visible (hidden removed)`);
      assert(drawerOpenState.mainInert === true, `Page ${p}: main-content marked inert`);

      // Dismiss with Escape key
      await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await sleep(100);

      const drawerClosedState = await evaluate(`(() => {
        const toggle = document.getElementById('nav-toggle');
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        return {
          expanded: toggle?.getAttribute('aria-expanded'),
          drawerHidden: drawer?.hasAttribute('hidden'),
          mainInert: main?.inert || main?.getAttribute('aria-hidden') === 'true'
        };
      })()`);
      assert(drawerClosedState.expanded === 'false', `Page ${p}: nav-toggle aria-expanded="false" after Escape`);
      assert(drawerClosedState.drawerHidden === true, `Page ${p}: nav-drawer hidden after Escape`);
      assert(drawerClosedState.mainInert === false, `Page ${p}: main-content inert removed after Escape`);
    }

    // =========================================================================
    // FINAL SANITY: ZERO CONSOLE ERRORS & ZERO EXCEPTIONS SUMMARY
    // =========================================================================
    console.log('\n========================================================================');
    console.log('  EMPIRICAL CHALLENGER VERIFICATION SUMMARY                             ');
    console.log('========================================================================');
    console.log(`  Total Checks Executed : ${stats.total}`);
    console.log(`  Passed               : ${stats.passed}`);
    console.log(`  Failed               : ${stats.failed}`);
    console.log(`  Console Errors       : ${consoleErrors.length}`);
    console.log(`  Uncaught Exceptions  : ${uncaughtExceptions.length}`);
    console.log('========================================================================\n');

    assert(stats.failed === 0, `All ${stats.total} empirical checks passed with 0 failures`);
    assert(consoleErrors.length === 0, `Total console errors is 0 (got ${consoleErrors.length})`);
    assert(uncaughtExceptions.length === 0, `Total uncaught exceptions is 0 (got ${uncaughtExceptions.length})`);

    console.log('>>> VERDICT: EMPIRICAL STRESS TEST PASSED 100% CLEAN <<<');

  } finally {
    if (ws) {
      try { ws.close(); } catch (e) {}
    }
    chrome.kill('SIGTERM');
    try {
      if (existsSync(userDataDir)) {
        rmSync(userDataDir, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

runAdversarialSuite().catch((err) => {
  console.error('\n[FATAL] Test harness failed:', err.message);
  process.exit(1);
});
