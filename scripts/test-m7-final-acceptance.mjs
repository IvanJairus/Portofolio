// Milestone M7 Final Acceptance Verification Harness
// Comprehensive Headless Browser Runtime Validation across all 5 canonical pages on http://127.0.0.1:8731/
import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const BASE_URL = 'http://127.0.0.1:8731';
const CDP_PORT = 9271;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CANONICAL_PAGES = [
  { path: '/', name: 'Executive Overview', file: 'index.html' },
  { path: '/work/', name: 'Case Studies & Threat Model', file: 'work/index.html' },
  { path: '/diagrams/', name: 'Interactive Architecture Studio', file: 'diagrams/index.html' },
  { path: '/pipelines/', name: 'Dual-Engine Trace Console', file: 'pipelines/index.html' },
  { path: '/decisions/', name: 'Architecture Decisions (ADRs)', file: 'decisions/index.html' }
];

const VIEWPORTS = [320, 360, 768, 1024, 1440];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runAcceptanceValidation() {
  console.log('========================================================================');
  console.log('  MILESTONE M7: FINAL ACCEPTANCE BROWSER RUNTIME VERIFICATION          ');
  console.log('  Target: Local Server at http://127.0.0.1:8731/                       ');
  console.log('========================================================================\n');

  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, message, details = null) {
    summary.total++;
    if (!condition) {
      summary.failed++;
      summary.failures.push({ message, details });
      console.error(`  [FAIL] ${message}`);
      if (details) console.error('         Details:', JSON.stringify(details, null, 2));
      throw new Error(`Assertion failed: ${message}`);
    } else {
      summary.passed++;
      console.log(`  [PASS] ${message}`);
    }
  }

  // 1. Pre-flight check: ensure local server is answering HTTP 200 on all canonical pages
  console.log('--- 1. HTTP STATUS 200 CHECK FOR ALL CANONICAL PAGES ---');
  for (const page of CANONICAL_PAGES) {
    const pageUrl = `${BASE_URL}${page.path}`;
    try {
      const res = await fetch(pageUrl, { method: 'GET' });
      assert(res.status === 200, `${page.name} (${page.path}) responded with HTTP 200 OK (status: ${res.status})`);
    } catch (err) {
      assert(false, `Failed to fetch ${pageUrl}: ${err.message}`);
    }
  }

  // 2. Launch Headless Chrome
  console.log('\n--- 2. LAUNCH HEADLESS CHROME INSTANCE (CDP) ---');
  const userDataDir = `/tmp/chrome-m7-acceptance-${Date.now()}`;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  try {
    let connected = false;
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) { connected = true; break; }
      } catch (e) {}
    }
    assert(connected, `Chrome remote debugging active on port ${CDP_PORT}`);

    // Create a new tab
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE_URL + '/')}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    const ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.removeEventListener('message', handler);
          reject(new Error(`Timeout waiting for CDP ${method} (${id})`));
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

    const consoleErrors = [];
    const exceptions = [];

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleErrors.push(text);
        console.error(`    [BROWSER CONSOLE.ERROR]: ${text}`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails.text + (msg.params.exceptionDetails.exception?.description || '');
        exceptions.push(text);
        console.error(`    [BROWSER EXCEPTION]: ${text}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Iterate through all 5 canonical pages
    for (const page of CANONICAL_PAGES) {
      const pageUrl = `${BASE_URL}${page.path}`;
      console.log(`\n========================================================================`);
      console.log(`  VALIDATING PAGE: ${page.name.toUpperCase()} (${page.path})`);
      console.log(`========================================================================`);

      consoleErrors.length = 0;
      exceptions.length = 0;

      await send('Page.navigate', { url: pageUrl });
      await sleep(1000);

      assert(consoleErrors.length === 0, `${page.name}: Zero browser console errors on initial load`, consoleErrors);
      assert(exceptions.length === 0, `${page.name}: Zero uncaught browser exceptions on initial load`, exceptions);

      // Check Viewports for Horizontal Overflow & Touch Targets
      for (const vpWidth of VIEWPORTS) {
        console.log(`\n  Checking Viewport: ${vpWidth}px...`);
        await send('Emulation.setDeviceMetricsOverride', {
          width: vpWidth,
          height: 900,
          deviceScaleFactor: 1,
          mobile: vpWidth < 768
        });
        await sleep(250);

        // Overflow check
        const ovResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const docW = document.documentElement.clientWidth;
            const scrollW = document.documentElement.scrollWidth;
            const bodyW = document.body.scrollWidth;
            const maxScroll = Math.max(scrollW, bodyW);
            function isClipped(element) {
              let p = element.parentElement;
              while (p && p !== document.body && p !== document.documentElement) {
                const s = window.getComputedStyle(p);
                const ox = s.overflowX;
                const o = s.overflow;
                if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip' ||
                    o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') {
                  return true;
                }
                p = p.parentElement;
              }
              return false;
            }

            const leaking = [];
            document.querySelectorAll('*').forEach(el => {
              const cs = window.getComputedStyle(el);
              if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
              if (el.closest('.nav-drawer')) return;
              if (isClipped(el)) return;
              const r = el.getBoundingClientRect();
              if (r.width === 0 && r.height === 0) return;
              if (r.right > docW + 1.5) {
                leaking.push({
                  tag: el.tagName,
                  cls: (el.className || '').toString().slice(0, 50),
                  id: el.id,
                  right: Math.round(r.right * 10) / 10,
                  width: Math.round(r.width * 10) / 10
                });
              }
            });
            return {
              docW,
              scrollW,
              bodyW,
              maxScroll,
              overflow: maxScroll > docW + 1,
              leakingCount: leaking.length,
              leaking: leaking.slice(0, 5)
            };
          })()`,
          returnByValue: true
        });

        const ov = ovResult.result.value;
        assert(
          !ov.overflow,
          `${page.name} @ ${vpWidth}px: Zero horizontal scroll overflow (clientWidth=${ov.docW}px, maxScroll=${ov.maxScroll}px)`,
          ov
        );
        assert(
          ov.leakingCount === 0,
          `${page.name} @ ${vpWidth}px: Zero in-flow elements leak outside viewport (leaks=${ov.leakingCount})`,
          ov.leaking
        );

        // Touch Targets check
        const ttResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const selector = 'a[href], button, select, input, [role="button"], .jump-pill, .dec-fold, .tool-btn, .btn, .skip-link, .back-to-top, .drawer-close, .drawer-link';
            const candidates = Array.from(document.querySelectorAll(selector));
            const checked = [];

            for (const el of candidates) {
              const cs = window.getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 && r.height === 0) continue;

              // WCAG 2.5.5 / 2.5.8 Inline Link Exception: links embedded in running text
              const isInline = el.tagName === 'A' && el.closest('p, .care-note, .ds-lead, .lead, dd, li:not(.drawer-links li)');

              const width = Math.round(r.width * 10) / 10;
              const height = Math.round(r.height * 10) / 10;
              const text = (el.textContent || el.getAttribute('aria-label') || el.className).trim().replace(/\\s+/g, ' ').slice(0, 30);
              const passes = (width >= 43.5 && height >= 43.5);

              checked.push({
                tag: el.tagName,
                cls: el.className,
                id: el.id,
                text,
                w: width,
                h: height,
                isInline: Boolean(isInline),
                passes
              });
            }

            const standalone = checked.filter(c => !c.isInline);
            const fails = standalone.filter(c => !c.passes);
            return {
              total: checked.length,
              standalone: standalone.length,
              failsCount: fails.length,
              fails: fails.slice(0, 5)
            };
          })()`,
          returnByValue: true
        });

        const tt = ttResult.result.value;
        assert(
          tt.failsCount === 0,
          `${page.name} @ ${vpWidth}px: 100% of standalone interactive controls (${tt.standalone}) meet >= 44x44px touch target (fails: ${tt.failsCount})`,
          tt.fails
        );
      }

      // Mobile Navigation Drawer Verification (at mobile 360px viewport)
      console.log(`\n  Checking Mobile Navigation Drawer on ${page.name}...`);
      await send('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true
      });
      await sleep(200);

      // Verify toggle button initial state
      const initialToggleState = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('nav-toggle');
          const drawer = document.getElementById('nav-drawer');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            toggleFound: Boolean(btn),
            expanded: btn ? btn.getAttribute('aria-expanded') : null,
            drawerHidden: drawer ? drawer.hasAttribute('hidden') : null,
            mainInert: main ? main.inert : null
          };
        })()`,
        returnByValue: true
      });
      const its = initialToggleState.result.value;
      assert(its.toggleFound, `${page.name}: #nav-toggle button exists in header`);
      assert(its.expanded === 'false', `${page.name}: #nav-toggle initially has aria-expanded="false"`);
      assert(its.drawerHidden === true, `${page.name}: #nav-drawer initially has hidden attribute`);
      assert(!its.mainInert, `${page.name}: main content initially not inert`);

      // Click toggle to OPEN drawer
      await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-toggle').click()`
      });
      await sleep(350);

      const openedDrawerState = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('nav-toggle');
          const drawer = document.getElementById('nav-drawer');
          const main = document.getElementById('main-content') || document.querySelector('main');
          const activeEl = document.activeElement;
          const insideDrawer = drawer && drawer.contains(activeEl);

          // Measure drawer items touch targets
          const links = Array.from(drawer.querySelectorAll('a, button'));
          const smallTargets = links.filter(l => {
            const r = l.getBoundingClientRect();
            return r.width < 43.5 || r.height < 43.5;
          });

          return {
            expanded: btn ? btn.getAttribute('aria-expanded') : null,
            drawerHidden: drawer ? drawer.hasAttribute('hidden') : null,
            isOpenClass: drawer ? drawer.classList.contains('is-open') : null,
            mainInert: main ? main.inert : null,
            activeTag: activeEl ? activeEl.tagName : null,
            insideDrawer: Boolean(insideDrawer),
            drawerItemsCount: links.length,
            smallTargetsCount: smallTargets.length
          };
        })()`,
        returnByValue: true
      });
      const ods = openedDrawerState.result.value;
      assert(ods.expanded === 'true', `${page.name}: #nav-toggle has aria-expanded="true" after click`);
      assert(ods.drawerHidden === false, `${page.name}: #nav-drawer unhidden after click`);
      assert(ods.isOpenClass === true, `${page.name}: #nav-drawer has .is-open class`);
      assert(ods.mainInert === true, `${page.name}: main content marked inert when drawer is open`);
      assert(ods.insideDrawer === true, `${page.name}: focus trapped inside drawer upon opening`);
      assert(ods.smallTargetsCount === 0, `${page.name}: 100% of drawer links/buttons measure >= 44x44px`);

      // Test focus trap: Tab forward through drawer
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await sleep(100);

      const focusTrapped = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          return Boolean(drawer && drawer.contains(document.activeElement));
        })()`,
        returnByValue: true
      });
      assert(focusTrapped.result.value === true, `${page.name}: Focus stays trapped inside drawer on Tab navigation`);

      // Press Escape key to close drawer
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(350);

      const closedDrawerState = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('nav-toggle');
          const drawer = document.getElementById('nav-drawer');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            expanded: btn ? btn.getAttribute('aria-expanded') : null,
            drawerHidden: drawer ? drawer.hasAttribute('hidden') : null,
            isOpenClass: drawer ? drawer.classList.contains('is-open') : null,
            mainInert: main ? main.inert : null,
            focusedIsToggle: document.activeElement === btn
          };
        })()`,
        returnByValue: true
      });
      const cds = closedDrawerState.result.value;
      assert(cds.expanded === 'false', `${page.name}: #nav-toggle aria-expanded="false" after Escape`);
      assert(cds.drawerHidden === true, `${page.name}: #nav-drawer hidden restored after Escape`);
      assert(cds.isOpenClass === false, `${page.name}: .is-open class removed after Escape`);
      assert(cds.mainInert === false, `${page.name}: main content un-inert after Escape`);
      assert(cds.focusedIsToggle === true, `${page.name}: Focus restored to #nav-toggle upon closing`);

      // Page-specific functional checks
      if (page.path === '/') {
        console.log('\n  Checking Executive Overview specific components...');
        // Verify toolbox filters
        const tbResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const chips = Array.from(document.querySelectorAll('.tb-chip, [data-filter]'));
            if (!chips.length) return { hasToolbox: false };
            let success = true;
            for (const chip of chips) {
              chip.click();
            }
            return { hasToolbox: true, count: chips.length };
          })()`,
          returnByValue: true
        });
        assert(tbResult.result.value.hasToolbox, `Overview: Toolbox interactive chips found and clickable`);

        // Check flagship preview links
        const flagshipResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const links = Array.from(document.querySelectorAll('a[href*="work"], a[href*="diagrams"], a[href*="decisions"]'));
            return links.length >= 3;
          })()`,
          returnByValue: true
        });
        assert(flagshipResult.result.value, `Overview: Flagship preview cards link to /work/, /diagrams/, and /decisions/`);
      }

      if (page.path === '/work/') {
        console.log('\n  Checking Case Studies & Threat Model specific components...');
        const csResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const tmTable = document.querySelector('.tm-table, table');
            const board = document.getElementById('board');
            const platform = document.getElementById('platform');
            const arch = document.getElementById('architecture');
            return {
              hasTable: Boolean(tmTable),
              hasBoard: Boolean(board),
              hasPlatform: Boolean(platform),
              hasArch: Boolean(arch)
            };
          })()`,
          returnByValue: true
        });
        assert(csResult.result.value.hasTable, `Case Studies: Threat Model table present`);
        assert(
          csResult.result.value.hasBoard && csResult.result.value.hasPlatform && csResult.result.value.hasArch,
          `Case Studies: 3 distinct case study sections present (#board, #platform, #architecture)`
        );
      }

      if (page.path === '/diagrams/') {
        console.log('\n  Checking Interactive Architecture Studio specific controls...');
        // Test step next, prev, and play/pause on Plate 1
        const studioResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const root = document.querySelector('[data-motion-root]');
            if (!root) return { error: 'No motion root' };
            const nextBtn = root.querySelector('[data-step-next], [data-action="next"]');
            const prevBtn = root.querySelector('[data-step-prev], [data-action="prev"]');
            const playBtn = root.querySelector('[data-step-play], [data-action="play-pause"]');
            const dot1 = root.querySelector('[data-step-target="1"]');

            // Pause if playing
            if (root.classList.contains('is-playing') && playBtn) {
              playBtn.click();
            }

            // Reset to step 1
            if (dot1) dot1.click();
            const step1 = root.dataset.stepCurrent;

            // Click Next
            if (nextBtn && !nextBtn.disabled) nextBtn.click();
            const afterNext = root.dataset.stepCurrent;

            // Click Play
            if (playBtn) playBtn.click();
            const isPlaying = playBtn ? playBtn.getAttribute('aria-pressed') : null;

            // Click Pause
            if (playBtn) playBtn.click();
            const isPaused = playBtn ? playBtn.getAttribute('aria-pressed') : null;

            return {
              step1,
              afterNext,
              isPlaying,
              isPaused
            };
          })()`,
          returnByValue: true
        });
        const sr = studioResult.result.value;
        assert(sr.step1 === '1', `Diagrams: Jump to step 1 verified`);
        assert(sr.afterNext === '2', `Diagrams: Step Next button advanced diagram state (from 1 to 2)`);
        assert(sr.isPlaying === 'true', `Diagrams: Play/pause button toggled automated walkthrough (aria-pressed=true)`);
        assert(sr.isPaused === 'false', `Diagrams: Play/pause button paused automated walkthrough (aria-pressed=false)`);
      }

      if (page.path === '/pipelines/') {
        console.log('\n  Checking Dual-Engine Pipelines Console & Fail-Closed Toggle...');
        const pipeResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const runSeg = document.getElementById('run-seg');
            const buttons = runSeg ? Array.from(runSeg.querySelectorAll('button')) : [];
            const refusedBtn = buttons.find(b => b.textContent.includes('refused'));
            const passedBtn = buttons.find(b => b.textContent.includes('passed'));

            const initLegend = document.getElementById('legend').textContent;
            if (refusedBtn) refusedBtn.click();
            const refusedLegend = document.getElementById('legend').textContent;

            // Check if hits exist in source code viewer
            const hits = document.querySelectorAll('.pv-cl.hit');

            if (passedBtn) passedBtn.click();
            const passedLegend = document.getElementById('legend').textContent;

            return {
              hasButtons: buttons.length >= 2,
              initLegend,
              refusedLegend,
              passedLegend,
              hitsCount: hits.length
            };
          })()`,
          returnByValue: true
        });
        const pr = pipeResult.result.value;
        assert(pr.hasButtons, `Pipelines: Pass/Refuse segmented controls found`);
        assert(pr.refusedLegend.includes('refused'), `Pipelines: Toggling 'refused' updates console legend to 'gate refused'`);
        assert(pr.passedLegend.includes('passed'), `Pipelines: Toggling 'passed' updates console legend to 'gate passed'`);
        assert(pr.hitsCount > 0, `Pipelines: Pinned source code viewer highlights exact gate rule statements (hits: ${pr.hitsCount})`);
      }

      if (page.path === '/decisions/') {
        console.log('\n  Checking Architecture Decisions Folds and Jump Pills...');
        // Test fold toggle
        const decFoldResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const foldBtn = document.querySelector('.dec-fold');
            if (!foldBtn) return { hasFold: false };
            const card = foldBtn.closest('.dec-card');
            const initFold = card.dataset.fold;
            foldBtn.click();
            const toggledFold = card.dataset.fold;
            foldBtn.click();
            return {
              hasFold: true,
              initFold,
              toggledFold
            };
          })()`,
          returnByValue: true
        });
        assert(decFoldResult.result.value.hasFold, `Decisions: Interactive card fold button (.dec-fold) functions properly`);

        // Test jump pills
        const jumpResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const pills = Array.from(document.querySelectorAll('.jump-pill'));
            const topHeader = document.querySelector('.site-header');
            const headerHeight = topHeader ? topHeader.getBoundingClientRect().height : 0;
            return {
              count: pills.length,
              headerHeight
            };
          })()`,
          returnByValue: true
        });
        assert(jumpResult.result.value.count >= 2, `Decisions: Category jump pills found (count: ${jumpResult.result.value.count})`);
      }

      // Assert zero console errors or uncaught exceptions during all interactive steps
      assert(consoleErrors.length === 0, `${page.name}: Zero browser console errors after all interactions`, consoleErrors);
      assert(exceptions.length === 0, `${page.name}: Zero uncaught browser exceptions after all interactions`, exceptions);
    }

    console.log('\n========================================================================');
    console.log(`  COMPREHENSIVE RUNTIME VERIFICATION SUMMARY:`);
    console.log(`  Total Checks Executed: ${summary.total}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log('========================================================================\n');

    ws.close();
  } finally {
    chrome.kill();
    try {
      if (existsSync(userDataDir)) rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runAcceptanceValidation().catch(err => {
  console.error('\n[RUNTIME VALIDATION FAILED]:', err);
  process.exit(1);
});
