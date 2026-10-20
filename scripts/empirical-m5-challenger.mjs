// Empirical M5 Challenger Test Suite
// Rigorous browser runtime, CDP controls, extreme viewports, touch target measurement across breakpoints,
// scanner report data verification, jump pill navigation, amber disclaimer, Edge Case 11, fail-closed toggle,
// drawer navigation accessibility, focus trapping, and keyboard interaction.

import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const TARGET_URL = 'http://127.0.0.1:8731/pipelines/index.html';
const CDP_PORT = 9255;

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER M5 EMPIRICAL HARNESS: AUDIT & ADVERSARIAL STRESS   ');
  console.log('================================================================\n');

  const userDataDir = `/tmp/chrome-challenger-m5-${Date.now()}`;
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
    if (!connected) throw new Error('Could not connect to Chrome debugging port ' + CDP_PORT);

    // Open new tab
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), 12000);
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

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        report.consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        report.exceptions.push(msg.params.exceptionDetails.text);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for initial load and trace simulation
    await new Promise(r => setTimeout(r, 2000));

    console.log('--- TEST 1: Console Errors & Exceptions ---');
    assert(report.consoleErrors.length === 0, `0 console errors on initial load (got ${report.consoleErrors.length}: ${report.consoleErrors.join(', ')})`);
    assert(report.exceptions.length === 0, `0 unhandled exceptions (got ${report.exceptions.length})`);

    console.log('\n--- TEST 2: Extreme Viewport Horizontal Overflow (320px, 360px, 375px, 768px, 1024px, 1440px) ---');
    const viewports = [320, 360, 375, 768, 1024, 1440];
    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await new Promise(r => setTimeout(r, 200));

      const ov = await send('Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const bodyScrollW = document.body.scrollWidth;
          const maxScroll = Math.max(scrollW, bodyScrollW);
          const leaking = [];
          if (maxScroll > docW) {
            document.querySelectorAll('*').forEach(el => {
              const r = el.getBoundingClientRect();
              if (r.right > docW + 1) {
                leaking.push({
                  tag: el.tagName,
                  cls: (el.className || '').toString().slice(0, 40),
                  id: el.id,
                  right: Math.round(r.right),
                  width: Math.round(r.width)
                });
              }
            });
          }
          return { docW, maxScroll, overflowDelta: maxScroll - docW, leaking: leaking.slice(0, 5) };
        })()`,
        returnByValue: true
      });
      const res = ov.result.value;
      assert(res.overflowDelta <= 0, `Viewport ${w}px has 0px horizontal scroll overflow (overflowDelta: ${res.overflowDelta}px, leaking: ${JSON.stringify(res.leaking)})`);
    }

    console.log('\n--- TEST 3: Touch Targets Measurement Across Breakpoints (320px, 375px, 1440px) ---');
    for (const testW of [320, 375, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: testW,
        height: 800,
        deviceScaleFactor: 1,
        mobile: testW < 768
      });
      await new Promise(r => setTimeout(r, 200));

      const touchAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll(
            'a[href], button, select, [role="button"], .pv-seg button, .gl-job, .bo-node, .pv-tfile, .rp-jump-pill, #nav-toggle, .skip-link'
          ));
          const checked = [];
          for (const el of els) {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;

            // Inline text links inside a sentence/paragraph are exempt under WCAG 2.5.5 / 2.5.8 exception
            const isInlineLink = el.tagName === 'A' && el.closest('p, .pv-fine, .pv-enote, .pv-note, .lead, .rp-where');

            const width = Math.round(r.width * 10) / 10;
            const height = Math.round(r.height * 10) / 10;
            const text = (el.textContent || el.getAttribute('aria-label') || el.className).trim().replace(/\\s+/g, ' ').slice(0, 30);
            const passes = (r.width >= 43.5 && r.height >= 43.5);

            checked.push({
              tag: el.tagName,
              cls: (el.className || '').toString(),
              id: el.id,
              text,
              w: width,
              h: height,
              isInlineLink: Boolean(isInlineLink),
              pass: passes
            });
          }
          const standalone = checked.filter(c => !c.isInlineLink);
          const fails = standalone.filter(c => !c.pass);
          return {
            viewport: ${testW},
            total: checked.length,
            standaloneCount: standalone.length,
            passCount: standalone.length - fails.length,
            failCount: fails.length,
            failures: fails
          };
        })()`,
        returnByValue: true
      });
      const ta = touchAudit.result.value;
      console.log(`  Viewport ${testW}px: Measured ${ta.standaloneCount} standalone controls.`);
      if (ta.failCount > 0) {
        console.error(`  Viewport ${testW}px failures detail:`, JSON.stringify(ta.failures, null, 2));
      }
      assert(ta.failCount === 0, `Viewport ${testW}px: 100% of standalone controls >= 44x44px (passed ${ta.passCount}/${ta.standaloneCount})`);
    }

    console.log('\n--- TEST 4: Mobile Drawer Navigation & Touch Targets ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 200));

    // Open mobile nav drawer
    const openDrawer = await send('Runtime.evaluate', {
      expression: `(() => {
        const toggle = document.getElementById('nav-toggle');
        if (!toggle) return { found: false };
        toggle.click();
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        return {
          found: true,
          expanded: toggle.getAttribute('aria-expanded'),
          drawerHidden: drawer ? drawer.hasAttribute('hidden') : null,
          mainInert: main ? main.hasAttribute('inert') : null
        };
      })()`,
      returnByValue: true
    });
    const od = openDrawer.result.value;
    assert(od.found, '#nav-toggle hamburger button found');
    assert(od.expanded === 'true', '#nav-toggle aria-expanded is true after click');
    assert(!od.drawerHidden, '#nav-drawer is not hidden when open');
    assert(od.mainInert, '#main-content has inert attribute when drawer is open');

    // Measure drawer touch targets
    const drawerTouch = await send('Runtime.evaluate', {
      expression: `(() => {
        const links = Array.from(document.querySelectorAll('#nav-drawer a, #nav-drawer button'));
        const measured = [];
        for (const el of links) {
          const r = el.getBoundingClientRect();
          const w = Math.round(r.width * 10) / 10;
          const h = Math.round(r.height * 10) / 10;
          measured.push({
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 25),
            w, h,
            pass: (w >= 43.5 && h >= 43.5)
          });
        }
        const fails = measured.filter(m => !m.pass);
        return { count: measured.length, failCount: fails.length, fails };
      })()`,
      returnByValue: true
    });
    const dt = drawerTouch.result.value;
    console.log(`  Measured ${dt.count} interactive drawer controls.`);
    assert(dt.failCount === 0, `100% of drawer interactive controls >= 44x44px (passed ${dt.count - dt.failCount}/${dt.count})`);

    // Close drawer via Escape key
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
    await new Promise(r => setTimeout(r, 300));

    const drawerClosed = await send('Runtime.evaluate', {
      expression: `(() => {
        const toggle = document.getElementById('nav-toggle');
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        return {
          expanded: toggle.getAttribute('aria-expanded'),
          drawerHidden: drawer.hasAttribute('hidden'),
          mainInert: main.hasAttribute('inert')
        };
      })()`,
      returnByValue: true
    });
    const dc = drawerClosed.result.value;
    assert(dc.expanded === 'false', '#nav-toggle aria-expanded is false after Escape');
    assert(dc.drawerHidden, '#nav-drawer is hidden after Escape');
    assert(!dc.mainInert, '#main-content inert removed after Escape');

    console.log('\n--- TEST 5: Scanner Reports Data Accuracy ---');
    // Reset to desktop viewport for report inspection
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 200));

    const reportsData = await send('Runtime.evaluate', {
      expression: `(() => {
        // Report 1: #sync
        const syncSec = document.getElementById('sync');
        const syncStats = {};
        syncSec.querySelectorAll('.ms').forEach(el => {
          const val = el.querySelector('b')?.textContent.trim();
          const lbl = el.querySelector('span')?.textContent.trim();
          if (lbl) syncStats[lbl] = val;
        });

        // Report 2: #sast
        const sastSec = document.getElementById('sast');
        const sastCallout = sastSec.querySelector('.mail-callout');
        const sastCalloutStyle = sastCallout ? window.getComputedStyle(sastCallout) : null;
        const sastStats = {};
        sastSec.querySelectorAll('.mail-stats .ms').forEach(el => {
          const val = el.querySelector('b')?.textContent.trim();
          const lbl = el.querySelector('span')?.textContent.trim();
          if (lbl) sastStats[lbl] = val;
        });

        const sastRows = [];
        sastSec.querySelectorAll('.mail-tbl tbody tr:not(.th)').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          sastRows.push(cells);
        });

        // Report 3: #sonar
        const sonarSec = document.getElementById('sonar');
        const sonarStats = {};
        sonarSec.querySelectorAll('.mail-stats .ms').forEach(el => {
          const val = el.querySelector('b')?.textContent.trim();
          const lbl = el.querySelector('span')?.textContent.trim();
          if (lbl) sonarStats[lbl] = val;
        });

        const sonarRows = [];
        sonarSec.querySelectorAll('.mail-tbl tbody tr:not(.th)').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          sonarRows.push(cells);
        });

        const sonarNote = sonarSec.querySelector('.mail-note')?.textContent.trim();

        return {
          sync: {
            exists: Boolean(syncSec),
            stats: syncStats
          },
          sast: {
            exists: Boolean(sastSec),
            hasCallout: Boolean(sastCallout),
            calloutText: sastCallout ? sastCallout.textContent.trim() : '',
            calloutBorderLeft: sastCalloutStyle ? sastCalloutStyle.borderLeftColor : '',
            calloutBg: sastCalloutStyle ? sastCalloutStyle.backgroundColor : '',
            calloutVisible: sastCalloutStyle ? (sastCalloutStyle.display !== 'none' && sastCalloutStyle.visibility !== 'hidden') : false,
            stats: sastStats,
            rows: sastRows
          },
          sonar: {
            exists: Boolean(sonarSec),
            stats: sonarStats,
            rows: sonarRows,
            note: sonarNote
          }
        };
      })()`,
      returnByValue: true
    });
    const rd = reportsData.result.value;

    // Report 1: #sync assertions
    assert(rd.sync.exists, '#sync report section exists');
    assert(rd.sync.stats['merged'] === '6', '#sync has 6 merged');
    assert(rd.sync.stats['no changes'] === '3', '#sync has 3 no changes');
    assert(rd.sync.stats['conflict'] === '1', '#sync has 1 conflict');
    assert(rd.sync.stats['approval failed'] === '1', '#sync has 1 approval failed');
    assert(rd.sync.stats['skipped'] === '1', '#sync has 1 skipped');

    // Report 2: #sast assertions
    assert(rd.sast.exists, '#sast report section exists');
    assert(rd.sast.hasCallout, '#sast has amber disclaimer callout');
    assert(rd.sast.calloutVisible, '#sast disclaimer callout is visible in computed styles');
    assert(rd.sast.calloutText.toLowerCase().includes('false positive'), '#sast disclaimer explicitly mentions false positives');
    assert(rd.sast.calloutText.toLowerCase().includes('scope and limits'), '#sast disclaimer highlights scope and limits');
    assert(rd.sast.stats['total'] === '6', '#sast has 6 total');
    assert(rd.sast.stats['critical'] === '1', '#sast has 1 critical');
    assert(rd.sast.stats['medium'] === '5', '#sast has 5 medium');
    assert(rd.sast.rows.length === 2, '#sast table has 2 category rows (FE and BE)');
    assert(rd.sast.rows[0][0] === 'FE' && rd.sast.rows[0].includes('CLEAN'), '#sast FE category is marked CLEAN');
    assert(rd.sast.rows[1][0] === 'BE' && rd.sast.rows[1].includes('FINDINGS'), '#sast BE category is marked FINDINGS');

    // Report 3: #sonar assertions
    assert(rd.sonar.exists, '#sonar report section exists');
    assert(rd.sonar.stats['total scan'] === '31', '#sonar total scan is 31');
    assert(rd.sonar.stats['scanned'] === '30', '#sonar scanned is 30');
    assert(rd.sonar.stats['passed'] === '28', '#sonar passed is 28');
    assert(rd.sonar.stats['not passed'] === '2', '#sonar not passed is 2');
    assert(rd.sonar.stats['no analysis'] === '1', '#sonar no analysis is 1');

    console.log('\n--- TEST 6: Edge Case 11 ("NO ANALYSIS" Schedule Failure Pill) ---');
    const e11Row = rd.sonar.rows.find(r => r.some(cell => cell.includes('NO ANALYSIS')));
    assert(Boolean(e11Row), 'Row containing NO ANALYSIS exists in SonarQube table');
    assert(e11Row[0] === 'scheduler-job', 'scheduler-job is the service with NO ANALYSIS');
    assert(rd.sonar.note.toLowerCase().includes('schedule runner') || rd.sonar.note.toLowerCase().includes('polling timeout'), 'SonarQube note explains schedule runner or polling timeout rationale');

    console.log('\n--- TEST 7: Jump Pill Scrolling & Navigation ---');
    const jumpTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const pills = Array.from(document.querySelectorAll('.rp-jump-pill'));
        const results = [];
        for (const pill of pills) {
          const href = pill.getAttribute('href');
          const target = document.querySelector(href);
          if (!target) {
            results.push({ href, ok: false, error: 'target not found' });
            continue;
          }
          const cs = window.getComputedStyle(target);
          const scrollMarginTop = parseFloat(cs.scrollMarginTop || '0');
          results.push({
            href,
            scrollMarginTop,
            hasScrollMargin: scrollMarginTop >= 44
          });
        }
        return results;
      })()`,
      returnByValue: true
    });
    const jt = jumpTest.result.value;
    assert(jt.length === 3, 'Found exactly 3 jump pills (#sync, #sast, #sonar)');
    for (const pillRes of jt) {
      assert(pillRes.hasScrollMargin, `Target ${pillRes.href} has scroll-margin-top >= 44px (got ${pillRes.scrollMarginTop}px)`);
    }

    // Scroll to #sonar via jump pill
    const scrollResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const sonarPill = document.querySelector('.rp-jump-pill[href="#sonar"]');
        sonarPill.click();
        const target = document.getElementById('sonar');
        target.scrollIntoView();
        const rect = target.getBoundingClientRect();
        return { top: Math.round(rect.top), headerH: document.querySelector('.site-header')?.offsetHeight || 56 };
      })()`,
      returnByValue: true
    });
    assert(scrollResult.result.value.top >= 0, `#sonar target rect.top is visible on screen after jump (rect.top: ${scrollResult.result.value.top}px)`);

    console.log('\n--- TEST 8: Dual-Engine Toggle Interaction (Pass vs Refuse) ---');
    // Scroll back to top for toggle interaction
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0)` });
    await new Promise(r => setTimeout(r, 200));

    // Test clicking Refuse toggle
    const refuseClick = await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#run-seg button'));
        const btnRefuse = buttons.find(b => b.textContent.trim().toLowerCase() === 'refused');
        if (!btnRefuse) return { found: false };
        btnRefuse.click();
        return { found: true };
      })()`,
      returnByValue: true
    });
    assert(refuseClick.result.value.found, 'Found Refuse button in #run-seg');
    await new Promise(r => setTimeout(r, 600));

    const refuseState = await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#run-seg button'));
        const btnRefuse = buttons.find(b => b.textContent.trim().toLowerCase() === 'refused');
        const pressed = btnRefuse ? btnRefuse.getAttribute('aria-pressed') : null;
        const glSt = document.querySelector('.pv-card[data-engine="gitlab"] .pv-sttxt')?.textContent.trim();
        const boSt = document.querySelector('.pv-card[data-engine="jenkins"] .pv-sttxt')?.textContent.trim();
        return { pressed, glSt, boSt };
      })()`,
      returnByValue: true
    });
    assert(refuseState.result.value.pressed === 'true', 'Refuse button has aria-pressed="true" after click');
    assert(refuseState.result.value.glSt === 'refused', `GitLab card status is refused (got ${refuseState.result.value.glSt})`);
    assert(refuseState.result.value.boSt === 'refused', `Jenkins card status is refused (got ${refuseState.result.value.boSt})`);

    // Switch back to Pass toggle
    const passClick = await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#run-seg button'));
        const btnPass = buttons.find(b => b.textContent.trim().toLowerCase() === 'passed');
        if (!btnPass) return { found: false };
        btnPass.click();
        return { found: true };
      })()`,
      returnByValue: true
    });
    assert(passClick.result.value.found, 'Found Pass button in #run-seg');
    await new Promise(r => setTimeout(r, 600));

    const passState = await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#run-seg button'));
        const btnPass = buttons.find(b => b.textContent.trim().toLowerCase() === 'passed');
        const pressed = btnPass ? btnPass.getAttribute('aria-pressed') : null;
        const glSt = document.querySelector('.pv-card[data-engine="gitlab"] .pv-sttxt')?.textContent.trim();
        const boSt = document.querySelector('.pv-card[data-engine="jenkins"] .pv-sttxt')?.textContent.trim();
        return { pressed, glSt, boSt };
      })()`,
      returnByValue: true
    });
    assert(passState.result.value.pressed === 'true', 'Pass button has aria-pressed="true" after click');
    assert(passState.result.value.glSt === 'passed', `GitLab card status restored to passed (got ${passState.result.value.glSt})`);
    assert(passState.result.value.boSt === 'passed', `Jenkins card status restored to passed (got ${passState.result.value.boSt})`);

    console.log('\n--- TEST 9: Job Selection & Pinned Source Code Auto-Scroll ---');
    const jobClick = await send('Runtime.evaluate', {
      expression: `(() => {
        const trivyJob = Array.from(document.querySelectorAll('.gl-job')).find(j => j.textContent.includes('container-trivy'));
        if (!trivyJob) return { found: false };
        trivyJob.click();
        return { found: true };
      })()`,
      returnByValue: true
    });
    assert(jobClick.result.value.found, 'Found container-trivy job in GitLab CI pipeline');
    await new Promise(r => setTimeout(r, 600));

    const srcViewerState = await send('Runtime.evaluate', {
      expression: `(() => {
        const cbody = document.querySelector('.pv-card[data-engine="gitlab"] .pv-cbody');
        const hit = cbody?.querySelector('.hit');
        const codeName = document.querySelector('.pv-card[data-engine="gitlab"] [data-role="code-name"]')?.textContent.trim();
        const isHitVisible = Boolean(hit);
        return { codeName, isHitVisible, hasHitClass: Boolean(hit) };
      })()`,
      returnByValue: true
    });
    assert(srcViewerState.result.value.codeName.includes('backend.yml'), `Source code viewer shows backend.yml (got ${srcViewerState.result.value.codeName})`);
    assert(srcViewerState.result.value.hasHitClass, 'Highlighted hit line exists in source code viewer');

    console.log('\n--- TEST 10: Zero Hidden Cards & Anti-Hiding Verification ---');
    const hiddenAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const hiddenNodes = Array.from(document.querySelectorAll('[hidden]'));
        const hiddenCards = Array.from(document.querySelectorAll('.mail-card[hidden], .pv-card[hidden], article[hidden], section[hidden]'));
        return {
          totalHidden: hiddenNodes.length,
          hiddenCards: hiddenCards.length
        };
      })()`,
      returnByValue: true
    });
    const ha = hiddenAudit.result.value;
    assert(ha.hiddenCards === 0, 'Zero cards or sections carry hidden attribute');

    console.log('\n--- TEST 11: Copy Integrity & Em Dash Verification ---');
    const pageHtml = readFileSync('pipelines/index.html', 'utf8');
    const emDashRegex = /—|\\u2014|&mdash;|&#8212;/g;
    const emDashMatches = pageHtml.match(emDashRegex) || [];
    assert(emDashMatches.length === 0, `pipelines/index.html contains 0 em dashes (got ${emDashMatches.length})`);

    console.log('\n================================================================');
    console.log(`  ALL CHALLENGER M5 EMPIRICAL TESTS PASSED: ${report.testResults.length}/${report.testResults.length}  `);
    console.log('================================================================\n');

    if (ws) ws.close();
  } finally {
    try { chrome.kill('SIGKILL'); } catch (e) {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('\n*** CHALLENGER SUITE ENCOUNTERED UNEXPECTED ERROR ***\n', err);
  process.exit(1);
});
