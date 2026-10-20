// Empirical M7 Challenger Adversarial Test Suite
// Rigorous verification across 9 viewports, 100% touch targets, mobile drawer a11y,
// focus trap cycling, escape dismissal, backdrop scrim dismissal, inert background,
// copy integrity, and complete acceptance criteria across all 5 canonical pages.

import { spawn } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const PORTFOLIO_ROOT = '/Users/70572/Documents/Qoder/2026-10-05/17ddef50/portfolio';
const BASE_URL = 'http://127.0.0.1:8731';
const CDP_PORT = 9288;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CANONICAL_PAGES = [
  { path: '/', name: 'Executive Overview', file: 'index.html' },
  { path: '/work/', name: 'Case Studies & Threat Model', file: 'work/index.html' },
  { path: '/diagrams/', name: 'Interactive Architecture Studio', file: 'diagrams/index.html' },
  { path: '/pipelines/', name: 'Dual-Engine Trace Console', file: 'pipelines/index.html' },
  { path: '/decisions/', name: 'Architecture Decisions (ADRs)', file: 'decisions/index.html' }
];

// All 9 viewports required by dispatch
const VIEWPORTS = [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runChallengerSuite() {
  console.log('========================================================================');
  console.log('  CHALLENGER M7 EMPIRICAL ADVERSARIAL TEST SUITE                        ');
  console.log('  Scope: Viewports (9), Touch Targets (100%), Drawer A11y, Scrim, Inert ');
  console.log('  Target: Local Server at http://127.0.0.1:8731/                        ');
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

  // =========================================================================
  // PHASE 1: Static Copy Integrity & E2E Verification
  // =========================================================================
  console.log('--- PHASE 1: COPY INTEGRITY & E2E TEST SUITE RUNS ---');

  // 1.1 assert-copy --strict
  try {
    const copyOut = execSync('node scripts/assert-copy.mjs --strict', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(copyOut.includes('dash-as-connector: 0'), 'Copy check: 0 em dashes across 88 files (node scripts/assert-copy.mjs --strict)');
  } catch (err) {
    assert(false, `Copy check failed: ${err.message}`);
  }

  // 1.2 check-visible
  try {
    const visOut = execSync('node scripts/check-visible.mjs', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(visOut.includes('no card is shipped hidden'), 'Visibility check: 0 cards shipped hidden (node scripts/check-visible.mjs)');
  } catch (err) {
    assert(false, `Visibility check failed: ${err.message}`);
  }

  // 1.3 e2e-test-suite.py
  try {
    const e2eOut = execSync('python3 scripts/e2e-test-suite.py 2>&1', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(e2eOut.includes('Passed: 313') && e2eOut.includes('Failures: 0'), 'E2E suite: 313/313 tests pass (python3 scripts/e2e-test-suite.py)');
  } catch (err) {
    assert(false, `E2E suite failed: ${err.message}`);
  }

  // =========================================================================
  // PHASE 2: Chrome Headless CDP Empirical Testing
  // =========================================================================
  console.log('\n--- PHASE 2: LAUNCH HEADLESS CHROME INSTANCE (CDP) ---');
  const userDataDir = `/tmp/chrome-m7-challenger-${Date.now()}`;
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

    // Create tab
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
        }, 15000);

        const handler = (event) => {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            if (res.error) {
              reject(new Error(`CDP Error in ${method}: ${JSON.stringify(res.error)}`));
            } else {
              resolve(res.result);
            }
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Enable domains
    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');
    await send('CSS.enable');

    const consoleErrors = [];
    const uncaughtExceptions = [];

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        uncaughtExceptions.push(msg.params.exceptionDetails.text);
      }
    });

    // Test each of the 5 canonical pages
    for (const page of CANONICAL_PAGES) {
      console.log(`\n========================================================================`);
      console.log(`  EMPIRICAL TESTING: ${page.name.toUpperCase()} (${page.path})`);
      console.log(`========================================================================`);

      consoleErrors.length = 0;
      uncaughtExceptions.length = 0;

      const fullUrl = `${BASE_URL}${page.path}`;
      await send('Page.navigate', { url: fullUrl });
      await sleep(500);

      assert(consoleErrors.length === 0, `${page.name}: Zero console errors on initial load`, consoleErrors);
      assert(uncaughtExceptions.length === 0, `${page.name}: Zero uncaught exceptions on initial load`, uncaughtExceptions);

      // -----------------------------------------------------------------------
      // 1. Extreme Viewports (9 viewports)
      // -----------------------------------------------------------------------
      console.log(`\n  --- 1. EXTREME VIEWPORTS ADVERSARIAL TESTING (9 Viewports) ---`);
      for (const vp of VIEWPORTS) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp,
          height: 800,
          deviceScaleFactor: 1,
          mobile: vp < 768
        });
        await sleep(150);

        // Check horizontal overflow
        const overflow = await send('Runtime.evaluate', {
          expression: `(() => {
            const doc = document.documentElement;
            const body = document.body;
            const clientWidth = doc.clientWidth;
            const scrollWidth = doc.scrollWidth;
            const bodyScrollWidth = body ? body.scrollWidth : 0;
            const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
            const winInner = window.innerWidth;

            // Attempt horizontal scroll
            window.scrollTo(2000, 0);
            const scrolledX = window.pageXOffset || window.scrollX || 0;
            window.scrollTo(0, 0);

            // Element boundary leak check (elements leaking outside viewport without overflow-x container)
            const all = Array.from(document.querySelectorAll('*'));
            const leakingElements = [];

            function isClippedOrScrollable(el) {
              let p = el.parentElement;
              while (p && p !== doc) {
                const s = window.getComputedStyle(p);
                if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden' ||
                    s.overflow === 'auto' || s.overflow === 'scroll' || s.overflow === 'hidden') {
                  return true;
                }
                p = p.parentElement;
              }
              return false;
            }

            for (const el of all) {
              if (el === doc || el === body || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'HEAD') continue;
              if (el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true })) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;

              // Check if right edge exceeds viewport by more than 1px without being clipped
              if (r.right > winInner + 1.0) {
                if (!isClippedOrScrollable(el)) {
                  leakingElements.push({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    right: r.right,
                    viewport: winInner,
                    overflow: r.right - winInner
                  });
                }
              }
            }

            return {
              clientWidth,
              scrollWidth,
              bodyScrollWidth,
              maxScroll,
              winInner,
              scrolledX,
              leaksCount: leakingElements.length,
              sampleLeaks: leakingElements.slice(0, 3)
            };
          })()`,
          returnByValue: true
        });

        const ov = overflow.result.value;
        const diff = ov.maxScroll - ov.clientWidth;
        assert(diff <= 0.5, `${page.name} @ ${vp}px: maxScroll (${ov.maxScroll}px) <= clientWidth (${ov.clientWidth}px) [diff=${diff}px]`, ov);
        assert(ov.scrolledX === 0, `${page.name} @ ${vp}px: Horizontal scroll offset is strictly 0px after scroll attempt (scrolledX=${ov.scrolledX})`);
        assert(ov.leaksCount === 0, `${page.name} @ ${vp}px: Zero unclipped elements leak outside viewport (leaks=${ov.leaksCount})`, ov.sampleLeaks);
      }

      // -----------------------------------------------------------------------
      // 2. Universal Touch Targets (>= 44x44px for 100% interactive controls)
      // -----------------------------------------------------------------------
      console.log(`\n  --- 2. UNIVERSAL TOUCH TARGETS VERIFICATION ---`);
      // Test at mobile (360px) and tablet (768px) and desktop (1280px)
      for (const testVp of [360, 768, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: testVp,
          height: 800,
          deviceScaleFactor: 1,
          mobile: testVp < 768
        });
        await sleep(150);

        const targetResult = await send('Runtime.evaluate', {
          expression: `(() => {
            const selector = 'button, a[href], [role="button"], [role="tab"], summary, input, select, textarea, .tb-chip, .dec-fold, .jump-pill';
            const allElements = Array.from(document.querySelectorAll(selector));

            function isVisible(el) {
              if (el.checkVisibility) {
                return el.checkVisibility({ checkVisibilityCSS: true });
              }
              const s = window.getComputedStyle(el);
              return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
            }

            // Exclude inline links inside continuous prose paragraphs (exempt per WCAG 2.5.5 / 2.5.8)
            function isInlineProseLink(el) {
              if (el.tagName !== 'A') return false;
              const parentTag = el.parentElement ? el.parentElement.tagName : '';
              if (parentTag === 'P' || parentTag === 'LI') {
                const s = window.getComputedStyle(el);
                if (s.display === 'inline' || s.display === 'inline-block') {
                  const text = el.parentElement.textContent || '';
                  if (text.length > (el.textContent || '').length + 15) {
                    return true;
                  }
                }
              }
              return false;
            }

            const measured = [];
            const failures = [];

            for (const el of allElements) {
              if (!isVisible(el)) continue;
              if (isInlineProseLink(el)) continue;

              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;

              const passes = (r.width >= 43.5 && r.height >= 43.5);
              const info = {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                text: (el.textContent || '').trim().slice(0, 30),
                width: Math.round(r.width * 10) / 10,
                height: Math.round(r.height * 10) / 10
              };

              measured.push(info);
              if (!passes) {
                failures.push(info);
              }
            }

            return {
              totalCount: measured.length,
              failedCount: failures.length,
              failures: failures.slice(0, 5)
            };
          })()`,
          returnByValue: true
        });

        const tr = targetResult.result.value;
        assert(tr.failedCount === 0, `${page.name} @ ${testVp}px: 100% of visible interactive controls (${tr.totalCount}) measure >= 44x44px (fails: ${tr.failedCount})`, tr.failures);
      }

      // -----------------------------------------------------------------------
      // 3. Mobile Navigation Drawer & Accessibility Protocol
      // -----------------------------------------------------------------------
      console.log(`\n  --- 3. MOBILE NAVIGATION DRAWER & ACCESSIBILITY AUDIT ---`);
      // Set to mobile viewport 360px
      await send('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true
      });
      await sleep(150);

      // 3.1 Modal dialog semantics
      const drawerSemantics = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          const toggle = document.getElementById('nav-toggle') || document.querySelector('[data-menu-btn]');
          const scrim = document.getElementById('nav-scrim');
          return {
            hasDrawer: Boolean(drawer),
            hasToggle: Boolean(toggle),
            hasScrim: Boolean(scrim),
            role: drawer ? drawer.getAttribute('role') : null,
            ariaModal: drawer ? drawer.getAttribute('aria-modal') : null,
            ariaLabel: drawer ? (drawer.getAttribute('aria-label') || drawer.getAttribute('aria-labelledby')) : null,
            ariaControls: toggle ? toggle.getAttribute('aria-controls') : null,
            initiallyHidden: drawer ? drawer.hasAttribute('hidden') : null,
            toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null
          };
        })()`,
        returnByValue: true
      });

      const ds = drawerSemantics.result.value;
      assert(ds.hasDrawer, `${page.name}: #nav-drawer element exists`);
      assert(ds.hasToggle, `${page.name}: #nav-toggle element exists`);
      assert(ds.hasScrim, `${page.name}: #nav-scrim backdrop scrim element exists`);
      assert(ds.role === 'dialog', `${page.name}: #nav-drawer has role="dialog"`);
      assert(ds.ariaModal === 'true', `${page.name}: #nav-drawer has aria-modal="true"`);
      assert(Boolean(ds.ariaLabel), `${page.name}: #nav-drawer has accessible label (${ds.ariaLabel})`);
      assert(ds.ariaControls === 'nav-drawer', `${page.name}: #nav-toggle has aria-controls="nav-drawer"`);
      assert(ds.initiallyHidden === true, `${page.name}: #nav-drawer initially has hidden attribute`);
      assert(ds.toggleExpanded === 'false', `${page.name}: #nav-toggle initially has aria-expanded="false"`);

      // 3.2 Open drawer via toggle click
      await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-toggle').click()`
      });
      await sleep(250);

      const openedState = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          const toggle = document.getElementById('nav-toggle');
          const main = document.getElementById('main-content') || document.querySelector('main');
          const footer = document.getElementById('site-footer') || document.querySelector('footer');
          const activeEl = document.activeElement;
          return {
            expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
            unhidden: drawer ? !drawer.hasAttribute('hidden') : null,
            isOpen: drawer ? drawer.classList.contains('is-open') : null,
            mainInert: main ? main.inert : null,
            mainAriaHidden: main ? main.getAttribute('aria-hidden') : null,
            footerInert: footer ? footer.inert : null,
            focusInside: drawer ? drawer.contains(activeEl) : null,
            activeTag: activeEl ? activeEl.tagName : null,
            activeText: activeEl ? activeEl.textContent.trim().slice(0, 20) : null
          };
        })()`,
        returnByValue: true
      });

      const os = openedState.result.value;
      assert(os.expanded === 'true', `${page.name}: #nav-toggle has aria-expanded="true" when open`);
      assert(os.unhidden === true, `${page.name}: #nav-drawer hidden attribute removed when open`);
      assert(os.isOpen === true, `${page.name}: #nav-drawer has class .is-open`);
      assert(os.mainInert === true, `${page.name}: main content marked inert=true when drawer is open`);
      assert(os.mainAriaHidden === 'true', `${page.name}: main content marked aria-hidden="true" when drawer is open`);
      assert(os.focusInside === true, `${page.name}: Focus moved into #nav-drawer upon opening (focused: <${os.activeTag}> "${os.activeText}")`);

      // 3.3 Focus trap cycling (Forward & Backward)
      const focusCycleTest = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          const focusables = Array.from(drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter(el => !el.hasAttribute('disabled') && (el.checkVisibility ? el.checkVisibility() : true));

          if (focusables.length < 2) return { error: 'Insufficient focusables in drawer', count: focusables.length };

          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          // 1. Focus the last element, simulate Tab
          last.focus();
          const lastFocused = (document.activeElement === last);

          // Dispatch Tab keydown on document
          const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
          document.dispatchEvent(tabEvent);
          const afterTabFocusFirst = (document.activeElement === first);

          // 2. Focus the first element, simulate Shift+Tab
          first.focus();
          const firstFocused = (document.activeElement === first);

          const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
          document.dispatchEvent(shiftTabEvent);
          const afterShiftTabFocusLast = (document.activeElement === last);

          return {
            focusablesCount: focusables.length,
            lastFocused,
            afterTabFocusFirst,
            firstFocused,
            afterShiftTabFocusLast
          };
        })()`,
        returnByValue: true
      });

      const fc = focusCycleTest.result.value;
      assert(fc.afterTabFocusFirst === true, `${page.name}: Focus trap forward cycling (Tab from last focusable wraps to first focusable)`);
      assert(fc.afterShiftTabFocusLast === true, `${page.name}: Focus trap backward cycling (Shift+Tab from first focusable wraps to last focusable)`);

      // 3.4 Escape key dismissal
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(250);

      const afterEscapeState = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          const toggle = document.getElementById('nav-toggle');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
            hidden: drawer ? drawer.hasAttribute('hidden') : null,
            isOpen: drawer ? drawer.classList.contains('is-open') : null,
            mainInert: main ? main.inert : null,
            focusedToggle: document.activeElement === toggle
          };
        })()`,
        returnByValue: true
      });

      const aes = afterEscapeState.result.value;
      assert(aes.expanded === 'false', `${page.name}: #nav-toggle aria-expanded="false" after Escape`);
      assert(aes.hidden === true, `${page.name}: #nav-drawer hidden attribute restored after Escape`);
      assert(aes.isOpen === false, `${page.name}: #nav-drawer .is-open class removed after Escape`);
      assert(aes.mainInert === false, `${page.name}: main content inert cleared after Escape`);
      assert(aes.focusedToggle === true, `${page.name}: Focus properly restored to #nav-toggle after Escape`);

      // 3.5 Backdrop scrim click dismissal
      // Open drawer again
      await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-toggle').click()`
      });
      await sleep(250);

      // Verify open
      const reopened = await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-drawer').classList.contains('is-open')`,
        returnByValue: true
      });
      assert(reopened.result.value === true, `${page.name}: Drawer successfully re-opened for scrim click test`);

      // Click the backdrop scrim
      await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-scrim').click()`
      });
      await sleep(250);

      const afterScrimState = await send('Runtime.evaluate', {
        expression: `(() => {
          const drawer = document.getElementById('nav-drawer');
          const toggle = document.getElementById('nav-toggle');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
            hidden: drawer ? drawer.hasAttribute('hidden') : null,
            isOpen: drawer ? drawer.classList.contains('is-open') : null,
            mainInert: main ? main.inert : null,
            focusedToggle: document.activeElement === toggle
          };
        })()`,
        returnByValue: true
      });

      const ass = afterScrimState.result.value;
      assert(ass.expanded === 'false', `${page.name}: #nav-toggle aria-expanded="false" after clicking backdrop scrim`);
      assert(ass.hidden === true, `${page.name}: #nav-drawer hidden attribute restored after clicking backdrop scrim`);
      assert(ass.isOpen === false, `${page.name}: #nav-drawer .is-open class removed after clicking backdrop scrim`);
      assert(ass.mainInert === false, `${page.name}: main content inert cleared after clicking backdrop scrim`);
      assert(ass.focusedToggle === true, `${page.name}: Focus restored to #nav-toggle after clicking backdrop scrim`);

      // Check console errors for page
      assert(consoleErrors.length === 0, `${page.name}: Zero console errors during all adversarial tests`, consoleErrors);
      assert(uncaughtExceptions.length === 0, `${page.name}: Zero uncaught exceptions during all adversarial tests`, uncaughtExceptions);
    }

    console.log('\n========================================================================');
    console.log(`  ALL 5 CANONICAL PAGES TESTED EMPIRICALLY WITH ZERO FAILURES`);
    console.log(`  Total Checks: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
    console.log('========================================================================\n');

  } finally {
    try { chrome.kill('SIGTERM'); } catch (e) {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }

  return summary;
}

runChallengerSuite().then((s) => {
  if (s.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error('\nFatal error running challenger suite:', err);
  process.exit(1);
});
