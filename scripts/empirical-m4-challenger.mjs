// Empirical M4 Challenger Test Suite
// Rigorous browser runtime, CDP controls, state machine, stress test, and no-JS fallback harness.

import { spawn } from 'node:child_process';
import http from 'node:http';

const TARGET_URL = 'http://127.0.0.1:8731/diagrams/index.html';
const CDP_PORT = 9245;

const PLATES = [
  { id: 'state-governance', count: 6, name: '21-phase board governance' },
  { id: 'control-plane', count: 5, name: 'Control plane and three archetypes' },
  { id: 'event-router', count: 6, name: 'Dual-track event router' },
  { id: 'dependency-graph', count: 5, name: 'Where the six pipelines converge' },
  { id: 'sequence-sit', count: 6, name: 'One card from In Dev to SIT' }
];

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER M4 EMPIRICAL HARNESS: CONTROLS, STATE & NO-JS      ');
  console.log('================================================================\n');

  const userDataDir = `/tmp/chrome-challenger-m4-${Date.now()}`;
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

    // Open new tab
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, { method: 'PUT' });
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

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (type === 'error') {
          console.error(`  [BROWSER ERROR] ${text}`);
          report.consoleErrors.push(text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
        console.error(`  [BROWSER EXCEPTION] ${desc}`);
        report.exceptions.push(desc);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    console.log('\n--- PART 1: BASELINE PAGE INTEGRITY & METADATA ---');
    await send('Page.navigate', { url: TARGET_URL });
    await new Promise(r => setTimeout(r, 1500));

    const metaCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim(),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
          platesPresent: Array.from(document.querySelectorAll('.dg-plate')).map(p => p.id),
          hasMain: !!document.getElementById('main-content'),
          hasSkipLink: !!document.querySelector('.skip-link'),
          hasNavToggle: !!document.getElementById('nav-toggle'),
          hasNavDrawer: !!document.getElementById('nav-drawer')
        };
      })()`,
      returnByValue: true
    });
    const meta = metaCheck.result.value;
    assert(meta.title.includes('System Architecture Studio') || meta.title.includes('Diagrams') || meta.title.includes('Ivan Jairus'), `Valid document title: "${meta.title}"`);
    assert(meta.canonical === 'https://www.ivanjairus.xyz/portfolio/diagrams/', `Canonical URL matches contract: ${meta.canonical}`);
    assert(meta.hasMain && meta.hasSkipLink, 'Main container and skip-link present');
    assert(meta.hasNavToggle && meta.hasNavDrawer, 'Accessible navigation drawer components present');
    for (const p of PLATES) {
      assert(meta.platesPresent.includes(p.id), `Plate #${p.id} present in DOM`);
    }

    console.log('\n--- PART 2: EMPIRICAL STEP NAVIGATION (NEXT / PREV / CLAMPING) ON ALL 5 PLATES ---');
    for (const plate of PLATES) {
      console.log(`\nTesting Plate #${plate.id} (total steps: ${plate.count})...`);
      const plateTest = await send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.getElementById("${plate.id}");
          const prevBtn = root.querySelector("[data-step-prev]");
          const nextBtn = root.querySelector("[data-step-next]");
          const counterCurrent = root.querySelector(".dg-counter-current");
          const counterTotal = root.querySelector(".dg-counter-total");
          const caption = root.querySelector("[data-step-caption]");
          const playPauseBtn = root.querySelector("[data-step-play]");

          // Pause playback immediately so timer doesn't interfere
          if (root.classList.contains("is-playing")) {
            playPauseBtn.click();
          }

          // Jump to Step 1
          const dot1 = root.querySelector('[data-step-target="1"]');
          dot1.click();

          const step1Current = counterCurrent.textContent.trim();
          const step1PrevDisabled = prevBtn.disabled;
          const step1NextDisabled = nextBtn.disabled;
          const dot1Active = dot1.classList.contains("is-active") && dot1.getAttribute("aria-current") === "step";

          // Boundary test: click disabled Prev at step 1
          prevBtn.click();
          const stepAfterDisabledPrevClick = counterCurrent.textContent.trim();
          const clampedAt1 = stepAfterDisabledPrevClick === "1";

          // Walk forward 1-by-1 to max
          const forwardSteps = [];
          for (let s = 1; s <= ${plate.count}; s++) {
            const currentNum = counterCurrent.textContent.trim();
            const captionText = caption.textContent.trim();
            const dot = root.querySelector(\`[data-step-target="\${s}"]\`);
            const dotActive = dot ? (dot.classList.contains("is-active") && dot.getAttribute("aria-current") === "step") : false;
            
            // Check SVG items visibility
            const visibleItems = Array.from(root.querySelectorAll('[data-motion-item]'))
              .filter(it => it.classList.contains('is-visible'))
              .map(it => Number(it.dataset.step));
            const currentItem = root.querySelector(\`[data-motion-item][data-step="\${s}"]\`);
            const itemIsCurrent = currentItem ? currentItem.classList.contains('is-current') : true;

            forwardSteps.push({
              step: currentNum,
              captionLength: captionText.length,
              dotActive,
              prevDisabled: prevBtn.disabled,
              nextDisabled: nextBtn.disabled,
              maxVisibleStep: visibleItems.length ? Math.max(...visibleItems) : 0,
              itemIsCurrent
            });

            if (s < ${plate.count}) {
              nextBtn.click();
            }
          }

          // At max step: Next must be disabled
          const maxNextDisabled = nextBtn.disabled;
          const maxPrevDisabled = prevBtn.disabled;

          // Boundary test: click disabled Next at max step
          nextBtn.click();
          const stepAfterDisabledNextClick = counterCurrent.textContent.trim();
          const clampedAtMax = stepAfterDisabledNextClick === String(${plate.count});

          // Walk backward 1-by-1 to 1
          const backwardSteps = [];
          for (let s = ${plate.count}; s >= 1; s--) {
            const currentNum = counterCurrent.textContent.trim();
            backwardSteps.push(currentNum);
            if (s > 1) {
              prevBtn.click();
            }
          }

          return {
            totalMatch: counterTotal.textContent.trim() === String(${plate.count}),
            step1Current,
            step1PrevDisabled,
            step1NextDisabled,
            dot1Active,
            clampedAt1,
            forwardSteps,
            maxNextDisabled,
            maxPrevDisabled,
            clampedAtMax,
            backwardSteps
          };
        })()`,
        returnByValue: true
      });

      const res = plateTest.result.value;
      assert(res.totalMatch, `Total counter matches ${plate.count}`);
      assert(res.step1Current === '1', 'Initial reset to step 1 verified');
      assert(res.step1PrevDisabled === true, 'Prev button disabled at step 1');
      assert(res.step1NextDisabled === false, 'Next button enabled at step 1');
      assert(res.dot1Active === true, 'Dot 1 marked is-active and aria-current="step"');
      assert(res.clampedAt1 === true, 'Prev click at step 1 clamps correctly (does not underflow)');

      // Verify forward progression
      for (let s = 1; s <= plate.count; s++) {
        const stepData = res.forwardSteps[s - 1];
        assert(stepData.step === String(s), `Step matches expected forward index: ${s}`);
        assert(stepData.dotActive === true, `Dot ${s} marked active and aria-current`);
        assert(stepData.captionLength > 5, `Step ${s} caption populated: length=${stepData.captionLength}`);
        if (s > 1) assert(stepData.prevDisabled === false, `Prev enabled at step ${s}`);
        if (s < plate.count) assert(stepData.nextDisabled === false, `Next enabled at step ${s}`);
      }

      assert(res.maxNextDisabled === true, `Next button disabled at max step ${plate.count}`);
      assert(res.maxPrevDisabled === false, `Prev button enabled at max step ${plate.count}`);
      assert(res.clampedAtMax === true, `Next click at max step clamps correctly (does not overflow)`);

      // Verify backward progression
      assert(res.backwardSteps[0] === String(plate.count), 'Backward start at max');
      assert(res.backwardSteps[res.backwardSteps.length - 1] === '1', 'Backward finishes at step 1');
    }

    console.log('\n--- PART 3: PLAY / PAUSE CONTROLS & AUTO-WALKTHROUGH ON ALL 5 PLATES ---');
    for (const plate of PLATES) {
      console.log(`\nTesting Play/Pause on Plate #${plate.id}...`);
      const playPauseAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.getElementById("${plate.id}");
          const playBtn = root.querySelector("[data-step-play]");
          const nextBtn = root.querySelector("[data-step-next]");
          const prevBtn = root.querySelector("[data-step-prev]");
          const counterCurrent = root.querySelector(".dg-counter-current");

          // Ensure in paused state first
          if (root.classList.contains("is-playing")) {
            playBtn.click();
          }

          const pausedAriaPressed = playBtn.getAttribute("aria-pressed");
          const pausedLabel = playBtn.querySelector(".dg-btn-label")?.textContent?.trim();
          const pausedIcon = playBtn.querySelector(".dg-btn-icon")?.textContent?.trim();
          const pausedHasClass = root.classList.contains("is-playing");

          // Start playing
          playBtn.click();
          const playingAriaPressed = playBtn.getAttribute("aria-pressed");
          const playingLabel = playBtn.querySelector(".dg-btn-label")?.textContent?.trim();
          const playingIcon = playBtn.querySelector(".dg-btn-icon")?.textContent?.trim();
          const playingHasClass = root.classList.contains("is-playing");

          // Manual step NEXT must pause
          nextBtn.click();
          const pausedAfterNext = !root.classList.contains("is-playing") && playBtn.getAttribute("aria-pressed") === "false";

          // Start playing again
          playBtn.click();
          // Manual step PREV must pause
          prevBtn.click();
          const pausedAfterPrev = !root.classList.contains("is-playing") && playBtn.getAttribute("aria-pressed") === "false";

          // Start playing again
          playBtn.click();
          // Direct jump dot must pause
          const dot = root.querySelector('[data-step-target="2"]');
          dot.click();
          const pausedAfterDot = !root.classList.contains("is-playing") && playBtn.getAttribute("aria-pressed") === "false";

          // Start playing again
          playBtn.click();
          // ArrowRight must pause
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
          const pausedAfterArrowRight = !root.classList.contains("is-playing") && playBtn.getAttribute("aria-pressed") === "false";

          // Start playing again
          playBtn.click();
          // ArrowLeft must pause
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
          const pausedAfterArrowLeft = !root.classList.contains("is-playing") && playBtn.getAttribute("aria-pressed") === "false";

          return {
            pausedAriaPressed,
            pausedLabel,
            pausedIcon,
            pausedHasClass,
            playingAriaPressed,
            playingLabel,
            playingIcon,
            playingHasClass,
            pausedAfterNext,
            pausedAfterPrev,
            pausedAfterDot,
            pausedAfterArrowRight,
            pausedAfterArrowLeft
          };
        })()`,
        returnByValue: true
      });

      const ppa = playPauseAudit.result.value;
      assert(ppa.pausedAriaPressed === 'false', 'Paused aria-pressed is "false"');
      assert(ppa.pausedLabel === 'Play', 'Paused label is "Play"');
      assert(ppa.pausedIcon === '▶', 'Paused icon is "▶"');
      assert(ppa.pausedHasClass === false, 'Paused plate does not have .is-playing');

      assert(ppa.playingAriaPressed === 'true', 'Playing aria-pressed is "true"');
      assert(ppa.playingLabel === 'Pause', 'Playing label is "Pause"');
      assert(ppa.playingIcon === '❚❚', 'Playing icon is "❚❚"');
      assert(ppa.playingHasClass === true, 'Playing plate has .is-playing');

      assert(ppa.pausedAfterNext === true, 'Next step button click immediately pauses playback');
      assert(ppa.pausedAfterPrev === true, 'Prev step button click immediately pauses playback');
      assert(ppa.pausedAfterDot === true, 'Direct step dot click immediately pauses playback');
      assert(ppa.pausedAfterArrowRight === true, 'ArrowRight key immediately pauses playback');
      assert(ppa.pausedAfterArrowLeft === true, 'ArrowLeft key immediately pauses playback');
    }

    console.log('\n--- PART 4: DIRECT STEP JUMP DOTS ON ALL 5 PLATES ---');
    for (const plate of PLATES) {
      console.log(`\nTesting Jump Dots on Plate #${plate.id}...`);
      const jumpAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.getElementById("${plate.id}");
          const counterCurrent = root.querySelector(".dg-counter-current");
          const caption = root.querySelector("[data-step-caption]");

          // Jump pattern: 1 -> 3 -> last -> 2 -> 1
          const targets = [1, 3, ${plate.count}, 2, 1];
          const results = [];

          for (const t of targets) {
            const dot = root.querySelector(\`[data-step-target="\${t}"]\`);
            dot.click();
            const stepNum = counterCurrent.textContent.trim();
            const isActive = dot.classList.contains("is-active");
            const hasAriaCurrent = dot.getAttribute("aria-current") === "step";
            results.push({
              target: t,
              actual: Number(stepNum),
              isActive,
              hasAriaCurrent
            });
          }

          return results;
        })()`,
        returnByValue: true
      });

      const jumps = jumpAudit.result.value;
      for (const j of jumps) {
        assert(j.target === j.actual, `Jumped accurately to step ${j.target} (actual: ${j.actual})`);
        assert(j.isActive && j.hasAriaCurrent, `Target dot ${j.target} has is-active and aria-current="step"`);
      }
    }

    console.log('\n--- PART 5: KEYBOARD SHORTCUTS (ARROWLEFT, ARROWRIGHT, SPACE, HOME, END) ---');
    for (const plate of PLATES) {
      console.log(`\nTesting Keyboard on Plate #${plate.id}...`);
      const keyAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.getElementById("${plate.id}");
          const counter = root.querySelector(".dg-counter-current");
          const playBtn = root.querySelector("[data-step-play]");

          // Ensure paused
          if (root.classList.contains("is-playing")) playBtn.click();

          // Reset to step 1
          root.querySelector('[data-step-target="1"]').click();

          // ArrowRight advances to 2
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
          const afterRight = counter.textContent.trim();

          // ArrowLeft returns to 1
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
          const afterLeft = counter.textContent.trim();

          // End key jumps to max
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
          const afterEnd = counter.textContent.trim();

          // Home key jumps to 1
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
          const afterHome = counter.textContent.trim();

          // Boundary: ArrowLeft at step 1 stays at 1
          for (let i = 0; i < 5; i++) {
            root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
          }
          const clampedLeft = counter.textContent.trim();

          // Jump to max, boundary: ArrowRight at max stays at max
          root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
          for (let i = 0; i < 5; i++) {
            root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
          }
          const clampedRight = counter.textContent.trim();

          // Space key toggles playback
          const initialPlaying = root.classList.contains("is-playing");
          root.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
          const playingAfterSpace = root.classList.contains("is-playing");
          root.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
          const pausedAfterSecondSpace = root.classList.contains("is-playing");

          return {
            afterRight,
            afterLeft,
            afterEnd,
            afterHome,
            clampedLeft,
            clampedRight,
            initialPlaying,
            playingAfterSpace,
            pausedAfterSecondSpace
          };
        })()`,
        returnByValue: true
      });

      const ka = keyAudit.result.value;
      assert(ka.afterRight === '2', 'ArrowRight advanced step from 1 to 2');
      assert(ka.afterLeft === '1', 'ArrowLeft stepped back from 2 to 1');
      assert(ka.afterEnd === String(plate.count), `End key jumped to max step ${plate.count}`);
      assert(ka.afterHome === '1', 'Home key jumped to step 1');
      assert(ka.clampedLeft === '1', 'ArrowLeft repeatedly pressed at step 1 clamps at 1');
      assert(ka.clampedRight === String(plate.count), `ArrowRight repeatedly pressed at max step clamps at ${plate.count}`);
      assert(ka.playingAfterSpace === true, 'Space key toggles play/pause from paused to playing');
      assert(ka.pausedAfterSecondSpace === false, 'Space key toggles play/pause back to paused');
    }

    console.log('\n--- PART 6: ADVERSARIAL STRESS TEST (RAPID CLICKS & CONCURRENCY) ---');
    for (const plate of PLATES) {
      const stressRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.getElementById("${plate.id}");
          const prevBtn = root.querySelector("[data-step-prev]");
          const nextBtn = root.querySelector("[data-step-next]");
          const playBtn = root.querySelector("[data-step-play]");
          const dots = Array.from(root.querySelectorAll("[data-step-target]"));
          const counter = root.querySelector(".dg-counter-current");

          // Perform 40 rapid disordered actions
          for (let i = 0; i < 40; i++) {
            const r = i % 4;
            if (r === 0) nextBtn.click();
            else if (r === 1) prevBtn.click();
            else if (r === 2) playBtn.click();
            else {
              const dot = dots[i % dots.length];
              dot.click();
            }
          }

          const finalStep = Number(counter.textContent.trim());
          const isNum = Number.isInteger(finalStep);
          const inRange = finalStep >= 1 && finalStep <= ${plate.count};

          return { isNum, inRange, finalStep };
        })()`,
        returnByValue: true
      });
      const sr = stressRes.result.value;
      assert(sr.isNum && sr.inRange, `Plate #${plate.id} survived 40 rapid click events: final step=${sr.finalStep} within [1, ${plate.count}]`);
    }

    console.log('\n--- PART 7: MULTI-PLATE ISOLATION TEST ---');
    const isolationTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const p1 = document.getElementById("state-governance");
        const p2 = document.getElementById("control-plane");
        const p3 = document.getElementById("event-router");

        // Set all to step 1
        p1.querySelector('[data-step-target="1"]').click();
        p2.querySelector('[data-step-target="1"]').click();
        p3.querySelector('[data-step-target="1"]').click();

        // Advance p1 to step 4
        p1.querySelector('[data-step-target="4"]').click();

        const p1Step = p1.querySelector(".dg-counter-current").textContent.trim();
        const p2Step = p2.querySelector(".dg-counter-current").textContent.trim();
        const p3Step = p3.querySelector(".dg-counter-current").textContent.trim();

        return { p1Step, p2Step, p3Step };
      })()`,
      returnByValue: true
    });
    const iso = isolationTest.result.value;
    assert(iso.p1Step === '4', 'Plate 1 set to step 4');
    assert(iso.p2Step === '1' && iso.p3Step === '1', 'Plates 2 and 3 remain at step 1 without crosstalk');

    console.log('\n--- PART 8: QUERY STRING PARAMETERS & OVERRIDES ---');
    // Test ?motion=static
    await send('Page.navigate', { url: TARGET_URL + '?motion=static' });
    await new Promise(r => setTimeout(r, 1200));
    const staticQueryRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const docMotion = document.documentElement.dataset.motion;
        const p1 = document.getElementById("state-governance");
        const p1Frame = p1.dataset.frame;
        const p1Playing = p1.classList.contains("is-playing");
        return { docMotion, p1Frame, p1Playing };
      })()`,
      returnByValue: true
    });
    const sq = staticQueryRes.result.value;
    assert(sq.docMotion === 'static', '?motion=static sets document motion to static');
    assert(sq.p1Frame === 'static', 'Plate frame set to static');
    assert(sq.p1Playing === false, 'Playback is stopped in static mode');

    // Test ?motion=step&step=3
    await send('Page.navigate', { url: TARGET_URL + '?motion=step&step=3' });
    await new Promise(r => setTimeout(r, 1200));
    const stepQueryRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const p1 = document.getElementById("state-governance");
        const stepNum = p1.querySelector(".dg-counter-current").textContent.trim();
        const p1Playing = p1.classList.contains("is-playing");
        return { stepNum, p1Playing };
      })()`,
      returnByValue: true
    });
    const sq2 = stepQueryRes.result.value;
    assert(sq2.stepNum === '3', '?motion=step&step=3 initializes plate directly to step 3');
    assert(sq2.p1Playing === false, 'Playback paused when exact step requested');

    console.log('\n--- PART 9: ACCESSIBILITY, TOUCH TARGETS & MULTI-VIEWPORT REFLOW AUDIT ---');
    await send('Page.navigate', { url: TARGET_URL });
    await new Promise(r => setTimeout(r, 1200));

    // Audit viewports: 360px, 412px, 768px, 1024px, 1280px, 1440px
    const testViewports = [
      { w: 360, h: 740, mobile: true },
      { w: 375, h: 812, mobile: true },
      { w: 412, h: 915, mobile: true },
      { w: 768, h: 1024, mobile: false },
      { w: 1024, h: 768, mobile: false },
      { w: 1280, h: 800, mobile: false },
      { w: 1440, h: 900, mobile: false }
    ];

    for (const vp of testViewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 2,
        mobile: vp.mobile
      });
      await new Promise(r => setTimeout(r, 200));

      const vpAudit = await send('Runtime.evaluate', {
        expression: `(() => {
          const docWidth = document.documentElement.scrollWidth;
          const winWidth = window.innerWidth;
          const hasHorizontalOverflow = docWidth > winWidth;
          return { docWidth, winWidth, hasHorizontalOverflow };
        })()`,
        returnByValue: true
      });
      const vpa = vpAudit.result.value;
      assert(!vpa.hasHorizontalOverflow, `Zero horizontal scroll overflow at ${vp.w}px viewport: scrollWidth (${vpa.docWidth}) <= winWidth (${vpa.winWidth})`);
    }

    // Touch targets audit at 360px
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 300));

    const mobileTouchAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const interactiveSelectors = [
          ".dg-btn",
          ".dg-step-btn",
          ".dg-plate-link",
          "#nav-toggle",
          ".nav-link",
          ".btn",
          "a[href]"
        ];
        const elements = document.querySelectorAll(interactiveSelectors.join(", "));
        const failures = [];
        let total = 0;

        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none" && window.getComputedStyle(el).visibility !== "hidden") {
            total++;
            if (rect.width < 43.5 || rect.height < 43.5) {
              failures.push({
                tag: el.tagName,
                class: el.className,
                text: el.textContent.trim().slice(0, 20),
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10
              });
            }
          }
        });

        return {
          totalChecked: total,
          failureCount: failures.length,
          failures: failures.slice(0, 5)
        };
      })()`,
      returnByValue: true
    });

    const mta = mobileTouchAudit.result.value;
    assert(mta.failureCount === 0, `All touch targets pass >= 44x44px at 360px (checked: ${mta.totalChecked}, failures: ${mta.failureCount})`);

    // Reset device metrics
    await send('Emulation.clearDeviceMetricsOverride');

    console.log('\n--- PART 9B: SCREEN READER LIVE ANNOUNCER AUDIT ---');
    const announcerAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const p1 = document.getElementById("state-governance");
        const announcer = p1.querySelector('[role="status"]');
        const nextBtn = p1.querySelector("[data-step-next]");
        const playBtn = p1.querySelector("[data-step-play]");

        // Step to 1
        p1.querySelector('[data-step-target="1"]').click();
        const textAt1 = announcer.textContent.trim();

        // Step to 2 via Next
        nextBtn.click();
        const textAt2 = announcer.textContent.trim();

        // Pause explicitly
        playBtn.click(); // play
        playBtn.click(); // pause
        const textOnPause = announcer.textContent.trim();

        return { textAt1, textAt2, textOnPause };
      })()`,
      returnByValue: true
    });
    const ara = announcerAudit.result.value;
    assert(ara.textAt1.includes('Step 1 of 6'), `Live announcer announces Step 1: "${ara.textAt1}"`);
    assert(ara.textAt2.includes('Step 2 of 6'), `Live announcer announces Step 2 on Next click: "${ara.textAt2}"`);
    assert(ara.textOnPause.includes('Paused at step'), `Live announcer announces pause state: "${ara.textOnPause}"`);

    console.log('\n--- PART 9C: PREFERS-REDUCED-MOTION MEDIA EMULATION ---');
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await send('Page.navigate', { url: TARGET_URL });
    await new Promise(r => setTimeout(r, 1200));

    const reducedMotionAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const p1 = document.getElementById("state-governance");
        const isPlaying = p1.classList.contains("is-playing");
        const motionState = p1.dataset.motionState;
        const frame = p1.dataset.frame;
        return { isPlaying, motionState, frame };
      })()`,
      returnByValue: true
    });
    const rma = reducedMotionAudit.result.value;
    assert(rma.isPlaying === false, 'prefers-reduced-motion stops automated playback');
    assert(rma.motionState === 'reduced', 'Plate data-motion-state is "reduced"');
    assert(rma.frame === 'static', 'Plate data-frame is "static"');

    // Clear emulated media
    await send('Emulation.setEmulatedMedia', { media: '', features: [] });


    console.log('\n--- PART 10: NO-JAVASCRIPT STATIC FALLBACK AUDIT ---');
    // Disable script execution
    await send('Emulation.setScriptExecutionDisabled', { value: true });
    await send('Page.navigate', { url: TARGET_URL });
    await new Promise(r => setTimeout(r, 1200));

    const noJsAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const controls = Array.from(document.querySelectorAll(".dg-controls"));
        const allControlsHidden = controls.every(c => window.getComputedStyle(c).display === "none");

        const noscripts = Array.from(document.querySelectorAll("noscript"));
        // Evaluate DOM text inside noscript
        const noscriptCards = noscripts.map(ns => {
          const content = ns.innerHTML || ns.textContent;
          return {
            hasCard: content.includes('dg-noscript-card'),
            hasStepList: content.includes('Step 1') && content.includes('Step'),
            hasTitle: content.includes('Static diagram reference')
          };
        });

        const allNoscriptsComplete = noscriptCards.length === 5 && noscriptCards.every(c => c.hasCard && c.hasStepList);
        const svgPlatesVisible = Array.from(document.querySelectorAll(".diagram-container svg")).every(s => {
          const rect = s.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        return {
          controlsCount: controls.length,
          allControlsHidden,
          noscriptCount: noscripts.length,
          allNoscriptsComplete,
          svgPlatesVisible
        };
      })()`,
      returnByValue: true
    });

    const nja = noJsAudit.result.value;
    assert(nja.allControlsHidden === true, `All 5 interactive controls hidden when JavaScript is disabled`);
    assert(nja.noscriptCount === 5, `All 5 plates contain noscript fallback cards`);
    assert(nja.allNoscriptsComplete === true, `All 5 noscript cards contain complete ordered phase/step breakdown`);
    assert(nja.svgPlatesVisible === true, `All SVG plates remain visible and render statically`);

    console.log('\n--- PART 11: CONSOLE ERRORS & UNHANDLED EXCEPTIONS AUDIT ---');
    console.log(`Console errors captured: ${report.consoleErrors.length}`);
    console.log(`Unhandled exceptions captured: ${report.exceptions.length}`);
    assert(report.consoleErrors.length === 0, `0 console errors detected throughout entire test suite`);
    assert(report.exceptions.length === 0, `0 unhandled exceptions detected throughout entire test suite`);

    console.log('\n================================================================');
    console.log(`  ALL CHALLENGER EMPIRICAL AUDITS PASSED (${report.testResults.length} checks)`);
    console.log('================================================================\n');

    ws.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('\n[FATAL ERROR] Empirical challenger harness failed:', err);
  process.exit(1);
});
