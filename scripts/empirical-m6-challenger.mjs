// Empirical M6 Challenger Test Suite
// Rigorous verification of ADR content, sections, categories, exact metrics,
// link integrity, anti-slop, and Chrome DevTools Protocol runtime checks.

import { spawn } from 'node:child_process';
import { readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const PORTFOLIO_ROOT = '/Users/70572/Documents/Qoder/2026-10-05/17ddef50/portfolio';
const TARGET_URL = 'http://127.0.0.1:8731/decisions/index.html';
const CDP_PORT = 9256;

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER M6 EMPIRICAL HARNESS: ADRs, CATEGORIES & LINKS     ');
  console.log('================================================================\n');

  const report = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, message) {
    report.totalTests++;
    if (!condition) {
      console.error(`  [FAIL] ${message}`);
      report.failed++;
      report.failures.push(message);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`  [PASS] ${message}`);
      report.passed++;
    }
  }

  // =========================================================================
  // TIER 1: Static Structural, Semantic, & Data Verification
  // =========================================================================
  console.log('--- PHASE 1: Static Semantic & Data Verification ---');

  const htmlPath = join(PORTFOLIO_ROOT, 'decisions/index.html');
  assert(existsSync(htmlPath), 'decisions/index.html exists on disk');
  const html = readFileSync(htmlPath, 'utf8');

  // 1.1 Strict CSP
  const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert(Boolean(cspMatch), 'Strict Content-Security-Policy meta tag exists');
  const cspContent = cspMatch[1];
  assert(cspContent.includes("default-src 'self'"), "CSP contains default-src 'self'");
  assert(cspContent.includes("script-src 'self'"), "CSP contains script-src 'self'");
  assert(cspContent.includes("style-src 'self'"), "CSP contains style-src 'self'");

  // 1.2 Skip Link & Landmark
  assert(html.includes('<a href="#main-content" class="skip-link">Skip to main content</a>'), 'Skip link exists pointing to #main-content');
  assert(html.includes('<main id="main-content">'), 'Main landmark exists with id="main-content"');

  // 1.3 Total ADR Cards
  const cardMatches = [...html.matchAll(/<article\s+class="dec-card[^"]*"\s+id="(adr-\d+)">/g)];
  assert(cardMatches.length === 11, `Exactly 11 ADR cards present (found ${cardMatches.length})`);

  const cardIds = cardMatches.map(m => m[1]);
  const expectedCardIds = Array.from({ length: 11 }, (_, i) => `adr-${String(i + 1).padStart(2, '0')}`);
  assert(JSON.stringify(cardIds) === JSON.stringify(expectedCardIds), `Card IDs match adr-01 through adr-11 in sequence: ${cardIds.join(', ')}`);

  // 1.4 Category Container Card Counts
  // Category 1: System Topology
  const sysTopMatch = html.match(/<section\s+id="system-topology"[^>]*>([\s\S]*?)<\/section>/);
  assert(Boolean(sysTopMatch), '<section id="system-topology"> exists');
  const sysTopHtml = sysTopMatch[1];
  assert(sysTopHtml.includes('id="shaped"'), 'id="shaped" wrapper exists inside #system-topology');
  const shapedCards = [...sysTopHtml.matchAll(/<article\s+class="dec-card[^"]*"\s+id="(adr-\d+)">/g)].map(m => m[1]);
  assert(shapedCards.length === 6, `Exactly 6 ADR cards inside #system-topology / #shaped (found ${shapedCards.length}: ${shapedCards.join(', ')})`);
  assert(JSON.stringify(shapedCards) === JSON.stringify(['adr-01', 'adr-02', 'adr-03', 'adr-04', 'adr-05', 'adr-06']), 'Shaped cards are adr-01 to adr-06');

  // Category 2: Production Operations
  const prodOpsMatch = html.match(/<section\s+id="production-operations"[^>]*>([\s\S]*?)<\/section>/);
  assert(Boolean(prodOpsMatch), '<section id="production-operations"> exists');
  const prodOpsHtml = prodOpsMatch[1];
  assert(prodOpsHtml.includes('id="production"'), 'id="production" wrapper exists inside #production-operations');
  const prodCards = [...prodOpsHtml.matchAll(/<article\s+class="dec-card[^"]*"\s+id="(adr-\d+)">/g)].map(m => m[1]);
  assert(prodCards.length === 5, `Exactly 5 ADR cards inside #production-operations / #production (found ${prodCards.length}: ${prodCards.join(', ')})`);
  assert(JSON.stringify(prodCards) === JSON.stringify(['adr-07', 'adr-08', 'adr-09', 'adr-10', 'adr-11']), 'Production cards are adr-07 to adr-11');

  // 1.5 Jump Navigation
  assert(html.includes('href="#system-topology"'), 'Jump pill links to #system-topology');
  assert(html.includes('href="#production-operations"'), 'Jump pill links to #production-operations');

  // 1.6 Verify All 11 Cards Have Mandatory Sections & Semantic Fields
  for (let i = 1; i <= 11; i++) {
    const cardId = `adr-${String(i).padStart(2, '0')}`;
    const badge = `ADR-${String(i).padStart(4, '0')}`;
    const cardRegex = new RegExp(`<article\\s+class="dec-card[^"]*"\\s+id="${cardId}">([\\s\\S]*?)<\\/article>`);
    const cardMatch = html.match(cardRegex);
    assert(Boolean(cardMatch), `Card ${cardId} extractable`);
    const cHtml = cardMatch[1];

    assert(cHtml.includes(badge), `Card ${cardId} carries badge ${badge}`);
    assert(cHtml.includes('class="dec-fold"'), `Card ${cardId} contains .dec-fold button`);
    assert(cHtml.includes('aria-expanded="true"'), `Card ${cardId} .dec-fold button has aria-expanded="true"`);

    assert(cHtml.includes('<dl>'), `Card ${cardId} contains definition list <dl>`);

    // Verify the 4 mandatory fields
    const hasDec = cHtml.includes('field-decision') && cHtml.includes('val-decision');
    assert(hasDec, `Card ${cardId} contains Decision section (field-decision, val-decision)`);

    const hasAlt = cHtml.includes('field-alternative') && cHtml.includes('val-alternative');
    assert(hasAlt, `Card ${cardId} contains Alternative Rejected section (field-alternative, val-alternative)`);

    const hasWhy = cHtml.includes('field-why') && cHtml.includes('val-why');
    assert(hasWhy, `Card ${cardId} contains Engineering Rationale section (field-why, val-why)`);

    const hasCost = cHtml.includes('field-cost') && cHtml.includes('val-cost');
    assert(hasCost, `Card ${cardId} contains Real Cost Paid section (field-cost, val-cost)`);

    // Verify non-empty values
    const decValMatch = cHtml.match(/<dd\s+class="val-decision">([\s\S]*?)<\/dd>/);
    assert(Boolean(decValMatch) && decValMatch[1].trim().length > 10, `Card ${cardId} val-decision has substantial content`);

    const altValMatch = cHtml.match(/<dd\s+class="val-alternative">([\s\S]*?)<\/dd>/);
    assert(Boolean(altValMatch) && altValMatch[1].trim().length > 10, `Card ${cardId} val-alternative has substantial content`);

    const whyValMatch = cHtml.match(/<dd\s+class="val-why">([\s\S]*?)<\/dd>/);
    assert(Boolean(whyValMatch) && whyValMatch[1].trim().length > 10, `Card ${cardId} val-why has substantial content`);

    const costValMatch = cHtml.match(/<dd\s+class="val-cost">([\s\S]*?)<\/dd>/);
    assert(Boolean(costValMatch) && costValMatch[1].trim().length > 10, `Card ${cardId} val-cost has substantial content`);
  }

  // 1.7 Exact Verbatim Figures and Units
  console.log('\n--- PHASE 2: Verbatim Quantitative Figures & Critical Strings ---');

  // ADR-11 metrics
  assert(html.includes('median 93 seconds'), 'Verbatim "median 93 seconds" present');
  assert(html.includes('n = 13'), 'Verbatim "n = 13" present');
  assert(html.includes('p90 162 s'), 'Verbatim "p90 162 s" present');
  assert(html.includes('range 19–199 s'), 'Verbatim "range 19–199 s" present (with unspaced en dash)');
  assert(html.includes('median 80 seconds'), 'Verbatim "median 80 seconds" present');
  assert(html.includes('n = 30'), 'Verbatim "n = 30" present');
  assert(html.includes('p90 140 s'), 'Verbatim "p90 140 s" present');
  assert(html.includes('8 October 2026'), 'Verbatim "8 October 2026" present');
  assert(html.includes('53 services declared'), 'Verbatim "53 services declared" present');
  assert(html.includes('99 source repositories'), 'Verbatim "99 source repositories" present');
  assert(html.includes('46 of them with pipeline history'), 'Verbatim "46 of them with pipeline history" present');
  assert(html.includes('10 pipeline projects'), 'Verbatim "10 pipeline projects" present');
  assert(html.includes('7,550 pipelines'), 'Verbatim "7,550 pipelines" present');

  // Integration test phrases
  assert(html.includes('gateway.yml'), 'Verbatim "gateway.yml" present');
  assert(html.includes('fail closed'), 'Verbatim "fail closed" present');
  assert(html.includes('Two CI engines'), 'Verbatim "Two CI engines" present');
  assert(html.includes('inside the ticket'), 'Verbatim "inside the ticket" present');
  assert(html.includes('Nothing they write merges itself'), 'Verbatim "Nothing they write merges itself" present');
  assert(html.includes('Capacity is decided upstream. I make it stick.'), 'Verbatim "Capacity is decided upstream. I make it stick." present');
  assert(html.includes('One rollout rule, and no two deploys at once.'), 'Verbatim "One rollout rule, and no two deploys at once." present');
  assert(html.includes('A backup is only real if it expires.'), 'Verbatim "A backup is only real if it expires." present');
  assert(html.includes('Measured baseline per artifact type, not copied configs'), 'Verbatim "Measured baseline per artifact type, not copied configs" present');
  assert(html.includes('Numbers, with the sample size attached'), 'Verbatim "Numbers, with the sample size attached" present');
  assert(html.includes('Built the control plane, did not buy one'), 'Verbatim "Built the control plane, did not buy one" present');
  assert(html.includes('One gateway, not per-repo templates'), 'Verbatim "One gateway, not per-repo templates" present');
  assert(html.includes('Gates fail closed'), 'Verbatim "Gates fail closed" present');
  assert(html.includes('What I deliberately did NOT build'), 'Verbatim "What I deliberately did NOT build" present');

  // 1.8 Anti-Slop & Copy Hygiene (Zero Em Dashes & Zero Banned Buzzwords)
  console.log('\n--- PHASE 3: Copy Hygiene & Anti-Slop Validation ---');
  const emDashRegex = /—|&mdash;|&#8212;|\u2014|\s--\s|\s–\s/;
  const emDashMatch = html.match(emDashRegex);
  assert(!emDashMatch, `Zero em dashes in decisions/index.html (found: ${emDashMatch ? emDashMatch[0] : 'none'})`);

  const buzzwords = [
    'revolutionary',
    'seamless',
    'cutting-edge',
    'next-level',
    'game-changer',
    'world-class',
    'state-of-the-art',
    'hyper-converged',
    'synergy'
  ];
  for (const bw of buzzwords) {
    const bwRegex = new RegExp(`\\b${bw}\\b`, 'i');
    const bwMatch = html.match(bwRegex);
    assert(!bwMatch, `Zero occurrences of buzzword "${bw}" in decisions/index.html`);
  }

  // 1.9 Link Integrity & Linkcheck Execution
  console.log('\n--- PHASE 4: Link Integrity Verification ---');
  try {
    const linkcheckOutput = execSync('python3 _linkcheck.py', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    console.log(`  _linkcheck.py output:\n  ${linkcheckOutput.trim().replace(/\n/g, '\n  ')}`);
    assert(linkcheckOutput.includes('0 broken'), '_linkcheck.py reports 0 broken links');
  } catch (err) {
    assert(false, `_linkcheck.py failed with error: ${err.message}`);
  }

  // Verify all internal references in decisions/index.html resolve
  const hrefMatches = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  const localHrefs = hrefMatches.filter(h => !h.startsWith('http') && !h.startsWith('data:') && !h.startsWith('mailto:'));
  for (const ref of localHrefs) {
    if (ref.startsWith('#')) {
      const targetId = ref.slice(1);
      const idRegex = new RegExp(`id="${targetId}"`);
      assert(idRegex.test(html), `Local anchor ${ref} matches existing id in decisions/index.html`);
    } else {
      const [filePath, frag] = ref.split('#');
      if (filePath) {
        const resolvedPath = join(PORTFOLIO_ROOT, 'decisions', filePath);
        let targetFile = resolvedPath;
        if (existsSync(targetFile) && statSync(targetFile).isDirectory()) {
          targetFile = join(targetFile, 'index.html');
        }
        assert(existsSync(targetFile), `Referenced asset/file exists: ${ref} -> ${targetFile}`);
        if (frag && existsSync(targetFile)) {
          const targetHtml = readFileSync(targetFile, 'utf8');
          const idRegex = new RegExp(`id="${frag}"`);
          assert(idRegex.test(targetHtml), `Target anchor #${frag} exists in ${targetFile}`);
        }
      }
    }
  }

  // 1.10 E2E Test Suite Run
  console.log('\n--- PHASE 5: Standard E2E Test Suite Execution ---');
  try {
    const e2eOutput = execSync('python3 scripts/e2e-test-suite.py 2>&1', { cwd: PORTFOLIO_ROOT, encoding: 'utf8' });
    assert(e2eOutput.includes('OK'), 'e2e-test-suite.py passed with OK');
    assert(e2eOutput.includes('Passed: 313'), 'e2e-test-suite.py ran 313/313 passing tests');
  } catch (err) {
    assert(false, `e2e-test-suite.py failed: ${err.message}`);
  }

  // =========================================================================
  // TIER 2: Chrome DevTools Protocol Runtime Stress Testing
  // =========================================================================
  console.log('\n--- PHASE 6: Chrome DevTools Protocol Runtime Stress Testing ---');

  const userDataDir = `/tmp/chrome-challenger-m6-${Date.now()}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  const cdpReport = {
    consoleErrors: [],
    exceptions: []
  };

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
    assert(connected, `Connected to Chrome CDP port ${CDP_PORT}`);

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
        cdpReport.consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        cdpReport.exceptions.push(msg.params.exceptionDetails.text);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    await new Promise(r => setTimeout(r, 1500));

    // 6.1 Console Errors & Exceptions
    assert(cdpReport.consoleErrors.length === 0, `0 console errors on initial load (found ${cdpReport.consoleErrors.length})`);
    assert(cdpReport.exceptions.length === 0, `0 unhandled exceptions (found ${cdpReport.exceptions.length})`);

    // 6.2 Viewport Horizontal Overflow Check
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
      assert(res.overflowDelta <= 0, `Viewport ${w}px has 0px horizontal scroll overflow (overflowDelta: ${res.overflowDelta}px)`);
    }

    // 6.3 Touch Target Measurement (Min 44x44px for standalone controls)
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
            'a[href], button, select, [role="button"], .jump-pill, .dec-fold, #nav-toggle, #nav-close, .skip-link, .back-to-top'
          ));
          const checked = [];
          for (const el of els) {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;

            // Inline text links inside a sentence/paragraph are exempt under WCAG 2.5.5 / 2.5.8 exception
            const isInlineLink = el.tagName === 'A' && el.closest('p, .care-note, .ds-lead, .lead, dd');

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

    // 6.4 Sticky Header Scroll Clearance Test
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 200));

    const targetsToTest = ['system-topology', 'production-operations', 'shaped', 'production', 'adr-01', 'adr-07', 'adr-11'];
    for (const tid of targetsToTest) {
      const clearanceTest = await send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.getElementById("${tid}");
          if (!el) return { found: false };
          const cs = window.getComputedStyle(el);
          const smt = cs.scrollMarginTop;
          return { found: true, smt };
        })()`,
        returnByValue: true
      });
      const res = clearanceTest.result.value;
      assert(res.found, `Element #${tid} exists in DOM`);
      assert(res.smt && (res.smt.includes('81px') || parseFloat(res.smt) >= 80), `Element #${tid} has scroll-margin-top >= 80px (actual: ${res.smt})`);
    }

    // 6.5 Mobile Fold Toggle Behavior
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 300));

    const foldToggleTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.getElementById('adr-02');
        const btn = card.querySelector('.dec-fold');
        if (!btn) return { error: 'No fold button in adr-02' };
        
        const initialExpanded = btn.getAttribute('aria-expanded');
        btn.click();
        const afterClickFold = card.dataset.fold;
        const afterClickExpanded = btn.getAttribute('aria-expanded');
        const afterClickLabel = btn.textContent.trim();

        // Click again to reopen
        btn.click();
        const afterSecondFold = card.dataset.fold || '';
        const afterSecondExpanded = btn.getAttribute('aria-expanded');
        const afterSecondLabel = btn.textContent.trim();

        return {
          initialExpanded,
          afterClickFold,
          afterClickExpanded,
          afterClickLabel,
          afterSecondFold,
          afterSecondExpanded,
          afterSecondLabel
        };
      })()`,
      returnByValue: true
    });
    const ftRes = foldToggleTest.result.value;
    assert(!ftRes.error, 'Fold button exists in adr-02');
    assert(ftRes.afterClickFold === 'closed', 'Clicking fold button sets data-fold="closed"');
    assert(ftRes.afterClickExpanded === 'false', 'Clicking fold button sets aria-expanded="false"');
    assert(ftRes.afterClickLabel === 'show', 'Clicking fold button changes label to "show"');
    assert(ftRes.afterSecondFold === '', 'Second click removes data-fold="closed"');
    assert(ftRes.afterSecondExpanded === 'true', 'Second click sets aria-expanded="true"');
    assert(ftRes.afterSecondLabel === 'hide', 'Second click restores label to "hide"');

    // 6.6 Mobile Drawer Navigation Test
    const drawerTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const navToggle = document.getElementById('nav-toggle');
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        if (!navToggle || !drawer || !main) return { error: 'Nav elements missing' };

        navToggle.click();
        const drawerOpen = !drawer.hidden;
        const toggleExpanded = navToggle.getAttribute('aria-expanded');
        const mainInert = main.inert || main.hasAttribute('inert');

        return {
          drawerOpen,
          toggleExpanded,
          mainInert
        };
      })()`,
      returnByValue: true
    });
    const dtRes = drawerTest.result.value;
    assert(!dtRes.error, 'Nav toggle, drawer, and main elements present');
    assert(dtRes.drawerOpen, 'Clicking nav-toggle opens #nav-drawer');
    assert(dtRes.toggleExpanded === 'true', 'nav-toggle has aria-expanded="true" when open');
    assert(dtRes.mainInert, '#main-content is inert when drawer is open');

    // Test Escape Key Dismissal
    await send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await new Promise(r => setTimeout(r, 200));

    const escTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const navToggle = document.getElementById('nav-toggle');
        const drawer = document.getElementById('nav-drawer');
        const main = document.getElementById('main-content');
        return {
          drawerHidden: drawer.hidden,
          toggleExpanded: navToggle.getAttribute('aria-expanded'),
          mainNotInert: !(main.inert || main.hasAttribute('inert'))
        };
      })()`,
      returnByValue: true
    });
    const escRes = escTest.result.value;
    assert(escRes.drawerHidden, 'Pressing Escape dismisses mobile drawer');
    assert(escRes.toggleExpanded === 'false', 'nav-toggle has aria-expanded="false" after Escape');
    assert(escRes.mainNotInert, '#main-content is no longer inert after Escape');

    console.log('\n================================================================');
    console.log(`  CHALLENGER M6 RUN COMPLETE: ${report.passed} PASSED / ${report.totalTests} TOTAL`);
    console.log('================================================================\n');

  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }

  if (report.failed > 0) {
    console.error(`FAILED with ${report.failed} failures:`, report.failures);
    process.exit(1);
  } else {
    console.log('ALL EMPIRICAL ADVERSARIAL CHECKS PASSED WITH ZERO FAILURES.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error in challenger harness:', err);
  process.exit(1);
});
