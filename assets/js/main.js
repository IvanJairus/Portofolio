/*
  i18n, profil, navigasi, counter dan terminal halaman.
*/

(function () {
  "use strict";

  const lang = "en"; /* situs ditetapkan English-only */

  /* penanda: kontrol yang butuh JS tidak boleh tampil sebagai tombol mati tanpa JS */
  document.documentElement.dataset.js = "1";

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

  function setSafeHtml(el, str) {
    el.replaceChildren();
    if (!str) return;
    const doc = new DOMParser().parseFromString(str, "text/html");
    while (doc.body.firstChild) {
      el.appendChild(doc.body.firstChild);
    }
  }

  /* ---------- terjemahan statis ---------- */
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

    document.title = (P.name || "Portfolio") + ", " + pick(P.role);

    /* tautan sosial */
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

    /* timeline pengalaman */
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

  /* ---------- dua kedalaman baca (Skim / Deep) ---------- */
  function initDepth() {
    const root = document.documentElement;
    const btns = [].slice.call(document.querySelectorAll("[data-depth-btn]"));
    const label = btns.length ? btns[0].querySelector("[data-i18n]") : null;
    const skim = () => root.dataset.depth === "skim";
    const set = (on) => {
      root.dataset.depth = on ? "skim" : "deep";
      btns.forEach((b) => b.setAttribute("aria-pressed", String(on)));
      /* tombolnya berubah kata kerja, bukan cuma berubah state: "Highlights only
         · off" tidak memberi tahu apa yang terjadi setelah ditekan */
      if (label) label.textContent = t(on ? "depth.deep" : "depth.skim");
    };
    btns.forEach((b) => b.addEventListener("click", () => set(!skim())));
    if (new URLSearchParams(location.search).get("view") === "skim") set(true);
    /* tautan ke section yang sedang disembunyikan: buka dulu, baru lompat */
    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || !skim()) return;
      const target = document.getElementById(a.getAttribute("href").slice(1));
      if (target && target.matches("[data-deep]")) set(false);
    });
  }

  /* ---------- potret: di ponsel ia pindah ke kartu kontak ---------- */
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

  /* ---------- strip stack: papan nama yang bisa digeser ----------
     Yang digerakkan adalah scrollLeft barisnya sendiri, bukan transform, jadi
     satu kontrol melayani dua arah: lajur berjalan pelan, dan jari yang menarik
     tetap bekerja seperti menggeser baris biasa. Selama disentuh / di-scroll /
     difokus ia diam, lalu lanjut 1,4 detik setelah interaksi terakhir - dari
     posisi itu, bukan dari awal. Tidak ada tombol pause: yang berhenti adalah
     animasinya, bukan hak penggunanya.
     Isinya diduplikasi sekali supaya putarannya tidak pernah berakhir; salinan
     itu aria-hidden sehingga pembaca layar menyebut setiap alat satu kali.
     Tanpa JS atau dengan reduced-motion: tidak ada kloning, barisnya tetap bisa
     digeser seperti semula. */
  function initStackMarquee() {
    const row = document.querySelector(".hs-row");
    if (!row) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chips = [].slice.call(row.children);
    if (chips.length < 2) return;
    if (row.scrollWidth <= row.clientWidth + 8) return;   /* muat seluruhnya: tidak perlu berjalan */

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

    /* satu putaran = lebar satu set, termasuk gap pemisah di akhirnya. Posisi p
       dan p + period menampilkan isi yang sama, jadi memelotkan scrollLeft ke
       dalam [0, period) tidak pernah terlihat sebagai lompatan. */
    const period = set.getBoundingClientRect().width + 12;
    const SPEED = 26;                 /* px per detik - tetap, tidak bergantung panjang isi */
    const RESUME_AFTER = 1400;
    let idleAt = 0, hovered = false, focused = false, offscreen = false;
    const hold = () => { idleAt = performance.now() + RESUME_AFTER; };
    ["touchstart", "touchend", "pointerdown", "pointerup", "wheel", "keydown"]
      .forEach((ev) => row.addEventListener(ev, hold, { passive: true }));
    /* hover hanya bila perangkatnya memang punya hover - di layar sentuh :hover
       menempel sampai sentuhan berikutnya, jadi itu bukan "masih dibaca" */
    if (window.matchMedia("(hover: hover)").matches) {
      row.addEventListener("mouseenter", () => { hovered = true; });
      row.addEventListener("mouseleave", () => { hovered = false; });
    }
    row.addEventListener("focusin", () => { focused = true; });
    row.addEventListener("focusout", () => { focused = false; });
    /* jangan menggerakkan sesuatu yang tidak terlihat */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { offscreen = !es[0].isIntersecting; },
        { threshold: 0 }).observe(row);
    }
    let last = performance.now();
    /* scrollLeft dibaca-back dalam bilangan bulat pada DPR 1, dan satu frame
       hanya 0,42px di 26px/s - kalau posisinya diambil ulang dari scrollLeft,
       pembulatan itu membuatnya selalu kembali ke angka tadi dan lajur tidak
       pernah jalan. x adalah posisinya yang sebenarnya; scrollLeft cuma dibayar
       ke browser setiap frame. */
    let x = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);   /* tab yang ditinggal tidak boleh melompat */
      last = now;
      if (now < idleAt || hovered || focused || offscreen) {
        x = row.scrollLeft;                            /* jari yang pegang: ikuti, jangan dilawan */
      } else {
        x = (x + SPEED * dt) % period;
        row.scrollLeft = x;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- accordeon Runtime + Decisions (C2) ---------- */
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
      /* kartu pertama tiap seksi tetap terbuka supaya pembaca tahu isinya bisa dibuka */
      setOpen(!(narrow.matches && card.previousElementSibling));
      btn.addEventListener("click", () => setOpen(card.dataset.fold === "closed"));
    });
    /* layar melebar: status tersembunyi tidak berlaku lagi, label disamakan */
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

  /* ---------- C4: pil kontak yang menunggu sampai hero lewat ---------- */
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
    initDepth();
    initFold();
    initStackMarquee();
    initPhotoSlot();
    initMobileCta();
    initCopy();

  });
})();
