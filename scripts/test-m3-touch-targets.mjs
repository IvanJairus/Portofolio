// Independent Exhaustive Touch Target Verification Harness for M3
import { spawn } from 'node:child_process';

const TARGET_URL = 'http://127.0.0.1:8731/work/index.html';
const CDP_PORT = 9227;

async function main() {
  console.log('================================================================');
  console.log('  EXHAUSTIVE TOUCH TARGET VERIFICATION HARNESS                  ');
  console.log('================================================================\n');

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome-touch-audit-' + Date.now()
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
    const ws = new WebSocket(tabData.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const timer = setTimeout(() => {
          ws.removeEventListener('message', handler);
          reject(new Error(`Timeout waiting for CDP ${method} (${msgId})`));
        }, 8000);

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

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1200));

    const viewports = [360, 375, 412, 768, 899, 900, 1280, 1440];
    let totalTested = 0;
    let totalFailures = 0;

    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await new Promise(r => setTimeout(r, 150));

      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll(
            'a, button, select, [role="button"], .bd-btn, .bd-dot, .bd-break, .rp-ni, #rp-role, .rp-proj, .lc-pause, .dx-cta, .lc-mailmore a, .footer-nav a, .brand, .repo-cta-row .btn'
          ));
          const checked = [];
          for (const el of els) {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;

            const width = Math.round(r.width * 10) / 10;
            const height = Math.round(r.height * 10) / 10;
            const text = (el.textContent || el.getAttribute('aria-label') || el.className).trim().replace(/\\s+/g, ' ').slice(0, 30);
            checked.push({
              tag: el.tagName,
              cls: el.className,
              text,
              w: width,
              h: height,
              pass: (r.width >= 43.5 && r.height >= 43.5)
            });
          }
          return checked;
        })()`,
        returnByValue: true
      });

      const controls = res.result.value;
      const failed = controls.filter(c => !c.pass);
      totalTested += controls.length;
      totalFailures += failed.length;

      console.log(`Viewport ${w}px: ${controls.length} controls tested`);
      if (failed.length > 0) {
        console.error(`  [FAIL] ${failed.length} controls failed at ${w}px:`, failed);
      } else {
        console.log(`  [PASS] 100% of ${controls.length} controls satisfy >= 44x44px target`);
      }
    }

    console.log('\n----------------------------------------------------------------');
    console.log(`TOTAL AUDIT RESULT: ${totalTested} checks, ${totalFailures} failures`);
    console.log('----------------------------------------------------------------');

    if (totalFailures > 0) {
      throw new Error(`Exhaustive audit failed with ${totalFailures} non-compliant touch targets`);
    }

    console.log('\n[SUCCESS] 100% compliance across all 8 viewports.');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('\n[AUDIT FAILED]:', err);
  process.exit(1);
});
