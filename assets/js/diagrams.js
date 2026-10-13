/*
  Animation sequence for the architecture, pipeline and gate diagrams, plus
  continuous auto-loop playback for the interactive atlas on /diagrams/.
  Respects prefers-reduced-motion: reduce and ?motion=static.
*/

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* measure each SVG line length so the "draw" animation is exact */
  function measureLinks(scope) {
    scope.querySelectorAll(".dg-link").forEach((p) => {
      try {
        const len = Math.ceil(p.getTotalLength());
        p.style.setProperty("--len", len);
      } catch (e) { /* non-path element: skip */ }
    });
  }

  function playGateway(scope) {
    scope.classList.add("play");
    const seq = [
      [0,    () => light(scope, ".n-repo", 90)],
      [500,  () => light(scope, ".n-gateway", 0)],
      [1300, () => light(scope, ".n-dom", 140)],
      [2200, () => light(scope, ".n-env", 140)]
    ];
    seq.forEach(([t, fn]) => setTimeout(fn, t));
  }

  function light(scope, selector, stagger) {
    scope.querySelectorAll(selector).forEach((el, i) => {
      setTimeout(() => el.classList.add("lit"), stagger * i);
    });
  }

  function playGate(scope) {
    scope.classList.add("play");
    const checks = scope.querySelectorAll(".gate-check");
    const result = scope.querySelector(".gate-result");
    checks.forEach((c, i) => setTimeout(() => c.classList.add("ok"), 400 + i * 800));
    setTimeout(() => {
      result.classList.add("ready");
      const state = result.querySelector(".g-state");
      if (state) state.textContent = state.dataset.ready;
    }, 400 + checks.length * 800 + 300);
  }

  function observeDiagrams() {
    const targets = document.querySelectorAll("[data-diagram]");
    if (!targets.length) return;

    if (reduced) {
      targets.forEach((t) => {
        t.classList.add("play");
        t.querySelectorAll(".gate-check").forEach((c) => c.classList.add("ok"));
        const r = t.querySelector(".gate-result");
        if (r) {
          r.classList.add("ready");
          const s = r.querySelector(".g-state");
          if (s) s.textContent = s.dataset.ready;
        }
        light(t, ".dg-node", 0);
      });
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const kind = entry.target.dataset.diagram;
        if (kind === "gateway") playGateway(entry.target);
        else if (kind === "gate") playGate(entry.target);
        else entry.target.classList.add("play");
      });
    }, { threshold: 0.35 });

    targets.forEach((t) => io.observe(t));
  }

  function applyMotionI18n() {
    const dict = window.I18N && window.I18N.en;
    if (!dict) return;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && Object.prototype.hasOwnProperty.call(dict, key)) {
        el.textContent = dict[key];
      }
    });
  }

  function initMotionRoots() {
    const roots = document.querySelectorAll("[data-motion-root]");
    if (!roots.length) return;

    const params = new URLSearchParams(window.location.search);
    const staticOverride =
      params.get("motion") === "static" ||
      document.documentElement.dataset.motion === "static";
    const requestedStep = params.get("step");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        document.documentElement.dataset.fontsReady = "true";
      });
    }

    roots.forEach((root) => {
      const count = Number(root.dataset.stepCount);
      const styles = getComputedStyle(root);
      const hold = parseFloat(styles.getPropertyValue("--motion-hold")) || 420;
      const loopPause =
        parseFloat(styles.getPropertyValue("--motion-loop-pause")) || 10000;
      const parsedStep =
        requestedStep !== null && /^\d+$/.test(requestedStep)
          ? Number(requestedStep)
          : null;
      const exactStep =
        params.get("motion") === "step" &&
        Number.isSafeInteger(parsedStep) &&
        parsedStep >= 0 &&
        parsedStep <= count
          ? parsedStep
          : null;
      const items = Array.from(root.querySelectorAll("[data-motion-item]"));

      let step = 0;
      let timer = 0;
      let playing = false;

      const clearClock = () => {
        window.clearTimeout(timer);
        timer = 0;
      };

      function render(next) {
        step = Math.max(0, Math.min(count, next));
        root.dataset.stepCurrent = String(step);
        root.dataset.frame =
          step === count ? "end" : step === 0 ? "start" : "step";
        items.forEach((item) => {
          const itemStep = Number(item.dataset.step);
          item.classList.toggle("is-visible", itemStep <= step);
          item.classList.toggle("is-current", itemStep === step);
        });
      }

      function pause() {
        clearClock();
        playing = false;
        root.classList.remove("is-playing");
      }

      function tick() {
        if (!playing) return;
        if (step >= count) {
          /* Reset briefly to 0 so draw-path and step transitions replay cleanly */
          render(0);
          timer = window.setTimeout(() => {
            if (!playing) return;
            render(1);
            timer = window.setTimeout(tick, hold);
          }, 160);
          return;
        }
        const nextStep = step + 1;
        render(nextStep);
        /* Hold for 10 seconds on the completed frame before looping again */
        const nextDelay = nextStep >= count ? loopPause : hold;
        timer = window.setTimeout(tick, nextDelay);
      }

      function playLoop() {
        clearClock();
        playing = true;
        root.classList.add("is-playing");
        render(1);
        timer = window.setTimeout(tick, hold);
      }

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          if (playing) pause();
        } else if (
          !staticOverride &&
          !reduce.matches &&
          exactStep === null &&
          root.dataset.motionMode !== "none"
        ) {
          playLoop();
        }
      });

      reduce.addEventListener("change", (event) => {
        pause();
        if (event.matches) {
          render(count);
          root.dataset.frame = "static";
          root.dataset.motionState = "reduced";
        } else if (staticOverride || root.dataset.motionMode === "none") {
          render(count);
          root.dataset.frame = "static";
          root.dataset.motionState = "static";
        } else {
          delete root.dataset.motionState;
          if (exactStep !== null) {
            render(exactStep);
            root.dataset.frame = "step";
            root.dataset.motionState = "test";
          } else {
            playLoop();
          }
        }
      });

      root.classList.add("motion-ready");

      if (staticOverride) {
        document.documentElement.dataset.motion = "static";
        pause();
        render(count);
        root.dataset.frame = "static";
        root.dataset.motionState = "static";
      } else if (reduce.matches || root.dataset.motionMode === "none") {
        pause();
        render(count);
        root.dataset.frame = "static";
        root.dataset.motionState = reduce.matches ? "reduced" : "static";
      } else if (exactStep !== null) {
        document.documentElement.dataset.motion = "step";
        pause();
        render(exactStep);
        root.dataset.frame = "step";
        root.dataset.motionState = "test";
      } else {
        playLoop();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyMotionI18n();
    document.querySelectorAll("[data-diagram]").forEach(measureLinks);
    observeDiagrams();
    initMotionRoots();
  });
})();
