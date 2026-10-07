/* ============================================================
   main.js — i18n, profil, navigasi, counter, terminal
   ============================================================ */

(function () {
  "use strict";

  const lang = "en"; /* situs ditetapkan English-only */

  const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || (window.I18N.en[key] || key);
  const pick = (obj) => (obj && (obj[lang] || obj.en)) || "";

  /* diakses showcase.js agar komponen yang dirender JS ikut dua bahasa */
  window.PF = {
    t: t,
    lang: () => lang,
    escape: (s) => String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ))
  };

  /* ---------- terjemahan statis ---------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
      });
    });
    /* teks siap untuk gate, dipakai diagrams.js */
    document.querySelectorAll(".g-state").forEach((el) => {
      el.dataset.ready = t("sec.gate.ready");
      if (el.closest(".gate-result").classList.contains("ready")) {
        el.textContent = t("sec.gate.ready");
      }
    });
  }

  /* ---------- data pribadi dari config.js ---------- */
  function renderProfile() {
    const P = window.PROFILE || {};
    const set = (sel, val) => {
      if (val == null) return;
      document.querySelectorAll(sel).forEach((el) => { el.textContent = val; });
    };
    set("[data-profile='name']", P.name);
    set("[data-profile='monogram']", P.monogram);
    set("[data-profile='brand-name']", P.name);
    set("[data-profile='role']", pick(P.role));
    set("[data-profile='email']", P.email);
    set("[data-profile='location']", P.location);

    const mail = document.querySelector("[data-profile='email-link']");
    if (mail && P.email) {
      mail.href = "mailto:" + P.email;
      mail.textContent = P.email;
    }

    document.title = (P.name || "Portfolio") + " — " + pick(P.role);

    /* tautan sosial */
    const linksBox = document.querySelector("[data-profile='links']");
    if (linksBox) {
      linksBox.innerHTML = "";
      (P.links || []).forEach((l) => {
        const a = document.createElement("a");
        a.href = l.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = l.label + " ↗";
        linksBox.appendChild(a);
      });
    }

    /* timeline pengalaman */
    const tl = document.querySelector("[data-profile='experience']");
    if (tl) {
      tl.innerHTML = "";
      (P.experience || []).forEach((e) => {
        const item = document.createElement("div");
        item.className = "tl-item";
        const pts = (pick(e.points) || []).map((p) => "<li>" + escapeHtml(p) + "</li>").join("");
        item.innerHTML =
          '<div class="tl-period">' + escapeHtml(pick(e.period)) + "</div>" +
          '<h3 class="tl-title">' + escapeHtml(pick(e.title)) + "</h3>" +
          '<div class="tl-company">' + escapeHtml(pick(e.company)) + "</div>" +
          /* jangan buang <ul> kosong supaya tidak ada jarak hantu di timeline */
          (pts ? '<ul class="tl-points">' + pts + "</ul>" : "");
        tl.appendChild(item);
      });
    }

    const yr = document.querySelector("[data-profile='year']");
    if (yr) yr.textContent = String(new Date().getFullYear());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ---------- counter statistik ---------- */
  function initCounters() {
    const els = document.querySelectorAll("[data-count]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = (el) => {
      el.textContent = t(el.dataset.i18n || "");
    };

    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const suffixEn = el.dataset.suffixEn || "";
      const suffixId = el.dataset.suffixId || suffixEn;
      const suffix = lang === "id" ? suffixId : suffixEn;
      if (reduced) { finish(el); return; }
      const dur = 1300;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = (target * eased).toFixed(decimals);
        el.textContent = (lang === "id" ? val.replace(".", ",") : val) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else finish(el);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          io.unobserve(en.target);
          run(en.target);
        }
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- terminal mengetik ---------- */
  function initTerminal() {
    const body = document.querySelector(".terminal-body");
    if (!body) return;
    const lines = Array.from(body.querySelectorAll(".ln"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const texts = lines.map((l) => l.textContent);
    if (reduced) return;
    lines.forEach((l) => (l.textContent = ""));

    let li = 0;
    function typeLine() {
      if (li >= lines.length) return;
      const el = lines[li];
      const text = texts[li];
      const isCmd = el.classList.contains("cmd");
      let ci = 0;
      const speed = isCmd ? 42 : 12;
      const tick = () => {
        ci += 1;
        el.textContent = text.slice(0, ci);
        if (ci < text.length) setTimeout(tick, speed);
        else { li += 1; setTimeout(typeLine, isCmd ? 260 : 120); }
      };
      setTimeout(tick, isCmd ? 200 : 40);
    }
    /* mulai saat hero terlihat */
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); typeLine(); }
    }, { threshold: 0.4 });
    io.observe(body);
  }

  /* ---------- nav: active section + menu mobile ---------- */
  function initNav() {
    const links = Array.from(document.querySelectorAll(".nav a[href^='#']"));
    const map = new Map();
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec) map.set(sec, a);
    });
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target);
      });
      links.forEach((l) => l.classList.remove("active"));
      let best = null;
      visible.forEach((sec) => { if (!best || sec.offsetTop < best.offsetTop) best = sec; });
      if (best) map.get(best).classList.add("active"); /* di hero: tidak ada yang aktif */
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, sec) => io.observe(sec));

    const menuBtn = document.querySelector("[data-menu-btn]");
    const nav = document.querySelector(".nav");
    if (menuBtn && nav) {
      menuBtn.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", String(open));
      });
      nav.addEventListener("click", (e) => {
        if (e.target.tagName === "A") nav.classList.remove("open");
      });
    }
  }

  /* ---------- referensi skill → kartu proyek ---------- */
  function initSkillRefs() {
    document.querySelectorAll(".ref").forEach((a) => {
      const target = document.getElementById(a.dataset.ref);
      if (!target) return;
      const flash = () => {
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1500);
      };
      a.addEventListener("mouseenter", flash);
      a.addEventListener("focus", flash);
      /* anchor membawa user ke proyek; flash menyusul setelah scroll */
      a.addEventListener("click", () => setTimeout(flash, 500));
    });
  }

  /* ---------- salin email ---------- */
  function initCopy() {
    const btn = document.querySelector("[data-copy-btn]");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const email = (window.PROFILE || {}).email || "";
      try {
        await navigator.clipboard.writeText(email);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = email;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const original = t("contact.cta");
      btn.textContent = t("contact.copied");
      btn.classList.add("done");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("done");
      }, 1600);
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderProfile();
    applyI18n();
    initCounters();
    initTerminal();
    initNav();
    initSkillRefs();
    initCopy();

  });
})();
