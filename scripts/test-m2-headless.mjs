import { spawn } from 'node:child_process';
import http from 'node:http';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;
const URL = 'http://127.0.0.1:8731/index.html';
const VIEWPORTS = [360, 375, 412, 768, 899, 900, 1280, 1440];

async function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function run() {
  console.log('--- Starting Headless Chrome ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--disable-background-networking'
  ]);

  let connected = false;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      await fetchJson('/json/version');
      connected = true;
      break;
    } catch {}
  }

  if (!connected) {
    console.error('Failed to connect to Chrome CDP');
    chromeProc.kill();
    process.exit(1);
  }

  const targets = await fetchJson('/json/list');
  let target = targets.find(t => t.type === 'page');
  if (!target) {
    target = await fetchJson('/json/new');
  }

  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  console.log('\n=== 1. VIEWPORT OVERFLOW AUDIT (8 Viewports) ===');
  const overflowResults = [];

  for (const width of VIEWPORTS) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 900
    });

    await client.send('Page.navigate', { url: URL });
    await sleep(300);

    const check = await client.eval(`
      (() => {
        const docEl = document.documentElement;
        const scrollW = docEl.scrollWidth;
        const innerW = window.innerWidth;
        const overflow = scrollW - innerW;

        const overflowingElements = [];
        if (overflow > 0) {
          const all = document.querySelectorAll('*');
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0) {
              if (rect.right > innerW + 0.5) {
                overflowingElements.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || undefined,
                  className: el.className || undefined,
                  right: Math.round(rect.right),
                  width: Math.round(rect.width)
                });
              }
            }
          }
        }

        return {
          width: innerW,
          scrollWidth: scrollW,
          overflow,
          pass: overflow <= 0,
          overflowingElements: overflowingElements.slice(0, 5)
        };
      })()
    `);

    overflowResults.push(check);
    const mark = check.pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${width}px: innerWidth=${check.width}, scrollWidth=${check.scrollWidth}, diff=${check.overflow}px`);
    if (!check.pass) {
      console.log('  Overflow elements:', JSON.stringify(check.overflowingElements));
    }
  }

  console.log('\n=== 2. PURGED ELEMENTS AUDIT (.terminal & looping animations) ===');
  const purgeCheck = await client.eval(`
    (() => {
      const terminalEls = document.querySelectorAll('.terminal, [class*="terminal"]');
      const packetEls = document.querySelectorAll('.hf-packet, [class*="packet"], .packet');
      const allEls = document.querySelectorAll('*');
      const loopingAnims = [];
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        const animName = style.animationName;
        const animIter = style.animationIterationCount;
        if (animName && animName !== 'none' && (animIter === 'infinite' || animIter > 10)) {
          loopingAnims.push({
            tag: el.tagName.toLowerCase(),
            className: el.className,
            animationName: animName,
            animationIterationCount: animIter
          });
        }
      }

      return {
        terminalCount: terminalEls.length,
        packetCount: packetEls.length,
        loopingAnimations: loopingAnims
      };
    })()
  `);
  console.log(`- Terminal emulator count: ${purgeCheck.terminalCount} (${purgeCheck.terminalCount === 0 ? 'PASS' : 'FAIL'})`);
  console.log(`- Packet animation count: ${purgeCheck.packetCount} (${purgeCheck.packetCount === 0 ? 'PASS' : 'FAIL'})`);
  console.log(`- Looping infinite animations: ${purgeCheck.loopingAnimations.length} (${purgeCheck.loopingAnimations.length === 0 ? 'PASS' : 'INFO/WARN'})`);
  if (purgeCheck.loopingAnimations.length > 0) {
    console.log('  Looping animations found:', JSON.stringify(purgeCheck.loopingAnimations));
  }

  console.log('\n=== 3. TOUCH TARGET AUDIT (Interactive Controls >= 44x44px) ===');
  // Check at 375px mobile viewport
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });
  await sleep(200);

  const touchTargetsMobile = await client.eval(`
    (() => {
      const results = [];
      const selectors = [
        '#nav-toggle',
        '.brand',
        '.btn',
        '.card-cta',
        '.card-sublink',
        '.filter-chip',
        '.contact-card a',
        '.footer-nav a',
        '.hy-run'
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          results.push({
            selector: sel,
            text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            pass: rect.width >= 43.5 && rect.height >= 43.5
          });
        }
      }
      return results;
    })()
  `);

  let touchMobileFails = 0;
  for (const t of touchTargetsMobile) {
    const mark = t.pass ? 'PASS' : 'FAIL';
    if (!t.pass) touchMobileFails++;
    console.log(`[${mark}] ${t.selector} ("${t.text}"): ${t.width}x${t.height}px`);
  }

  console.log(`\nMobile touch targets: ${touchTargetsMobile.length} inspected, ${touchMobileFails} failed.`);

  console.log('\n=== 4. MOBILE DRAWER INTERACTION & TOUCH AUDIT ===');
  // Open drawer via #nav-toggle click
  await client.eval(`document.querySelector('#nav-toggle').click();`);
  await sleep(200);

  const drawerAudit = await client.eval(`
    (() => {
      const drawer = document.querySelector('#nav-drawer');
      const isVisible = drawer && !drawer.hidden && window.getComputedStyle(drawer).display !== 'none';
      const toggle = document.querySelector('#nav-toggle');
      const ariaExpanded = toggle ? toggle.getAttribute('aria-expanded') : null;

      const links = Array.from(document.querySelectorAll('#nav-drawer a, #nav-close')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          pass: rect.width >= 43.5 && rect.height >= 43.5
        };
      });

      return {
        drawerVisible: isVisible,
        ariaExpanded,
        links
      };
    })()
  `);

  console.log(`- Drawer open state: visible=${drawerAudit.drawerVisible}, aria-expanded=${drawerAudit.ariaExpanded}`);
  let drawerFails = 0;
  for (const l of drawerAudit.links) {
    const mark = l.pass ? 'PASS' : 'FAIL';
    if (!l.pass) drawerFails++;
    console.log(`  [${mark}] ${l.tag}#${l.id || ''} ("${l.text}"): ${l.width}x${l.height}px`);
  }

  // Close drawer via Escape key
  await client.eval(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  `);
  await sleep(150);

  const drawerClosed = await client.eval(`
    (() => {
      const drawer = document.querySelector('#nav-drawer');
      const hidden = drawer.hidden || window.getComputedStyle(drawer).display === 'none';
      const toggle = document.querySelector('#nav-toggle');
      return {
        closed: hidden,
        ariaExpanded: toggle.getAttribute('aria-expanded')
      };
    })()
  `);
  console.log(`- Drawer close on Escape: closed=${drawerClosed.closed}, aria-expanded=${drawerClosed.ariaExpanded}`);

  console.log('\n=== 5. DESKTOP VIEWPORT TOUCH & NAV AUDIT (1280px) ===');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);

  const desktopNavAudit = await client.eval(`
    (() => {
      const navLinks = Array.from(document.querySelectorAll('.desktop-nav a')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          text: el.textContent.trim(),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          pass: rect.height >= 43.5
        };
      });
      return navLinks;
    })()
  `);

  for (const n of desktopNavAudit) {
    const mark = n.pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] Desktop Nav "${n.text}": ${n.width}x${n.height}px`);
  }

  // Check inline citation links (.ref)
  const refLinksAudit = await client.eval(`
    (() => {
      const refs = Array.from(document.querySelectorAll('a.ref')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          text: el.textContent.trim(),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10
        };
      });
      return refs;
    })()
  `);
  console.log(`\nToolbox inline reference links (a.ref count=${refLinksAudit.length}):`);
  console.log(`  Sample: ${JSON.stringify(refLinksAudit.slice(0, 3))}`);

  // Summary verdict
  const allOverflowPass = overflowResults.every(r => r.pass);
  const allPurgePass = purgeCheck.terminalCount === 0 && purgeCheck.packetCount === 0;
  const allTouchMobilePass = touchMobileFails === 0;
  const allDrawerPass = drawerAudit.drawerVisible && drawerAudit.ariaExpanded === 'true' && drawerFails === 0 && drawerClosed.closed;

  console.log('\n======================================================');
  console.log('                 OVERALL VERDICT');
  console.log('======================================================');
  console.log(`1. Viewport Overflow (8 viewports): ${allOverflowPass ? 'PASS' : 'FAIL'}`);
  console.log(`2. Purged Artifacts (.terminal & packets): ${allPurgePass ? 'PASS' : 'FAIL'}`);
  console.log(`3. Mobile Touch Targets (>= 44x44px): ${allTouchMobilePass ? 'PASS' : 'FAIL'}`);
  console.log(`4. Drawer Navigation & Touch: ${allDrawerPass ? 'PASS' : 'FAIL'}`);

  const verdict = allOverflowPass && allPurgePass && allTouchMobilePass && allDrawerPass ? 'APPROVE' : 'CHALLENGE_FAILED';
  console.log(`\nFINAL CHALLENGE VERDICT: ${verdict}`);

  client.close();
  chromeProc.kill();
  process.exit(verdict === 'APPROVE' ? 0 : 1);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
