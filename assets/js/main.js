/*
  i18n, profile, navigation, counters and the page terminal.
*/

(function () {
  "use strict";

  const lang = "en"; /* the site is set to English-only */

  /* marker: controls that need JS must not appear as dead buttons without JS */
  document.documentElement.dataset.js = "1";

  const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || (window.I18N.en[key] || key);
  const pick = (obj) => (obj && (obj[lang] || obj.en)) || "";

  /* read by showcase.js so components rendered by JS follow both languages */
  window.PF = {
    t: t,
    lang: () => lang,
    escape: (s) => String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ))
  };

  function setSafeHtml(el, str) {
    el.replaceChildren();
    if (!str) return;
    const doc = new DOMParser().parseFromString(str, "text/html");
    while (doc.body.firstChild) {
      el.appendChild(doc.body.firstChild);
    }
  }

  /* ---------- static translations ---------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      setSafeHtml(el, t(el.dataset.i18nHtml));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
      });
    });
    /* ready text for the gate, used by diagrams.js */
    document.querySelectorAll(".g-state").forEach((el) => {
      el.dataset.ready = t("sec.gate.ready");
      if (el.closest(".gate-result").classList.contains("ready")) {
        el.textContent = t("sec.gate.ready");
      }
    });
  }

  /* ---------- personal data from config.js ---------- */
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

    document.title = (P.name || "Portfolio") + ", " + pick(P.role);

    /* social links */
    const linksBox = document.querySelector("[data-profile='links']");
    if (linksBox) {
      linksBox.replaceChildren();
      (P.links || []).forEach((l) => {
        const a = document.createElement("a");
        a.href = l.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = l.label + " ↗";
        linksBox.appendChild(a);
      });
    }

    /* experience timeline */
    const tl = document.querySelector("[data-profile='experience']");
    if (tl) {
      tl.replaceChildren();
      (P.experience || []).forEach((e) => {
        const item = document.createElement("div");
        item.className = "tl-item";

        const period = document.createElement("div");
        period.className = "tl-period";
        period.textContent = pick(e.period) || "";

        const title = document.createElement("h3");
        title.className = "tl-title";
        title.textContent = pick(e.title) || "";

        const company = document.createElement("div");
        company.className = "tl-company";
        company.textContent = pick(e.company) || "";

        item.append(period, title, company);

        const pts = pick(e.points) || [];
        if (pts.length) {
          const ul = document.createElement("ul");
          ul.className = "tl-points";
          pts.forEach((p) => {
            const li = document.createElement("li");
            li.textContent = p;
            ul.appendChild(li);
          });
          item.appendChild(ul);
        }
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

  /* ---------- stat counters ---------- */
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

  /* ---------- typing terminal ---------- */
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
    /* start once the hero is visible */
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); typeLine(); }
    }, { threshold: 0.4 });
    io.observe(body);
  }

  /* ---------- nav: active section + mobile menu ---------- */
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
      if (best) map.get(best).classList.add("active"); /* in the hero: nothing is active */
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

  /* ---------- skill references → project cards ---------- */
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
      /* the anchor takes the user to the project; the flash follows after the scroll */
      a.addEventListener("click", () => setTimeout(flash, 500));
    });
  }

  /* ---------- two reading depths (Skim / Deep) ---------- */
  function initDepth() {
    const root = document.documentElement;
    const btns = [].slice.call(document.querySelectorAll("[data-depth-btn]"));
    const label = btns.length ? btns[0].querySelector("[data-i18n]") : null;
    const skim = () => root.dataset.depth === "skim";
    const set = (on) => {
      root.dataset.depth = on ? "skim" : "deep";
      btns.forEach((b) => b.setAttribute("aria-pressed", String(on)));
      /* the button changes its verb, not only its state: "Highlights only
         · off" never says what happens once it is pressed */
      if (label) label.textContent = t(on ? "depth.deep" : "depth.skim");
    };
    btns.forEach((b) => b.addEventListener("click", () => set(!skim())));
    if (new URLSearchParams(location.search).get("view") === "skim") set(true);
    /* link to a section that is hidden: open it first, then jump */
    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || !skim()) return;
      const target = document.getElementById(a.getAttribute("href").slice(1));
      if (target && target.matches("[data-deep]")) set(false);
    });
  }

  /* ---------- portrait: on a phone it moves into the contact card ---------- */
  function initPhotoSlot() {
    const mq = window.matchMedia("(max-width: 860px)");
    const photo = document.querySelector(".hero-photo");
    const card = document.querySelector(".contact-meta");
    const hero = document.querySelector(".hero-grid");
    if (!photo || !card || !hero) return;
    const place = (mobile) => {
      if (mobile) card.insertBefore(photo, card.firstChild);
      else if (photo.parentElement !== hero) hero.appendChild(photo);
    };
    place(mq.matches);
    mq.addEventListener("change", (e) => place(e.matches));
  }

  /* ---------- stack strip: a swipeable name board ----------
     What moves is the row's own scrollLeft, not a transform, so
     one control serves both directions: the lane drifts slowly, and a finger pulling it
     still works like swiping an ordinary row. While touched / scrolled /
     focused it holds still, then resumes 1.4 seconds after the last interaction, from
     that position, not from the start. There is no pause button: what stops is
     the animation, not the user's right.
     The content is duplicated once so the loop never ends; the copy
     is aria-hidden so a screen reader names each tool one time.
     Without JS or with reduced-motion: no cloning, the row stays
     swipeable as before. */
  function initStackMarquee() {
    const row = document.querySelector(".hs-row");
    if (!row) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chips = [].slice.call(row.children);
    if (chips.length < 2) return;
    if (row.scrollWidth <= row.clientWidth + 8) return;   /* fits in full: no need to run */

    const set = document.createElement("div");
    set.className = "hs-set";
    chips.forEach((c) => set.appendChild(c));
    const track = document.createElement("div");
    track.className = "hs-track";
    const clone = set.cloneNode(true);
    clone.classList.add("hs-clone");
    clone.setAttribute("aria-hidden", "true");
    track.append(set, clone);
    row.appendChild(track);
    row.classList.add("hs-marquee");

    /* one lap = the width of one set, including the separator gap at its end. Positions p
       and p + period show the same content, so clamping scrollLeft into
       [0, period) is never seen as a jump. */
    const period = set.getBoundingClientRect().width + 12;
    const SPEED = 26;                 /* px per second, fixed, independent of how long the content is */
    const RESUME_AFTER = 1400;
    let idleAt = 0, hovered = false, focused = false, offscreen = false;
    const hold = () => { idleAt = performance.now() + RESUME_AFTER; };
    ["touchstart", "touchend", "pointerdown", "pointerup", "wheel", "keydown"]
      .forEach((ev) => row.addEventListener(ev, hold, { passive: true }));
    /* hover only if the device really has hover: on touch screens :hover
       sticks until the next touch, so it does not mean "still being read" */
    if (window.matchMedia("(hover: hover)").matches) {
      row.addEventListener("mouseenter", () => { hovered = true; });
      row.addEventListener("mouseleave", () => { hovered = false; });
    }
    row.addEventListener("focusin", () => { focused = true; });
    row.addEventListener("focusout", () => { focused = false; });
    /* do not move something that is not visible */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { offscreen = !es[0].isIntersecting; },
        { threshold: 0 }).observe(row);
    }
    let last = performance.now();
    /* scrollLeft reads back as an integer at DPR 1, and one frame
       is only 0.42px at 26px/s. If the position were re-read from scrollLeft,
       that rounding would snap it back to the same value every time and the lane would
       never move. x is the real position; scrollLeft is only paid back
       to the browser each frame. */
    let x = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);   /* a left-behind tab must not jump */
      last = now;
      if (now < idleAt || hovered || focused || offscreen) {
        x = row.scrollLeft;                            /* a finger holding on: follow it, do not fight it */
      } else {
        x = (x + SPEED * dt) % period;
        row.scrollLeft = x;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- accordion Runtime + Decisions (C2) ---------- */
  function initFold() {
    const narrow = window.matchMedia("(max-width: 760px)");
    const cards = document.querySelectorAll("#runtime .dec-card, #decisions .dec-card");
    cards.forEach((card) => {
      const btn = card.querySelector(".dec-fold");
      if (!btn) return;
      const label = btn.querySelector("span");
      const setOpen = (on) => {
        if (on) delete card.dataset.fold; else card.dataset.fold = "closed";
        btn.setAttribute("aria-expanded", String(on));
        if (label) label.textContent = t(on ? "dec.fold.hide" : "dec.fold.show");
      };
      /* the first card of each section stays open so readers know the rest can open */
      setOpen(!(narrow.matches && card.previousElementSibling));
      btn.addEventListener("click", () => setOpen(card.dataset.fold === "closed"));
    });
    /* the screen widens: the hidden state no longer applies, labels are synced */
    narrow.addEventListener("change", (e) => {
      if (!e.matches) {
        cards.forEach((c) => {
          delete c.dataset.fold;
          const b = c.querySelector(".dec-fold");
          if (b) {
            b.setAttribute("aria-expanded", "true");
            const l = b.querySelector("span");
            if (l) l.textContent = t("dec.fold.hide");
          }
        });
      }
    });
  }

  /* ---------- C4: the contact pill that waits until the hero is past ---------- */
  function initMobileCta() {
    const cta = document.querySelector("[data-mcta]");
    const hero = document.querySelector(".hero");
    const contact = document.querySelector("#contact");
    if (!cta || !hero || !contact || !("IntersectionObserver" in window)) return;
    let inHero = true, inContact = false;
    const sync = () => { cta.hidden = inHero || inContact; };
    new IntersectionObserver((es) => { inHero = es[0].isIntersecting; sync(); }).observe(hero);
    new IntersectionObserver((es) => { inContact = es[0].isIntersecting; sync(); }).observe(contact);
  }

  /* ---------- copy email ---------- */
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
    initDepth();
    initFold();
    initStackMarquee();
    initPhotoSlot();
    initMobileCta();
    initCopy();

  });
})();
