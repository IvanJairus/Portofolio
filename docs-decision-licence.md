# Decision memo: which licence, if any, this repository should carry

Status: **awaiting the owner's decision.** No `LICENSE.md` has been written.
Nothing in this memo changes the legal position of any file; it exists because
an external audit scored the repository's hygiene 5/10 partly for a missing
licence, and the fix should be a choice rather than a default.

Date of writing: 2026-10-07.

## 1. What is actually in here, and who holds it

Two kinds of thing share this repository, and they want different treatment:

- **The code.** `index.html`, `assets/css/*`, `assets/js/*`, `vercel.json`,
  `.github/*`. Hand-written, no dependencies, no package.json, no vendored
  library. One exception, already in the repo: the eleven tool marks inlined as
  SVG path data in the hero stack strip were taken from Simple Icons at build
  time (commit `f56ac45`). Simple Icons is CC0, so those paths carry no
  attribution obligation and no share-alike condition — but they are third-party
  and the eventual licence file should say so rather than imply every byte is
  original.
- **The content.** The case-study prose, the decision cards, the threat model
  table, the sanitised artefacts, `assets/img/*` (the OG cover is a render of
  this site's own composition, commit `c6dad99`), and `assets/cv/cv-ivan-jairus.pdf`.
  This is a job-application artefact. It makes specific engineering claims about
  a named person, and it is written to be read by a hiring manager.

Current position: with no licence file, copyright is **all rights reserved by
operation of law**, not by choice. Commit `1784a04` already reasoned this out —
protection arises when the work is fixed under UU 28/2021 and the Berne
Convention, registration is evidence rather than a precondition, and the phrase
"All rights reserved" was deleted from the footer because it is a 1910 Buenos
Aires Convention relic that reserves nothing Berne does not already reserve. The
footer now reads simply `(c) 2026 Ivan Jairus`. Any of the three options below
has to be consistent with that line.

One fact is not established by the repository and is a blocker for options 2 and
3: **who owns the copyright in `assets/img/profile.jpg` and
`assets/img/profile-480.jpg`.** A portrait is usually taken by someone else.
Granting reuse rights over an image the site does not own would be granting
rights the owner cannot give.

## 2. The three viable options

### Option A — All rights reserved, with a short note

No licence grant. A `LICENSE.md` of a few lines: the code and text are the
author's, verbatim copying for redistribution is not permitted, quoting a
sentence with attribution is welcome, and "please don't scrape this into a
generative-training corpus and repost it as a template".

- **Signals to an employer:** neutral-to-negative on hygiene (an auditor already
  marked it), but clean on intent. It says the artefact is personal, not a
  library. It costs nothing and it is honest about what is already true.
- **Signals it can be misread as:** unwillingness to share, which sits badly next
  to a page whose whole argument is that standards and reusable pipelines should
  be published for other teams to adopt.
- **Risk:** none, legally. The missing-licence audit finding is only half closed;
  a note documents a reservation, it is not a licence.

### Option B — MIT for the code, CC BY-NC-ND 4.0 for text and images

Two grants, split by asset type: the engineering artifacts under MIT, the
expressive content under CC BY-NC-ND 4.0.

- **Signals to an employer:** the strongest of the three for this specific
  candidate. It demonstrates licence granularity — the same instinct that makes
  someone put a deny-list in a CI policy instead of one blanket rule — and it
  matches how DevSecOps teams actually classify artifacts. Recruiters can reuse
  the repo structure; nobody can republish the case studies commercially or in
  modified form.
- **The ND clause matters here more than the NC clause.** A non-modified-only
  condition prevents a mirror from editing the claims attributed to a named
  person. NC alone would still allow a rewritten version to circulate under his
  name.
- **Costs and honest downsides:** two licenses to state and to keep in force, so
  the file structure gets more complicated than one `LICENSE.md`; CC BY-NC-ND is
  not an Open Definition license and should not be described as "open source";
  CC's non-commercial term is genuinely ambiguous in some jurisdictions, and
  Indonesian practice around it is untested. Also, ND forbids the adapted
  translations and derivative summaries that other people might otherwise make of
  the work — a real loss of reach.
- **Risk:** low, provided the profile-photo ownership question is settled first.

### Option C — CC BY 4.0 over everything

One licence, attribution required, commercial use and adaptations permitted.

- **Signals to an employer:** maximal openness, and it reads as confidence. It is
  also the option that assumes the repository is a contribution to a commons
  rather than a CV.
- **Why it is weak here:** the content is a job application, not a reference. CC
  BY lets an aggregator take the case studies, strip the context that makes the
  sanitisation legible, republish them behind a content farm, and keep the
  engineering claims sounding like a product description. The licence would also
  cover the CV PDF, which is a document that should travel by request, not by
  licence.
- **Risk:** reputational rather than legal, plus the same photo-ownership blocker.

## 3. Recommendation

**Option B — MIT for `index.html`, `assets/**` code, `vercel.json` and
`.github/**`; CC BY-NC-ND 4.0 for the prose, images and CV.** With two
conditions before it is written:

1. Confirm who holds the copyright in the two profile images. If it is not the
   owner, license the site's text and code, and mark the images as third-party
   work with no grant, or replace them.
2. Confirm that nothing in the current employment agreement claims work published
   under the owner's own name. The site already handles the substance of this
   carefully — the employer is described only as a state-owned banking group and
   every figure, host and screenshot is deliberately dummy data — but the
   question is about contract terms, not about the content, and it is worth
   twenty minutes of reading before granting any licence at all.

Reasoning: the audit finding is that the repository looks ungoverned, and Option B
is the answer a DevSecOps candidate would give to an ungoverned artifact — classify
first, then apply the narrowest grant that still lets the work be used. Option A
leaves the finding open. Option C optimises for reach on the one part of this site
that is not meant to travel: the claims about who did this work.

If the two conditions above cannot be confirmed quickly, ship **Option A now** and
revisit it. It takes ten minutes, it closes most of the finding by documenting the
position, and it forecloses nothing.

## 4. What writing the licence will require, whichever option is chosen

- A `LICENSE.md` carrying the full text of each grant, with an explicit
  asset-type scope line at the top, plus SPDX identifiers in `README.md`
  (`MIT` and `LicenseRef-Portfolio-Content`) so tooling reads it correctly.
- A line recording that the inlined SVG marks come from Simple Icons under CC0,
  wherever the licence text lands, so the attribution trail is not lost when the
  harness history is.
- No change to the footer. It already states only what is checkable against this
  repository, and the craft claim there is load-bearing for the site's argument.
- A tag or release once the licence is in, so the licensed state is addressable.
