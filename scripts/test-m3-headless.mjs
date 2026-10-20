// M3 Headless Chrome E2E and Visual / Interaction Audit
import { spawn } from 'node:child_process';

const TARGET_URL = 'http://127.0.0.1:8731/work/index.html';
const CDP_PORT = 9224;

async function main() {
  console.log('=== STARTING M3 HEADLESS CHROME AUDIT ===\n');

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome-m3-test-' + Date.now()
  ]);

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
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for DOM & script hydration
    await new Promise(r => setTimeout(r, 1500));

    // 1. CONSOLE ERRORS & TITLE
    console.log('--- 1. CONSOLE ERRORS & DOCUMENT TITLE ---');
    const pageState = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        errors: window.__errors || []
      })`,
      returnByValue: true
    });
    console.log('Document title:', pageState.result.value.title);
    if (pageState.result.value.title !== 'Case Studies & Threat Model | Ivan Jairus') {
      throw new Error('Title mismatch: ' + pageState.result.value.title);
    }
    if (consoleErrors.length > 0 || exceptions.length > 0) {
      console.error('Console errors:', consoleErrors);
      console.error('Exceptions:', exceptions);
      throw new Error('Console errors or exceptions detected!');
    }
    console.log('[PASS] Zero console errors and zero exceptions\n');

    // 2. HYDRATION AUDIT
    console.log('--- 2. INTERACTIVE WIDGET HYDRATION ---');
    const hydration = await send('Runtime.evaluate', {
      expression: `({
        feedChildren: document.querySelector('[data-bd-feed]')?.children.length || 0,
        rpViewChildren: document.querySelector('[data-rp-view]')?.children.length || 0
      })`,
      returnByValue: true
    });
    console.log('Feed child count:', hydration.result.value.feedChildren);
    console.log('Replica view child count:', hydration.result.value.rpViewChildren);
    if (hydration.result.value.feedChildren === 0 || hydration.result.value.rpViewChildren === 0) {
      throw new Error('Hydration failed: widgets are empty!');
    }
    console.log('[PASS] Both storyboard feed and replica view hydrated successfully\n');

    // 3. TOUCH TARGET AUDIT
    console.log('--- 3. TOUCH TARGET SIZE AUDIT (>= 44x44px) ---');
    const touchSelectors = [
      '.bd-btn', '.bd-dot', '.bd-break', '.rp-ni', '#rp-role', '.rp-proj',
      '.lc-pause', '.dx-cta', '.lc-mailmore a', '.footer-nav a', '.brand',
      '.repo-cta-row .btn', '.skip-link', '.ms-more', '.lc-out a', '.wsn', '.lc-node'
    ];
    let allTouchPassed = true;
    for (const sel of touchSelectors) {
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll('${sel}'));
          return els.map(el => {
            const r = el.getBoundingClientRect();
            return {
              text: (el.textContent || '').trim().slice(0, 24),
              w: Math.round(r.width * 10) / 10,
              h: Math.round(r.height * 10) / 10,
              ok: (r.width >= 43.5 && r.height >= 43.5)
            };
          });
        })()`,
        returnByValue: true
      });
      const els = res.result.value;
      if (els.length === 0) {
        console.warn(`[WARN] Selector not found: ${sel}`);
      } else {
        const failed = els.filter(e => !e.ok);
        if (failed.length > 0) {
          allTouchPassed = false;
          console.error(`[FAIL] ${sel}: ${failed.length}/${els.length} below 44x44`, failed);
        } else {
          console.log(`[PASS] ${sel}: all ${els.length} items >= 44x44 (${els[0].w}x${els[0].h})`);
        }
      }
    }
    if (!allTouchPassed) throw new Error('Touch target audit failed');
    console.log('[PASS] All interactive elements satisfy minimum 44x44px touch target\n');

    // 4. HORIZONTAL OVERFLOW ACROSS VIEWPORTS
    console.log('--- 4. HORIZONTAL OVERFLOW AUDIT (8 VIEWPORTS) ---');
    const viewports = [360, 375, 412, 768, 899, 900, 1280, 1440];
    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await new Promise(r => setTimeout(r, 200));
      const res = await send('Runtime.evaluate', {
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth
        })`,
        returnByValue: true
      });
      const data = res.result.value;
      if (data.hasOverflow) {
        console.error(`[FAIL] Viewport ${w}px: overflow detected (scrollWidth=${data.scrollWidth}, innerWidth=${data.innerWidth})`);
        throw new Error(`Horizontal overflow at ${w}px viewport`);
      }
      console.log(`[PASS] Viewport ${w}px: scrollWidth=${data.scrollWidth}, innerWidth=${data.innerWidth}`);
    }
    console.log('[PASS] Zero horizontal overflow across all tested viewports (360px - 1440px)\n');

    // 5. CONTENT REQUIREMENTS AUDIT
    console.log('--- 5. CONTENT REQUIREMENTS VERIFICATION ---');
    const contentAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.textContent;
        return {
          has32Pipelines: text.includes('32 pipeline jobs'),
          has18Orchestrators: text.includes('18 orchestrators'),
          has330Tests: text.includes('~330 unit tests'),
          has21PhaseFlow: text.includes('21-Phase Flow') || text.includes('21-phase flow'),
          hasSequentialPhases: text.includes('PHASE_FLOW'),
          hasMultipleFlow: text.includes('MULTIPLE_FLOW'),
          hasExpress: text.includes('Express + SSE event streaming'),
          hasRbac: text.includes('admin, devsecops, developer'),
          hasMachineAuth: text.includes('API-key auth for machine callers'),
          hasCompositeGate: text.includes('Deployment SUCCESS, Quality gate PASSED (code quality), and 0 CRITICAL vulnerabilities findings'),
          has5Packaging: text.includes('jar') && text.includes('image') && text.includes('apk') && text.includes('ipa') && text.includes('web'),
          hasGithubCTA: !!document.querySelector('a[href="https://github.com/IvanJairus/Pipeline"]'),
          hasThreatModelPunctuation: text.includes('thinking about.'),
          hasThreeCaseStudiesSkim: text.includes('three case studies hidden')
        };
      })()`,
      returnByValue: true
    });
    console.log('Content checks:', contentAudit.result.value);
    for (const [k, v] of Object.entries(contentAudit.result.value)) {
      if (!v) throw new Error(`Content check failed for: ${k}`);
    }
    console.log('[PASS] All M3 content specifications verified present in page\n');

    // 6. SKIM BUTTON INTERACTION TEST
    console.log('--- 6. DEPTH / SKIM TOGGLE TEST ---');
    const skimTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const depthBtn = document.querySelector('[data-depth-btn]');
        if (!depthBtn) return { error: 'No depth button found' };
        depthBtn.click();
        const skimNote = document.querySelector('[data-skim-note]');
        const isSkimNoteVisible = skimNote && (window.getComputedStyle(skimNote).display === 'flex' || skimNote.offsetParent !== null);
        const noteText = skimNote ? skimNote.innerText : '';
        // Toggle back to deep mode
        depthBtn.click();
        return { isSkimNoteVisible, noteText };
      })()`,
      returnByValue: true
    });
    console.log('Skim toggle test:', skimTest.result.value);
    if (!skimTest.result.value.isSkimNoteVisible || !skimTest.result.value.noteText.includes('three case studies')) {
      throw new Error('Skim button toggle verification failed: ' + JSON.stringify(skimTest.result.value));
    }
    console.log('[PASS] Skim toggle correctly reveals "three case studies hidden"\n');

    console.log('=== ALL M3 AUDITS PASSED WITH FLYING COLORS ===');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('\n[AUDIT FAILED]:', err);
  process.exit(1);
});
