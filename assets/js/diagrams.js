/*
  Animation sequence for the architecture, pipeline and gate diagrams. Each diagram
  plays only when it enters the viewport, once, and is fully off when
  prefers-reduced-motion is on.
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

  /* diagram 1: gateway */
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

  /* diagram 3: security gate */
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

  /* shared observer */
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
        else entry.target.classList.add("play"); /* flow: pure CSS */
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
      const hold =
        parseFloat(getComputedStyle(root).getPropertyValue("--motion-hold")) ||
        900;
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
      const labels = Array.from({ length: count + 1 }, (_, index) =>
        index === 0
          ? "Ready"
          : items
              .filter(
                (item) =>
                  !item.hasAttribute("data-motion-decorative") &&
                  Number(item.dataset.step) === index
              )
              .map((item) => item.getAttribute("aria-label"))
              .filter(Boolean)
              .join("; ")
      );
      const controls = root.querySelector("[data-motion-controls]");
      const status = root.querySelector("[data-motion-status]");
      const visibleStep = root.querySelector("[data-motion-step-label]");
      if (!controls || !status) return;

      let step = count;
      let timer = 0;
      let playing = false;
      let stepBeforeReduce = count;
      let resumeAfterReduce = root.dataset.motionMode === "reveal";

      const buttons = (action) =>
        controls.querySelector('[data-motion-action="' + action + '"]');
      const clearClock = () => {
        window.clearTimeout(timer);
        timer = 0;
      };
      const announce = () => {
        status.textContent =
          "Step " +
          step +
          " of " +
          count +
          ": " +
          (labels[step] || "Complete");
      };
      const setControlsAvailable = (available) => {
        controls.hidden = !available;
        controls.setAttribute("aria-hidden", String(!available));
        controls.dataset.playbackDisabled = String(!available);
        controls.querySelectorAll("button").forEach((control) => {
          control.disabled = !available;
        });
      };

      function render(next, userInitiated) {
        step = Math.max(0, Math.min(count, next));
        root.dataset.stepCurrent = String(step);
        root.dataset.frame =
          step === count ? "end" : step === 0 ? "start" : "step";
        items.forEach((item) => {
          const itemStep = Number(item.dataset.step);
          item.classList.toggle("is-visible", itemStep <= step);
          item.classList.toggle("is-current", itemStep === step);
        });
        if (visibleStep) visibleStep.textContent = String(step);
        const unavailable = controls.dataset.playbackDisabled === "true";
        const prevBtn = buttons("prev");
        const nextBtn = buttons("next");
        if (prevBtn) prevBtn.disabled = unavailable;
        if (nextBtn) nextBtn.disabled = unavailable;
        if (userInitiated) announce();
      }

      function pause(userInitiated) {
        clearClock();
        playing = false;
        root.classList.remove("is-playing");
        const playBtn = buttons("play");
        const pauseBtn = buttons("pause");
        if (playBtn) playBtn.setAttribute("aria-pressed", "false");
        if (pauseBtn) pauseBtn.setAttribute("aria-pressed", "true");
        if (userInitiated) {
          status.textContent = "Paused at step " + step + " of " + count;
        }
      }

      function finish() {
        pause(false);
        root.dataset.frame = "end";
        status.textContent = "Complete · step " + count + " of " + count;
      }

      function tick() {
        if (!playing) return;
        if (step >= count) {
          finish();
          return;
        }
        render(step + 1, false);
        if (step >= count) {
          finish();
          return;
        }
        timer = window.setTimeout(tick, hold);
      }

      function play(fromStart, userInitiated) {
        clearClock();
        if (fromStart || step >= count) render(0, userInitiated);
        playing = true;
        root.classList.add("is-playing");
        const playBtn = buttons("play");
        const pauseBtn = buttons("pause");
        if (playBtn) playBtn.setAttribute("aria-pressed", "true");
        if (pauseBtn) pauseBtn.setAttribute("aria-pressed", "false");
        timer = window.setTimeout(tick, hold);
      }

      controls.addEventListener("click", (event) => {
        const button = event.target.closest("[data-motion-action]");
        if (!button) return;
        const action = button.dataset.motionAction;
        if (action === "play") play(false, true);
        if (action === "pause") pause(true);
        if (action === "replay") play(true, true);
        if (action === "prev") {
          pause(false);
          render(step <= 0 ? count : step - 1, true);
        }
        if (action === "next") {
          pause(false);
          render(step >= count ? 1 : step + 1, true);
        }
      });

      root.addEventListener("keydown", (event) => {
        if (event.target.matches("input, textarea, select, a[href]")) return;
        const keys = {
          ArrowLeft: step <= 0 ? count : step - 1,
          ArrowRight: step >= count ? 1 : step + 1,
          Home: 0,
          End: count
        };
        if (event.code === "Space" && !event.target.closest("button")) {
          event.preventDefault();
          if (playing) pause(true);
          else play(false, true);
          return;
        }
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          event.key.toLowerCase() === "r"
        ) {
          event.preventDefault();
          play(true, true);
          return;
        }
        if (!(event.key in keys)) return;
        event.preventDefault();
        pause(false);
        render(keys[event.key], true);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && playing) pause(false);
      });

      reduce.addEventListener("change", (event) => {
        if (event.matches && root.dataset.motionState !== "reduced") {
          stepBeforeReduce = step;
          resumeAfterReduce = playing;
        }
        pause(false);
        if (event.matches) {
          setControlsAvailable(false);
          render(count, false);
          root.dataset.frame = "static";
          root.dataset.motionState = "reduced";
          status.textContent =
            "Reduced motion · complete static frame · playback controls unavailable";
        } else if (staticOverride || root.dataset.motionMode === "none") {
          setControlsAvailable(false);
          render(count, false);
          root.dataset.frame = "static";
          root.dataset.motionState = "static";
          status.textContent =
            "Static frame · complete diagram · playback controls unavailable";
        } else {
          delete root.dataset.motionState;
          if (exactStep !== null) {
            setControlsAvailable(false);
            render(exactStep, false);
            root.dataset.frame = "step";
            root.dataset.motionState = "test";
            status.textContent =
              "Test frame · step " +
              step +
              " of " +
              count +
              " · playback controls unavailable";
          } else {
            setControlsAvailable(true);
            render(stepBeforeReduce, false);
            status.textContent = "Ready · step " + step + " of " + count;
            if (resumeAfterReduce && root.dataset.motionMode === "reveal") {
              play(false, false);
            }
          }
          resumeAfterReduce = false;
        }
      });

      if (staticOverride) {
        document.documentElement.dataset.motion = "static";
        pause(false);
        setControlsAvailable(false);
        render(count, false);
        root.dataset.frame = "static";
        root.dataset.motionState = "static";
        status.textContent =
          "Static frame · complete diagram · playback controls unavailable";
      } else if (reduce.matches || root.dataset.motionMode === "none") {
        pause(false);
        setControlsAvailable(false);
        render(count, false);
        root.dataset.frame = "static";
        root.dataset.motionState = reduce.matches ? "reduced" : "static";
        status.textContent = reduce.matches
          ? "Reduced motion · complete static frame · playback controls unavailable"
          : "Static frame · complete diagram · playback controls unavailable";
      } else if (exactStep !== null) {
        document.documentElement.dataset.motion = "step";
        pause(false);
        setControlsAvailable(false);
        render(exactStep, false);
        root.dataset.frame = "step";
        root.dataset.motionState = "test";
        status.textContent =
          "Test frame · step " +
          step +
          " of " +
          count +
          " · playback controls unavailable";
      } else if (root.dataset.motionMode === "reveal") {
        setControlsAvailable(true);
        render(0, false);
        play(false, false);
      } else {
        pause(false);
        setControlsAvailable(true);
        render(count, false);
        status.textContent = "Ready · step " + count + " of " + count;
      }
      root.classList.add("motion-ready");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyMotionI18n();
    document.querySelectorAll("[data-diagram]").forEach(measureLinks);
    observeDiagrams();
    initMotionRoots();
  });
})();

