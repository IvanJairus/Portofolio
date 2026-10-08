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
- **Four of the 82 commits are Dependabot bumps**, collected under
  *Dependencies* rather than being presented as authored work.
- **On "rebuilt from an earlier private draft": not asserted.** That framing was
  checked against the commit messages and is not supported by them — nothing in
  the 82 subjects or bodies mentions a predecessor, an import, or a private
  draft. The history begins with `24b4a83` "Portfolio: glance-pass redesign".
  What the messages *do* reference repeatedly is an audit of this working site,
  in labelled batches (Batch A, C, E, G, K) and a numbered finding list (`F8`,
  commit `4c112ee`) — that is a review process, not evidence of another
  repository. The claim is therefore omitted.
- Short hashes are given so every line can be checked with `git show`.

## [Unreleased]

Fifty commits after `v1.0.0`, all on 2026-10-08. The tag was cut at
`66d63ad`; everything below is after it and has not been tagged yet.

### Domain

- `84ec20d` — every absolute URL moves to `https://www.ivanjairus.xyz`
  (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`, sitemap,
  robots, security.txt). `919b0f0` adds a `308` from the old
  `portofolio-six-delta-18.vercel.app` hostname to `www`, verified in
  production. Vercel's own apex→www redirect is what makes `www` canonical.

### The first screen

- `d2ddd66` — a 2px read-progress line under the header, pure
  `animation-timeline: scroll()`, removed under `prefers-reduced-motion`.
  `52b5993` undoes a regression that commit introduced: it also set the
  header to `sticky` while it is already `fixed`, which pushed the hero down
  65px. Found by re-measuring, not by reading the diff.
- `75d36fd` — the pipeline rail now fits the first screen at every width
  measured: 7 of 7 nodes fully above the fold at 360x740, 390x844, 412x915,
  1024x768, 1280x720 and 1440x900. It was 0 of 7 at 390 and 1280.
- `ec0982b` — the hero states years in delivery, the role and the city, the
  three facts a recruiter scans for. The rail order was re-compensated so
  this costs nothing above the fold.

### Two reading depths

- `6bb0c6f` — a "Highlights only" toggle and `?view=skim` hide the six case
  studies by CSS only; the default remains deep so crawlers and a Tech Lead
  still get everything. A link into a hidden section returns to deep before
  jumping. At 390px the page is 24.814px deep and 9.644px skimmed.
- Same commit: the ten Runtime and Decisions cards fold at ≤760px, first card
  of each section left open. Runtime + Decisions went from 5.807px to
  2.671px. Without JavaScript both controls disappear rather than sitting
  there dead (`html[data-js]`), verified with scripting off.

### Mobile correctness

- `2ddd5da` — three "swipe sideways to see the rest" labels plus edge
  shadows on the boxes that were silently cutting 46-49% of their content,
  and a pause control for the lifecycle rail (WCAG 2.2.2; it rotates every
  3.8s).
- `810eb27` — the work sub-nav was 93px tall at 390px (three wrapped rows),
  and all six Work anchors landed 39px behind it. One scrollable row, 56px,
  with the chrome heights in `--header-h` / `--subnav-h` and the scroll
  margins split so sections outside Work do not inherit a sub-nav they do
  not have. Every anchor now lands 8px below the chrome.
- `f2e7474` — one contact pill on phones, appearing after the hero and
  retiring at Contact.
- `e39df39` — 37 labels that were drawn at 8-9px get a 10,5px floor at
  ≤620px; decorative marks stay as drawn. A clipping probe over all 37
  selectors returns zero truncated text.
- `836755e` — hover effects that move or recolour are gated behind
  `@media (hover: hover)` (on touch `:hover` sticks until the next tap); the
  hero photo, whose colour was a hover state, is now colour wherever hover
  does not exist; twelve controls reach 44px under a coarse pointer; the header
  gets a plain `rgba()` fallback before its `color-mix()`.
- `7b3e6a0` — the replica's swipe hint appears only when the view currently
  open actually overflows. Measured: 1 of 8 views overflows at 390px, so a
  permanent hint would have been wrong seven times out of eight.
- `25b7a86` — the phone portrait is 60% of the column instead of 46%, and its
  `sizes` hint was updated to match.

### Proof and consistency

- `e81673a` — a Runtime card carrying the measured numbers with their sample
  sizes (53 services, 99 repositories, 7.550 pipelines, deploy median 93s
  n=13, scan median 80s n=30) and an explicit statement that none of them are
  reproducible by a visitor.
- `eaf2a60`, `f0d4f7f` — "40+ repos with an include" becomes "53 services from
  one pipeline repository", which is what the platform actually does.
- `3192a31` — finishes that change: the Architecture headline, its
  `og:description`, two care notes and the diagram's overflow box still said
  forty, while the diagram's own label said 53.
- `63548d4`, `eddc0d4` — link the published reference implementation
  (`IvanJairus/Pipeline`, public, tagged `v0.1.0`) from Contact and from the
  gateway card it describes.
- `7e6781d` — the footer links the CI gate that enforces this page's budgets,
  instead of publishing scores that would rot.
- `a9cbc76` — the Open Graph cover is rebuilt from a source now committed at
  `assets/og/cover-source.html`. The card still showed `40+ repos` and the
  old vercel.app hostname; the previous fix was a pixel recomposite because
  the generator had been thrown away.

### What the delivery path does with AI

- `e2786cc` — three things that were happening every week and appeared nowhere:
  a coding agent drafting `gateway.yml`, Groovy and shell; a hosted model
  turning scan output into the note on the merge request; natural language
  mapped onto the ChatOps commands that already existed. Written as a Decisions
  card (agents draft, nothing they draft merges itself), a threat-model row for
  the model itself, and a sample summary in the Scans view. Every figure in
  that summary is arithmetic on the table above it (3 bugs + 4 vulns + 96
  smells = 103). No model vendor is named.
- `1f32d6e` — the internal artifact store and the hardened mobile build join
  the page: every service resolves Maven and npm through one Nexus instance
  (proxy, hosted, group), and `/deploy-secure` on the ticket switches a build
  from the plain standard to DexGuard / iXGuard inside the same stage contract.
  Each gets a Toolbox tier and a threat-model row.
- `b7af6bb`, `db09afb` — evidence rows for two names that sat in the hero strip
  with nothing under them (Firebase / TestFlight, on-prem VM provisioning). The
  first was tiered "production regular" by inference and corrected to
  "production daily" by the owner.

### Proof instead of promise

- `8ad2f18` — the board gained "break the gate": a card is pushed to Merged
  with no merge request behind it, then 1.4s later is visibly returned to In
  Review while the revert and the exit-1 land in the activity feed. It is a
  mode, not a ninth step (the counter still reads 1 / 8 and a red
  COUNTER-EXAMPLE flag names it), any navigation leaves it, and every beat
  restates something already claimed elsewhere on the page.

### Motion that carries information

- `e0484db` — the replica's views swap with a 260ms move instead of a hard cut,
  and touching a repository in the gateway diagram lights its own path while
  the other lines drop to 0.22 opacity. Parallax was the obvious alternative
  and was not used: the connector lines are separate SVG elements from the
  boxes, so a shifted column would detach from its own cable. Cost recorded:
  394.8 → 406.8 KiB.
- `c0b25b7`, `67a61c5`, `d5f6648` — three attempts at the same problem, that a
  single-line strip at 390px holds 1315px of content in a 350px box and gives
  no cue. A one-pass nudge, then a repeating one, then the owner's phone
  screenshot settled it: a continuous loop at a constant 26px/s (1327px of
  chips over 51s), paused on hover, on keyboard focus, on screen exit and by a
  pause button, with the duplicate set `aria-hidden`. Under
  `prefers-reduced-motion` or without JavaScript the marquee is never built and
  the row keeps its original swipe.

### Phone review, from the owner's screenshots

- `d9e5c78` — thirteen breakpoints become nine, and `overflow-x: hidden` on
  body becomes `clip`. That second change is the finding: hidden makes body a
  scroll container and hides the sin, and with clip the page measured 372px
  wide at a 360px viewport. Cause: fourteen grid tracks written as `1fr`, which
  is `minmax(auto, 1fr)`, so one unbreakable string widens the track past its
  container. All fourteen are now `minmax(0, 1fr)`.
- `8ab6b72` — the lifecycle rail below 620px is a vertical stepper: one step
  per row, connector down the left through the dot centres, 44px rows, fan-out
  chips indented. It had been wrapping thirteen nodes into three rows with the
  connector switched off, which is a grid of unlabeled dots. The travelling
  packet is hidden there rather than rotated.
- `050ee79` — the mini before/after board turns its five columns into five rows
  at ≤620px. Type was not shrunk: 51px columns clipped three cards even at the
  10,5px floor this round set.
- `d0d5b65`, `b016bac` — the portrait that moved into the contact card landed
  in the card's second column (it still carried `grid-area: photo`, which in a
  grid with no such area creates a phantom track), then sat alone on a row of
  its own. It is now 104px beside the "open to work" pill, and the pill drops
  to its own row whole at 320px rather than wrapping.
- `e336b7e` — the header's menu control draws an 18px SVG instead of the
  `≡` glyph.

### Records and hygiene

- `704cbae` — this file catches up to the 29 commits that had landed behind the
  tag, including a "how to read" bullet the tag itself had made false.
- `1fd7120` — the page-weight budget moves to 512 KiB by owner decision, with
  the measured local-vs-wire difference written into the gate and every other
  budget left where it was.
- `a5e17d1` — the licence memo is deleted once the decision is in `LICENSE.md`,
  the README stops describing an Indonesian dictionary that no longer exists,
  and SECURITY.md stops shipping a section that announces it is not ready.
- `2db02e7` — five ADRs in `docs/`, reconstructed from what the page already
  claims, labelled as reconstructions, with 0005 ending on its own weakness.
- `4e3a859` — schema.org Person built only from facts on the page, and a
  `theme-color` still painted in a palette the design left weeks ago.
- `9eaa50e` — Trusted Types recorded as tried, measured and declined: the
  directive breaks the one string-to-DOM path that renders translated text, and
  the policy needed to work around it would enforce nothing.
- `866456e` — CODEOWNERS says one owner, because that is who owns it.

### Round 3, from the owner's second screenshot set

- `637eb7a` — three regressions of my own, all found by looking at rendered
  screens rather than measuring widths: the "counter-example" flag was clipped
  19px outside a 360px viewport (the flex row holding it could not wrap, so the
  label that names the mode was the one thing off screen); the phone reflow of
  the before/after board also caught the "gitlab out of the box" panel, whose
  empty columns are the point, so it is scoped to `.ba-cols.five` now; and the
  portrait in the contact card still carried `grid-area: photo`, which in a grid
  without that area creates a phantom second track — the photo moved right and
  the email row was cut at the card edge.
- `2cabbf7` — the pause button is gone, on your instruction, and the strip is
  driven by its own `scrollLeft` instead of a CSS transform so the same row can
  be dragged by hand while it crawls at 26px/s. It holds still for 1,4s after
  the last touch and then continues from wherever you left it. The trap that
  made the first version stand still: `scrollLeft` reads back as an integer at
  DPR 1, and one frame at 26px/s is 0,42px, so re-reading the position floored
  the step to zero forever.
- `493a92e` — "Highlights only · off" becomes a verb that swaps with its own
  state, and a dashed note now sits where the six case studies were: "six case
  studies hidden — this is the short read" with its own Show-them control.
  Without JavaScript the note and the control row stay hidden.
- `bf69dfa` — the rail is numbered 1–7 at ≤620px (the connector is switched off
  there, which is what turned seven stages into seven shapes), its caption says
  what the row is for instead of naming a property, the five artifact types
  become five chips with glyphs drawn here, and the hero stops spending 70px of
  a phone's first screen on padding.
- `59adb96` — the footer's "Hand-built …" clause and the whole quality-gate
  paragraph are removed. Recorded so it is not a silent loss: that paragraph was
  the only place the page pointed at the CI enforcing its own numbers, and it had
  gone stale ("400 KiB" after the ceiling moved to 512). The gate still runs; it
  is just not advertised in the footer.

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

- `LICENSE.md` — dual-licence grant (MIT for code, CC BY-NC-ND 4.0 for content, case studies, images, and CV) with CC0 attribution for Simple Icons.
- `.gitignore` — replaces the exclusion of the local verification harness (`/_*`) from `.git/info/exclude`.
- `SECURITY.md` — vulnerability reporting policy, scope, and contact instructions.
- `.well-known/security.txt` — RFC 9116 compliant security contact metadata.
- `docs-decision-licence.md` — background decision memo for license classification.
- `CHANGELOG.md` — this file.
- `.github/workflows/quality.yml` and `.github/scripts/assert-lighthouse.mjs` — Lighthouse/axe gate and post-deploy live headers gate.

### Security & Compliance

- **Public CV PII purged (P0/P1-2)**: `assets/cv/cv-ivan-jairus.pdf` rebuilt from `cv-draft/cv-ivan-jairus.html`. Exactly 1 page, ATS format. Date of birth, mobile number, and apartment address completely eliminated from public download.
- **`innerHTML` refactored (P2-1)**: All 12 usages of `innerHTML` in `main.js` and `showcase.js` eliminated in favor of safe DOM APIs (`replaceChildren()`, `textContent`, `createElement`, and a safe `DOMParser` tree builder). Exactly zero `innerHTML` calls remain in the codebase.
- `vercel.json` — `Strict-Transport-Security` gains `includeSubDomains` (`max-age=63072000`).
- `vercel.json` — `Permissions-Policy` expanded from 3 to 11 features denying unused hardware APIs, with `clipboard-write=(self)`.

### Changed

- `README.md` — gained SPDX licence identifiers and direct links to `LICENSE.md`.

## [2026-10-07]

Fifty-four commits: a full palette replacement, the page moving to a white
canvas, the hero stack strip rebuilt with inlined marks, a new `#runtime`
section, a batch of board and walkthrough layout repairs, and the footer
rewritten so every claim on it is checkable against this repository.

### Added

- **Palette tokens, "Varian B"** (`9696392`): one warm light theme replaces the
  black/white + lime pair — background `#FAF7F2`, panels `#FFFDF9`, recessed
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
  16 chips (15 marks) with Jira, Linux, Firebase, TestFlight and Servers/VMs —
  TestFlight carries the Apple vendor mark because Simple Icons has no TestFlight
  glyph, and "Servers / VMs" is text-only because naming a hypervisor this site
  does not claim would be a false mark.
- **`.gitlab-ci.yml` include card** (`40792f7`): fills the dead space right of the
  hero terminal with the four-line include, in a deliberately light card so the
  hero keeps exactly one dark block. The invented `ref: v4.2.1` from the preview
  was dropped rather than shipped — GitLab does not require `ref`. Contrast was
  computed for all seven new text/surface pairs before shipping.
- **`#runtime` section** (`84ec51f`, `32a4655`, `815c45b`, `8bbf4f8`, `4f0c08d`):
  a new block between Architecture and Decisions with a sixth subnav pill (the
  scroll-spy is data-driven, so no JS change) and `#runtime` added to the anchor
  scroll-margin list. Four cards — capacity, rollout, backup, and what I would do
  differently — all stating the role boundary: the capacity numbers are not the
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
  `Sitemap` line in `robots.txt`. Checked with lychee 0.24.2 — the version CI
  installs — that the not-yet-deployed image URL does not break the link job:
  70 checks, 0 errors.
- **Runtime footer creed** (`f0eff0a`): the footer's right side carries the
  owner's own line; the left keeps the verified craft claim.

### Changed

- **Status colours follow their meaning** (`050d3b5`, `7e5b765`, `35e4ecc`): the
  three skill tiers become Jenkins green / Jira blue / amber; rail stages are
  coloured by the tool that does the work; the terminal block, replica console,
  email mockups, board storyboard and replica chrome move onto shared tokens. The
  severity ladder lost its purple so no seventh brand colour enters. Structure,
  layout and text of every mockup untouched — only their palette.
- **Light/dark toggle removed** (`0d4504a`): the `◐` button, `data-theme` on
  `<html>`, `applyTheme()`, the `LS_THEME` key and the `lsGet`/`lsSet` helpers
  that existed only because `localStorage` can be blocked. Zero references left.
- **Role wording** (`3d69162`): "DevSecOps" only — no "Senior", no "Engineer" —
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
- **About card link destination** (`53b5e01`): card 4 is labelled "see Board — D2"
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
  verified against the repo — zero external resources loaded (three outbound
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
  (up to 36px at 390) — now `min-height` with real room on the after side and
  `min-width:0` on the columns; the walkthrough board takes the wider half
  (1.05fr/0.95fr → 1.5fr/1fr) so nowrap phase badges stop hanging 30–36px out of
  their card; the email panel is centred instead of hugging left with 324px of
  dead space; before/after box heights equalised; mobile column headers no longer
  ellipsised to "IN REV…"; board headers raised from 9.5px to the 12px floor.
- **Touch and keyboard targets** (`7129bc9`, `fbaa469`): step dots were the bar
  itself, offering 121×3 at 1440 and 34×3 at 390 against a 24×24 minimum — the
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
  An attempted 6.4 KB saving — rounding SVG path coordinates to 2 decimals —
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
  Decisions & trade-offs, the threat-model table, and experience signals — with
  the stats-counter strip and the "2.5y" framing removed.
- **Content sections**: architecture lifecycle animation, two-ecosystems panel and
  the sanitised email preview (`3d52efe`); mail previews with three tabs — branch
  sync, SAST with an amber disclaimer, SonarQube (`ffb6021`); audit batch 1+2,
  including the disclosure decisions P1–P6, CV download, education, and the
  accessibility pass (`6c0dc44`).
- **English-only site** (`e3f84c4`): the ID language toggle, its handlers and the
  317-line ID dictionary removed; `lang` fixed to `en`.
- **Toolbox tier filter** (`3ece8fe`): default production-daily, per-tier and Show
  all, with `aria-pressed`, keyboard-operable; without JS all items show.
- **Hero rail as a legible diagram**: scale-proof row (`3c43b51`, all four figures
  already used elsewhere on the site), node/label sizing (`718dd03`, resting
  contrast 6.9–7.9:1), status markers — diamond in `--warn`, square in `--danger`
  — so the difference survives colour-blindness and grayscale (`b27d643`), and a
  single pass on viewport entry with the IntersectionObserver disconnecting after
  the first run (`2b51629`).
- **CI, the first gate layer** (`d6fe6a3`): actions pinned to full commit SHAs,
  weekly Dependabot for `github-actions`, a lychee link-check job and an
  html-validate job — and, as a precondition, real HTML defects fixed (duplicate
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

- **CSP: `'unsafe-inline'` removed from `style-src`** (`bd6c7f8`) — 29 inline
  `style="--d:.."` declarations plus one `display:grid` converted to utility
  classes, 20 inline style attributes in `showcase.js` moved to classes or
  `el.style`, and the `<noscript><style>` block moved to an external
  `assets/css/noscript.css`. Verified strict `style-src 'self'` with zero CSP
  violations across all sections.
- **Headers**: `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`
  added as `same-origin` (`6f52c44`). The same commit records that HSTS was left
  *without* `includeSubDomains`/`preload` while the site lives on `vercel.app` —
  a decision now reversed in the Unreleased section above.
- **CI**: the `--root` flag dropped from lychee (`20f5eeb`) — renamed
  `--root-dir` in lychee 0.18 and requiring an absolute path; this site uses only
  relative links, so no root is needed.

### Dependencies

- `actions/checkout` 4.2.2 → 7.0.1 (`5fd8e62`, PR #2).
- `actions/setup-node` 4.4.0 → 7.0.0 (`540554c`, PR #1).
- `lycheeverse/lychee-action` 2.4.0 → 2.9.0 (`60a320d`, PR #3).
