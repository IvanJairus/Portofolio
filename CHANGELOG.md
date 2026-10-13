# Changelog

All notable changes to this repository are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## How to read this file

- **The history spans two days.** 82 commits, 28 on 2026-10-06 and 54 on
  2026-10-07 (`git log --format='%h %ad %s' --date=short`). That is the whole
  recorded history of this repository; it is a compressed build, not a
  long-running project, and the numbers here should be read that way.
- **The headings below `1.0.0` are dates, not versions.** The first 82 commits
  were built before any tag existed; `2026-10-06` and `2026-10-07` stand in for
  releases the owner had not cut yet. `v1.0.0` was tagged on 2026-10-08 at
  `66d63ad`, and the `2026-10-06` / `2026-10-07` sections are its contents.
  **`v1.1.0`** was tagged on 2026-10-08 as well, one day of work later: 58
  commits, two new evidence repositories linked, and the tab mark changed.
- **Four of the 82 commits are Dependabot bumps**, collected under
  *Dependencies* rather than being presented as authored work.
- **On "rebuilt from an earlier private draft": not asserted.** That framing was
  checked against the commit messages and is not supported by them. Nothing in
  the 82 subjects or bodies mentions a predecessor, an import, or a private
  draft. The history begins with `24b4a83` "Portfolio: glance-pass redesign".
  What the messages *do* reference repeatedly is an audit of this working site,
  in labelled batches (Batch A, C, E, G, K) and a numbered finding list (`F8`,
  commit `4c112ee`). That is a review process, not evidence of another
  repository. The claim is therefore omitted.
- Short hashes are given so every line can be checked with `git show`.

## [Unreleased]

### Added

- **`#spotlight`, two panels on the landing, and what they cost.** A band between
  `#architecture` and `#decisions` now points at the two pages that had outgrown
  their work cards: one for the diagram atlas, one for the pipeline consoles, each
  with a mini topology strip and two links. Measured at 390px the section occupies
  17,161 to 18,132, so 971px, and the landing went from 24,301px to 25,272px. The
  landing transfers 414,636 B against the 524,288 B ceiling, 6,895 B more than
  before it, at Performance 89 (was 90), FCP 2.40 s (was 2.26 s), TBT 21 ms (was
  10 ms), CLS 0. The atlas panel names the five plates by their titles instead of
  paraphrasing them a fourth time, and the fallback is generated through
  `scripts/sync-i18n.mjs`, so `i18n.js` and the HTML cannot drift.
- **`/diagrams/`, five plates, and the landing stayed link-only.** The architecture
  suite that had lived in a local lab folder is now a sixth page: 21-phase board
  governance, control plane and runner topology, dual-track event router, six-domain
  dependency convergence, and the card-to-SIT sequence, each with its own deep link
  (`#state-governance`, `#control-plane`, `#event-router`, `#dependency-graph`,
  `#sequence-sit`). The SVG markup is inline, its CSS and JS sit in
  `assets/css/diagrams.css` and the atlas branch of `assets/js/diagrams.js`, and
  every plate carries `data-frame="end"` with `data-static-frame="complete"`, so a
  reader without JavaScript gets the finished diagram rather than an empty frame.
  The landing did not gain a fourth inline SVG: it gained links, one in the primary
  nav, two on the work cards, one under the gateway diagram, one in the footer band.
  That is a weight decision, not a taste one, because the landing already transfers
  407,741 B against a 524,288 B ceiling. Measured on this branch with the flags CI
  uses (`lighthouse@13.5.0`, mobile, `--force-prefers-reduced-motion`): `/diagrams/`
  scores Performance 99, Accessibility 100, Best-Practices 100, SEO 100, FCP 1.502 s,
  LCP 1.652 s, TBT 0 ms, CLS 0, and transfers 137,661 B, the lightest page on the
  site. The landing itself moved 401,859 B to 407,741 B against `main`, +5,882 B for
  the five new link labels, with LCP 3,307 ms to 3,306 ms and Performance 89 to 90.
  The deep links were proven in a same-origin frame rather than by screenshot:
  `#control-plane` lands the plate at 81 px from the top, which is exactly its
  `scroll-margin-top`, and `#sequence-sit` at the same offset. A headless screenshot
  of a fragment returns a blank frame either way and proves nothing about the page.
  The 390px reading of each plate is a horizontal pan inside its container by design
  (`min-width: 1080px`), not a reflow. Built across `47ac390` to `1dc1cda`, then
  trimmed and wired into CI in `ea628ac`.
- **`/decisions/`, a fourth page, and the landing finally got shorter.**
  `#runtime` and `#decisions` were eleven `decision / alternative / why / cost`
  cards and 1,252 words of prose sitting at the eighth and ninth screen of a
  mobile scroll, where the accordion had already folded nine of them. They are one
  page now, in two groups ("How the system is shaped", "Running it in production"),
  and the landing keeps a band in their reading position: the heading, the count,
  and three decisions named by what they cost, so the link has to earn the click.
  Measured at 390px the landing went 26,230px to 24,041px, and at 1440 19,490px to
  16,871px; across the whole session that is 25,569px to 24,041px on mobile and
  425,844 B to 401,859 B. The new page measures Performance 98, Accessibility 100,
  CLS 0.003, 155,033 B.
- **`folds.mjs`, and one trap worth writing down.** The accordion moved with the
  cards, out of `main.js`. `showcase.css` hides `.dec-fold` until
  `html[data-js]` exists, so a reader without JS gets open cards instead of a
  button that does nothing, and that flag is set by `main.js`, which the new page
  does not load. The first build therefore folded the cards and hid the control
  that opens them: eleven collapsed panels with no visible affordance. The flag is
  set in `folds.mjs` now, with the reason there.
- **60 dictionary entries deleted.** The moved cards carry plain text, so their
  `dec.*` and `rt.*` keys and the `Runtime` sub-nav chip went with them;
  `i18n.js` is 35,298 B to 27,110 B and parity reports 323 keys, 0 broken.
- **`/decisions/` in the gates.** `quality.yml` measures four pages, `html-validate`
  five documents, the sitemap lists four URLs, and `404.html`'s "Runtime" link
  became "Decisions" pointing at the new page rather than at an anchor that no
  longer exists.

