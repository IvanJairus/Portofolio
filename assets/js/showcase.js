/* ============================================================
   showcase.js — komponen interaktif portofolio:
   1. rel pipeline di hero
   2. konveyor matriks stack
   3. storyboard board GitLab (8 langkah, autoplay)
   4. chip ChatOps
   5. replika UI release control plane

   Semua data di dalam replika adalah dummy yang sudah disanitasi.
   ============================================================ */

(function () {
  "use strict";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function T(k) { return window.PF ? window.PF.t(k) : k; }
  function esc(s) { return window.PF ? window.PF.escape(s) : String(s); }

  function setSafeHtml(el, str) {
    el.replaceChildren();
    if (!str) return;
    var doc = new DOMParser().parseFromString(str, "text/html");
    while (doc.body.firstChild) {
      el.appendChild(doc.body.firstChild);
    }
  }

  /* ============================================================
     1. HERO — rel pipeline
     ============================================================ */
  function initHeroFlow() {
    var rail = document.querySelector('[data-flow="hero"]');
    if (!rail) return;
    var nodes = rail.querySelectorAll(".hf-node");
    /* tanpa gerak: semua tahap menyala, informasi tetap lengkap tanpa animasi */
    if (RM) { nodes.forEach(function (n) { n.classList.add("lit"); }); return; }

    var period = 7000;
    var busy = false;   /* satu putaran berjalan */
    var started = false;/* putaran pertama sudah pernah dipicu */

    function cycle() {
      nodes.forEach(function (n, i) {
        var at = period * ((i + 0.5) / nodes.length);
        setTimeout(function () {
          n.classList.add("lit");
          setTimeout(function () { n.classList.remove("lit"); }, 1000);
        }, at);
      });
    }

    /* satu putaran: paket melintas sekali lalu diam di ujung */
    function run() {
      if (busy) return;
      busy = true;
      rail.classList.remove("run");
      void rail.offsetWidth; /* reflow paksa agar animasi bisa diulang */
      rail.classList.add("run");
      cycle();
      setTimeout(function () { busy = false; }, period);
    }

    function maybeStart() {
      if (started || document.hidden) return;
      var r = rail.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        started = true;
        if (io) io.disconnect();
        run();
      }
    }

    var io = "IntersectionObserver" in window
      ? new IntersectionObserver(maybeStart, { threshold: 0.4 })
      : null;
    if (io) { io.observe(rail); } else { started = true; run(); }
    /* tab yang dibuka di latar belakang: jalankan saat pertama kali terlihat */
    document.addEventListener("visibilitychange", maybeStart);

    /* pengulangan hanya atas interaksi pengunjung, bukan loop tak berujung */
    rail.addEventListener("pointerenter", run);
    rail.addEventListener("focusin", run);
  }

  /* ============================================================
     2. KONVEYOR STACK
     ============================================================ */
  function initConveyor() {
    var cv = document.querySelector(".conveyor");
    if (!cv || RM || !("IntersectionObserver" in window)) { cv && cv.classList.add("run"); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { cv.classList.toggle("run", e.isIntersecting); });
    }, { threshold: 0.25 });
    io.observe(cv);
  }

  /* ============================================================
     3. STORYBOARD BOARD
     ============================================================ */
  var STEPS = [
    {
      col: 0, phase: "Intake", approvals: [],
      acts: [
        { who: "engineer", cls: "human", name: "manual", title: "Ticket sits in To do", body: "No branch, no state, no approvals yet. A plain GitLab board gives you columns and labels — nothing that a regulated release actually needs." }
      ],
      narr: "board.narr.1"
    },
    {
      col: 0, phase: "Dev Planning", approvals: ["team", "business", "product", "architecture"],
      acts: [
        { who: "gate", cls: "gate", name: "phase validator", title: "Phase flow validated", body: "Phases run in a fixed sequence. A jump is <b>reverted automatically</b> through the API with an explanatory comment — the board cannot be lied to." },
        { who: "gate", cls: "gate", name: "approval checker", title: "Approval chain complete", body: "team → business → product → architecture. One role may hold only one approval state; a contradictory second value clears both and posts a warning." }
      ],
      narr: "board.narr.2"
    },
    {
      col: 1, phase: "Development", approvals: ["team", "business", "product", "architecture"],
      acts: [
        { who: "engineer", cls: "human", name: "manual", title: "Card moved to In Dev", body: "This is the <b>only</b> manual step in the whole cycle." },
        { who: "bot", cls: "bot", name: "board bot", title: "✓ Branch Created", body: "<code>dev/sprint-24/issue-471</code> from <code>release/sprint-24</code> — naming derived from milestone and ticket number, so it is traceable forever." }
      ],
      narr: "board.narr.3"
    },
    {
      col: 1, phase: "Development", approvals: ["team", "business", "product", "architecture"],
      acts: [
        { who: "engineer", cls: "human", name: "manual", title: "3 commits pushed", body: "<code>a91f0c2</code> reconcile ledger rows · <code>7d4e118</code> add retry backoff · <code>c02b9af</code> tests" },
        { who: "gate", cls: "gate", name: "duplicate webhook guard", title: "Second webhook ignored", body: "GitLab sends the same event more than once. A 120s dedupe window and a per-cycle idempotency check make sure the automation never runs twice for one action." }
      ],
      narr: "board.narr.4"
    },
    {
      col: 2, phase: "Development", approvals: ["team", "business", "product", "architecture"],
      acts: [
        { who: "engineer", cls: "human", name: "manual", title: "Card moved to In Review", body: "" },
        { who: "bot", cls: "bot", name: "board bot", title: "Merge Request Created", body: "<code>!812</code> &nbsp; <code>dev/sprint-24/issue-471</code> → <code>release/sprint-24</code>, reviewers assigned from the milestone owners." },
        { who: "bot", cls: "bot", name: "scanner", title: "Quality scan triggered (parallel)", body: "Static analysis runs on the development branch the moment review starts, not the night before release. A 900s cooldown stops duplicate scans; a ChatOps command can bypass it deliberately." }
      ],
      narr: "board.narr.5"
    },
    {
      col: 3, phase: "Development", approvals: ["team", "business", "product", "architecture"], botmark: true,
      acts: [
        { who: "reviewer", cls: "human", name: "manual", title: "Approved and merged in the GitLab UI", body: "The bot never merges on a human's behalf. If the card is set to Merged too early, it posts the summary and <b>reverts the status</b> so a person still clicks merge." },
        { who: "bot", cls: "bot", name: "board bot", title: "Merge confirmed by API polling", body: "Merge is asynchronous: the webhook can arrive before GitLab agrees with itself. The orchestrator polls until the state is real — and fails loudly if it never becomes real." },
        { who: "bot", cls: "bot", name: "board bot", title: "Pre-Deploy Summary (Accumulated)", body: 'Affected services resolved from the diff, including library → service fan-out:<table class="mini-tbl"><tr><th>service</th><th>type</th><th>branch</th></tr><tr><td>ledger-service</td><td>jar</td><td class="ok">release/sprint-24</td></tr><tr><td>scheduler-job</td><td>jar</td><td class="ok">release/sprint-24</td></tr><tr><td>mobile-bff</td><td>image</td><td class="ok">release/sprint-24</td></tr></table>A hidden state marker is written into the ticket description, so the release state survives with the ticket itself — no external database.' }
      ],
      narr: "board.narr.6"
    },
    {
      col: 4, phase: "Promote", approvals: ["team", "business", "product", "architecture"], botmark: true,
      acts: [
        { who: "release owner", cls: "human", name: "manual", title: "Card moved to Deploy · ticket closed", body: "" },
        { who: "gate", cls: "gate", name: "deploy guard", title: "Guards passed", body: "No pending services left · identical payload within 60s is silently dropped · the previous deploy pipeline for this cycle has finished. If a pipeline is still running the request is <b>refused</b>, not queued." },
        { who: "bot", cls: "bot", name: "board bot", title: "Deploy Pipeline Triggered", body: '<table class="mini-tbl"><tr><th>pipeline</th><th>services</th><th>state</th></tr><tr><td>#deploy-4821</td><td>3</td><td class="ok">running</td></tr></table>A deploy watermark is stored in the ticket so a re-sent webhook can never deploy the same cycle twice.' }
      ],
      narr: "board.narr.7"
    },
    {
      col: 4, phase: "SIT", approvals: ["team", "business", "product", "architecture", "engineering"], botmark: true,
      acts: [
        { who: "domain pipeline", cls: "bot", name: "callback", title: "Deploy Result", body: '<table class="mini-tbl"><tr><th>service</th><th>env</th><th>status</th></tr><tr><td>ledger-service</td><td>SIT</td><td class="ok">SUCCESS</td></tr><tr><td>scheduler-job</td><td>SIT</td><td class="ok">SUCCESS</td></tr><tr><td>mobile-bff</td><td>SIT</td><td class="ok">SUCCESS</td></tr></table>The pipeline writes its own result back into the ticket as a comment — the audit trail lives where the work lives.' },
        { who: "QA", cls: "human", name: "chatops", title: "/diff sit", body: "Artifact comparison between environments posted as a MATCH / DIFF / MISSING table, so \"is UAT really what we tested?\" is a command, not an argument." },
        { who: "bot", cls: "bot", name: "board bot", title: "Phase advanced", body: "Integration Testing → SIT, final approval recorded. Security scanners keep running on schedule as a continuous gate, and release branches are kept in sync by cascading merges where the approver is never the author." }
      ],
      narr: "board.narr.8"
    }
  ];

  var CHATOPS = {
    retry: "board.co.retry",
    sonarqube: "board.co.sonar",
    diff: "board.co.diff",
    sync: "board.co.sync",
    follow: "board.co.follow",
    summarypic: "board.co.summarypic",
    notif: "board.co.notif"
  };

  var bd = null;

  function initBoard() {
    var root = document.querySelector(".bd");
    if (!root) return;
    bd = {
      root: root,
      card: root.querySelector("#bd-card"),
      cols: root.querySelectorAll(".bd-col"),
      feed: root.querySelector("[data-bd-feed]"),
      narr: root.querySelector("[data-bd-narr]"),
      phase: root.querySelector("[data-bd-phase]"),
      approve: root.querySelector("[data-bd-approve]"),
      botmark: root.querySelector("[data-bd-botmark]"),
      cur: root.querySelector("[data-bd-cur]"),
      dots: root.querySelectorAll(".bd-dot"),
      playBtn: root.querySelector("[data-bd-play]"),
      idx: 0,
      rendered: 0,
      timer: null,
      playing: false
    };
    bd.total = root.querySelector("[data-bd-total]");
    if (bd.total) bd.total.textContent = String(STEPS.length);

    root.querySelector("[data-bd-prev]").addEventListener("click", function () { stop(); go(bd.idx - 1); });
    root.querySelector("[data-bd-next]").addEventListener("click", function () { stop(); go(bd.idx + 1); });
    bd.playBtn.addEventListener("click", function () { bd.playing ? stop() : play(); });
    bd.dots.forEach(function (d) {
      d.addEventListener("click", function () { stop(); go(parseInt(d.dataset.bdGo, 10)); });
    });

    go(0);

    /* autoplay saat terlihat, berhenti saat keluar layar */
    if ("IntersectionObserver" in window) {
      var started = false;
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !started) { started = true; play(); }
        else if (!en[0].isIntersecting && started) { stop(); started = false; }
      }, { threshold: 0.35 });
      io.observe(root);
    }
  }

  function play() {
    if (!bd) return;
    bd.playing = true;
    bd.playBtn.classList.remove("paused");
    clearTimeout(bd.timer);
    bd.timer = setInterval(function () {
      if (document.hidden) return;
      if (bd.idx >= STEPS.length - 1) { stop(); return; }
      go(bd.idx + 1);
    }, 4200);
  }
  function stop() {
    if (!bd) return;
    bd.playing = false;
    bd.playBtn.classList.add("paused");
    clearInterval(bd.timer);
  }

  function go(i) {
    if (!bd) return;
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    var moved = i !== bd.idx || bd.rendered === 0;
    bd.idx = i;
    var s = STEPS[i];

    /* posisi kartu */
    var body = bd.cols[s.col].querySelector(".bd-colbody");
    if (bd.card.parentElement !== body) {
      body.appendChild(bd.card);
      if (moved && !RM) {
        bd.card.classList.remove("moved");
        void bd.card.offsetWidth;
        bd.card.classList.add("moved");
      }
    }
    bd.cols.forEach(function (c, ci) { c.classList.toggle("active", ci === s.col); });
    bd.cols.forEach(function (c) {
      var n = c.querySelector(".bd-colbody").children.length;
      c.querySelector(".cc").textContent = String(n);
    });

    /* header kartu */
    bd.phase.textContent = s.phase;
    bd.approve.replaceChildren();
    s.approvals.forEach(function (a) {
      var span = document.createElement("span");
      span.className = "ap-chip ok";
      span.textContent = "✓ " + a;
      bd.approve.appendChild(span);
    });
    bd.botmark.classList.toggle("on", !!s.botmark);

    /* feed aktivitas: kumulatif */
    if (bd.rendered > countActs(i)) { bd.feed.replaceChildren(); bd.rendered = 0; }
    var flat = [];
    for (var k = 0; k <= i; k++) flat = flat.concat(STEPS[k].acts);
    for (var j = bd.rendered; j < flat.length; j++) {
      var a = flat[j];
      var el = document.createElement("div");
      el.className = "act " + a.cls;

      var who = document.createElement("div");
      who.className = "act-who";
      var s1 = document.createElement("span");
      s1.textContent = a.who;
      var s2 = document.createElement("span");
      s2.textContent = a.name;
      who.append(s1, s2);

      var title = document.createElement("div");
      title.className = "act-title";
      setSafeHtml(title, a.title);

      el.append(who, title);
      if (a.body) {
        var body = document.createElement("div");
        body.className = "act-body";
        setSafeHtml(body, a.body);
        el.appendChild(body);
      }
      bd.feed.appendChild(el);
    }
    bd.rendered = flat.length;
    bd.feed.scrollTop = bd.feed.scrollHeight;

    /* narasi + progres */
    setSafeHtml(bd.narr, T(s.narr));
    bd.cur.textContent = String(i + 1);
    bd.dots.forEach(function (d, di) {
      d.classList.toggle("on", di === i);
      d.classList.toggle("done", di < i);
    });
  }

  function countActs(i) {
    var n = 0;
    for (var k = 0; k <= i; k++) n += STEPS[k].acts.length;
    return n;
  }

  /* ============================================================
     4. CHATOPS
     ============================================================ */
  function initChatops() {
    var box = document.querySelector("[data-co-chips]");
    var out = document.querySelector("[data-co-text]");
    if (!box || !out) return;
    var chips = box.querySelectorAll(".co-chip");
    var active = null;

    function show(key) {
      setSafeHtml(out, T(CHATOPS[key]));
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("on"); });
        c.classList.add("on");
        active = c.dataset.co;
        show(active);
      });
    });
    /* tampilkan perintah pertama sebagai default */
    active = chips[0].dataset.co;
    chips[0].classList.add("on");
    show(active);
    box._refresh = function () { if (active) show(active); };
  }

  /* ============================================================
     5. REPLIKA RELEASE CONTROL PLANE
     ============================================================ */
  var SVC = [
    { n: "ledger-service", t: "jar", cat: "Backend", sit: "3.14.2", uat: "3.13.0", st: "diff" },
    { n: "auth-gateway", t: "image", cat: "Backend", sit: "2.8.1", uat: "2.8.1", st: "same" },
    { n: "notification-worker", t: "image", cat: "Backend", sit: "1.22.0", uat: "1.21.4", st: "diff" },
    { n: "report-engine", t: "jar", cat: "Backend", sit: "5.2.0", uat: "5.2.0", st: "same" },
    { n: "mobile-bff", t: "image", cat: "Backend", sit: "4.1.7", uat: "4.0.9", st: "diff" },
    { n: "scheduler-job", t: "jar", cat: "Backend", sit: "1.9.3", uat: "—", st: "new" },
    { n: "customer-portal-web", t: "bundle", cat: "Frontend", sit: "2026.10.05", uat: "2026.09.28", st: "diff" },
    { n: "admin-console", t: "bundle", cat: "Frontend", sit: "1.6.0", uat: "1.6.0", st: "same" },
    { n: "android-app", t: "apk / aab", cat: "Mobile", sit: "7.4.0-b212", uat: "7.3.2-b198", st: "diff" },
    { n: "ios-app", t: "ipa", cat: "Mobile", sit: "7.4.0-190", uat: "7.3.2-176", st: "same" }
  ];

  var HISTORY = [
    { t: "22:14", s: "ledger-service", e: "SIT", v: "3.14.2", st: "SUCCESS", sq: "PASSED", by: "ivan.j" },
    { t: "21:48", s: "mobile-bff", e: "SIT", v: "4.1.7", st: "SUCCESS", sq: "PASSED", by: "pipeline" },
    { t: "20:31", s: "customer-portal-web", e: "UAT", v: "2026.09.28", st: "SUCCESS", sq: "PASSED", by: "dwi.a" },
    { t: "19:07", s: "notification-worker", e: "SIT", v: "1.22.0", st: "FAILED", sq: "PASSED", by: "ivan.j" },
    { t: "17:52", s: "android-app", e: "SIT", v: "7.4.0-b212", st: "SUCCESS", sq: "SKIPPED", by: "pipeline" },
    { t: "16:20", s: "auth-gateway", e: "PROD", v: "2.8.1", st: "SUCCESS", sq: "PASSED", by: "rina.p" }
  ];

  var SCANS = [
    { r: "ledger-service", g: "PASSED", rt: "A", b: 0, v: 1, s: 34, c: "78.4%", d: "2.1%", tv: [0, 2, 11] },
    { r: "auth-gateway", g: "PASSED", rt: "A", b: 0, v: 0, s: 12, c: "84.0%", d: "1.4%", tv: [0, 0, 6] },
    { r: "notification-worker", g: "FAILED", rt: "C", b: 3, v: 4, s: 96, c: "41.2%", d: "6.8%", tv: [1, 3, 18] },
    { r: "mobile-bff", g: "PASSED", rt: "B", b: 1, v: 0, s: 47, c: "69.5%", d: "3.2%", tv: [0, 1, 9] },
    { r: "report-engine", g: "PASSED", rt: "B", b: 0, v: 1, s: 58, c: "62.0%", d: "4.0%", tv: [0, 1, 14] },
    { r: "customer-portal-web", g: "PASSED", rt: "A", b: 0, v: 0, s: 21, c: "71.8%", d: "1.9%", tv: [0, 0, 4] }
  ];

  var SECRETS = [
    { p: "kv/data/core/database", kv: [["url", "••••••••••••"], ["username", "svc_ledger"], ["password", "••••••••"]], ch: "updated" },
    { p: "kv/data/core/registry", kv: [["host", "••••••••"], ["token", "••••••••••••"]], ch: "unchanged" },
    { p: "kv/data/mobile/signing", kv: [["keystore", "••••••••"], ["alias", "release"], ["password", "••••••••"]], ch: "updated" },
    { p: "kv/data/mobile/ios-profile", kv: [["profile", "••••••••"], ["team", "••••••••"]], ch: "created" },
    { p: "kv/data/shared/smtp", kv: [["host", "••••••••"], ["port", "587"], ["password", "••••••••"]], ch: "unchanged" }
  ];

  var AUDIT = [
    { t: "22:14:07", a: "ivan.j", r: "admin", e: "build-deploy · 3 services · SIT" },
    { t: "21:48:52", a: "pipeline-key", r: "pipeline", e: "deployment callback · mobile-bff" },
    { t: "20:31:19", a: "dwi.a", r: "devsecops", e: "promotion approved · plan #48" },
    { t: "19:02:44", a: "ivan.j", r: "admin", e: "api-key revoked · core-banking" },
    { t: "16:20:03", a: "rina.p", r: "devsecops", e: "vault secret updated · kv/core/database" }
  ];

  var TICKETS = [
    { c: 0, id: "#474", t: "chore: rotate signing key", q: null },
    { c: 1, id: "#468", t: "fix: statement export timeout", q: null },
    { c: 1, id: "#471", t: "feat: nightly ledger reconciliation", q: null },
    { c: 2, id: "#469", t: "feat: retry backoff on worker", q: null },
    { c: 3, id: "#465", t: "chore: bump base image", q: ["y", "y", "n"] },
    { c: 3, id: "#463", t: "fix: portal cache header", q: ["y", "y", "y"] },
    { c: 4, id: "#461", t: "feat: report scheduler", q: ["y", "y", "y"] }
  ];

  var TAG_DESC =
    "Release 2026.10.05 — Sprint 24\n" +
    "\n" +
    "Features\n" +
    "  • #471 nightly ledger reconciliation\n" +
    "  • #461 report scheduler with retry backoff\n" +
    "\n" +
    "Bugfixes\n" +
    "  • #463 portal cache header on static assets\n" +
    "  • #468 statement export timeout under load\n" +
    "\n" +
    "Configuration changes\n" +
    "  • modified  ledger-service/application-sit.yml\n" +
    "  • added     scheduler-job/quartz.yml\n" +
    "\n" +
    "Secret changes\n" +
    "  • updated  kv/data/core/database  (by rina.p, 16:20)\n" +
    "  • created  kv/data/mobile/ios-profile  (by ivan.j, 19:41)\n" +
    "\n" +
    "Repositories tagged: 6 · sync group: monolith";

  var CONSOLE = [
    { s: 0, c: "c-dim", t: "[queue] item queued — waiting for executor" },
    { s: 0, c: "c-dim", t: "[queue] executing on runner #2 (shell)" },
    { s: 0, c: "", t: "[checkout] release/sprint-24 @ a91f0c2" },
    { s: 1, c: "", t: "[build] mvn -B -DskipTests package → ledger-service.jar" },
    { s: 1, c: "c-dim", t: "[build] compiling 412 source files" },
    { s: 1, c: "", t: "[build] mvn -B package → scheduler-job.jar" },
    { s: 2, c: "", t: "[unit-test] 128 tests · 0 failures · 0 skipped" },
    { s: 3, c: "c-warn", t: "[scan] trivy image — 0 critical · 2 high · 11 medium" },
    { s: 3, c: "c-ok", t: "[scan] sonarqube — quality gate PASSED (coverage 78.4%)" },
    { s: 4, c: "", t: "[sbom] cyclonedx bom written → artifact archive" },
    { s: 5, c: "", t: "[package] docker build → registry push (digest sha256:9f2c…)" },
    { s: 5, c: "c-dim", t: "[package] signing material fetched from secret store at runtime" },
    { s: 6, c: "", t: "[deploy] stop service · backup ledger-service-20261005-2214.jar" },
    { s: 6, c: "", t: "[deploy] start service · waiting for port" },
    { s: 6, c: "c-ok", t: "[deploy] health check /actuator/health → UP (attempt 1/3)" },
    { s: 7, c: "", t: "[verify] version endpoint reports 3.14.2" },
    { s: 7, c: "c-ok", t: "[done] SUCCESS — 3 services · 4m38s" }
  ];
  var STAGES = ["checkout", "build", "unit-test", "scan", "sbom", "package", "deploy", "verify"];

  var P = {
    view: "dashboard",
    deployTab: "history",
    role: "devsecops",
    proj: "all",
    sel: {},
    secret: 0,
    building: false,
    timers: [],
    history: HISTORY.slice(),
    scans: SCANS.map(function (s) { return Object.assign({}, s); }),
    planStatus: "draft"
  };

  function can(a) {
    if (P.role === "admin") return true;
    if (P.role === "devsecops") return a !== "users";
    return a === "view" || a === "deploy";
  }

  function clearTimers() { P.timers.forEach(clearTimeout); P.timers = []; }
  function later(fn, ms) { P.timers.push(setTimeout(fn, ms)); }

  function initPlatform() {
    var root = document.querySelector("[data-rp]");
    if (!root) return;
    P.root = root;
    P.viewEl = root.querySelector("[data-rp-view]");
    P.navEl = root.querySelector("[data-rp-nav]");
    P.toasts = root.querySelector("[data-rp-toasts]");
    P.sse = root.querySelector("[data-rp-sse]");
    P.crumb = root.querySelector("[data-rp-crumb]");

    root.querySelectorAll(".rp-ni").forEach(function (b) {
      b.addEventListener("click", function () { setView(b.dataset.view); });
    });
    root.querySelector("[data-rp-role]").addEventListener("change", function (e) {
      P.role = e.target.value;
      if (P.role === "developer" && P.proj === "all") P.proj = "core";
      toast("role switched → " + P.role, P.role === "developer" ? "warn" : "");
      render();
    });
    root.querySelector("[data-rp-proj]").addEventListener("change", function (e) {
      if (P.role === "developer" && e.target.value === "all") {
        toast("developers only see assigned projects", "warn");
        e.target.value = P.proj;
        return;
      }
      P.proj = e.target.value;
      pulse();
      render();
    });

    P.viewEl.addEventListener("click", onViewClick);
    P.viewEl.addEventListener("change", onViewChange);

    /* jam + denyut SSE berkala */
    var clock = root.querySelector("[data-rp-clock]");
    setInterval(function () {
      if (!clock || document.hidden) return;
      var d = new Date();
      clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(function (n) { return String(n).padStart(2, "0"); }).join(":");
    }, 1000);

    var vis = false;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }, { threshold: 0.15 });
      io.observe(root);
    } else { vis = true; }
    setInterval(function () { if (vis && !document.hidden && !RM) pulse(); }, 11000);

    render();
  }

  function setView(v) {
    if (v === "settings" && !can("settings")) { toast("your role cannot open settings", "bad"); return; }
    P.view = v;
    render();
  }

  function pulse() {
    if (!P.sse) return;
    P.sse.classList.add("on");
    setTimeout(function () { P.sse.classList.remove("on"); }, 1400);
  }

  function toast(msg, kind) {
    if (!P.toasts) return;
    var el = document.createElement("div");
    el.className = "rp-toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    P.toasts.appendChild(el);
    pulse();
    setTimeout(function () {
      el.style.transition = "opacity .35s ease, transform .35s ease";
      el.style.opacity = "0";
      el.style.transform = "translateX(14px)";
      setTimeout(function () { el.remove(); }, 380);
    }, 3000);
  }

  var TITLES = {
    dashboard: "Dashboard", board: "Board", deploys: "Deploys", preuat: "PRE-UAT",
    scans: "Scans", testing: "Testing", secrets: "Secrets", settings: "Settings"
  };

  function render() {
    if (!P.root) return;
    clearTimers();
    P.navEl.querySelectorAll(".rp-ni").forEach(function (b) {
      b.classList.toggle("on", b.dataset.view === P.view);
      if (b.dataset.view === "settings") b.hidden = !can("settings");
    });
    var projSel = P.root.querySelector("[data-rp-proj]");
    if (projSel && projSel.value !== P.proj) projSel.value = P.proj;
    P.crumb.textContent = TITLES[P.view] || "";
    setSafeHtml(P.viewEl, VIEW[P.view] ? VIEW[P.view]() : "");
    P.viewEl.querySelectorAll("[data-h]").forEach(function (b) { b.style.height = b.getAttribute("data-h") + "%"; });
    if (P.view === "deploys" && P.deployTab === "monitoring" && P.building) startConsole();
  }

  /* ---------- helper markup ---------- */
  function panel(title, right, inner, note) {
    return '<div class="rp-panel"><h5><span>' + title + "</span>" +
      (right ? '<span class="r">' + right + "</span>" : "") + "</h5>" + inner +
      (note ? '<div class="rp-note">' + note + "</div>" : "") + "</div>";
  }
  function metric(k, n, d, cls) {
    return '<div class="rp-metric"><div class="k">' + k + '</div><div class="n ' + (cls || "") + '">' + n + "</div>" +
      (d ? '<div class="d">' + d + "</div>" : "") + "</div>";
  }
  function badge(txt, kind) { return '<span class="rp-badge ' + (kind || "") + '">' + txt + "</span>"; }
  function stBadge(st) {
    if (st === "same") return badge("same", "ok");
    if (st === "diff") return badge("diff", "warn");
    return badge("new", "info");
  }
  function changed() { return SVC.filter(function (s) { return s.st !== "same"; }); }

  /* ---------- view: dashboard ---------- */
  var VIEW = {};

  VIEW.dashboard = function () {
    var rows = SVC.map(function (s) {
      return "<tr><td class='svc'>" + s.n + "</td><td><span class='rp-badge type'>" + s.t + "</span></td>" +
        "<td class='mono'>" + s.sit + "</td><td class='mono'>" + s.uat + "</td>" +
        "<td>" + stBadge(s.st) + "</td>" +
        "<td>" + (s.st === "same" ? "<span class='mono qg-ok'>✓ ✓ ✓</span>" : "<span class='mono qg-warn'>✓ ✓ ✗</span>") + "</td></tr>";
    }).join("");
    var weeks = [9, 14, 11, 18, 22, 17, 26, 24];
    var max = Math.max.apply(null, weeks);
    var bars = weeks.map(function (w, i) {
      return '<b data-l="w' + (33 + i) + '" data-h="' + Math.round((w / max) * 100) + '" class="' + (w >= 20 ? "hot" : "") + '"></b>';
    }).join("");

    return '<div class="rp-h"><h4>Release overview</h4><span class="sub">auto-refresh via SSE</span></div>' +
      '<div class="rp-metrics">' +
      metric("services", SVC.length, "across 3 projects") +
      metric("success rate", "96.4%", "last 30 days", "acc") +
      metric("SIT ≠ UAT", changed().length, "services to promote", "warn") +
      metric("deploys today", "18", "6 failed · 2 rolled back") +
      "</div>" +
      panel("Version comparison — SIT vs UAT", "gate: deploy · sonar · trivy",
        "<table class='rp-tbl'><tr><th>service</th><th>type</th><th>SIT</th><th>UAT</th><th>state</th><th>quality gate</th></tr>" + rows + "</table>",
        "Only services whose versions diverged are eligible for the next release plan — nothing rides along by accident.") +
      panel("Deployment frequency", "weekly", '<div class="rp-bars rp-bars-wrap">' + bars + "</div>");
  };

  /* ---------- view: board ---------- */
  VIEW.board = function () {
    var cols = ["To do", "In Dev", "In Review", "Merged", "Deploy"];
    var html = cols.map(function (c, ci) {
      var cards = TICKETS.filter(function (t) { return t.c === ci; }).map(function (t) {
        var q = t.q ? "<div class='qg'>" + t.q.map(function (x) {
          return "<span class='" + x + "'>" + (x === "y" ? "✓" : "✗") + "</span>";
        }).join(" ") + "</div>" : "";
        return "<div class='rp-kcard'><span class='id'>" + t.id + "</span>" + t.t + q + "</div>";
      }).join("");
      return "<div class='rp-kcol'><h6><span>" + c + "</span><span>" + TICKETS.filter(function (t) { return t.c === ci; }).length + "</span></h6>" + cards + "</div>";
    }).join("");
    return '<div class="rp-h"><h4>Ticket board</h4><span class="sub">8 statuses · validated transitions</span></div>' +
      '<div class="rp-kanban">' + html + "</div>" +
      panel("Transition rules", "", '<div class="rp-note rp-note--plain">A ticket may only move along the allowed path; <code>emergency-hotfix</code> starts directly at <b>sit-deployed</b>. Every transition is recorded with actor and timestamp, and a rejected PRE-UAT review returns the ticket to <b>sit-deployed</b> and increments its rejection counter.</div>');
  };

  /* ---------- view: deploys ---------- */
  VIEW.deploys = function () {
    var tabs = [["history", "History"], ["build", "Build & Deploy"], ["monitoring", "Monitoring"], ["rollback", "Rollback"]];
    var tabHtml = '<div class="rp-tabs">' + tabs.map(function (t) {
      return '<button class="rp-tab ' + (P.deployTab === t[0] ? "on" : "") + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    return '<div class="rp-h"><h4>Deploys</h4><span class="sub">jenkins + gitlab, one interface</span></div>' + tabHtml + VIEW["deploys_" + P.deployTab]();
  };

  VIEW.deploys_history = function () {
    var rows = P.history.map(function (h) {
      return "<tr><td class='mono'>" + h.t + "</td><td class='svc'>" + h.s + "</td><td>" + badge(h.e, h.e === "PROD" ? "bad" : "") + "</td>" +
        "<td class='mono'>" + h.v + "</td><td>" + badge(h.st, h.st === "SUCCESS" ? "ok" : "bad") + "</td>" +
        "<td>" + badge(h.sq, h.sq === "PASSED" ? "ok" : "") + "</td><td class='mono'>" + h.by + "</td></tr>";
    }).join("");
    return panel("Deployment history", P.history.length + " events",
      "<table class='rp-tbl'><tr><th>time</th><th>service</th><th>env</th><th>version</th><th>status</th><th>sonar</th><th>actor</th></tr>" + rows + "</table>",
      "Every entry also lands in the audit log with its actor, and is pushed to all open sessions in realtime.");
  };

  VIEW.deploys_build = function () {
    var cats = ["Backend", "Frontend", "Mobile"];
    var grid = cats.map(function (c) {
      var items = SVC.filter(function (s) { return s.cat === c; }).map(function (s) {
        var on = P.sel[s.n] ? "on" : "";
        return '<label class="rp-svc ' + on + '"><input type="checkbox" data-svc="' + s.n + '" ' + (P.sel[s.n] ? "checked" : "") + ' />' +
          '<span class="nm">' + s.n + '</span><span class="rp-badge type">' + s.t + "</span></label>";
      }).join("");
      return '<div class="rp-cat">' + c + "</div>" + items;
    }).join("");
    var count = Object.keys(P.sel).length;
    return panel("Build & Deploy", count + " selected",
      '<div class="rp-sel rp-sel--pad">' +
      '<select class="rp-inp rp-w190"><option>pipeline: sit-deploy</option><option>pipeline: uat-promote</option><option>pipeline: prod-release</option></select>' +
      '<input class="rp-inp rp-w190" value="release/sprint-24" aria-label="branch" />' +
      '<button class="rp-btn" data-act="selectall">select all</button>' +
      '<button class="rp-btn" data-act="clearsel">clear</button>' +
      "</div>" +
      '<div class="rp-svc-grid">' + grid + "</div>" +
      '<div class="rp-sel">' +
      '<button class="rp-btn primary" data-act="deploy"' + (count ? "" : " disabled") + ">Deploy " + (count ? "(" + count + ")" : "") + "</button>" +
      '<span class="mono rp-or">or</span>' +
      '<input class="rp-inp" placeholder="paste a commit SHA — services resolved from the diff" data-act-input="sha" />' +
      '<button class="rp-btn" data-act="bycommit">Deploy by Commit</button>' +
      "</div>",
      "Service type (backend / frontend / both) and the target host mapping are resolved from configuration per branch — the operator never types a Jenkins parameter by hand.");
  };

  VIEW.deploys_monitoring = function () {
    var stages = STAGES.map(function (s, i) {
      var cls = "";
      if (P.building) cls = i < P.stageDone ? "done" : (i === P.stageDone ? "run" : "");
      else if (P.lastRunOk) cls = "done";
      return '<span class="rp-stage ' + cls + '">' + s + "</span>";
    }).join("");
    return panel("Active builds", P.building ? '<span class="rp-building"><i></i>building</span>' : (P.lastRunOk ? badge("SUCCESS", "ok") : badge("idle", "")),
      '<div class="rp-stages">' + stages + "</div>" +
      '<div class="rp-pad"><div class="rp-console" data-console>' + (P.consoleHtml || '<span class="c-dim">no active build — trigger one from Build &amp; Deploy</span>') + "</div></div>" +
      '<div class="rp-sel"><button class="rp-btn" data-act="jenkins">View in CI server</button>' +
      '<button class="rp-btn" data-act="rerun">Re-run last build</button></div>',
      "Queue item, pipeline stages and console output are polled progressively and streamed into the page — engineers watch a deploy without ever opening the CI server.");
  };

  VIEW.deploys_rollback = function () {
    if (!can("rollback")) {
      return '<div class="rp-lock">Rollback can only be performed by <b>admin</b> or <b>devsecops</b>. You are signed in as <b>' + P.role + "</b>.</div>" +
        panel("Previous versions", "", '<div class="rp-empty">action unavailable for this role</div>');
    }
    var rows = SVC.slice(0, 6).map(function (s, i) {
      return "<tr><td class='svc'>" + s.n + "</td><td class='mono'>" + s.sit + "</td><td class='mono'>" + (i % 3 === 0 ? "3.13.0" : s.uat) + "</td>" +
        "<td><button class='rp-btn danger' data-act='rollback' data-svc='" + s.n + "'>rollback</button></td></tr>";
    }).join("");
    return panel("Rollback", "jar over SSH · image by digest",
      "<table class='rp-tbl'><tr><th>service</th><th>current</th><th>previous</th><th></th></tr>" + rows + "</table>",
      "Jars roll back from a dated backup taken before every deploy; images roll back by digest. Both paths verify the service is healthy again before reporting success.");
  };

  /* ---------- view: pre-uat ---------- */
  VIEW.preuat = function () {
    var ch = changed();
    var rows = ch.map(function (s) {
      return "<tr><td class='svc'>" + s.n + "</td><td><span class='rp-badge type'>" + s.t + "</span></td>" +
        "<td class='mono'>" + s.uat + " → " + s.sit + "</td><td class='mono'>#47" + (1 + ch.indexOf(s)) + "</td>" +
        "<td>" + stBadge(s.st) + "</td></tr>";
    }).join("");
    var cfg = [
      ["mod", "ledger-service/application-sit.yml"],
      ["add", "scheduler-job/quartz.yml"],
      ["mod", "mobile-bff/routes.json"],
      ["del", "report-engine/legacy-cron.xml"]
    ].map(function (c) {
      return '<div class="rp-chg"><span class="s ' + c[0] + '">' + c[0] + '</span><span class="mono">' + c[1] + "</span></div>";
    }).join("");
    var vault = [
      ["updated", "kv/data/core/database", "rina.p", "16:20"],
      ["created", "kv/data/mobile/ios-profile", "ivan.j", "19:41"]
    ].map(function (v) {
      return '<div class="rp-chg"><span class="s ' + (v[0] === "created" ? "add" : "mod") + '">' + v[0] + '</span><span class="mono">' + v[1] + '</span><span class="mono rp-meta-r">' + v[2] + " · " + v[3] + "</span></div>";
    }).join("");

    var approved = P.planStatus === "approved";
    return '<div class="rp-h"><h4>PRE-UAT review</h4><span class="sub">plan #48 · ' + P.planStatus + "</span></div>" +
      (approved ? '<div class="rp-note rp-note--ok">Plan approved and tags created — 6 repositories tagged consistently.</div>' : "") +
      panel("Services to deploy", ch.length + " changed",
        "<table class='rp-tbl'><tr><th>service</th><th>type</th><th>version</th><th>ticket</th><th>state</th></tr>" + rows + "</table>",
        "This list is generated from the version diff, not typed by a human.") +
      panel("Config files to sync", "", cfg) +
      panel("Vault secret changes", "tracked per actor", vault) +
      panel("Auto-generated tag description", "from grouped tickets",
        '<div class="rp-pad"><div class="rp-pre">' + esc(TAG_DESC) + "</div></div>" +
        '<div class="rp-sel"><button class="rp-btn" data-act="copytags">Copy</button></div>') +
      '<div class="rp-actions">' +
      '<button class="rp-btn primary" data-act="createtags"' + (approved || !can("approve") ? " disabled" : "") + ">Create Tags &amp; Promote</button>" +
      '<button class="rp-btn" data-act="approve"' + (!can("approve") || approved ? " disabled" : "") + ">Approve</button>" +
      '<button class="rp-btn danger" data-act="reject"' + (!can("approve") || approved ? " disabled" : "") + ">Reject</button>" +
      (!can("approve") ? '<span class="mono rp-warn-inline">approval requires devsecops or admin</span>' : "") +
      "</div>";
  };

  /* ---------- view: scans ---------- */
  VIEW.scans = function () {
    var rows = P.scans.map(function (s, i) {
      return "<tr><td class='svc'>" + s.r + "</td>" +
        "<td>" + badge(s.g, s.g === "PASSED" ? "ok" : "bad") + "</td>" +
        "<td>" + badge(s.rt, s.rt === "A" ? "ok" : (s.rt === "B" ? "info" : "warn")) + "</td>" +
        "<td class='mono'>" + s.b + "</td><td class='mono'>" + s.v + "</td><td class='mono'>" + s.s + "</td>" +
        "<td class='mono'>" + s.c + "</td><td class='mono'>" + s.d + "</td>" +
        "<td class='mono'>" + s.tv.map(function (n, k) {
          return "<span class='" + (k === 0 && n ? "sev-crit" : (k === 1 && n ? "sev-warn" : "sev-faint")) + "'>" + n + "</span>";
        }).join(" / ") + "</td>" +
        "<td><button class='rp-btn' data-act='scanone' data-i='" + i + "'>rescan</button></td></tr>";
    }).join("");
    return '<div class="rp-h"><h4>Quality &amp; security scans</h4><span class="sub">sonarqube + trivy</span></div>' +
      '<div class="rp-actions rp-mb14">' +
      '<button class="rp-btn" data-act="fetchsonar">Fetch from SonarQube</button>' +
      '<button class="rp-btn primary" data-act="triggerscan">Trigger Scan</button>' +
      '<select class="rp-inp rp-w190"><option>branch: release/sprint-24</option><option>branch: main</option></select>' +
      "</div>" +
      panel("Per-repository results", "live",
        "<table class='rp-tbl'><tr><th>repo</th><th>gate</th><th>rating</th><th>bugs</th><th>vulns</th><th>smells</th><th>coverage</th><th>dupl.</th><th>trivy C/H/M</th><th></th></tr>" + rows + "</table>",
        "Container scanning covers vulnerabilities, embedded secrets and misconfiguration, and a CycloneDX SBOM is archived beside every image.");
  };

  /* ---------- view: testing ---------- */
  VIEW.testing = function () {
    var suites = [
      { d: "2026-10-05", n: "login-flow", p: 24, f: 0, t: "3m12s" },
      { d: "2026-10-05", n: "transfer-flow", p: 18, f: 2, t: "5m44s" },
      { d: "2026-10-04", n: "statement-export", p: 11, f: 0, t: "2m08s" }
    ];
    var html = suites.map(function (s) {
      var frames = [0, 1, 2, 3].map(function (i) {
        return '<div class="rp-frame" data-t="' + (i * 4 + 2) + 's">▷</div>';
      }).join("");
      return '<div class="rp-suite"><div class="rp-suite-h"><span>' + (s.f ? badge(s.f + " failed", "bad") : badge("passed", "ok")) + "</span>" +
        "<b>" + s.n + "</b><span class='sp'>" + s.p + " steps · " + s.t + " · " + s.d + "</span></div>" +
        '<div class="rp-rec">' + frames + "</div>" +
        (s.f ? '<div class="rp-note">failure: element <code>#confirm-button</code> not found after 10s (step 14)</div>' : "") +
        "</div>";
    }).join("");
    return '<div class="rp-h"><h4>Mobile test results</h4><span class="sub">uploaded by the pipeline, no auth token needed</span></div>' +
      '<div class="rp-metrics">' + metric("suites", "3", "last 24h") + metric("passed", "53", "steps", "acc") +
      metric("failed", "2", "steps", "warn") + metric("retention", "3d", "auto-cleanup daily") + "</div>" + html;
  };

  /* ---------- view: secrets ---------- */
  VIEW.secrets = function () {
    var list = SECRETS.map(function (s, i) {
      return '<button class="rp-path ' + (P.secret === i ? "on" : "") + '" data-act="path" data-i="' + i + '"><span>' + s.p + "</span><span>" + badge(s.ch, s.ch === "created" ? "info" : (s.ch === "updated" ? "warn" : "")) + "</span></button>";
    }).join("");
    var s = SECRETS[P.secret];
    var kv = s.kv.map(function (k) { return "<dt>" + k[0] + "</dt><dd>" + k[1] + "</dd>"; }).join("");
    return '<div class="rp-h"><h4>Secret store browser</h4><span class="sub">KV v2 · values masked in this demo</span></div>' +
      '<div class="rp-secrets"><div>' + list +
      '<div class="rp-actions rp-mt10"><button class="rp-btn" data-act="newsecret">+ New secret</button></div></div>' +
      panel(s.p, "version 4", '<dl class="rp-kv">' + kv + "</dl>" +
        '<div class="rp-sel"><button class="rp-btn" data-act="editsecret">Edit</button>' +
        '<button class="rp-btn danger" data-act="delsecret">Delete version</button></div>') +
      "</div>" +
      panel("Change tracking", "surfaced in every PRE-UAT review",
        "<table class='rp-tbl'><tr><th>action</th><th>path</th><th>actor</th><th>time</th></tr>" +
        "<tr><td>" + badge("updated", "warn") + "</td><td class='mono'>kv/data/core/database</td><td class='mono'>rina.p</td><td class='mono'>16:20</td></tr>" +
        "<tr><td>" + badge("created", "info") + "</td><td class='mono'>kv/data/mobile/ios-profile</td><td class='mono'>ivan.j</td><td class='mono'>19:41</td></tr>" +
        "<tr><td>" + badge("deleted", "bad") + "</td><td class='mono'>kv/data/shared/legacy-ftp</td><td class='mono'>ivan.j</td><td class='mono'>09:12</td></tr>" +
        "</table>",
        "Secret changes are part of the release record: who changed what, when, and whether it travelled to the next environment.");
  };

  /* ---------- view: settings ---------- */
  VIEW.settings = function () {
    if (!can("settings")) return '<div class="rp-lock">restricted</div>';
    var users = [
      ["ivan.j", "admin", "all projects"],
      ["rina.p", "devsecops", "core-banking, mobile-channel"],
      ["dwi.a", "devsecops", "customer-portal"],
      ["yoga.s", "developer", "core-banking"],
      ["pipeline-key", "pipeline", "core-banking"]
    ].map(function (u) {
      return "<tr><td class='svc'>" + u[0] + "</td><td>" + badge(u[1], u[1] === "admin" ? "ok" : "") + "</td><td class='mono'>" + u[2] + "</td>" +
        "<td>" + (can("users") ? "<button class='rp-btn danger' data-act='deluser'>remove</button>" : "<span class='mono rp-locked'>locked</span>") + "</td></tr>";
    }).join("");
    var audit = AUDIT.map(function (a) {
      return "<tr><td class='mono'>" + a.t + "</td><td class='mono'>" + a.a + "</td><td>" + badge(a.r) + "</td><td class='mono'>" + a.e + "</td></tr>";
    }).join("");
    return '<div class="rp-h"><h4>Settings</h4><span class="sub">role: ' + P.role + "</span></div>" +
      panel("Users & access", can("users") ? "admin only" : "read-only for your role",
        "<table class='rp-tbl'><tr><th>user</th><th>role</th><th>projects</th><th></th></tr>" + users + "</table>",
        "Sessions are hashed with bcrypt, expire after 8 hours and are destroyed after 30 minutes of idle time. Pipelines authenticate with a revocable per-project API key instead of a person's session.") +
      panel("Audit log", "capped at 1000 entries",
        "<table class='rp-tbl rp-audit'><tr><th>time</th><th>actor</th><th>role</th><th>event</th></tr>" + audit + "</table>") +
      panel("Health", "v5.22.2",
        '<div class="rp-sel rp-pad">' +
        '<span class="mono rp-dimline">uptime 14d 06:22 · heap 118 MB · rate limit 100 req/min/ip</span>' +
        '<button class="rp-btn primary rp-mla" data-act="platformupdate">Platform Update</button></div>',
        "That button triggers the CI job that redeploys this dashboard itself — the platform is delivered by the same pipeline it orchestrates.");
  };

  /* ---------- interaksi ---------- */
  function onViewClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.dataset.act;

    if (act === "tab") { P.deployTab = b.dataset.tab; render(); return; }

    if (act === "selectall") { SVC.forEach(function (s) { P.sel[s.n] = 1; }); render(); return; }
    if (act === "clearsel") { P.sel = {}; render(); return; }

    if (act === "deploy") {
      var n = Object.keys(P.sel).length;
      if (!n) { toast("select at least one service", "warn"); return; }
      toast("build triggered — " + n + " services · SIT");
      P.deployTab = "monitoring";
      P.building = true;
      P.stageDone = 0;
      P.consoleHtml = "";
      P.lastRunOk = false;
      render();
      return;
    }
    if (act === "bycommit") {
      var inp = P.viewEl.querySelector('[data-act-input="sha"]');
      var sha = inp && inp.value.trim();
      if (!sha || sha.length < 7) { toast("paste a commit SHA first", "warn"); return; }
      toast("diff analyzed — 2 services resolved: ledger-service, scheduler-job");
      P.sel = { "ledger-service": 1, "scheduler-job": 1 };
      render();
      return;
    }
    if (act === "jenkins") { toast("demo only — no external links here", ""); return; }
    if (act === "rerun") {
      toast("re-running last build with the same parameters");
      P.deployTab = "monitoring"; P.building = true; P.stageDone = 0; P.consoleHtml = ""; P.lastRunOk = false;
      render(); return;
    }
    if (act === "rollback") {
      if (!can("rollback")) { toast("forbidden for role " + P.role, "bad"); return; }
      toast("rollback queued — " + b.dataset.svc);
      return;
    }

    if (act === "copytags") {
      var txt = TAG_DESC;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(function () {});
      toast("tag description copied to clipboard");
      return;
    }
    if (act === "approve") {
      if (!can("approve")) { toast("forbidden for role " + P.role, "bad"); return; }
      P.planStatus = "approved";
      toast("plan #48 approved");
      render(); return;
    }
    if (act === "reject") {
      if (!can("approve")) { toast("forbidden for role " + P.role, "bad"); return; }
      P.planStatus = "draft";
      toast("plan rejected — 4 tickets returned to sit-deployed", "warn");
      render(); return;
    }
    if (act === "createtags") {
      if (!can("approve")) { toast("forbidden for role " + P.role, "bad"); return; }
      toast("tagging 6 repositories…");
      b.disabled = true;
      later(function () {
        toast("promote pipeline triggered — tags + merge", "");
      }, 1100);
      later(function () {
        P.planStatus = "approved";
        toast("6 tags created · active versions copied SIT → UAT");
        render();
      }, 2600);
      return;
    }

    if (act === "fetchsonar") {
      b.disabled = true; b.textContent = "fetching…";
      later(function () {
        P.scans.forEach(function (s) { s.c = (parseFloat(s.c) + Math.random() * 1.4).toFixed(1) + "%"; });
        toast("quality gates refreshed from SonarQube");
        render();
      }, 1200);
      return;
    }
    if (act === "triggerscan") {
      toast("scan pipeline triggered — results arrive by callback");
      later(function () { toast("scan completed: 5 passed · 1 failed", "warn"); pulse(); }, 2600);
      return;
    }
    if (act === "scanone") {
      var i = parseInt(b.dataset.i, 10);
      toast("rescanning " + P.scans[i].r + "…");
      later(function () {
        P.scans[i].g = "PASSED"; P.scans[i].rt = "A"; P.scans[i].b = 0; P.scans[i].v = 0;
        P.scans[i].s = Math.max(4, P.scans[i].s - 30);
        P.scans[i].tv = [0, 0, P.scans[i].tv[2]];
        toast(P.scans[i].r + " → gate PASSED");
        render();
      }, 1800);
      return;
    }

    if (act === "path") { P.secret = parseInt(b.dataset.i, 10); render(); return; }
    if (act === "newsecret" || act === "editsecret") { toast("demo only — writes are disabled", "warn"); return; }
    if (act === "delsecret") { toast("soft delete: version 4 marked as deleted", "warn"); return; }
    if (act === "deluser") {
      if (!can("users")) { toast("only admin can manage users", "bad"); return; }
      toast("demo only — user not removed", "warn"); return;
    }
    if (act === "platformupdate") {
      toast("self-deploy job triggered — the dashboard redeploys itself");
      later(function () { toast("platform updated · v5.22.3", ""); }, 2400);
      return;
    }
  }

  function onViewChange(e) {
    var cb = e.target.closest("[data-svc]");
    if (!cb) return;
    if (cb.checked) P.sel[cb.dataset.svc] = 1; else delete P.sel[cb.dataset.svc];
    var lbl = cb.closest(".rp-svc");
    if (lbl) lbl.classList.toggle("on", cb.checked);
    var head = P.viewEl.querySelector(".rp-panel > h5 .r");
    if (head) head.textContent = Object.keys(P.sel).length + " selected";
    var btn = P.viewEl.querySelector('[data-act="deploy"]');
    if (btn) {
      var n = Object.keys(P.sel).length;
      btn.disabled = !n;
      btn.textContent = n ? "Deploy (" + n + ")" : "Deploy";
    }
  }

  /* ---------- streaming console ---------- */
  function startConsole() {
    var box = P.viewEl.querySelector("[data-console]");
    if (!box) return;
    var picked = Object.keys(P.sel);
    var count = picked.length || 3;
    var first = null;
    for (var f = 0; f < SVC.length; f++) if (SVC[f].n === picked[0]) first = SVC[f];
    var script = CONSOLE.map(function (l) { return { s: l.s, c: l.c, t: l.t }; });
    script.forEach(function (l) {
      if (first && l.t.indexOf("[verify]") === 0) l.t = "[verify] version endpoint reports " + first.sit;
      if (l.t.indexOf("[done]") === 0) l.t = "[done] SUCCESS — " + count + (count === 1 ? " service" : " services") + " · 4m38s";
    });
    var i = 0;
    P.stageDone = 0;
    box.replaceChildren();
    function step() {
      if (!P.building) return;
      if (i >= script.length) {
        P.building = false;
        P.lastRunOk = true;
        P.consoleHtml = Array.from(box.children).map(function (c) { return c.outerHTML; }).join("");
        var names = Object.keys(P.sel);
        names.forEach(function (n) {
          var sv = null;
          for (var k = 0; k < SVC.length; k++) if (SVC[k].n === n) sv = SVC[k];
          P.history.unshift({ t: nowHM(), s: n, e: "SIT", v: sv ? sv.sit : "3.14.2", st: "SUCCESS", sq: "PASSED", by: "ivan.j" });
        });
        P.history = P.history.slice(0, 10);
        toast("build SUCCESS — " + (names.length || 3) + " services deployed to SIT");
        render();
        return;
      }
      var ln = script[i];
      var el = document.createElement("div");
      if (ln.c) el.className = ln.c;
      el.textContent = ln.t;
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
      if (ln.s !== P.stageDone) { P.stageDone = ln.s; paintStages(); }
      i += 1;
      P.timers.push(setTimeout(step, RM ? 60 : 420 + Math.random() * 320));
    }
    step();
  }

  function paintStages() {
    if (!P.viewEl) return;
    P.viewEl.querySelectorAll(".rp-stage").forEach(function (s, i) {
      s.classList.toggle("done", i < P.stageDone);
      s.classList.toggle("run", i === P.stageDone);
    });
  }

  function nowHM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ---------- sub-nav scroll spy (Work) ---------- */
  function initSubnav() {
    var bar = document.querySelector("[data-subnav]");
    if (!bar || !("IntersectionObserver" in window)) return;
    var links = {};
    bar.querySelectorAll(".wsn").forEach(function (a) { links[a.dataset.wsn] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        for (var k in links) links[k].classList.toggle("on", k === id);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- toolbox tier filter ---------- */
  function initToolboxFilter() {
    var grid = document.querySelector(".skill-grid");
    var bar = document.querySelector(".tier-filter");
    if (!grid || !bar) return;
    var items = [].slice.call(grid.querySelectorAll(".skill-item"));
    var groups = [].slice.call(grid.querySelectorAll(".skill-group"));
    var btns = [].slice.call(bar.querySelectorAll("[data-filter]"));
    function tierOf(it) {
      var t = it.querySelector(".tier");
      if (!t) return "";
      if (t.classList.contains("t-daily")) return "daily";
      if (t.classList.contains("t-regular")) return "regular";
      if (t.classList.contains("t-exposure")) return "exposure";
      return "";
    }
    function apply(tier) {
      items.forEach(function (it) { it.style.display = (tier === "all" || tierOf(it) === tier) ? "" : "none"; });
      groups.forEach(function (g) {
        var any = [].slice.call(g.querySelectorAll(".skill-item")).some(function (it) { return it.style.display !== "none"; });
        g.style.display = any ? "" : "none";
      });
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.filter === tier)); });
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { apply(b.dataset.filter); }); });
    apply("daily"); /* default saat JS aktif; tanpa JS semua tampil (noscript.css menyembunyikan bar) */
  }

  /* ---------- mail preview tabs ---------- */
  function initMailTabs() {
    var box = document.querySelector(".mailshow");
    if (!box) return;
    var tabs = box.querySelectorAll(".ms-tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.toggle("on", x === t); });
        box.querySelectorAll("[data-mail-pane]").forEach(function (p) {
          p.hidden = p.dataset.mailPane !== t.dataset.mail;
        });
      });
    });
  }

  /* ---------- lifecycle rail (Architecture) ---------- */
  function initLifecycle() {
    var wrap = document.querySelector(".lc");
    if (!wrap) return;
    var nodes = [].slice.call(wrap.querySelectorAll("[data-lc]"));
    var detail = wrap.querySelector("[data-lc-detail]");
    var cur = 0, timer = null;
    function show(i) {
      cur = i;
      nodes.forEach(function (n) { n.classList.toggle("on", +n.dataset.lc === i); });
      if (detail) detail.textContent = T("lc.d" + (i + 1));
    }
    function start() {
      if (RM || timer) return;
      timer = setInterval(function () { if (!document.hidden) show((cur + 1) % nodes.length); }, 3800);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    var pauseBtn = wrap.querySelector("[data-lc-pause]");
    var paused = false;
    function setPaused(on) {
      paused = on;
      if (on) { stop(); } else { start(); }
      if (pauseBtn) {
        pauseBtn.setAttribute("aria-pressed", String(on));
        var lbl = pauseBtn.querySelector("span");
        if (lbl) lbl.textContent = T(on ? "lc.resume" : "lc.pause");
      }
    }
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function () { setPaused(!paused); });
      if (RM) { pauseBtn.disabled = true; }
    }
    nodes.forEach(function (n) {
      /* tidak ada lagi div berpura-pura tombol: .lc-node dan .lc-chip sama-sama
         <button type="button">, jadi Tab/Enter bekerja tanpa role tambahan.
         Klik menghentikan rotasi; tombol jeda memberi kontrol eksplisit (2.2.2). */
      n.addEventListener("click", function () { stop(); show(+n.dataset.lc); });
    });
    if (RM) {
      nodes.forEach(function (n) { n.classList.add("lit"); });
      show(0);
    } else {
      show(0);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en) {
          en.forEach(function (e) { e.isIntersecting ? start() : stop(); });
        }, { rootMargin: "120px" }).observe(wrap);
      } else { start(); }
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    initHeroFlow();
    initConveyor();
    initBoard();
    initChatops();
    initPlatform();
    initSubnav();
    initLifecycle();
    initMailTabs();
    initToolboxFilter();
  });
})();
