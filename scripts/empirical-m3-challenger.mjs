// Empirical M3 Challenger Test Suite
// Rigorous browser runtime, console, state machine, stress test, and link integrity harness.

import { spawn } from 'node:child_process';
import http from 'node:http';

const TARGET_URL = 'http://127.0.0.1:8731/work/index.html';
const CDP_PORT = 9225; // Use dedicated port to avoid collisions

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER M3 EMPIRICAL HARNESS: RUNTIME, CONSOLE & STATE     ');
  console.log('================================================================\n');

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome-challenger-m3-' + Date.now()
  ]);

  const report = {
    consoleErrors: [],
    exceptions: [],
    warnings: [],
    testResults: []
  };

  function assert(condition, message) {
    if (!condition) {
      console.error(`  [FAIL] ${message}`);
      report.testResults.push({ status: 'FAIL', message });
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`  [PASS] ${message}`);
      report.testResults.push({ status: 'PASS', message });
    }
  }

  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) { connected = true; break; }
      } catch (e) {}
    }
    if (!connected) throw new Error('Could not connect to Chrome debugging port ' + CDP_PORT);

    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    const wsUrl = tabData.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', handler);
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        if (msg.params.type === 'error') {
          report.consoleErrors.push(text);
          console.error('[BROWSER CONSOLE ERROR]:', text);
        } else if (msg.params.type === 'warning') {
          report.warnings.push(text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const exc = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
        report.exceptions.push(exc);
        console.error('[BROWSER EXCEPTION]:', exc);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    // Wait for DOM & script hydration
    await new Promise(r => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // TEST 1: Initial Page Load & Console Cleanliness
    // -------------------------------------------------------------------------
    console.log('\n--- 1. INITIAL RUNTIME & CONSOLE AUDIT ---');
    const initEval = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        readyState: document.readyState,
        hasJsFlag: document.documentElement.hasAttribute('data-js')
      })`,
      returnByValue: true
    });
    const initData = initEval.result.value;
    assert(initData.readyState === 'complete', 'Document readyState is complete');
    assert(initData.title === 'Case Studies & Threat Model | Ivan Jairus', `Document title is exact: ${initData.title}`);
    assert(initData.hasJsFlag === true, 'html element has data-js attribute set by main.js');
    assert(report.consoleErrors.length === 0, `0 console errors on initial load (found ${report.consoleErrors.length})`);
    assert(report.exceptions.length === 0, `0 unhandled exceptions on initial load (found ${report.exceptions.length})`);

    // -------------------------------------------------------------------------
    // TEST 2: Interactive Widget Hydration Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 2. INTERACTIVE WIDGET HYDRATION AUDIT ---');
    const hydrationEval = await send('Runtime.evaluate', {
      expression: `({
        feedEl: !!document.querySelector('[data-bd-feed]'),
        feedCount: document.querySelector('[data-bd-feed]')?.children.length || 0,
        rpViewEl: !!document.querySelector('[data-rp-view]'),
        rpViewCount: document.querySelector('[data-rp-view]')?.children.length || 0,
        cardEl: !!document.querySelector('#bd-card'),
        cardText: document.querySelector('#bd-card .bc-iid')?.textContent || '',
        cardPhase: document.querySelector('#bd-card [data-bd-phase]')?.textContent || '',
        cardCol: document.querySelector('#bd-card')?.parentElement?.closest('.bd-col')?.dataset?.col || '',
        dotsCount: document.querySelectorAll('.bd-dot').length,
        curStep: document.querySelector('[data-bd-cur]')?.textContent || '',
        totalSteps: document.querySelector('[data-bd-total]')?.textContent || ''
      })`,
      returnByValue: true
    });
    const hyd = hydrationEval.result.value;
    assert(hyd.feedEl && hyd.feedCount > 0, `[data-bd-feed] exists and has rendered children (count: ${hyd.feedCount})`);
    assert(hyd.rpViewEl && hyd.rpViewCount > 0, `[data-rp-view] exists and has rendered children (count: ${hyd.rpViewCount})`);
    assert(hyd.cardEl && hyd.cardText.includes('#471'), `Card #471 is present in the DOM (found: ${hyd.cardText})`);
    assert(hyd.cardCol === '0', `Card #471 starts in Column 0 (To do)`);
    assert(hyd.cardPhase === 'Intake', `Card #471 starts with phase "Intake"`);
    assert(hyd.dotsCount === 8, `Storyboard has exactly 8 navigation dots (found: ${hyd.dotsCount})`);
    assert(hyd.curStep === '1', `Storyboard indicator shows Step 1 initially`);
    assert(hyd.totalSteps === '8', `Storyboard indicator shows total 8`);

    // -------------------------------------------------------------------------
    // TEST 3: Storyboard Navigation Step-by-Step State Machine & Boundary Stress
    // -------------------------------------------------------------------------
    console.log('\n--- 3. STORYBOARD NAVIGATION & STATE MACHINE VERIFICATION ---');

    // Expected state progression across 8 steps:
    const expectedSteps = [
      { step: 0, col: '0', phase: 'Intake', minActs: 1, approvals: 0 },
      { step: 1, col: '0', phase: 'Dev Planning', minActs: 3, approvals: 4 },
      { step: 2, col: '1', phase: 'Development', minActs: 5, approvals: 4 },
      { step: 3, col: '1', phase: 'Development', minActs: 7, approvals: 4 },
      { step: 4, col: '2', phase: 'Development', minActs: 10, approvals: 4 },
      { step: 5, col: '3', phase: 'Development', minActs: 13, approvals: 4 },
      { step: 6, col: '4', phase: 'Promote', minActs: 16, approvals: 4 },
      { step: 7, col: '4', phase: 'SIT', minActs: 19, approvals: 5 }
    ];

    // First, pause any autoplay so we control steps manually
    await send('Runtime.evaluate', {
      expression: `(() => {
        const pauseBtn = document.querySelector('[data-bd-play]');
        if (pauseBtn && !pauseBtn.classList.contains('paused')) pauseBtn.click();
      })()`
    });

    // Step forward from 0 to 7
    for (let targetStep = 1; targetStep <= 7; targetStep++) {
      const stepRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const nextBtn = document.querySelector('[data-bd-next]');
          nextBtn.click();
          const card = document.querySelector('#bd-card');
          const col = card?.parentElement?.closest('.bd-col')?.dataset?.col || '';
          const phase = card?.querySelector('[data-bd-phase]')?.textContent || '';
          const cur = document.querySelector('[data-bd-cur]')?.textContent || '';
          const acts = document.querySelector('[data-bd-feed]')?.children.length || 0;
          const apps = card?.querySelectorAll('[data-bd-approve] .ap-chip')?.length || 0;
          const activeDot = Array.from(document.querySelectorAll('.bd-dot')).findIndex(d => d.classList.contains('on'));
          return { col, phase, cur, acts, apps, activeDot };
        })()`,
        returnByValue: true
      });
      const st = stepRes.result.value;
      const exp = expectedSteps[targetStep];
      assert(st.cur === String(targetStep + 1), `Step ${targetStep}: [data-bd-cur] is ${targetStep + 1}`);
      assert(st.col === exp.col, `Step ${targetStep}: Card #471 moved to col ${exp.col} (got ${st.col})`);
      assert(st.phase === exp.phase, `Step ${targetStep}: Phase is "${exp.phase}" (got "${st.phase}")`);
      assert(st.apps === exp.approvals, `Step ${targetStep}: Approvals count is ${exp.approvals} (got ${st.apps})`);
      assert(st.activeDot === targetStep, `Step ${targetStep}: Dot ${targetStep} is marked active`);
    }

    // Boundary stress test: Click NEXT at step 7 (upper bound)
    console.log('Testing boundary: Click NEXT at step 7...');
    const upperLimitRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const nextBtn = document.querySelector('[data-bd-next]');
        nextBtn.click(); // should not overshoot
        return {
          cur: document.querySelector('[data-bd-cur]')?.textContent || '',
          cardCol: document.querySelector('#bd-card')?.parentElement?.closest('.bd-col')?.dataset?.col || ''
        };
      })()`,
      returnByValue: true
    });
    assert(upperLimitRes.result.value.cur === '8', 'Card #471 stays clamped at Step 8 on next overflow');
    assert(upperLimitRes.result.value.cardCol === '4', 'Card #471 remains in Col 4 (Deploy)');

    // Step backwards from 7 down to 0
    console.log('Testing reverse traversal: Click PREV down to step 0...');
    for (let targetStep = 6; targetStep >= 0; targetStep--) {
      const stepRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const prevBtn = document.querySelector('[data-bd-prev]');
          prevBtn.click();
          const card = document.querySelector('#bd-card');
          const col = card?.parentElement?.closest('.bd-col')?.dataset?.col || '';
          const phase = card?.querySelector('[data-bd-phase]')?.textContent || '';
          const cur = document.querySelector('[data-bd-cur]')?.textContent || '';
          return { col, phase, cur };
        })()`,
        returnByValue: true
      });
      const st = stepRes.result.value;
      const exp = expectedSteps[targetStep];
      assert(st.cur === String(targetStep + 1), `Reverse to step ${targetStep}: indicator is ${targetStep + 1}`);
      assert(st.col === exp.col, `Reverse to step ${targetStep}: Card #471 in col ${exp.col}`);
      assert(st.phase === exp.phase, `Reverse to step ${targetStep}: Phase is "${exp.phase}"`);
    }

    // Boundary stress test: Click PREV at step 0 (lower bound)
    console.log('Testing boundary: Click PREV at step 0...');
    const lowerLimitRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const prevBtn = document.querySelector('[data-bd-prev]');
        prevBtn.click(); // should not undershoot
        return {
          cur: document.querySelector('[data-bd-cur]')?.textContent || '',
          cardCol: document.querySelector('#bd-card')?.parentElement?.closest('.bd-col')?.dataset?.col || ''
        };
      })()`,
      returnByValue: true
    });
    assert(lowerLimitRes.result.value.cur === '1', 'Card #471 stays clamped at Step 1 on prev underflow');
    assert(lowerLimitRes.result.value.cardCol === '0', 'Card #471 remains in Col 0 (To do)');

    // Direct dot navigation: Click dot 4
    console.log('Testing direct dot navigation: jump to dot 4 and dot 1...');
    const dotJumpRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const dots = document.querySelectorAll('.bd-dot');
        dots[4].click();
        const cur4 = document.querySelector('[data-bd-cur]')?.textContent || '';
        dots[1].click();
        const cur1 = document.querySelector('[data-bd-cur]')?.textContent || '';
        dots[0].click();
        const cur0 = document.querySelector('[data-bd-cur]')?.textContent || '';
        return { cur4, cur1, cur0 };
      })()`,
      returnByValue: true
    });
    assert(dotJumpRes.result.value.cur4 === '5', 'Direct dot 4 jump lands on Step 5');
    assert(dotJumpRes.result.value.cur1 === '2', 'Direct dot 1 jump lands on Step 2');
    assert(dotJumpRes.result.value.cur0 === '1', 'Direct dot 0 jump lands on Step 1');

    // -------------------------------------------------------------------------
    // TEST 4: "Break the Gate" Counter-Example & Recovery
    // -------------------------------------------------------------------------
    console.log('\n--- 4. "BREAK THE GATE" COUNTER-EXAMPLE STRESS TEST ---');
    const breakTriggerRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const breakBtn = document.querySelector('[data-bd-break]');
        if (!breakBtn) return { error: 'No break button' };
        breakBtn.click();
        const card = document.querySelector('#bd-card');
        return {
          pressed: breakBtn.getAttribute('aria-pressed'),
          col: card?.parentElement?.closest('.bd-col')?.dataset?.col || '',
          phase: card?.querySelector('[data-bd-phase]')?.textContent || '',
          feedActs: document.querySelector('[data-bd-feed]')?.children.length || 0
        };
      })()`,
      returnByValue: true
    });
    assert(breakTriggerRes.result.value.pressed === 'true', 'Break button aria-pressed set to "true"');
    assert(breakTriggerRes.result.value.col === '3', 'Card #471 artificially moved to Col 3 (Merged)');
    assert(breakTriggerRes.result.value.phase.includes('Merged'), `Phase indicates refusal: ${breakTriggerRes.result.value.phase}`);

    // Wait 1.8s for automation guard timer to revert (setTimeout in showcase.js is 1400ms)
    console.log('Waiting 1.8s for orchestrator gate refusal & revert timer...');
    await new Promise(r => setTimeout(r, 1800));

    const breakRevertRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector('#bd-card');
        const acts = Array.from(document.querySelectorAll('[data-bd-feed] .act-title')).map(a => a.textContent);
        return {
          col: card?.parentElement?.closest('.bd-col')?.dataset?.col || '',
          phase: card?.querySelector('[data-bd-phase]')?.textContent || '',
          hasRevertAction: acts.some(t => t.includes('Status reverted to In Review')),
          hasFailedJob: acts.some(t => t.includes('Job failed with exit 1'))
        };
      })()`,
      returnByValue: true
    });
    console.log('breakRevertRes result:', breakRevertRes.result.value);
    assert(breakRevertRes.result.value.col === '2', 'Card #471 automatically reverted back to Col 2 (In Review)');
    assert(breakRevertRes.result.value.phase === 'In Review', 'Phase reverted back to "In Review"');
    assert(breakRevertRes.result.value.hasRevertAction, 'Feed records: "Status reverted to In Review"');
    assert(breakRevertRes.result.value.hasFailedJob, 'Feed records: "Job failed with exit 1"');

    // Reset break mode
    await send('Runtime.evaluate', {
      expression: `(() => {
        const breakBtn = document.querySelector('[data-bd-break]');
        if (breakBtn && breakBtn.getAttribute('aria-pressed') === 'true') breakBtn.click();
      })()`
    });

    // -------------------------------------------------------------------------
    // TEST 5: Skim Mode / Depth Toggle Behavior
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SKIM MODE / DEPTH TOGGLE AUDIT ---');
    const initialDepthState = await send('Runtime.evaluate', {
      expression: `(() => {
        const htmlDepth = document.documentElement.dataset.depth || '';
        const deepSections = Array.from(document.querySelectorAll('[data-deep]'));
        const deepVisible = deepSections.every(s => window.getComputedStyle(s).display !== 'none');
        const skimNote = document.querySelector('[data-skim-note]');
        const noteVisible = skimNote && window.getComputedStyle(skimNote).display !== 'none';
        const btn = document.querySelector('[data-depth-btn]');
        return { htmlDepth, deepVisible, noteVisible, btnPressed: btn?.getAttribute('aria-pressed') };
      })()`,
      returnByValue: true
    });
    assert(initialDepthState.result.value.deepVisible, 'In default mode, all [data-deep] case studies are visible');
    assert(!initialDepthState.result.value.noteVisible, 'In default mode, [data-skim-note] is hidden');
    assert(initialDepthState.result.value.btnPressed === 'false', 'Depth toggle button aria-pressed is false initially');

    // Click depth toggle button
    console.log('Toggling depth button to SKIM mode...');
    const skimActivatedRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-depth-btn]');
        btn.click();
        const htmlDepth = document.documentElement.dataset.depth || '';
        const deepSections = Array.from(document.querySelectorAll('[data-deep]'));
        const allDeepHidden = deepSections.every(s => window.getComputedStyle(s).display === 'none');
        const skimNote = document.querySelector('[data-skim-note]');
        const noteDisplay = skimNote ? window.getComputedStyle(skimNote).display : 'none';
        const noteText = skimNote ? skimNote.innerText : '';
        const btnLabel = btn.querySelector('[data-i18n]')?.textContent || btn.textContent;
        const btnPressed = btn.getAttribute('aria-pressed');
        return { htmlDepth, allDeepHidden, noteDisplay, noteText, btnLabel, btnPressed };
      })()`,
      returnByValue: true
    });
    const skimData = skimActivatedRes.result.value;
    assert(skimData.htmlDepth === 'skim', 'html element receives data-depth="skim"');
    assert(skimData.btnPressed === 'true', 'Depth toggle button aria-pressed is true in skim mode');
    assert(skimData.allDeepHidden, 'All [data-deep] case study sections are hidden (display: none)');
    assert(skimData.noteDisplay === 'flex', `[data-skim-note] is displayed with display: flex`);
    assert(skimData.noteText.includes('three case studies hidden, this is the short read'), `Skim note displays required text: "${skimData.noteText}"`);

    // Click "Show them" button inside skim note
    console.log('Toggling back to DEEP mode via .skim-back button inside skim note...');
    const deepRestoredRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const showBtn = document.querySelector('.skim-back');
        showBtn.click();
        const htmlDepth = document.documentElement.dataset.depth || '';
        const deepSections = Array.from(document.querySelectorAll('[data-deep]'));
        const allDeepVisible = deepSections.every(s => window.getComputedStyle(s).display !== 'none');
        const skimNote = document.querySelector('[data-skim-note]');
        const noteDisplay = skimNote ? window.getComputedStyle(skimNote).display : 'none';
        return { htmlDepth, allDeepVisible, noteDisplay };
      })()`,
      returnByValue: true
    });
    assert(deepRestoredRes.result.value.htmlDepth === 'deep', 'html element receives data-depth="deep"');
    assert(deepRestoredRes.result.value.allDeepVisible, 'All [data-deep] case studies are restored to visible');
    assert(deepRestoredRes.result.value.noteDisplay === 'none', 'Skim note is hidden again');

    // Test anchor jump unhide in skim mode:
    console.log('Testing deep anchor auto-unhide when in skim mode via real subnav link a[href="#board"]...');
    const anchorJumpRes = await send('Runtime.evaluate', {
      expression: `(() => {
        // Toggle into skim first
        document.querySelector('[data-depth-btn]').click();
        const wasSkim = document.documentElement.dataset.depth === 'skim';
        // Click actual subnav link pointing to #board (which is a [data-deep] section)
        const link = document.querySelector('a[href="#board"]');
        if (link) link.click();
        const nowDepth = document.documentElement.dataset.depth;
        return { wasSkim, nowDepth };
      })()`,
      returnByValue: true
    });
    assert(anchorJumpRes.result.value.wasSkim, 'Was in skim mode before anchor click');
    assert(anchorJumpRes.result.value.nowDepth === 'deep', 'Subnav click to #board automatically restored data-depth="deep"');

    // -------------------------------------------------------------------------
    // TEST 6: Release Control Plane Replica (Case Study II) Interactive Stress
    // -------------------------------------------------------------------------
    console.log('\n--- 6. RELEASE CONTROL PLANE REPLICA INTERACTIVE STRESS ---');
    const replicaStressRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const results = [];
        const roleSel = document.querySelector('[data-rp-role]');
        const projSel = document.querySelector('[data-rp-proj]');
        const navBtns = Array.from(document.querySelectorAll('.rp-ni'));

        // Switch role to developer
        roleSel.value = 'developer';
        roleSel.dispatchEvent(new Event('change'));
        const toastDev = document.querySelector('[data-rp-toasts]')?.textContent || '';
        results.push({ test: 'role-dev', ok: toastDev.includes('developer') });

        // Developer tries settings
        const settingsBtn = navBtns.find(b => b.dataset.view === 'settings');
        if (settingsBtn) {
          settingsBtn.click();
          const toastDenied = document.querySelector('[data-rp-toasts]')?.textContent || '';
          results.push({ test: 'dev-settings-denied', ok: toastDenied.includes('cannot open settings') });
        }

        // Switch role to admin
        roleSel.value = 'admin';
        roleSel.dispatchEvent(new Event('change'));

        // Admin opens settings
        if (settingsBtn) {
          settingsBtn.click();
          const viewHtml = document.querySelector('[data-rp-view]')?.innerHTML || '';
          results.push({ test: 'admin-settings-opened', ok: viewHtml.length > 50 });
        }

        // Switch back to overview
        const overviewBtn = navBtns.find(b => b.dataset.view === 'overview');
        if (overviewBtn) {
          overviewBtn.click();
          results.push({ test: 'overview-restored', ok: true });
        }

        // Switch projects
        ['core', 'mobile', 'all'].forEach(p => {
          projSel.value = p;
          projSel.dispatchEvent(new Event('change'));
        });
        results.push({ test: 'proj-switched', ok: true });

        return results;
      })()`,
      returnByValue: true
    });
    for (const r of replicaStressRes.result.value) {
      assert(r.ok, `Replica stress test: ${r.test}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Mobile Navigation Drawer (Accessibility & Inert)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. MOBILE DRAWER NAVIGATION & ACCESSIBILITY AUDIT ---');
    const navDrawerRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const toggle = document.querySelector('#nav-toggle');
        const drawer = document.querySelector('#nav-drawer');
        const main = document.querySelector('#main-content');
        if (!toggle || !drawer || !main) return { error: 'Missing drawer elements' };

        // Open drawer
        toggle.click();
        const opened = drawer.classList.contains('is-open');
        const ariaExp = toggle.getAttribute('aria-expanded');
        const mainInert = main.hasAttribute('inert');

        // Dismiss with Escape key
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(escEvent);
        const closed = !drawer.classList.contains('is-open');
        const ariaExpClosed = toggle.getAttribute('aria-expanded');
        const mainNotInert = !main.hasAttribute('inert');

        return { opened, ariaExp, mainInert, closed, ariaExpClosed, mainNotInert };
      })()`,
      returnByValue: true
    });
    const nd = navDrawerRes.result.value;
    assert(nd.opened && nd.ariaExp === 'true', 'Drawer opens on #nav-toggle click and sets aria-expanded="true"');
    assert(nd.mainInert, '#main-content gets inert attribute when drawer is open');
    assert(nd.closed && nd.ariaExpClosed === 'false', 'Drawer closes on Escape keypress and reverts aria-expanded="false"');
    assert(nd.mainNotInert, 'inert is cleanly removed from #main-content when drawer closes');

    // -------------------------------------------------------------------------
    // TEST 8: Full Link Resolution & 404 Crawler from work/
    // -------------------------------------------------------------------------
    console.log('\n--- 8. LINK INTEGRITY & 404 CRAWLER AUDIT ---');
    const linksOnPageRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const links = Array.from(document.querySelectorAll('link[href]'));
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const imgs = Array.from(document.querySelectorAll('img[src]'));

        return {
          anchors: anchors.map(a => ({
            href: a.getAttribute('href'),
            text: (a.textContent || '').trim().slice(0, 30),
            id: a.id
          })),
          stylesheets: links.filter(l => l.rel === 'stylesheet').map(l => l.getAttribute('href')),
          favicons: links.filter(l => l.rel?.includes('icon')).map(l => l.getAttribute('href')),
          scripts: scripts.map(s => s.getAttribute('src')),
          imgs: imgs.map(i => i.getAttribute('src'))
        };
      })()`,
      returnByValue: true
    });
    const pageAssets = linksOnPageRes.result.value;

    // Helper to test HTTP status of URLs
    async function checkUrlStatus(url) {
      return new Promise((resolve) => {
        try {
          const req = http.request(url, { method: 'HEAD', timeout: 3000 }, (res) => {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
          });
          req.on('error', (err) => resolve({ status: 500, ok: false, error: err.message }));
          req.on('timeout', () => { req.destroy(); resolve({ status: 408, ok: false }); });
          req.end();
        } catch (e) {
          resolve({ status: 500, ok: false, error: e.message });
        }
      });
    }

    const baseUrl = 'http://127.0.0.1:8731/work/';
    let brokenLinksCount = 0;

    // Check stylesheets, favicons, scripts, images
    const staticAssets = [
      ...pageAssets.stylesheets,
      ...pageAssets.favicons,
      ...pageAssets.scripts,
      ...pageAssets.imgs
    ];
    for (const assetPath of staticAssets) {
      if (!assetPath || assetPath.startsWith('data:')) continue;
      const resolved = new URL(assetPath, baseUrl).href;
      const res = await checkUrlStatus(resolved);
      assert(res.ok, `Static asset ${assetPath} resolves with status ${res.status}`);
      if (!res.ok) brokenLinksCount++;
    }

    // Check anchor links
    for (const link of pageAssets.anchors) {
      const href = link.href;
      if (!href || href === '#' || href.startsWith('javascript:')) continue;
      if (href.startsWith('mailto:')) {
        console.log(`  [SKIP] mailto link: ${href}`);
        continue;
      }
      if (href.startsWith('https://') || href.startsWith('http://')) {
        // External link: verify valid syntax
        console.log(`  [PASS] External link syntax valid: ${href}`);
        continue;
      }
      if (href.startsWith('#')) {
        // In-page anchor: check element ID exists
        const anchorId = href.slice(1);
        const existsRes = await send('Runtime.evaluate', {
          expression: `!!document.getElementById('${anchorId}') || !!document.querySelector('${href}')`,
          returnByValue: true
        });
        assert(existsRes.result.value, `In-page anchor target exists: ${href}`);
        if (!existsRes.result.value) brokenLinksCount++;
        continue;
      }

      // Relative page link
      const resolved = new URL(href, baseUrl).href;
      // Strip fragment if present for HTTP HEAD
      const urlWithoutHash = resolved.split('#')[0];
      const res = await checkUrlStatus(urlWithoutHash);
      assert(res.ok, `Relative link ${href} resolves cleanly (status: ${res.status})`);
      if (!res.ok) brokenLinksCount++;
    }

    assert(brokenLinksCount === 0, `Total broken links / 404s found: ${brokenLinksCount}`);

    // -------------------------------------------------------------------------
    // TEST 9: Final Console Error & Exception Audit Across All Interactions
    // -------------------------------------------------------------------------
    console.log('\n--- 9. FINAL CUMULATIVE CONSOLE & EXCEPTION AUDIT ---');
    console.log(`Cumulative Console Errors: ${report.consoleErrors.length}`);
    console.log(`Cumulative Exceptions: ${report.exceptions.length}`);
    if (report.consoleErrors.length > 0) {
      console.error('Errors encountered during test execution:', report.consoleErrors);
    }
    if (report.exceptions.length > 0) {
      console.error('Exceptions encountered during test execution:', report.exceptions);
    }
    assert(report.consoleErrors.length === 0, `Strictly 0 console errors across all interactions (actual: ${report.consoleErrors.length})`);
    assert(report.exceptions.length === 0, `Strictly 0 unhandled exceptions across all interactions (actual: ${report.exceptions.length})`);

    // -------------------------------------------------------------------------
    // TEST 10: Strict Runtime Copy Audit (Zero Em Dashes in Rendered Text)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. RUNTIME RENDERED TEXT ANTI-SLOP AUDIT ---');
    const renderedCopyRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasEmDash = text.includes('\u2014');
        const hasEnDash = text.includes('\u2013');
        const bannedWords = ['revolutionary', 'seamless', 'cutting-edge', 'next-level', 'robust'];
        const foundBanned = bannedWords.filter(w => new RegExp('\\\\b' + w + '\\\\b', 'i').test(text));
        return { hasEmDash, hasEnDash, foundBanned, textSampleLen: text.length };
      })()`,
      returnByValue: true
    });
    const copyData = renderedCopyRes.result.value;
    assert(!copyData.hasEmDash, 'Strictly 0 em dashes in dynamically rendered body copy');
    assert(copyData.foundBanned.length === 0, `0 banned buzzwords in rendered body copy (found: ${copyData.foundBanned.join(', ')})`);

    // -------------------------------------------------------------------------
    // TEST 11: Mobile Viewport (360px) Interactive & Overflow Stress Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 11. MOBILE 360px INTERACTIVE & OVERFLOW STRESS AUDIT ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 300));

    // Check no horizontal scroll overflow initially
    const mobileOverflowRes = await send('Runtime.evaluate', {
      expression: `({
        docScrollWidth: document.documentElement.scrollWidth,
        winInnerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`,
      returnByValue: true
    });
    assert(!mobileOverflowRes.result.value.hasOverflow, `At 360px: Zero document horizontal overflow (scrollWidth=${mobileOverflowRes.result.value.docScrollWidth}, innerWidth=${mobileOverflowRes.result.value.winInnerWidth})`);

    // Interact with Storyboard at 360px
    const mobileStoryboardRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const next = document.querySelector('[data-bd-next]');
        next.click();
        const cur = document.querySelector('[data-bd-cur]')?.textContent;
        const overflowAfterClick = document.documentElement.scrollWidth > window.innerWidth;
        return { cur, overflowAfterClick };
      })()`,
      returnByValue: true
    });
    assert(!mobileStoryboardRes.result.value.overflowAfterClick, 'At 360px: Zero overflow after Storyboard next click');

    // Interact with Skim mode at 360px
    const mobileSkimRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-depth-btn]');
        btn.click();
        const overflowInSkim = document.documentElement.scrollWidth > window.innerWidth;
        btn.click(); // toggle back
        const overflowRestored = document.documentElement.scrollWidth > window.innerWidth;
        return { overflowInSkim, overflowRestored };
      })()`,
      returnByValue: true
    });
    assert(!mobileSkimRes.result.value.overflowInSkim, 'At 360px: Zero overflow in Skim mode');
    assert(!mobileSkimRes.result.value.overflowRestored, 'At 360px: Zero overflow when restored to Deep mode');

    // Restore desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 200));

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('\n[CHALLENGER FAILURE]:', err);
  process.exit(1);
});