- **`/reports/`, a third page.** The three report emails were a tabbed widget: one
  card visible, two hidden until a click, so a printed page, a crawler and a
  60-second read all saw exactly one of them. They are a page now, stacked, each
  under the question it answers ("Did every release branch get the fix?", "What
  did the scanner find across the domain?", "Which services failed their quality
  gate?"). Measured cold on simulated mobile: Performance 98, Accessibility 100,
  CLS 0, 149644 B.
- **Four ways into `/pipelines/`, where there was one.** Before this the only
  route to the strongest evidence on the site was the nav link, and the nav
  collapses to a hamburger below 900px. Now: the footer of the hero's
  `.gitlab-ci.yml` card says *and this is what one of those runs prints*; the Work
  section ends with three real lines from a refused gate run on the dark console
  surface; the lifecycle block ends with a "where this is enforced" pair; and the
  Toolbox closes with the receipt sentence pointing at the page that lists every
  tool against the file it appears in.
- **The gate's scan line is computed, not typed.** A `dyn: "readscan"` line builds
  `read scan file=… findings=N critical=… high=…` from the counts the ported rules
  produce, in the shape `run-gate.groovy` logs it. Before that the refused run
  displayed the passing run's numbers: `findings=3 critical=0` above a table that
  contained a critical.
- **A third page in the gates.** `quality.yml` runs the Lighthouse budget over
  root, `/pipelines/` and `/reports/`, and `html-validate` covers all four
  documents including `404.html`.
- **A gitleaks config with exactly one exemption.** CI's secret scanner flagged
  `key=gate-383a8aad37876b0e` in a console trace under `generic-api-key`. That
  value is the first 16 hex characters of a SHA-256 over a pipeline id and a
  verdict summary, which is what an idempotency key looks like. Checking it
  against `ticket_sync.py` also caught that the number on the page had been
  invented: `sha256("1421|gate passed")` is `383a8aad37876b0e`, and the trace
  said `51daa202bcf986a2`, which is the digest of nothing. The trace now carries
  the value the code produces, so a reader can recompute it. `.gitleaks.toml`
  allows `^gate-[0-9a-f]{16}$` and nothing else, anchored because gitleaks matches
  allowlist regexes against the secret rather than the line around it. `[extend]
  useDefault = true` is load-bearing: without it a config file replaces the
  default rules, which would switch the gate off while looking like it was
  configured. Tested both ways with the same binary CI uses (8.24.3): the range
  that failed now reports no leaks, and a planted Slack bot token in a scratch
  directory is still caught.
- **A tools receipt on `/pipelines/`.** The landing page names tools; the original
  brief for this page was that those names have to be provable somewhere. Sixteen
  rows, each pointing at the file or the job on this page where the tool actually
  appears, so a reader can check the claim by scrolling instead of by trusting a
  list.
- **A console line now has to name the statement that prints it.**
  `scripts/check-traces.mjs` used to be satisfied when a line's probe substring
  appeared anywhere in the pinned file, which is a weak claim: a log line could
  cite a comment three hundred lines away from the code that logs it. A line that
  presents itself as output (`log`, `ok`, `warn`, `err`, and not tool output) now
  has to resolve to a line containing a printing statement (`echo`, `printf`,
  `log INFO`, `log(...)`, `failures <<`, `error(...)`) or to a string literal the
  message begins with. Of the 217 lines on the page, 62 are traced to the
  statement that prints them, 25 are attributed to a tool the pinned file
  invokes, and the remainder are command lines and the annotations that point at
  the code they explain.
- **The pin line says what it counted.** `32 files pinned by SHA-256` and `217
  console lines` are both read out of the lock and the trace data as the page
  loads, so neither number can go stale the way a typed one does.
- **The page hashes the file it is showing.** When a source panel finishes
  fetching a vendored file, it computes that file's SHA-256 in the browser
  (`assets/js/release-rules.mjs`, the same pure implementation the golden checks
  use) and compares it with the lock. The panel head then says either `sha256
  3b4326204192 matches the pin` or `DOES NOT MATCH the pin ...`. CI proving
  byte-identity upstream and the page proving it here are two different things,
  and only the second one is evidence for the reader.
- **The vendored files are fetched by a script.** `scripts/sync-sources.mjs`
  downloads every file listed by `assets/data/sources.json` at the pinned commit,
  validates each highlight range and each job-to-file mapping before writing
  anything, and regenerates the bodies, the line counts in `sources.json` and
  `rules.lock.json` together. Before this, adding a file meant editing four
  places by hand and hoping.

### Changed

- **The spotlight moved to the front of the work and got the heading it was
  missing.** It sat between `#architecture` and `#decisions`, at 17,161 to 18,132
  on a 390px screen, the nineteenth screen of a twenty-five screen page, which is
  not what a spotlight is for; the same file already argues that content at the
  eighth and ninth screens was deep enough to move off the landing. It now sits
  between `#about` and `#work`, at 2,207 to 3,283, the fourth screen. It was also
  the only landing section without an `h2`, so its two `h3` read in the outline as
  belonging to whatever heading came before. `Two pages behind the cards` is that
  heading, written into `i18n.js` and regenerated into the fallback with
  `scripts/sync-i18n.mjs`. Measured: the section is 1,076px tall against 971px
  before the heading, the landing went 24,301px to 25,377px at 390, root transfers
  414,801 B, Performance 89, Accessibility 99, TBT 0, CLS 0, `errors-in-console` 0.
  Moving it out of `#work` changes nothing in skim mode, because the fold is
  driven by `data-deep` on each section and the spotlight never carried it. The
  `heading-order` audit still scores 0 on this page, and it did before the change:
  that item is still open and is not fixed by this move.
- **The plate list on `/diagrams/` now repeats each plate's own title, one per
  line.** The hero list described every plate a second time, so four of five
  entries disagreed with the heading they pointed at: `02 · control plane,
  archetypes & anti-loop` sat above `Control plane, three execution archetypes,
  and the loop back`. The rule is now that the list copies the title with its first
  letter lowercased, which is what entry 05 already did. The titles were cut to the
  subject only, because the eyebrow already names the kind and the deck already
  carries the detail: `21-phase board governance`, `Control plane and three
  archetypes`, `Dual-track event router`, `Where the six pipelines converge`,
  `One card from In Dev to SIT`, and `Release Orchestrator:` is gone from all of
  them. `&` survives only where width is the constraint: 26 of the page's 28
  ampersands are inside SVG labels, and the two that were in prose are gone.
  `.dg-jump` went from `flex-wrap: wrap` to a column. Measured in the page at 390px
  every one of the five entries is 21px tall, a single line; before this pass the
  two longest were 41px. At 1280 they are five distinct rows with equal left
  offsets, and the longest label is 39 characters against a container that fits 46.
- **The five plates on `/diagrams/` now speak with one voice.** Four still carried
  their lab tier (`State Machine · GOLD 1 · Interactive Motion · Reference`) and a
  deck opening `GOLD 3 / Variant 3 (Dual-Track Router · Interactive Step Mode):`,
  which named a control that no longer exists: `665ce87` deleted the playback bar
  and `1bbffe6` replaced stepping with a loop that pauses ten seconds on the
  finished frame. The fifth plate had already been rewritten as
  `Sequence · reference implementation · Interactive`, so the page disagreed with
  itself. Every eyebrow now reads `<kind> · reference implementation
  · Interactive`, every deck leads with what the plate shows, and three `h2` lost
  the `Release Orchestrator:` prefix only three of five had carried. No claim
  moved: the phase, layer, guard and status counts are the ones already published
  on the landing and drawn inside the SVG. Measured after the pass: Performance 99,
  Accessibility 100, SEO 100, LCP 1.66 s, 137,397 B transferred, 222 B lighter.
- **The report widget lost its tabs, and the code with them.** One card stays on
  the landing, and the two that are not shown are named by their own numbers
  ("1 critical, 5 medium, 31 services scanned") so the link carries the claim
  instead of a "read more". `initMailTabs()` and the `.ms-tab` rules are deleted:
  a control that switches between one thing that exists and two that do not is a
  dead control.
- **The honest surprise: the report split did not shorten the landing.** Moving two
  report cards off the page removed almost no height, because hidden elements
  contribute none, and the new pointers added some. Measured at 390px the page went
  from 25,569px to 26,230px, 2.6% taller, while transfer size fell from 425,844 B to
  422,597 B because the hidden cards, the tab JS and the tab CSS left together. That
  is what prompted the `/decisions/` split above, which did shorten it: 24,041px at
  390px and 401,859 B. The lesson is written where it can be found: shortening a
  page means moving something a reader can already see.
- **108 section banners stopped being drawn with dashes.**
  `/* ---------- mail preview tabs ---------- */` became `/* mail preview tabs */`,
  and `<!-- ================= HERO ================= -->` became `<!-- hero -->`.
  Ten more went the same way upstream (`1271c28`) in files this page displays,
  which moved the pin to that commit; `check-comments-only.py` proves that diff
  touched comments only, and the fixture there still reports 31/31.
- **The tab icon is the site's own mark.** The favicon was an orange circle with a
  white square inside it, a shape nothing else on the site uses, while every page
  header draws a 30px white box with a hairline orange border and bold mono `IJ`.
  The icon is that mark now. Two numbers are deliberately not copies of the CSS:
  the border is 2 units in a 32-unit box (a 16px tab halves every stroke, so the
  header's 1px would render as half a pixel), and the initials are 44% of the box
  instead of 40%. Both were chosen by rendering the mark at 16px on a light tab
  and a dark tab and comparing three weights; the picked version is the one that
  still reads as `IJ` at 16px. `favicon.svg`, `favicon-32.png` and
  `apple-touch-icon.png` (180px) all come from the same SVG, rendered by the
  browser rather than drawn twice. `404.html` declared only the SVG icon; it now
  declares the same three links as the other pages.
- **The consoles are three times longer.** The page drew 65 console lines from an
  array written next to the source data; it now draws 217 from
  `assets/data/traces.json`, one entry per line, each with its own probe. The
  extra length is not padding: the GitLab panel now narrates the scan jobs, the
  contract job and the promotion windows, and the Jenkins panel narrates the
  webhook payload, the label matching and the Vault lease, which is where the
  interesting logic actually is.
- **The consoles are a table.** Every line is four columns now (time, level,
  scope, message) on a CSS grid whose rows are `display: contents`, so the columns
  line up down the whole panel instead of drifting with the length of each
  message. Measured after the fix: at 1440 the four tracks are 90 / 14 / 14 / 378
  px and every row starts at x 199, 297, 319, 341; at 390 the scope column
  collapses to 0 and rows start at x 21, 119, 149. Pinning `grid-column` per cell
  was necessary: a hidden scope cell otherwise re-orders the auto-placement of
  everything after it.
- **The trivy console stopped claiming it printed a table row.** Three lines were
  composed by the page and probed against a threshold constant: a HIGH finding
  with "2 of 5 allowed" glued to it, a "within thresholds" verdict, and a CRITICAL
  row with "allowed 0". The two finding rows are now attributed to trivy, which is
  what produces them, and the threshold comparison is an annotation that points at
  `GateResult.THRESHOLDS` and says the gate adds no failure. The `✓` line is gone,
  because nothing in the repository prints it.
- **The last Indonesian on the site was in the sample SAST email.** The callout,
  the section heading, the two status pills, the attachment note and one word in a
  subject line are English now, which also retires the note that explained why the
  report text "stays in Indonesian". The arrow between the two ecosystems read
  "migrated the standard, not just the tools"; it says "same standard, different
  tools", which is the same fact without the construction.
- **The comments followed the copy.** 593 comment lines in 14 files (`base.css`,
  `showcase.css`, `components.css`, `main.js`, `showcase.js`, `index.html`, the
  two workflows, and six smaller ones) were still Indonesian, written as notes to
  myself. They are English now, including six CI messages that only a person
  reading an Actions log would see, and the parity script's own summary line. The
  change is provably comment-only: stripping every comment from the two versions
  of each file leaves byte-identical code.

### Fixed

- **The atlas contradicted the landing about how many services there are.** The
  three archetype labels read `mobile · wallet : 26 services`,
  `portal · core : 38 services`, `identity · ledger : 39 services`, which is 103,
  while `index.html` says 53 services in seven places, the hero line and a node of
  its own gateway diagram among them. The lab's internal edition states
  `103 services` five times across four files, so the three numbers were one
  population split three ways, not two measures of two different things. No basis
  could be named for either figure, so the counts are gone and the labels
  carry the domain names only: `grep -o ">[^<]*services[^<]*<" diagrams/index.html`
  now returns nothing, the archetype boxes lost no layout, and the page moved
  137,661 B to 137,619 B with Performance 99 and CLS 0 unchanged. **What this did
  not settle:** the 53 on the landing is still published without a source or a
  counting basis, which is the rule in `DESIGN.md` it has yet to meet.

- **The performance gate did not measure the page it was added for.** The
  `for page in` list at `quality.yml:97` carried four URLs, so `/diagrams/` had no
  Lighthouse budget on the runner, the same class of gap as the two CI file lists
  above. It is the fifth page measured now, and its local baseline is written next
  to the loop: Performance 99, Accessibility 100, FCP 1.50 s, LCP 1.65 s, TBT 0 ms,
  CLS 0, 137,661 B. The comment above the loop said "Two pages are measured" while
  four were, so the count there was wrong before this too.

- **`/diagrams/` downloaded a 42 KB dictionary that nothing read.** The page loaded
  `i18n.js` but not `main.js`, and `main.js` is the only consumer of `window.I18N`,
  so the 262 `data-i18n` attributes on the page were inert and the fallback text
  was already what every visitor saw. Dropping the script tag and the attributes
  left the rendered page identical, proven two ways on `?motion=static` so the
  capture is not a frame of a loop: the SHA-256 of a 1280x2600 screenshot is
  `b69e1c8de1e5fd3a` on both revisions, and the visible text, scripts and SVG
  markup stripped, is 552 words and byte-equal. A screenshot without that query
  parameter is not a proof, it lands on a different frame of the auto-loop each
  run. The page
  went from 183,728 B to 135,487 B raw, 45,346 B to 29,679 B gzipped. The 251
  `dg.*` keys nobody else referenced came out of `i18n.js` too, 579 keys to 328
  and 42,287 B to 27,506 B, which lightened the landing as well, since that is the
  page that really does load the dictionary. The convention was the tell: `pipelines/`,
  `decisions/` and `reports/` carry no `data-i18n` at all, and `sync-i18n.mjs`
  generates the fallback for `index.html` only. The atlas had invented a rule and
  then not followed it.
- **Two CI lists did not know the new page existed.** `security.yml` ran
  `html-validate@8` over five named files and `check-visible.mjs` carried the same
  five-item `PAGES` list, so `diagrams/index.html` was validated by neither. Both
  lists include it now. The card gate is a no-op on that page today, it has no
  `mail-card`, `dec-card`, `pf-card` or `wv` element, and it is added anyway so a
  card copied there later cannot ship `hidden`.

- **Two of the three reports were invisible on `/reports/`, found on a real
  phone.** The cards were copied out of the tabbed widget with their `hidden`
  attribute still on them, so the page rendered "report 2" and "report 3" as a
  heading and a sentence over empty space. My own check had counted three
  `.mail-card` elements in the markup and called that verified; the markup was
  right and the page was not. `scripts/check-visible.mjs` is the gate now: no card
  on any page may carry `hidden`, and it is proven to fire both ways, a clean run
  passes and a planted `hidden` fails with the file and the line.

- **The page contradicted itself about the scan findings.** The trivy console
  printed `Total: 3 (CRITICAL: 0, HIGH: 2, MEDIUM: 1, LOW: 0)` under a command
  that asked for `--severity CRITICAL,HIGH`, and the gate card below it computed
  `critical 0 high 1 medium 1 low 1` from a findings list that had nothing to do
  with the table above. Three separate untruths in one screen. The severity list
  is now `CRITICAL,HIGH,MEDIUM` in the three stage templates that scan images
  (`0774a5b` upstream), the gate's input is the finding list those two example
  reports actually contain, and the refused run got its own `Total: 4` line
  instead of borrowing the passing one. The consoles and the gate card now agree
  on every count in both outcomes: 0/2/1/0 passed, 1/2/1/0 refused.
- **A panel could name a file it never loaded.** `v1.4.0` was tagged at `52e3298`;
  this landed after it. Deep-linking into the Jenkins gate selected a job whose
  source is `GateResult.groovy`, and the panel printed the file name with no line
  marked, because the lazy loader fetched what the strip listed rather than what
  the job map points at. The fetch now takes the union, and the Jenkins tree lists
  the two shared classes it compiles.

## [1.4.0] - 2026-10-11

### Added

- **`DESIGN.md`.** The site's visual and prose direction written down instead of
  living in commit messages: why the page is white and the console is the only dark
  field, why orange is GitLab's and where its budget stops, the four radii and the
  two real shadows, the reason the graph-paper motif is there, and the declared
  motion dials ENERGY 2 / RHYTHM 2 / MOTION 3. Written after the fact, and the file
  says so.

### Changed

- **`/pipelines/` is one sheet with two engines on it, not a widget with tabs.** The
  first version of the page made you choose: engine here, outcome there, and the
  source behind a tab. A pipeline is read by comparing what happened with the code
  that made it happen, so the tabs are gone. The GitLab stage columns and the Jenkins
  Blue Ocean graph are now stacked, each with its console beside its own source panel,
  and the gate that decides both sits below them as its own section. One switch,
  `passed / refused`, moves all three at once.
- **The GitLab side got the complexity the claim needed.** Eight stages and sixteen
  jobs, named exactly as they are named in `ci-library/templates/backend.yml`:
  version stamp, jar, image digest, unit and contract tests, four scans including an
  SBOM index, the quality gate, the composite gate, the ticket write-back, the SIT
  deploy, two manual promotions, and a metrics push that runs whether the pipeline is
  green or red. The Jenkins side is a different animal and says so: it starts from a
  Jira webhook body and routes on the transition.
- **Twenty-five files are vendored from one pinned commit, not from a moving branch.**
  `scripts/sync-sources.mjs` fetches them from `raw.githubusercontent.com` at the
  commit named in `assets/data/sources.json`, writes the bodies, the line counts and
  `rules.lock.json`, and refuses to write anything if a highlight range falls outside
  the file it points at. `check-rules-sync.mjs` re-verifies all of it, including that
  every line count still matches the bytes on disk. Comparing against `HEAD` would
  have let the page's claim rot the first time someone edited a file upstream.
- **The console speaks the repository's log format.** `ci-library/scripts/lib/log.sh`
  defines `<RFC3339+offset> <LEVEL> <scope> <message> key=value`, and the page draws
  lines in that shape. The timestamps are the visitor's own clock as the replay is
  drawn, which the page states above the panels; the two durations that are real
  measurements carry their sample sizes.
- **Durations are shown in two places only.** Those are the two the landing page
  publishes with a sample size. Everywhere else the slot stays empty rather than
  guessing a plausible number, and a job the gate never let start shows no duration at
  all.
- **`DESIGN.md` now describes a two-page site.**
- **The Lighthouse gate measures both pages.** It measured the landing page only,
  so everything built on `/pipelines/` could regress without CI noticing. The loop
  now runs `root` and `pipelines` against the same thresholds, keeps the retry
  (two attempts per page, pass on either), and uploads one artifact per page. Run
  locally with the pinned version before committing:
  `root` A99 / BP100 / SEO100, `pipelines` P99 / A100 / BP100 / SEO100.
- **The other two gates started covering the second page too.** `html-validate` ran
  on `index.html` and `404.html`, and the link check on `index.html` and `README.md`,
  so `pipelines/index.html` was never parsed and its links were never followed. Both
  now include it. The first run found three `<button>` elements without a `type`.

### Fixed

- **`/pipelines/` moved the page under the reader while it loaded.** CLS 0.30 on
  first measurement, in two steps: the module waited for eight `fetch()`es before
  painting anything, and the empty containers it then filled were shorter than
  their own content. The run now paints synchronously from the vendored rules and
  only the repository files load late, and each JS-filled region reserves the
  height of the default run's filled state. Measured after: CLS 0.015, which is
  not zero and is not claimed as zero. The residual is the run title growing from
  one line to two inside a header that already reserved its height.
- **A 404 on every load of `/pipelines/`.** The page had no icon links, so the
  browser asked for `/favicon.ico` and Best-Practices lost a point. Now carries
  the same three as the landing page.
- **Two accessibility findings.** Stage names in the GitLab columns were `<h4>`
  under an `<h1>`, which axe reads as a broken heading order; they are column
  labels, so they are `<p>` now. And the brand link's `aria-label="Home"` did not
  match its visible text, which is a `label-content-name-mismatch`: the label is
  gone, so the accessible name is the text on screen. The landing page carries the
  same brand markup and is left alone until its published scores are re-measured.
- **The self-check badge rewrote the page when it finished.** Its result text was
  78 characters against a 40-character placeholder, so the pill grew a line and
  pushed the card down. Both states now fit one line at 390px.
- **The `run` label could sit alone at the end of a row** with its buttons on the
  next one. Label and control are grouped, so they wrap together.
- **Truncated job names had no way back.** `sonarqube-c…` and `promote-p…` are what
  a 132px column gives; the full name is now a tooltip, as it is in GitLab.
- **The architecture diagram was cut in half on a phone.** `min-width: 640px` inside
  a 350px box left 326px of the drawing off screen with nothing to suggest the box
  scrolled, so the two columns that carry the argument (`domain pipelines` and
  `environments`) were invisible. Held at 560px and the right edge now fades. The
  threat model table keeps its scroll and gained the same cue plus a line in its
  lead, because a text table cannot be squashed without becoming unreadable.
  Measured: 326px hidden, now 246px, and document overflow stays 0 at 390 and 412.
- **The "open to work" dot stopped pulsing.** It is a fact that does not change for
  hours, and a pulsing dot borrows the vocabulary of a live indicator for something
  that is not live. The three dots that mark real running state still pulse.
- **One regression caught while fixing the above.** A longer caption hint widened a
  grid row and pushed the scan card 215px off screen. Reverted; the overflow sweep
  is back to its previous single pre-existing finding.

### Changed

- **The "52-rule" count is off the page.** Four strings carried it: `work.2.i2`,
  `tm.8g`, `skills.e.1.1`, and the DevSecOps timeline bullet in `config.js`. The
  number could not be pointed at a published list, so it was a claim a reviewer
  could ask about and I could not answer. It now reads "the published standard"
  and "the published rule set", which the reference library can actually show
  line by line. `ReleaseRules.groovy` in `pipeline-gateway-reference` still
  writes "52 rules" in its own header comment; that is a different repository and
  was left alone. Cut after `v1.2.0`, so it belongs to the next release.
- **Copy: 348 dashes removed from the page and the repository.** The em dash was
  doing the job of a period, a comma or a colon in 16 tracked files, and in
  clusters it is the tell that reads as machine-written. Long sentences were split
  at the same time: `rt.1.c`, `dec.2.c`, `dec.5.c` and `board.narr.7` were 40 to
  49 words each. The recurring hedges were reduced with it, and three claims that
  were only decoration were cut rather than reworded, including `robust` in the
  backend bullet.
- **`assets/js/i18n.js` is now the only place page text is written.**
  `scripts/sync-i18n.mjs` regenerates the 424 HTML fallbacks from it, so the
  parity rule that used to be maintained by hand is now produced. `--check` is run
  by CI.
- **`scripts/assert-copy.mjs` measures what a reader sees.** It decodes the
  Unicode escape used inside a JS string and the HTML entity used inside markup
  before counting, which is how the first pass under-reported the problem: a
  plain grep found 201, the real number was 348. `LICENSE.md` is excluded because
  the Creative Commons headings are quoted legal text, not our prose.
- **SECURITY.md and README.md corrected.** Both claimed nothing on the page talks
  to a third party and that no visitor data exists. That was true until analytics
  was switched on, so the text now names what is collected, where it is posted,
  and what is not stored.

### Added

- **Vercel Web Analytics wired through `assets/js/observability.js`.** The script
  is same-origin, so `script-src 'self'` still holds; `connect-src` gained exactly
  one host, `vitals.vercel-insights.com`. The loader only fires on the production
  hostname, because a missing `/_vercel/...` script is a 404 in the console of a
  page that advertises its hygiene, and locally that is guaranteed.
- **Cache policy per asset class in `vercel.json`.** Photos and the OG cover are
  held a week with stale-while-revalidate; the CV is held one hour because people
  re-download it; CSS and JS must revalidate, since there is no content hash
  without a build step and a stale stylesheet is the one mistake this site can
  actually make.
- **`404.html` with `assets/css/error.css`.** Unknown paths used to fall through
  to Vercel's default page. The new one links the seven sections and loads only
  the tokens it needs.
- **Two CI steps in `quality.yml`:** the parity check and the copy gate.
  `security.yml` now validates `404.html` with the same pinned
  `html-validate@8`, which caught a lowercase doctype on the first run.

### Fixed

- **The page's own fallback text had drifted from its data.** `config.js` carries
  seven experience bullets and four contact links; `index.html` shipped six and
  two. A visitor with JavaScript disabled saw a shorter record than one without,
  and nothing in CI could notice. `scripts/sync-i18n.mjs` now generates the
  timeline and the links block from `config.js` the same way `main.js` builds
  them, so the drift is not possible to reintroduce. Verified in a browser: 10
  bullets and 4 links on both sides, identical text.
- **`robust` cut for real.** The backend bullet claimed "the design patterns and
  framework knowledge that keep microservice APIs robust", which states no fact.
  It now says what was built and stops there.

### Removed

- **Nine dead locale fields in `config.js`.** `main.js` fixes `lang` to `en`, so
  every `id:` sibling of an `en:` value was unreachable. The example entry in the
  file's own comment taught the two-language shape, so it was corrected too.
- **`links[].id` was kept on purpose.** Those four values are identifiers
  (`linkedin`, `github`, `pipeline`, `dashboard`), not Indonesian text, and a
  first pass that counted 13 dead fields mistook them for dead. They stay.

### Deliberately not added

- **ISR and server rendering** need Next.js; this is a static page with no build
  step, which is the point of it.
- **Edge Middleware** would add a compute hop to every request to do what
  `vercel.json` already does declaratively.
- **Vercel Cron and Storage** have nothing to schedule or store here. Adding them
  would be decoration.
- **Custom events** are not on the Hobby plan, so the CV-download count that made
  analytics interesting is not available. Pageviews and referrers are.

### Measured after

Lighthouse 13.5.0, mobile emulation, `--force-prefers-reduced-motion`, served by
`python3 -m http.server` on 127.0.0.1: performance 89, accessibility 99,
best-practices 100, SEO 100; FCP 2.4 s, LCP 3.3 s, TBT 0 ms, CLS 0.001, weight
416 KiB against a 512 KiB ceiling. Layout swept at 8 widths across 10 sections
with no page overflow and no clipped text, zero console errors, and the analytics
loader confirmed inert locally.

### Confirmed live, both features

Web Analytics was enabled in the dashboard on 2026-10-08, but nothing had ever
loaded its script. The pull request Vercel's agent opened to do it
(`IvanJairus/Portofolio#5`, still a draft since that day) is the only thing that
would have, and it writes the bootstrap as an inline `<script>` which this site's
`script-src 'self'` refuses. Its `vercel.json` change is byte-identical to the
one in this release, which is a useful second opinion on the host list. PR #5 can
be closed.

Speed Insights was assumed to need a per-project path copied from the dashboard,
so it was left for later. That assumption was wrong and checking it cost one
request: `/_vercel/speed-insights/script.js` already answers 200 on production.
Reading the loader settled the remaining question, which is where the data goes:
it posts to `vitals.vercel-insights.com/v2/vitals`, the same host Web Analytics
uses, and reports LCP, CLS and INP on `visibilitychange` through `sendBeacon`. No
CSP change was needed, so both scripts now load through the same guarded path.

Verified on production with a real browser: both scripts return 200, both tags
are present after load, `window.va` is a function, and the console stays clean.
Allowance on Hobby is 50,000 Web Analytics events per month and 10,000 Speed
Insights events per rolling 30 days, shared across the team.

### Measured after

Lighthouse 13.5.0, mobile emulation, `--force-prefers-reduced-motion`, served by
`python3 -m http.server` on 127.0.0.1, 2026-10-11. Both pages, same thresholds,
and the CI gate now runs both:

| Page | P | A | BP | SEO | FCP | LCP | TBT | CLS | Weight |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 89 | 99 | 100 | 100 | 2.40 s | 3.30 s | 0 ms | 0 | 416 KiB |
| `/pipelines/` | 99 | 100 | 100 | 100 | 1.58 s | 1.66 s | 0 ms | 0.011 | 250 KiB |

The landing page's own published figures still come from the 2026-10-07 run
(P93, LCP 2.9 s), and this table is not evidence that they are wrong: it is one
run on a laptop doing other things at midnight, and Performance is the number
that moves with the machine. That is exactly why the gate has thresholds and two
attempts instead of a fixed score. If a future run on a quiet machine does not
return to P93, the published figures have to be re-measured and corrected, not
smoothed over.

Weight is what an uncompressed local server sends; over the wire the deployed page
transfers far less. `/pipelines/` is 0.011 and not 0: the run title grows from one
line to two inside a header that had already reserved its height. Colour contrast:
axe reports 0 findings on the state a visitor lands in; the console's own palette was
computed by hand because the panels below the fold and the marked source lines are
not open at load (the console's scope column was raised from 4.23:1 to 6.08:1 as a result).

## [1.1.0] - 2026-10-08

Fifty-eight commits after `v1.0.0` (`66d63ad`), all on 2026-10-08, this
file's own commit included. Two evidence
repositories were published during this round - `IvanJairus/release-dashboard`
and `shared-library/` inside `IvanJairus/Pipeline` - and the page links both.

Measured at this tag, Lighthouse mobile with `prefers-reduced-motion`:
**89 / 99 / 100 / 100**, FCP 2.41s, LCP 3.31s, TBT 0, CLS 0, contrast findings 0,
console errors 0, 416 KiB served uncompressed by a local server. CI: 5 checks
green.

### Domain

- `84ec20d`: every absolute URL moves to `https://www.ivanjairus.xyz`
  (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`, sitemap,
  robots, security.txt). `919b0f0` adds a `308` from the old
  `portofolio-six-delta-18.vercel.app` hostname to `www`, verified in
  production. Vercel's own apex→www redirect is what makes `www` canonical.

### The first screen

- `d2ddd66`: a 2px read-progress line under the header, pure
  `animation-timeline: scroll()`, removed under `prefers-reduced-motion`.
  `52b5993` undoes a regression that commit introduced: it also set the
  header to `sticky` while it is already `fixed`, which pushed the hero down
  65px. Found by re-measuring, not by reading the diff.
- `75d36fd`: the pipeline rail now fits the first screen at every width
  measured: 7 of 7 nodes fully above the fold at 360x740, 390x844, 412x915,
  1024x768, 1280x720 and 1440x900. It was 0 of 7 at 390 and 1280.
- `ec0982b`: the hero states years in delivery, the role and the city, the
  three facts a recruiter scans for. The rail order was re-compensated so
  this costs nothing above the fold.

### Two reading depths

- `6bb0c6f`: a "Highlights only" toggle and `?view=skim` hide the six case
  studies by CSS only; the default remains deep so crawlers and a Tech Lead
  still get everything. A link into a hidden section returns to deep before
  jumping. At 390px the page is 24.814px deep and 9.644px skimmed.
- Same commit: the ten Runtime and Decisions cards fold at ≤760px, first card
  of each section left open. Runtime + Decisions went from 5.807px to
  2.671px. Without JavaScript both controls disappear rather than sitting
  there dead (`html[data-js]`), verified with scripting off.

### Mobile correctness

- `2ddd5da`: three "swipe sideways to see the rest" labels plus edge
  shadows on the boxes that were silently cutting 46-49% of their content,
  and a pause control for the lifecycle rail (WCAG 2.2.2; it rotates every
  3.8s).
- `810eb27`: the work sub-nav was 93px tall at 390px (three wrapped rows),
  and all six Work anchors landed 39px behind it. One scrollable row, 56px,
  with the chrome heights in `--header-h` / `--subnav-h` and the scroll
  margins split so sections outside Work do not inherit a sub-nav they do
  not have. Every anchor now lands 8px below the chrome.
- `f2e7474`: one contact pill on phones, appearing after the hero and
  retiring at Contact.
- `e39df39`: 37 labels that were drawn at 8-9px get a 10,5px floor at
  ≤620px; decorative marks stay as drawn. A clipping probe over all 37
  selectors returns zero truncated text.
- `836755e`: hover effects that move or recolour are gated behind
  `@media (hover: hover)` (on touch `:hover` sticks until the next tap); the
  hero photo, whose colour was a hover state, is now colour wherever hover
  does not exist; twelve controls reach 44px under a coarse pointer; the header
  gets a plain `rgba()` fallback before its `color-mix()`.
- `7b3e6a0`: the replica's swipe hint appears only when the view currently
  open actually overflows. Measured: 1 of 8 views overflows at 390px, so a
  permanent hint would have been wrong seven times out of eight.
- `25b7a86`: the phone portrait is 60% of the column instead of 46%, and its
  `sizes` hint was updated to match.

### Proof and consistency

- `e81673a`: a Runtime card carrying the measured numbers with their sample
  sizes (53 services, 99 repositories, 7.550 pipelines, deploy median 93s
  n=13, scan median 80s n=30) and an explicit statement that none of them are
  reproducible by a visitor.
- `eaf2a60`, `f0d4f7f`: "40+ repos with an include" becomes "53 services from
  one pipeline repository", which is what the platform actually does.
- `3192a31`: finishes that change: the Architecture headline, its
  `og:description`, two care notes and the diagram's overflow box still said
  forty, while the diagram's own label said 53.
- `63548d4`, `eddc0d4`: link the published reference implementation
  (`IvanJairus/Pipeline`, public, tagged `v0.1.0`) from Contact and from the
  gateway card it describes.
- `7e6781d`: the footer links the CI gate that enforces this page's budgets,
  instead of publishing scores that would rot.
- `a9cbc76`: the Open Graph cover is rebuilt from a source now committed at
  `assets/og/cover-source.html`. The card still showed `40+ repos` and the
  old vercel.app hostname; the previous fix was a pixel recomposite because
  the generator had been thrown away.

### What the delivery path does with AI

- `e2786cc`: three things that were happening every week and appeared nowhere:
  a coding agent drafting `gateway.yml`, Groovy and shell; a hosted model
  turning scan output into the note on the merge request; natural language
  mapped onto the ChatOps commands that already existed. Written as a Decisions
  card (agents draft, nothing they draft merges itself), a threat-model row for
  the model itself, and a sample summary in the Scans view. Every figure in
  that summary is arithmetic on the table above it (3 bugs + 4 vulns + 96
  smells = 103). No model vendor is named.
- `1f32d6e`: the internal artifact store and the hardened mobile build join
  the page: every service resolves Maven and npm through one Nexus instance
  (proxy, hosted, group), and `/deploy-secure` on the ticket switches a build
  from the plain standard to DexGuard / iXGuard inside the same stage contract.
  Each gets a Toolbox tier and a threat-model row.
- `b7af6bb`, `db09afb`: evidence rows for two names that sat in the hero strip
  with nothing under them (Firebase / TestFlight, on-prem VM provisioning). The
  first was tiered "production regular" by inference and corrected to
  "production daily" by the owner.

### Proof instead of promise

- `8ad2f18`: the board gained "break the gate": a card is pushed to Merged
  with no merge request behind it, then 1.4s later is visibly returned to In
  Review while the revert and the exit-1 land in the activity feed. It is a
  mode, not a ninth step (the counter still reads 1 / 8 and a red
  COUNTER-EXAMPLE flag names it), any navigation leaves it, and every beat
  restates something already claimed elsewhere on the page.

### Motion that carries information

- `e0484db`: the replica's views swap with a 260ms move instead of a hard cut,
  and touching a repository in the gateway diagram lights its own path while
  the other lines drop to 0.22 opacity. Parallax was the obvious alternative
  and was not used: the connector lines are separate SVG elements from the
  boxes, so a shifted column would detach from its own cable. Cost recorded:
  394.8 → 406.8 KiB.
- `c0b25b7`, `67a61c5`, `d5f6648`: three attempts at the same problem, that a
  single-line strip at 390px holds 1315px of content in a 350px box and gives
  no cue. A one-pass nudge, then a repeating one, then the owner's phone
  screenshot settled it: a continuous loop at a constant 26px/s (1327px of
  chips over 51s), paused on hover, on keyboard focus, on screen exit and by a
  pause button, with the duplicate set `aria-hidden`. Under
  `prefers-reduced-motion` or without JavaScript the marquee is never built and
  the row keeps its original swipe.

### Phone review, from the owner's screenshots

- `d9e5c78`: thirteen breakpoints become nine, and `overflow-x: hidden` on
  body becomes `clip`. That second change is the finding: hidden makes body a
  scroll container and hides the sin, and with clip the page measured 372px
  wide at a 360px viewport. Cause: fourteen grid tracks written as `1fr`, which
  is `minmax(auto, 1fr)`, so one unbreakable string widens the track past its
  container. All fourteen are now `minmax(0, 1fr)`.
- `8ab6b72`: the lifecycle rail below 620px is a vertical stepper: one step
  per row, connector down the left through the dot centres, 44px rows, fan-out
  chips indented. It had been wrapping thirteen nodes into three rows with the
  connector switched off, which is a grid of unlabeled dots. The travelling
  packet is hidden there rather than rotated.
- `050ee79`: the mini before/after board turns its five columns into five rows
  at ≤620px. Type was not shrunk: 51px columns clipped three cards even at the
  10,5px floor this round set.
- `d0d5b65`, `b016bac`: the portrait that moved into the contact card landed
  in the card's second column (it still carried `grid-area: photo`, which in a
  grid with no such area creates a phantom track), then sat alone on a row of
  its own. It is now 104px beside the "open to work" pill, and the pill drops
  to its own row whole at 320px rather than wrapping.
- `e336b7e`: the header's menu control draws an 18px SVG instead of the
  `≡` glyph.

### Records and hygiene

- `704cbae`: this file catches up to the 29 commits that had landed behind the
  tag, including a "how to read" bullet the tag itself had made false.
- `1fd7120`: the page-weight budget moves to 512 KiB by owner decision, with
  the measured local-vs-wire difference written into the gate and every other
  budget left where it was.
- `a5e17d1`: the licence memo is deleted once the decision is in `LICENSE.md`,
  the README stops describing an Indonesian dictionary that no longer exists,
  and SECURITY.md stops shipping a section that announces it is not ready.
- `2db02e7`: five ADRs in `docs/`, reconstructed from what the page already
  claims, labelled as reconstructions, with 0005 ending on its own weakness.
- `4e3a859`: schema.org Person built only from facts on the page, and a
  `theme-color` still painted in a palette the design left weeks ago.
- `9eaa50e`: Trusted Types recorded as tried, measured and declined: the
  directive breaks the one string-to-DOM path that renders translated text, and
  the policy needed to work around it would enforce nothing.
- `866456e`: CODEOWNERS says one owner, because that is who owns it.

### Round 3, from the owner's second screenshot set

- `637eb7a`: three regressions of my own, all found by looking at rendered
  screens rather than measuring widths: the "counter-example" flag was clipped
  19px outside a 360px viewport (the flex row holding it could not wrap, so the
  label that names the mode was the one thing off screen); the phone reflow of
  the before/after board also caught the "gitlab out of the box" panel, whose
  empty columns are the point, so it is scoped to `.ba-cols.five` now; and the
  portrait in the contact card still carried `grid-area: photo`, which in a grid
  without that area creates a phantom second track: the photo moved right and
  the email row was cut at the card edge.
- `2cabbf7`: the pause button is gone, on your instruction, and the strip is
  driven by its own `scrollLeft` instead of a CSS transform so the same row can
  be dragged by hand while it crawls at 26px/s. It holds still for 1,4s after
  the last touch and then continues from wherever you left it. The trap that
  made the first version stand still: `scrollLeft` reads back as an integer at
  DPR 1, and one frame at 26px/s is 0,42px, so re-reading the position floored
  the step to zero forever.
- `493a92e`: "Highlights only · off" becomes a verb that swaps with its own
  state, and a dashed note now sits where the six case studies were: "six case
  studies hidden, this is the short read" with its own Show-them control.
  Without JavaScript the note and the control row stay hidden.
- `bf69dfa`: the rail is numbered 1–7 at ≤620px (the connector is switched off
  there, which is what turned seven stages into seven shapes), its caption says
  what the row is for instead of naming a property, the five artifact types
  become five chips with glyphs drawn here, and the hero stops spending 70px of
  a phone's first screen on padding.
- `59adb96`: the footer's "Hand-built …" clause and the whole quality-gate
  paragraph are removed. Recorded so it is not a silent loss: that paragraph was
  the only place the page pointed at the CI enforcing its own numbers, and it had
  gone stale ("400 KiB" after the ceiling moved to 512). The gate still runs; it
  is just not advertised in the footer.

### Round 4, same evening

- `ac19fc9`: the Platform fact grid showed a grey box where a sixth fact would
  be. It was not an element: the grid draws its hairlines as its own background
  with 1px gaps, and five cells in two columns leave one gap exposed. The fifth
  fact spans the row now, which closes it without inventing a number.
- `37f8d07`: the hero rail between 381 and 620px was the 4+3 grid you called
  meaningless; it is one row of seven, and because it is one row the connector
  line came back. The line, not a number, is what reads as "this flows". The
  1–7 numbers stay only where the grid still wraps (≤380px). Tool sublabels are
  dropped at phone widths; the rail went from 128px to 55px tall and is still
  7/7 above the fold at five viewports. The artifact chips lost their borders so
  five fit one line instead of four plus an orphan.
- `c69a65d`: CI caught what my local check could not: the workflow pins
  `html-validate@8`, which rejects `aria-label` on `<ul>`; I had validated with
  11.16.2. The label is gone rather than worked around.

### Evidence links and the tab mark

- `c882d2c`: the Release Control Plane card and the contact links now point at
  `github.com/IvanJairus/release-dashboard`, the reference implementation added
  tonight. Its README says in its own words that it is a reconstruction with
  synthetic data, so the link does not overstate what it is.
- `6f0ebdc`: the stack strip gained **Sonatype Nexus** (production daily) and
  **Guardsquare** (production regular), 16 chips to 18. Both already had an
  evidence row in the Toolbox, which is the rule the last audit made for strip
  names. Guardsquare carries no mark: Simple Icons has no Guardsquare asset, and
  inventing one is not the same as having one - the row follows the existing
  "Servers / VMs" precedent and stays text-only.
- The tab icon is no longer a box. It is a filled accent disc with a square
  cut-out - the site's own gate geometry, the shape it already uses to mean
  "a gate inside the pipeline". Served as `favicon.svg` plus a 32px PNG and a
  180px `apple-touch-icon.png`, because iOS Safari does not read SVG favicons and
  the old inline `data:` URI could not be a touch icon at all. The Toolbox row
  `DexGuard / iXGuard` is renamed `Guardsquare (DexGuard / iXGuard)` so the strip
  label and its evidence row are the same name.

### Corrections

- `2ddd5da` and `ec0982b` retract two of my own earlier claims: "7 of 7 rail
  nodes above the fold at 360px" had been measured at a different viewport
  height (at 360x740 it was 4 of 7 even before the change), and the hero fact
  line dropped its start year because two accounts of it disagree and a public
  number that cannot be reconciled is worse than a slightly vaguer one.
- `d5f6648` overturns the reasoning written into `c0b25b7`, which rejected a
  looping marquee as decoration and shipped a one-pass nudge instead. The
  owner's phone screenshot settled it: one pass is missed by anyone still
  reading the headline. The loop is now the mechanism, and WCAG 2.2.2 is why it
  ships with four ways to stop.
- `b016bac` corrects `d0d5b65`, which reported the portrait as fixed after
  measuring only its left edge: it was no longer in the wrong column, but it
  was alone on a row of its own, which is the complaint it was meant to solve.
- `e336b7e` is a correction of a report, not of code: the menu glyph was said
  to sit off-centre, and measured it did not (offX 0, offY -0.4px inside
  44x44). What was actually wrong was the glyph's own optical centre.
- `2cabbf7` removes the pause button `d5f6648` shipped and defends with WCAG
  2.2.2. The owner rejected it, and the rejection is the better call: the strip
  is now swipeable while it runs, so stopping is something the user does by
  touching it rather than by finding a control. Reduced motion and no-JS still
  get no marquee at all. What is *not* satisfied any more is a strict reading of
  2.2.2 - there is no pause mechanism that is not "interact with the strip" -
  and that is a deliberate trade, recorded here rather than discovered later.
- `637eb7a` reverts the arrangement `b016bac` chose: the "open to work" pill sits
  under the portrait again, not beside it. The side-by-side version measured
  fine and looked wrong, which is the difference between a viewport and a screen.

## [1.0.0] - 2026-10-08

First formal release. Hardens repository hygiene, closes audit findings, enforces CI budgets, and replaces the public CV with a sanitized version.

### Added

- `LICENSE.md`: dual-licence grant (MIT for code, CC BY-NC-ND 4.0 for content, case studies, images, and CV) with CC0 attribution for Simple Icons.
- `.gitignore`: replaces the exclusion of the local verification harness (`/_*`) from `.git/info/exclude`.
- `SECURITY.md`: vulnerability reporting policy, scope, and contact instructions.
- `.well-known/security.txt`: RFC 9116 compliant security contact metadata.
- `docs-decision-licence.md`: background decision memo for license classification.
- `CHANGELOG.md`: this file.
- `.github/workflows/quality.yml` and `.github/scripts/assert-lighthouse.mjs`: Lighthouse/axe gate and post-deploy live headers gate.

### Security & Compliance

- **Public CV PII purged (P0/P1-2)**: `assets/cv/cv-ivan-jairus.pdf` rebuilt from `cv-draft/cv-ivan-jairus.html`. Exactly 1 page, ATS format. Date of birth, mobile number, and apartment address completely eliminated from public download.
- **`innerHTML` refactored (P2-1)**: All 12 usages of `innerHTML` in `main.js` and `showcase.js` eliminated in favor of safe DOM APIs (`replaceChildren()`, `textContent`, `createElement`, and a safe `DOMParser` tree builder). Exactly zero `innerHTML` calls remain in the codebase.
- `vercel.json`: `Strict-Transport-Security` gains `includeSubDomains` (`max-age=63072000`).
- `vercel.json`: `Permissions-Policy` expanded from 3 to 11 features denying unused hardware APIs, with `clipboard-write=(self)`.

### Changed

- `README.md`: gained SPDX licence identifiers and direct links to `LICENSE.md`.

## [2026-10-07]

Fifty-four commits: a full palette replacement, the page moving to a white
canvas, the hero stack strip rebuilt with inlined marks, a new `#runtime`
section, a batch of board and walkthrough layout repairs, and the footer
rewritten so every claim on it is checkable against this repository.

### Added

- **Palette tokens, "Varian B"** (`9696392`): one warm light theme replaces the
  black/white + lime pair: background `#FAF7F2`, panels `#FFFDF9`, recessed
  `#F7F2EA`, single dark surface `#241C17`, ink ramp `#1C1917`/`#5C5348`/
  `#766B5F` (15.7–17.2, 6.4–7.4, 4.7–5.1 on the three light surfaces), brand
  orange `#C2410C`, and status colours taken from the real tool colours (Jenkins
  `#2E7D32`/`#63A955`, OpenShift `#DA291C`, amber `#A94E09`, Jira `#0052CC`,
  Docker `#2496ED`, GitHub `#24292F`). Terraform purple and Vault yellow are not
  used.
- **The page goes white** (`2d188e2`): `--bg` `#FAF7F2` → `#FFFFFF` and `--bg-2`
  `#FFFDF9` → `#FFFFFF`; the paper tone survives only as the recessed tint. On
  pure white the composited tints dropped text to 4.38–4.44:1, so both alphas
  went 0.10 → 0.07, chosen by sweeping for the lowest value where all eleven site
  text colours clear 4.5:1 (worst pair 4.59). Verified at 94/99/100/100 with 0
  colour-contrast findings.
- **Inline SVG tool marks** (`f56ac45`): eleven marks, path data taken from
  Simple Icons (CC0) and inlined. Hot-linked logos would be blocked by the CSP
  (`img-src 'self' data:`), and inlining keeps the no-CDN / no-build-step rule.
  Each mark fills `currentColor` so it inherits the chip's usage tier instead of
  fighting it with brand colour; every mark is `aria-hidden`.
- **Hero stack strip** (`64b4ad7`, `9946a46`, `05dd9d0`): the strip moves into the
  hero as its own grid row and loses its panel; chips lose their boxes, borders
  and padding; marks and names collapse to one ink colour (`#1C1917` on white,
  17.49:1), leaving the rail as the only colour above the fold. Grows from 11 to
  16 chips (15 marks) with Jira, Linux, Firebase, TestFlight and Servers/VMs,
  TestFlight carries the Apple vendor mark because Simple Icons has no TestFlight
  glyph, and "Servers / VMs" is text-only because naming a hypervisor this site
  does not claim would be a false mark.
- **`.gitlab-ci.yml` include card** (`40792f7`): fills the dead space right of the
  hero terminal with the four-line include, in a deliberately light card so the
  hero keeps exactly one dark block. The invented `ref: v4.2.1` from the preview
  was dropped instead of shipped, because GitLab does not require `ref`. Contrast was
  computed for all seven new text/surface pairs before shipping.
- **`#runtime` section** (`84ec51f`, `32a4655`, `815c45b`, `8bbf4f8`, `4f0c08d`):
  a new block between Architecture and Decisions with a sixth subnav pill (the
  scroll-spy is data-driven, so no JS change) and `#runtime` added to the anchor
  scroll-margin list. Four cards: capacity, rollout, backup, and what I would do
  differently, all stating the role boundary: the capacity numbers are not the
  owner's to choose, and no resource values or retention windows are published.
- **Pressed state** (`fc18a8e`): the page had 30 hover rules and one global
  `:focus-visible` ring but **zero** `:active` rules. One shared `translateY(1px)`
  rule now covers 43 real controls plus `[data-act]` for JS-rendered ones. The
  hero rail is excluded by request.
- **Prior role in Experience** (`3921280`, `bc3b76c`): Backend Developer,
  2022–2024, same sanitised employer line. Its bullets were left empty in the
  first commit because the form did not supply them and the site does not invent
  claims, so the renderer now skips the `<ul>` instead of leaving a phantom gap;
  the three bullets were then filled from the owner's own CV, not invented.
- **Share metadata** (`90738a2`): a purpose-built 1200×630 `og:image` rendered
  from the site's own tokens, absolute `og:url`, canonical, `og:image:width/
  height/alt`, `twitter:card=summary_large_image`, plus `sitemap.xml` and the
  `Sitemap` line in `robots.txt`. Checked with lychee 0.24.2, the version CI
  installs, that the not-yet-deployed image URL does not break the link job:
  70 checks, 0 errors.
- **Runtime footer creed** (`f0eff0a`): the footer's right side carries the
  owner's own line; the left keeps the verified craft claim.

### Changed

- **Status colours follow their meaning** (`050d3b5`, `7e5b765`, `35e4ecc`): the
  three skill tiers become Jenkins green / Jira blue / amber; rail stages are
  coloured by the tool that does the work; the terminal block, replica console,
  email mockups, board storyboard and replica chrome move onto shared tokens. The
  severity ladder lost its purple so no seventh brand colour enters. Structure,
  layout and text of every mockup untouched, only their palette.
- **Light/dark toggle removed** (`0d4504a`): the `◐` button, `data-theme` on
  `<html>`, `applyTheme()`, the `LS_THEME` key and the `lsGet`/`lsSet` helpers
  that existed only because `localStorage` can be blocked. Zero references left.
- **Role wording** (`3d69162`): "DevSecOps" only, without "Senior" and without "Engineer",
  across config, page title, meta description, `og:title`, `twitter:title`,
  `og:image:alt`, photo alt, leads, terminal username and the OG cover.
- **Fallback parity** (`ea5106b`, `a08d28f`): 49 leaf elements now carry exactly
  the text the script writes at runtime (all 316 leaf `data-i18n` elements
  checked, 0 differences), so the no-JS and pre-JS view reads like the live view.
- **Decorative removals, one commit each** (`9e85ed6`, `3a46c19`, `d0c345e`,
  `4e22c7e`, `4404603`, `a0fd2f7`, `6851579`, `2c8b0cd`): the global
  reveal-on-scroll (56 `data-reveal` attributes, `initReveal()` and its observer)
  so content is visible without JS or scrolling; spaced-caps eyebrows from 11
  sections down to 2; fake project numbering and the A1–A3/E1–E4 code labels;
  decorative double slashes; decorative button arrows; the one-character lime
  accent and the blinking cursor; the four About numbers as a hairline-divided
  strip instead of four boxes; and chrome text moved to the sans stack while mono
  stays where it carries meaning.
- **About card link destination** (`53b5e01`): card 4 is labelled "see Board · D2"
  but pointed at `#threat`; corrected to `#board`.
- **OG cover recoloured to white** (`c6dad99`): the generator harness was gone, so
  the existing pixels were re-composited rather than redrawn (model
  `alpha*F + (1-alpha)*B`, weight falling with Chebyshev distance from the field
  colour). Measured on the output: 94.95% of pixels changed, max delta 13/255,
  darkest pixel still `#1C1917`, ink legibility 16.37 → 17.49. Re-encoded to
  69,866 B, verified pixel-identical to the canvas output (0 differing pixels).
  The PNG is referenced only by `og:image`, not by any element, so page weight
  stays 345 KiB.
- **Footer claims made checkable** (`6c386f1`, `1784a04`): "one accent color" was
  dropped because the page uses thirteen colour tokens; replaced with four claims
  verified against the repo: zero external resources loaded (three outbound
  links), no `package.json` so no build step, no framework, system font stacks.
  "All rights reserved" was deleted as a 1910 Buenos Aires Convention relic that
  reserves nothing the Berne Convention does not already reserve; the line is now
  `(c) 2026 Ivan Jairus`.

### Fixed

- **Colour contrast, the largest single repair** (`7f6dc08`): orange and green
  text on a 10–16% tint of itself sat at 4.18–4.43:1. Added `--accent-strong`
  `#A8360A` and `--pass-strong` `#256A2B` (5.49 and 5.58), lightened the tints,
  and replaced two opacity-on-text rules with a recessed background, because
  opacity on coloured text is what pushed it under AA. **Lighthouse
  color-contrast: 27 findings → 0**, accessibility back to 99.
- Contrast exposed by removing the reveal (`e0f79bb`) and inside the email
  mockups (`fed34a6`): muted looks now come from colour rather than transparency
  (watermark 3.1 → 4.7:1, table header band 2.9 → 5.4:1, muted cell 2.4 → 4.6:1).
- **Walkthrough activity panel overflow** (`4c112ee`, disclosed as new finding
  F8): unbreakable mono tokens made a `.mini-tbl` min-content ~640px inside a
  384px feed, and at 390 the ticket panel measured 676px inside a 350px column
  where `body{overflow-x:hidden}` silently clipped the right half of the text.
  `min-width:0` plus `table-layout:fixed` and `overflow-wrap:anywhere`; re-measured
  across all 8 steps: 0 spill, 0 inner scroll.
- **Board and before/after layout** (`9cb2098`, `fea608b`, `476691f`, `ac2cf9c`,
  `af290a1`, `371ce66`): fixed `height:34px` on `.ba-card` let text escape its box
  (up to 36px at 390), now `min-height` with real room on the after side and
  `min-width:0` on the columns; the walkthrough board takes the wider half
  (1.05fr/0.95fr → 1.5fr/1fr) so nowrap phase badges stop hanging 30–36px out of
  their card; the email panel is centred instead of hugging left with 324px of
  dead space; before/after box heights equalised; mobile column headers no longer
  ellipsised to "IN REV…"; board headers raised from 9.5px to the 12px floor.
- **Touch and keyboard targets** (`7129bc9`, `fbaa469`): step dots were the bar
  itself, offering 121×3 at 1440 and 34×3 at 390 against a 24×24 minimum. The
  button is now 24px tall with the bar drawn by `::after`, identical visually. Six
  of thirteen lifecycle steps were `<div>`s with `cursor:pointer` and a click
  handler but nothing to Tab to; all six are real `<button type=button>` and the
  dead `role=button` line is gone. Probe: fake clickable elements 10 → 0.
- **Hero rail sublabel collisions** (`a6dbb81`, `30e75e5`): `white-space:nowrap`
  in a 7-column grid with no gap let sublabels reach into their neighbour (three
  pairs at 0px at 390); the labels now wrap in-cell with a 10px column gap,
  smallest gap 19px at 1440 and 14px at 390. A stray hairline under the hero
  buttons was the stack strip sitting *inside* `.hero-id` so `grid-area: stack`
  never applied; moving it out gives a 40px gap and width 1044.
- **Decision-card label column** (`5127dea`): "ALTERNATIVE" at 12px mono measured
  97px in an 86px column, overrunning into the gap in all 8 cards; widened to
  98px with `minmax(0,1fr)` on the value side. Spill 0 at 1440 and 390.
- i18n parity regression (`a08d28f`): a footer string changed in `index.html` but
  not in the dictionary, because the key is last in the object and has no trailing
  comma, which the search string included.

### Dependencies

- `gitleaks/gitleaks-action` 2.3.9 → 3.0.0 (`a4b8381`, PR #4).

### Known consequences of these changes

- The stack strip moving above the fold formally waives the "all seven rail
  stages above the fold on mobile" guarantee set in Batch C: at 390 the rail sits
  at 733–1014 against an 844 fold, so four of seven stages are visible. Recorded
  in `64b4ad7` so it is not mistaken for a later regression.
- The stack strip growth cost measurable performance: page weight 335 → 345 KiB,
  FCP 2.0 → 2.1s, LCP 2.7 → 2.9s, Performance 94 → 93 across two identical runs;
  accessibility 99 and 0 contrast findings unchanged (`05dd9d0`, `40792f7`).
  An attempted 6.4 KB saving, rounding SVG path coordinates to 2 decimals,
  corrupted arc flags, produced six console path-parse errors and dropped
  best-practices to 96; it was reverted.

## [2026-10-06]

Twenty-eight commits, from the starting state of the repository (`24b4a83`) to a
sanitised, gated, single-page site.

### Added

- **Repository starting state** (`24b4a83`): hero pipeline map with tool labels,
  board before/after contrast plus an interactive walkthrough, platform replica
  with RBAC and diff-driven deploys, architecture composite gate. `abcc1e1` added
  the "why, not just what" layer: About proof cards, the sticky work sub-nav,
  Decisions & trade-offs, the threat-model table, and experience signals, with
  the stats-counter strip and the "2.5y" framing removed.
- **Content sections**: architecture lifecycle animation, two-ecosystems panel and
  the sanitised email preview (`3d52efe`); mail previews with three tabs: branch
  sync, SAST with an amber disclaimer, SonarQube (`ffb6021`); audit batch 1+2,
  including the disclosure decisions P1–P6, CV download, education, and the
  accessibility pass (`6c0dc44`).
- **English-only site** (`e3f84c4`): the ID language toggle, its handlers and the
  317-line ID dictionary removed; `lang` fixed to `en`.
- **Toolbox tier filter** (`3ece8fe`): default production-daily, per-tier and Show
  all, with `aria-pressed`, keyboard-operable; without JS all items show.
- **Hero rail as a legible diagram**: scale-proof row (`3c43b51`, all four figures
  already used elsewhere on the site), node/label sizing (`718dd03`, resting
  contrast 6.9–7.9:1), status markers (diamond in `--warn`, square in `--danger`)
  so the difference survives colour-blindness and grayscale (`b27d643`), and a
  single pass on viewport entry with the IntersectionObserver disconnecting after
  the first run (`2b51629`).
- **CI, the first gate layer** (`d6fe6a3`): actions pinned to full commit SHAs,
  weekly Dependabot for `github-actions`, a lychee link-check job and an
  html-validate job, and as a precondition real HTML defects fixed (duplicate
  class, missing button type, `th scope`, `tbody`, landmark labels, scan-card
  role).
- **No-JS and print fallbacks** (`b08e985`).

### Changed

- Cards and hero hierarchy: `proj-2` gains the gateway-diagram link and the demo
  is pinned to the card bottom (`46cf657`); the primary "Selected work" button
  stands out while "Get in touch" and CV drop to ghost styling (`85749d2`); mobile
  390px hardening with a permanent SMIL flow on the gateway diagram (`ea1b22a`);
  scroll-spy clears the active nav item while in the hero (`997dffd`).

### Removed

- Decorative `./profile --grayscale` photo tag (`aaa2f79`); stray tooling
  artifacts (`64d5cee`); screenshot harness files that had been accidentally
  staged in the contrast commit (`8418d53`).

### Fixed

- Contrast floor: `--ink-faint` raised to ≥4.5:1 in both themes and 49 functional
  text rules raised to 12px, with mock UI, email artifacts and SVG labels exempt
  (`474b0da`).

### Security

- **CSP: `'unsafe-inline'` removed from `style-src`** (`bd6c7f8`): 29 inline
  `style="--d:.."` declarations plus one `display:grid` converted to utility
  classes, 20 inline style attributes in `showcase.js` moved to classes or
  `el.style`, and the `<noscript><style>` block moved to an external
  `assets/css/noscript.css`. Verified strict `style-src 'self'` with zero CSP
  violations across all sections.
- **Headers**: `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`
  added as `same-origin` (`6f52c44`). The same commit records that HSTS was left
  *without* `includeSubDomains`/`preload` while the site lives on `vercel.app`,
  a decision now reversed in the Unreleased section above.
- **CI**: the `--root` flag dropped from lychee (`20f5eeb`): renamed
  `--root-dir` in lychee 0.18 and requiring an absolute path; this site uses only
  relative links, so no root is needed.

### Dependencies

- `actions/checkout` 4.2.2 → 7.0.1 (`5fd8e62`, PR #2).
- `actions/setup-node` 4.4.0 → 7.0.0 (`540554c`, PR #1).
- `lycheeverse/lychee-action` 2.4.0 → 2.9.0 (`60a320d`, PR #3).
