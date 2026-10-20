/*
  i18n, profile, navigation, counters and the page terminal.
*/

(function () {
  "use strict";

  const lang = "en";

  /* marker: controls that need JS must not appear as dead buttons without JS */
  document.documentElement.dataset.js = "1";

  const t = (key) => (window.I18N && window.I18N[lang] && window.I18N[lang][key]) ||
                     (window.I18N && window.I18N.en && window.I18N.en[key]) || key;
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

  function applyI18n() {
    document.documentElement.lang = lang;
    if (!window.I18N) return;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      if (el.dataset.i18n === "tm.lead" || el.dataset.i18n === "depth.hidden") return;
      const val = t(el.dataset.i18n);
      if (val) el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const val = t(el.dataset.i18nHtml);
      if (val) setSafeHtml(el, val);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        if (attr && key) {
          const val = t(key.trim());
          if (val) el.setAttribute(attr.trim(), val);
        }
      });
    });
    /* ready text for the gate, used by diagrams.js */
    document.querySelectorAll(".g-state").forEach((el) => {
      const ready = t("sec.gate.ready");
      if (ready) {
        el.dataset.ready = ready;
        if (el.closest(".gate-result").classList.contains("ready")) {
          el.textContent = ready;
        }
      }
    });
  }

  /* personal data from config.js */
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

    if (window.PROFILE && P.name && pick(P.role)) {
      document.title = (P.name || "Portfolio") + ", " + pick(P.role);
    }

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

  function initTerminal() {
    const body = document.querySelector(".terminal-body");
    if (!body) return;
    const lines = Array.from(body.querySelectorAll(".ln"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const texts = lines.map((l) => l.textContent);

    if (!reduced) {
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

    /* Appends simulated CLI output to the terminal body without layout shift. */
    const chips = Array.from(document.querySelectorAll("[data-term-cmd]"));
    if (!chips.length) return;

    const commands = {
      impact: {
        cmd: "$ ivan --impact",
        out: "53 services · 2 CI engines · ~90% lead time cut",
        dim: false
      },
      incident: {
        cmd: "$ ivan --incident",
        out: "zero prod spill · MTTR 14m · gate rule #38 enforced",
        dim: true
      }
    };

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmdKey = btn.dataset.termCmd;
        if (cmdKey === "clear") {
          body.querySelectorAll(".active-run").forEach((el) => el.remove());
          chips.forEach((c) => c.classList.remove("active"));
          return;
        }

        const data = commands[cmdKey];
        if (!data) return;

        const existing = Array.from(body.querySelectorAll(".ln.cmd.active-run"));
        if (existing.some((el) => el.textContent === data.cmd)) return;

        btn.classList.add("active");
        const cmdEl = document.createElement("div");
        cmdEl.className = "ln cmd active-run";
        const outEl = document.createElement("div");
        outEl.className = "ln out active-run" + (data.dim ? " dim-out" : "");

        body.appendChild(cmdEl);
        body.appendChild(outEl);

        if (reduced) {
          cmdEl.textContent = data.cmd;
          outEl.textContent = data.out;
          return;
        }

        let ci = 0;
        const tickCmd = () => {
          ci += 1;
          cmdEl.textContent = data.cmd.slice(0, ci);
          if (ci < data.cmd.length) {
            setTimeout(tickCmd, 25);
          } else {
            let oi = 0;
            const tickOut = () => {
              oi += 1;
              outEl.textContent = data.out.slice(0, oi);
              if (oi < data.out.length) {
                setTimeout(tickOut, 10);
              }
            };
            setTimeout(tickOut, 80);
          }
        };
        tickCmd();
      });
    });
  }

  /* nav: active section + mobile menu */
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
    if (menuBtn && nav && !document.getElementById("nav-drawer")) {
      menuBtn.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", String(open));
      });
      nav.addEventListener("click", (e) => {
        if (e.target.tagName === "A") nav.classList.remove("open");
      });
    }
  }

  /* ==========================================================================
     Mobile Drawer Navigation & Global Focus Management
     ========================================================================== */

  function initMobileDrawer() {
    const toggleBtn = document.getElementById("nav-toggle") || document.querySelector("[data-menu-btn]");
    const drawer = document.getElementById("nav-drawer");
    const scrim = document.getElementById("nav-scrim");
    const closeBtn = document.getElementById("nav-close");
    const mainContent = document.getElementById("main-content") || document.getElementById("top") || document.querySelector("main");
    const siteFooter = document.getElementById("site-footer") || document.querySelector(".site-footer") || document.querySelector("footer");

    if (!toggleBtn || !drawer) {
      return;
    }

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function isDrawerOpen() {
      return toggleBtn.getAttribute("aria-expanded") === "true";
    }

    function isElementVisible(el) {
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({ checkVisibilityCSS: true });
      }
      return el.offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";
    }

    function getFocusableElements() {
      return Array.from(drawer.querySelectorAll(focusableSelector))
        .filter((el) => !el.hasAttribute("disabled") && isElementVisible(el));
    }

    function setBackgroundInert(inert) {
      if (mainContent) {
        mainContent.inert = inert;
        if (inert) {
          mainContent.setAttribute("aria-hidden", "true");
        } else {
          mainContent.removeAttribute("aria-hidden");
        }
      }
      if (siteFooter) {
        siteFooter.inert = inert;
        if (inert) {
          siteFooter.setAttribute("aria-hidden", "true");
        } else {
          siteFooter.removeAttribute("aria-hidden");
        }
      }
    }

    function focusDrawerFirst() {
      const focusables = getFocusableElements();
      for (const el of focusables) {
        try {
          el.focus();
          if (document.activeElement === el) return true;
        } catch (_) {}
      }
      if (closeBtn && !closeBtn.hasAttribute("disabled")) {
        try {
          closeBtn.focus();
          if (document.activeElement === closeBtn) return true;
        } catch (_) {}
      }
      try {
        if (!drawer.hasAttribute("tabindex")) {
          drawer.setAttribute("tabindex", "-1");
        }
        drawer.focus();
        return document.activeElement === drawer;
      } catch (_) {}
      return false;
    }

    function openNav() {
      if (isDrawerOpen()) return;

      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.setAttribute("aria-label", "Close navigation menu");

      drawer.removeAttribute("hidden");
      drawer.classList.add("is-open");
      document.body.classList.add("nav-open");

      setBackgroundInert(true);

      const focused = focusDrawerFirst();
      if (!focused || !drawer.contains(document.activeElement)) {
        requestAnimationFrame(() => {
          if (!isDrawerOpen()) return;
          if (!drawer.contains(document.activeElement)) {
            focusDrawerFirst();
          }
        });
      }
    }

    function closeNav() {
      if (!isDrawerOpen()) return;

      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-label", "Open navigation menu");

      drawer.classList.remove("is-open");
      drawer.setAttribute("hidden", "");
      document.body.classList.remove("nav-open");

      setBackgroundInert(false);

      toggleBtn.focus();
    }

    // Toggle button handler
    toggleBtn.addEventListener("click", () => {
      if (isDrawerOpen()) {
        closeNav();
      } else {
        openNav();
      }
    });

    // Dedicated close button handler
    if (closeBtn) {
      closeBtn.addEventListener("click", closeNav);
    }

    // Backdrop scrim click dismissal
    if (scrim) {
      scrim.addEventListener("click", closeNav);
    }

    // Navigation link click dismissal
    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    // Escape key listener and Focus Trap
    document.addEventListener("keydown", (e) => {
      if (!isDrawerOpen()) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeNav();
        return;
      }

      if (e.key === "Tab") {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (!drawer.contains(document.activeElement)) {
          e.preventDefault();
          if (e.shiftKey) {
            last.focus();
          } else {
            first.focus();
          }
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Automatically close drawer when window resizes to desktop breakpoint
    const mql = window.matchMedia("(min-width: 900px)");
    mql.addEventListener("change", (e) => {
      if (e.matches && isDrawerOpen()) {
        closeNav();
      }
    });
  }

  /* skill references → project cards */
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

  /* two reading depths (Skim / Deep) */
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

  /* portrait: on a phone it moves into the contact card */
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

  /* Stack strip: a swipeable name board.
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

  /* C4: the contact pill that waits until the hero is past */
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

  document.addEventListener("DOMContentLoaded", () => {
    renderProfile();
    applyI18n();
    initCounters();
    initTerminal();
    initNav();
    initMobileDrawer();
    initSkillRefs();
    initDepth();
    initStackMarquee();
    initPhotoSlot();
    initMobileCta();
    initCopy();
  });
})();
