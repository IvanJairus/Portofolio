# Changelog

All notable changes to this repository are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## How to read this file

- **The history spans two days.** 82 commits, 28 on 2026-10-06 and 54 on
  2026-10-07 (`git log --format='%h %ad %s' --date=short`). That is the whole
  recorded history of this repository; it is a compressed build, not a
  long-running project, and the numbers here should be read that way.
- **The headings are dates, not versions.** No tag and no release exist yet, so
  there is nothing to map onto semantic versioning. The `2026-10-06` and
  `2026-10-07` headings stand in for the first two releases until the owner cuts
  them; the audit finding "no tag/release" is still open.
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

## [Unreleased] — repository hygiene

Drafts added in response to an external audit that scored this repository's
engineering hygiene 5/10. They are pending the owner's review; two of the audit
findings are deliberately left open because they need a human decision (marked
below).

### Added

- `.gitignore` — replaces the exclusion of the local verification harness
  (`/_*`) from `.git/info/exclude`, which is never shared with a clone, so a
  fresh checkout would offer the harness files to `git add -A`.
- `SECURITY.md` — what counts as a vulnerability on a static, no-user-data,
  strict-CSP site; what is out of scope; how to report. The response-time
  commitment is an explicit unfilled placeholder rather than an invented number.
- `.well-known/security.txt` — RFC 9116 (`Contact`, `Expires`,
  `Preferred-Languages`), with the fields that would be untrue documented as
  absent rather than included.
- `docs-decision-licence.md` — decision memo for the missing licence: three
  options, what each signals to an employer, a recommendation, and the two facts
  that must be confirmed before any licence is written. **No `LICENSE.md` was
  created**; the choice belongs to the owner.
- `CHANGELOG.md` — this file.
- `.github/workflows/quality.yml` and `.github/scripts/assert-lighthouse.mjs` —
  a Lighthouse/axe gate and a post-deploy header gate. Until now CI ran
  gitleaks, lychee and html-validate (`security.yml`) and measured nothing, so
  the published "Lighthouse 93/99/100/100" claim was unenforced. The assertion
  script uses only the Node built-in `fs` module: still no `package.json`, no
  bundler, no CDN.

### Changed

- `vercel.json` — `Strict-Transport-Security` gains `includeSubDomains`
  (`max-age=63072000` unchanged; `preload` deliberately **not** added, because
  the site is on a `*.vercel.app` hostname with no apex domain yet). This
  reverses the 2026-10-06 decision recorded in `6f52c44` ("HSTS left without
  includeSubDomains/preload while on vercel.app").
- `vercel.json` — `Permissions-Policy` expanded from 3 features to 11: `camera`,
  `microphone`, `geolocation` plus `payment`, `usb`, `hid`, `serial`,
  `accelerometer`, `gyroscope`, `magnetometer` denied, and `clipboard-write`
  scoped to `(self)`. `clipboard-write` is not denied because the email reveal
  and the copy buttons call `navigator.clipboard.writeText`; denying it would
  break a feature to gain nothing. `Content-Security-Policy` and every other
  header are untouched.

### Still open, on purpose

- `LICENSE.md` — blocked on the owner's choice and on two confirmations
  (see `docs-decision-licence.md`).
- `CODEOWNERS` — not drafted.
- First tag/release — not cut.

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
