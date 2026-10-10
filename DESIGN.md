# DESIGN.md

The written direction for this site's visual identity and its prose. The ADRs in
`docs/adr/` are about the delivery platform; this file is about the page that
describes it. It exists so that a reviewer can tell which choices were made and
which were defaults.

## Who it is for

Two readers, in tension. A DevSecOps tech lead who will check whether a claim has
a artifact behind it, and an HR screener who spends seconds, not minutes. When the
two conflict, the page keeps the evidence and puts a readable summary above it.

## Constraints that are not negotiable

- No framework, no CDN, no build step, no dependency at runtime, system fonts only.
- One theme. The light/dark toggle was removed deliberately and does not come back.
- English only.
- `Content-Security-Policy` stays `script-src 'self'; style-src 'self'`. That means
  no inline script, no inline `style` attribute, no third-party font or icon host.
- Every piece of text exists twice: as a value in `assets/js/i18n.js` and as the
  HTML fallback. `scripts/sync-i18n.mjs` generates the fallback and CI checks it.

## Palette

Paper white. `--bg` and `--bg-2` are `#FFFFFF`; the warm `#FAF7F2` survives only as
the recessed tint `--bg-3`. Separation between blocks is a hairline, not a fill,
which is why `--bg-2` equals `--bg` on purpose.

One dark field on any page: `--surface-dark` `#241C17`, used for the hero terminal
and the console. Two dark fields would start a competition for attention.

Brand is GitLab orange `#C2410C`, chosen because it is the colour of the tool this
work happens in, not a colour picked to look modern. `#FC6D26` is reserved for rail
lines, hovers and small accents. Text on tinted backgrounds uses the darker
`--accent-strong` `#A8360A`, because the same orange on its own 8 percent tint
measured 4.21:1.

Status colours are the real tools' colours: Jenkins green, OpenShift red, Jira
blue, Docker blue, GitHub grey, amber for warnings. Terraform purple and Vault
yellow were dropped; six tool colours on one page stopped meaning anything.

**Recompute on every background change.** Moving the page from warm paper to white
dropped text-on-tint pairs to 4.38:1 and forced the tints from 0.10 to 0.07. A
previous Lighthouse result is not evidence about the next one.

## Accent budget

Orange is used for: the primary CTA, the rail line, links, the active filter pill,
status dots, the focus ring, and a glow on the active lifecycle node. That is more
than the one deliberate accent the design should have.

The rule this file sets, and the reason it is written down rather than fixed by
ban: below the first screen, colour carries state and must keep doing that. On the
first screen, orange marks only what a visitor can act on. The caption border and
the legend marks are ink, not accent.

## Shape

Four radii, no more. `2px` for controls and code surfaces (57 uses), `var(--radius)`
`4px` for cards, `999px` only for things that are literally pills, `50%` for dots.
Small radius is a deliberate choice: this page reports on build tooling, and a
generously rounded card would read as a product landing page.

Elevation is rare on purpose. Of 18 `box-shadow` declarations, only two are
elevation; the rest are focus rings. Glass is two elements (site header, work
subnav). Glow is three sites, and all three are bound to a real state (`.lit`,
`.on`), never to a resting card.

## The grid motif

`body::before` paints a 72px graph paper behind the hero, at 0.35 opacity, fixed,
pointer-events none, masked with a radial gradient so it fades out below the fold.

The reason it exists is the sentence in the experience section: the diagram is
drawn before the YAML is written. Graph paper is that sentence's object. It is not
a texture added to make a flat page feel technical, and if it ever stops being
readable as the motif above, it should be deleted rather than kept.

## Motion

Declared dials: **ENERGY 2 / RHYTHM 2 / MOTION 3.**

Motion is the point of this site, so MOTION is high: the pipeline rail carries a
packet, the board walkthrough animates cards, the console streams. But every loop
is bound to something that is actually running. A dot pulsing over a fact that does
not change is decoration, and the "open to work" indicator stopped pulsing for
exactly that reason.

`prefers-reduced-motion` is honoured in every animation block, and the reduced
path renders the final state rather than freezing the first frame.

## Status must not be colour alone

Every stage, gate and job mark carries colour **and** a glyph **and** a word. This
is a WCAG 1.4.1 requirement, and it is also the reason a printed or greyscale
screenshot of a pipeline still reads correctly.

## Prose

The writing rules are enforced by `scripts/assert-copy.mjs`, which decodes Unicode
escapes and HTML entities before counting, because the visible text is what a
reader sees and not what grep finds.

- No em dash as a sentence connector. A period, a comma, a colon or parentheses
  instead.
- Buzzwords are absent by measurement, not by luck: `robust`, `seamless`,
  `leverage`, `cutting-edge`, `industry-leading` score zero.
- Every number is published with its source and sample size, or it is not
  published. The two durations on `/pipelines/` carry `n=13` and `n=30` because
  the landing page publishes them; everywhere else the page says what it decided
  rather than how long it took.
- A replica says it is a replica. Synthetic data is labelled where it is visible.
- The footer creed line is the owner's sentence. It is not quoted, not attributed,
  and not used as evidence for anyone else's claim.

## The one dark side of this file

`DESIGN.md` describes decisions that were mostly made by iteration and conversation
rather than up front. Writing it down after the fact is still worth it, but a
reviewer should read it as a reconstruction of the reasoning, not as a brief that
guided the build.
