// Adversarial Verification: Touch Targets, Viewport Overflows & Anti-Hiding
// Challenger: challenger_m6_2_r2
// Target: http://127.0.0.1:8731/decisions/index.html

import { spawn, execSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PORTFOLIO_ROOT = '/Users/70572/Documents/Qoder/2026-10-05/17ddef50/portfolio';
const TARGET_URL = 'http://127.0.0.1:8731/decisions/index.html';
const CDP_PORT = 9260;

const VIEWPORTS = [320, 360, 375, 768, 1024, 1440];

async function run() {
  console.log('================================================================');
  console.log('  CHALLENGER M6-2-R2: TOUCH TARGETS, OVERFLOW & ANTI-HIDING     ');
  console.log('================================================================\n');

  const suiteResults = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(cond, msg, details = null) {
    suiteResults.total++;
    if (!cond) {
      suiteResults.failed++;
      suiteResults.failures.push({ msg, details });
      console.error(`  [FAIL] ${msg}`);
      if (details) console.error('         Details:', JSON.stringify(details));
      throw new Error(`Assertion Failed: ${msg}`);
    } else {
      suiteResults.passed++;
      console.log(`  [PASS] ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Copy Integrity (Zero Em Dashes across all tracked files)
  // ---------------------------------------------------------------------------
  console.log('--- TEST STEP 1: Copy Integrity & Zero Em Dashes ---');
  try {
    const copyOut = execSync('node scripts/assert-copy.mjs --strict', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(copyOut.includes('dash-as-connector: 0 {}'), 'assert-copy.mjs reports 0 connector dashes across repository');
  } catch (err) {
    assert(false, `assert-copy.mjs failed: ${err.message}`);
  }

  const decHtml = readFileSync(join(PORTFOLIO_ROOT, 'decisions/index.html'), 'utf8');
  const emDashRegex = /—|&mdash;|&#8212;|\u2014|\s--\s|\s–\s/;
  const foundEmDash = decHtml.match(emDashRegex);
  assert(!foundEmDash, `Zero em dashes or spaced hyphens in decisions/index.html (found: ${foundEmDash})`);

  // ---------------------------------------------------------------------------
  // STEP 2: Anti-Hiding Verification (check-visible.mjs)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST STEP 2: Anti-Hiding Verification (check-visible.mjs) ---');
  try {
    const visOut = execSync('node scripts/check-visible.mjs', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(visOut.includes('ok: no card is shipped hidden'), 'check-visible.mjs confirms zero cards ship hidden across all pages');
  } catch (err) {
    assert(false, `check-visible.mjs failed: ${err.message}`);
  }

  // Check decisions/index.html directly for any card carrying hidden
  const cardHiddenMatches = [...decHtml.matchAll(/<article\s+class="[^"]*dec-card[^"]*"([^>]*)>/g)];
  assert(cardHiddenMatches.length === 11, `Found exactly 11 ADR cards in decisions/index.html (found ${cardHiddenMatches.length})`);
  for (const m of cardHiddenMatches) {
    const attrs = m[1];
    assert(!/\bhidden\b/.test(attrs), `ADR card tag does NOT carry 'hidden' attribute: ${m[0]}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: E2E Test Suite Run (python3 scripts/e2e-test-suite.py)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST STEP 3: Full Project E2E Test Suite ---');
  try {
    const e2eOut = execSync('python3 scripts/e2e-test-suite.py 2>&1', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(e2eOut.includes('OK'), 'python3 scripts/e2e-test-suite.py passed with OK');
    assert(e2eOut.includes('Passed: 313'), 'e2e-test-suite.py passed 313/313 tests');
  } catch (err) {
    assert(false, `python3 scripts/e2e-test-suite.py failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Chrome Headless CDP Runtime Stress Testing
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST STEP 4: Chrome CDP Runtime Stress Testing ---');

  const userDataDir = `/tmp/chrome-test-m6-2-r2-${Date.now()}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  let ws;
  try {
    let connected = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) { connected = true; break; }
      } catch (e) {}
    }
    assert(connected, `Chrome remote debugging listening on port ${CDP_PORT}`);

    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), 10000);
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    const consoleErrors = [];
    const exceptions = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.text);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for load
    await new Promise(r => setTimeout(r, 1200));
    assert(consoleErrors.length === 0, `0 console errors on initial load (found ${consoleErrors.length})`, consoleErrors);
    assert(exceptions.length === 0, `0 unhandled exceptions on initial load (found ${exceptions.length})`, exceptions);

    // -------------------------------------------------------------------------
    // 4.1 Extreme Viewport Horizontal Overflow Sweep
    // -------------------------------------------------------------------------
    console.log('\n--- 4.1 Viewport Horizontal Overflow Sweep (320, 360, 375, 768, 1024, 1440px) ---');
    for (const vpWidth of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vpWidth,
        height: 900,
        deviceScaleFactor: 1,
        mobile: vpWidth < 768
      });
      await new Promise(r => setTimeout(r, 200));

      const ovResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const bodyW = document.body.scrollWidth;
          const maxScroll = Math.max(scrollW, bodyW);
          const leaking = [];
          document.querySelectorAll('*').forEach(el => {
            const cs = window.getComputedStyle(el);
            if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
            // Also ignore elements inside a fixed container
            if (el.closest('.nav-drawer')) return;

            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > docW + 1) {
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
            overflowDelta: maxScroll - docW,
            leakingCount: leaking.length,
            leakingSample: leaking.slice(0, 5)
          };
        })()`,
        returnByValue: true
      });

      const res = ovResult.result.value;
      assert(
        res.maxScroll <= res.docW,
        `Viewport ${vpWidth}px: maxScroll (${res.maxScroll}px) <= clientWidth (${res.docW}px) (0px horizontal scroll overflow)`,
        res
      );
      assert(
        res.leakingCount === 0,
        `Viewport ${vpWidth}px: zero in-flow DOM elements leak outside right edge (leaking: ${res.leakingCount})`,
        res.leakingSample
      );
    }

    // -------------------------------------------------------------------------
    // 4.2 Comprehensive Touch Target Measurements (>= 44x44px for ALL controls)
    // -------------------------------------------------------------------------
    console.log('\n--- 4.2 Touch Target Measurements Across Viewports ---');
    // Test viewports covering mobile, tablet, and desktop
    const touchViewports = [320, 360, 375, 768, 1024, 1440];
    for (const vpWidth of touchViewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vpWidth,
        height: 900,
        deviceScaleFactor: 1,
        mobile: vpWidth < 768
      });
      await new Promise(r => setTimeout(r, 200));

      const ttResult = await send('Runtime.evaluate', {
        expression: `(() => {
          // Select all interactive element candidates
          const candidates = Array.from(document.querySelectorAll(
            'a[href], button, select, input, [role="button"], .jump-pill, .dec-fold, .tool-btn, .btn, .skip-link, .back-to-top, .drawer-close, .drawer-link'
          ));

          const audited = [];
          for (const el of candidates) {
            const cs = window.getComputedStyle(el);
            // Skip non-rendered / hidden elements
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) {
              continue;
            }
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;

            // Exemption check for inline text links within sentences/paragraphs per WCAG 2.5.5 / 2.5.8
            const isInline = el.tagName === 'A' && el.closest('p, .care-note, .ds-lead, .lead, dd');

            const width = Math.round(r.width * 10) / 10;
            const height = Math.round(r.height * 10) / 10;
            const text = (el.textContent || el.getAttribute('aria-label') || el.className).trim().replace(/\\s+/g, ' ').slice(0, 35);
            
            // Strict 44x44 target evaluation (with 0.5px subpixel tolerance)
            const passes = (width >= 43.5 && height >= 43.5);

            audited.push({
              tag: el.tagName,
              cls: (el.className || '').toString(),
              id: el.id,
              text,
              w: width,
              h: height,
              isInline: Boolean(isInline),
              passes
            });
          }

          const standalone = audited.filter(a => !a.isInline);
          const failed = standalone.filter(a => !a.passes);

          return {
            vpWidth: ${vpWidth},
            totalInteractive: audited.length,
            standaloneCount: standalone.length,
            failedCount: failed.length,
            failures: failed,
            standaloneSample: standalone.slice(0, 10)
          };
        })()`,
        returnByValue: true
      });

      const tt = ttResult.result.value;
      assert(
        tt.failedCount === 0,
        `Viewport ${vpWidth}px: 100% of standalone interactive controls (found ${tt.standaloneCount}) measure >= 44x44px`,
        tt.failures
      );
    }

    // -------------------------------------------------------------------------
    // 4.3 Mobile Drawer Touch Targets (when opened)
    // -------------------------------------------------------------------------
    console.log('\n--- 4.3 Mobile Drawer Touch Targets (Open State) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 200));

    // Open drawer
    await send('Runtime.evaluate', {
      expression: `(() => {
        const toggle = document.getElementById('nav-toggle');
        if (toggle) toggle.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 400));

    const drawerAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const drawer = document.getElementById('nav-drawer');
        const items = Array.from(drawer.querySelectorAll('button, a[href]'));
        const measured = [];
        for (const el of items) {
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          const w = Math.round(r.width * 10) / 10;
          const h = Math.round(r.height * 10) / 10;
          const passes = (w >= 43.5 && h >= 43.5);
          measured.push({
            id: el.id,
            cls: el.className,
            text: el.textContent.trim().slice(0, 30),
            w,
            h,
            passes
          });
        }
        const fails = measured.filter(m => !m.passes);
        return {
          total: measured.length,
          failsCount: fails.length,
          fails,
          measured
        };
      })()`,
      returnByValue: true
    });

    const da = drawerAudit.result.value;
    assert(da.total > 0, `Mobile drawer interactive elements found (count: ${da.total})`);
    assert(
      da.failsCount === 0,
      `100% of mobile drawer controls measure >= 44x44px (passed ${da.total - da.failsCount}/${da.total})`,
      da.fails
    );

    // Close drawer via Escape key
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await new Promise(r => setTimeout(r, 300));

    // -------------------------------------------------------------------------
    // 4.4 Scroll Clearance & Margin Assertions (81px scroll-margin-top)
    // -------------------------------------------------------------------------
    console.log('\n--- 4.4 Anchor Links & Jump Clearance Verification ---');
    const scrollTargets = [
      'system-topology',
      'production-operations',
      'shaped',
      'production',
      'adr-01',
      'adr-02',
      'adr-03',
      'adr-04',
      'adr-05',
      'adr-06',
      'adr-07',
      'adr-08',
      'adr-09',
      'adr-10',
      'adr-11'
    ];

    for (const targetId of scrollTargets) {
      const clearanceResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.getElementById("${targetId}");
          if (!el) return { found: false };
          const cs = window.getComputedStyle(el);
          return {
            found: true,
            scrollMarginTop: cs.scrollMarginTop,
            numericMargin: parseFloat(cs.scrollMarginTop) || 0
          };
        })()`,
        returnByValue: true
      });

      const cr = clearanceResult.result.value;
      assert(cr.found, `Anchor target #${targetId} exists in the DOM`);
      assert(
        cr.numericMargin >= 80,
        `Element #${targetId} scroll-margin-top is >= 80px (actual: ${cr.scrollMarginTop})`,
        cr
      );
    }

    // 4.5 Functional Jump Scroll Clearance Test
    // Emulate clicking jump pill to #system-topology and #production-operations, then verify target top clearance
    for (const jumpTarget of ['system-topology', 'production-operations', 'adr-05', 'adr-10']) {
      const scrollCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const target = document.getElementById("${jumpTarget}");
          target.scrollIntoView();
          const header = document.querySelector('.site-header');
          const headerRect = header.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          
          return {
            headerBottom: headerRect.bottom,
            targetTop: targetRect.top,
            clearance: targetRect.top - headerRect.bottom
          };
        })()`,
        returnByValue: true
      });

      const sc = scrollCheck.result.value;
      // clearance >= 0 means the target is not obscured beneath the fixed header
      assert(
        sc.targetTop >= sc.headerBottom - 1,
        `Jump to #${jumpTarget}: targetTop (${Math.round(sc.targetTop)}px) is below headerBottom (${Math.round(sc.headerBottom)}px) with >= 0px clearance (clearance: ${Math.round(sc.clearance)}px)`,
        sc
      );
    }

    // 4.6 Interactive Click Event Dispatch on Jump Pills (Wait for smooth scroll animation)
    const pill1Res = await send('Runtime.evaluate', {
      expression: `(async () => {
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 100));
        const pill1 = document.querySelector('a[href="#system-topology"].jump-pill');
        if (!pill1) return { error: 'pill1 not found' };
        pill1.click();
        await new Promise(r => setTimeout(r, 800));
        return { y: window.scrollY };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const p1 = pill1Res.result.value;
    assert(!p1.error, 'Jump pill 1 exists');
    assert(p1.y > 300, `Clicking #system-topology jump pill scrolled down to section (scrollY: ${Math.round(p1.y)}px)`);

    const pill2Res = await send('Runtime.evaluate', {
      expression: `(async () => {
        const pill2 = document.querySelector('a[href="#production-operations"].jump-pill');
        if (!pill2) return { error: 'pill2 not found' };
        pill2.click();
        await new Promise(r => setTimeout(r, 800));
        return { y: window.scrollY };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const p2 = pill2Res.result.value;
    assert(!p2.error, 'Jump pill 2 exists');
    assert(p2.y > p1.y, `Clicking #production-operations jump pill scrolled further down (scrollY: ${Math.round(p2.y)}px > ${Math.round(p1.y)}px)`);

    console.log('\n================================================================');
    console.log(`  ALL CHALLENGE TESTS COMPLETED: ${suiteResults.passed} PASSED / ${suiteResults.total} TOTAL`);
    console.log('================================================================\n');

  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }

  if (suiteResults.failed > 0) {
    console.error(`FAILURE COUNT: ${suiteResults.failed}`);
    process.exit(1);
  } else {
    console.log('CHALLENGER VERDICT: 100% EMPIRICAL VERIFICATION PASSED.');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
