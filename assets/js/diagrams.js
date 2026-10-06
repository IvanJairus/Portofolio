/* ============================================================
   diagrams.js — urutan animasi diagram arsitektur, pipeline, gate
   Semua diagram hanya bermain saat masuk viewport, sekali saja,
   dan dimatikan total bila prefers-reduced-motion.
   ============================================================ */

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ukur panjang tiap garis SVG supaya animasi "draw" presisi */
  function measureLinks(scope) {
    scope.querySelectorAll(".dg-link").forEach((p) => {
      try {
        const len = Math.ceil(p.getTotalLength());
        p.style.setProperty("--len", len);
      } catch (e) { /* elemen non-path: abaikan */ }
    });
  }

  /* ---------- diagram 1: gateway ---------- */
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

  /* ---------- diagram 3: security gate ---------- */
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

  /* ---------- observer umum ---------- */
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
        else entry.target.classList.add("play"); /* flow: murni CSS */
      });
    }, { threshold: 0.35 });

    targets.forEach((t) => io.observe(t));
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-diagram]").forEach(measureLinks);
    observeDiagrams();
  });
})();
