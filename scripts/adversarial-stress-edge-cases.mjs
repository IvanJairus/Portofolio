// Auxiliary Adversarial Stress & Edge Case Test Harness
// Tests rapid toggle bursts, auto-close on resize to desktop, and heading landmark sanity across all 5 pages.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE_URL = 'http://127.0.0.1:8731';
const CDP_PORT = 9290;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = ['/', '/work/', '/diagrams/', '/pipelines/', '/decisions/'];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runEdgeCases() {
  console.log('--- STARTING ADVERSARIAL STRESS & EDGE CASE HARNESS ---');
  const userDataDir = `/tmp/chrome-edge-cases-${Date.now()}`;
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
    if (!connected) throw new Error('Chrome not connected');

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
        }, 10000);
        const handler = (event) => {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            if (res.error) reject(new Error(JSON.stringify(res.error)));
            else resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    for (const path of PAGES) {
      console.log(`Checking edge cases for ${path}...`);
      await send('Page.navigate', { url: `${BASE_URL}${path}` });
      await sleep(400);

      // Set to mobile 360px
      await send('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true
      });
      await sleep(100);

      // Test 1: Rapid toggle burst (10 rapid clicks)
      const rapidResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('nav-toggle');
          if (!btn) return { error: 'no btn' };
          for (let i = 0; i < 10; i++) {
            btn.click();
          }
          const drawer = document.getElementById('nav-drawer');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            expanded: btn.getAttribute('aria-expanded'),
            hidden: drawer.hasAttribute('hidden'),
            isOpen: drawer.classList.contains('is-open'),
            mainInert: main.inert
          };
        })()`,
        returnByValue: true
      });
      const rr = rapidResult.result.value;
      // Even number of clicks (10) must return drawer to closed state
      if (rr.expanded !== 'false' || !rr.hidden || rr.isOpen || rr.mainInert) {
        throw new Error(`Rapid toggle left drawer in inconsistent state on ${path}: ${JSON.stringify(rr)}`);
      }
      console.log(`  [PASS] ${path}: 10 rapid toggle clicks returned safely to closed state`);

      // Test 2: Auto-close on resize to desktop breakpoint (>=900px)
      await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-toggle').click()`
      });
      await sleep(150);

      // Verify open
      const openCheck = await send('Runtime.evaluate', {
        expression: `document.getElementById('nav-toggle').getAttribute('aria-expanded') === 'true'`,
        returnByValue: true
      });
      if (!openCheck.result.value) throw new Error(`Drawer failed to open before resize on ${path}`);

      // Resize to 1024px
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1024,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(300);

      const resizeState = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('nav-toggle');
          const drawer = document.getElementById('nav-drawer');
          const main = document.getElementById('main-content') || document.querySelector('main');
          return {
            expanded: btn.getAttribute('aria-expanded'),
            hidden: drawer.hasAttribute('hidden'),
            isOpen: drawer.classList.contains('is-open'),
            mainInert: main.inert
          };
        })()`,
        returnByValue: true
      });
      const rs = resizeState.result.value;
      if (rs.expanded !== 'false' || !rs.hidden || rs.isOpen || rs.mainInert) {
        throw new Error(`Drawer failed to auto-close on desktop resize on ${path}: ${JSON.stringify(rs)}`);
      }
      console.log(`  [PASS] ${path}: Drawer automatically closed when viewport resized to desktop (1024px)`);

      // Test 3: Landmarks and Heading structure check
      const landmarks = await send('Runtime.evaluate', {
        expression: `(() => {
          const h1s = document.querySelectorAll('h1');
          const h2s = document.querySelectorAll('h2');
          const main = document.querySelector('main');
          const header = document.querySelector('header');
          const footer = document.querySelector('footer');
          const skipLink = document.querySelector('.skip-link');
          return {
            h1Count: h1s.length,
            h2Count: h2s.length,
            hasMain: Boolean(main),
            hasHeader: Boolean(header),
            hasFooter: Boolean(footer),
            hasSkipLink: Boolean(skipLink)
          };
        })()`,
        returnByValue: true
      });
      const lm = landmarks.result.value;
      if (!lm.hasMain || !lm.hasHeader || !lm.hasFooter || !lm.hasSkipLink) {
        throw new Error(`Missing landmark on ${path}: ${JSON.stringify(lm)}`);
      }
      console.log(`  [PASS] ${path}: Landmarks (header, main, footer, skip-link) present (h1: ${lm.h1Count}, h2: ${lm.h2Count})`);
    }

    console.log('--- ALL ADVERSARIAL STRESS & EDGE CASES PASSED ---');
  } finally {
    try { chrome.kill('SIGTERM'); } catch (e) {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

runEdgeCases().catch(e => {
  console.error('Edge cases failed:', e);
  process.exit(1);
});
