# Security policy

This is a personal portfolio: one hand-built static HTML page, its own CSS and
vanilla JavaScript, served as-is. There is no backend, no database, no
authentication, no forms, and no user data of any kind. Nothing on the page
talks to a third party — the Content-Security-Policy is `default-src 'self'`
with `style-src 'self'` and no `unsafe-inline`, so a hot-linked asset would be
blocked by the browser rather than loaded.

## What counts as a vulnerability

Report it if the finding is about the site as it is published, for example:

- A way to execute script in the page's origin, including a DOM-based sink in
  `assets/js/`, a bypass of the CSP, or an injection through the URL hash or a
  stored value the page reads.
- A published file that should not be public — a secret, a token, an internal
  hostname, or unsanitised employer data. Every figure, name, host and
  screenshot on the site is intentionally dummy data, so anything that looks
  real and internal is a disclosure bug.
- A header configuration in `vercel.json` that is weaker than it is documented
  to be, or a redirect that leaks the referrer.
- An accessibility failure that blocks a real task (keyboard operation, colour
  contrast below WCAG 2.1 AA) — this site sells its engineering hygiene, so
  accessibility defects are treated as bugs, not cosmetics.
- A supply-chain issue in CI: a workflow step that runs a floating tag, an
  over-broad `permissions:` block, or a third-party action that could execute
  unreviewed code on a pull request.

## What is out of scope

- Findings that require the site to do something it does not do: brute force,
  rate limiting, IDOR, SQL injection, XML external entities. There is no
  server-side code and no input handling to exploit.
- Missing HTTP-only hardening on the `*.vercel.app` hostname itself, or anything
  only reachable from a local `python3 -m http.server` run.
- Generic reports about the Vercel or GitHub platforms, and dependency advisories
  — there are no dependencies to update. Dependabot is configured for GitHub
  Actions only.
- Social engineering, phishing against the contact address, and scanner output
  without a reproducible demonstration.
- Reports about the accuracy of claims on the page. Those are welcome, but they
  are a content correction, not a security advisory.

## How to report

Email **Filemonivanjairus@gmail.com**. That address is already public on the
site, so plaintext is acceptable; if the finding is sensitive, send an outline
first and ask for an encryption method before describing it.

Please include: the URL, what the page does wrong, the steps to reproduce it,
and the impact. A proof of concept is more useful than a description. Do not
open a public issue for an unfixed vulnerability — the repository is public,
and an issue is a disclosure.

There is no bug bounty and no safe-harbour statement to offer beyond this: a
good-faith report sent to the address above will not be reported, and the
reporter's identity will not be disclosed.

## What this site does not claim

Trusted Types is not enforced, and that is a decision rather than an oversight.
`require-trusted-types-for 'script'` was tried and measured: Chrome rejects
`DOMParser.parseFromString(..., "text/html")` under that directive, which is the
single string-to-DOM path left in `assets/js/` after `innerHTML` was removed - so
the header would have blanked the translated text it was meant to protect. The
alternative, a policy whose `createHTML` returns its input unchanged, buys a
stricter-looking header and no actual restriction, and a security claim that is
decorative is worse on a page that sells security gates than no claim at all.

What is true instead: every string that reaches the DOM parser comes from
`assets/js/i18n.js` in this repository, no user input is rendered anywhere, and
`script-src 'self'` with no `unsafe-inline` already blocks injected script. If
the page ever takes input from outside the repo, this decision has to be revisited
before that ships - that is the condition, and it is written here so it can be
found later.

## Response commitment

No SLA is promised. This is a personal site maintained by one engineer in his
own time, and a number written here that nobody can keep is worse than no
number: I read every report that reaches the address above, I reply myself, and
a confirmed finding is fixed in a commit that says what it was. If a report
needs coordination before disclosure, say so in the first message and I will
hold to your timeline.

If you want a commitment you can hold me to, ask for one in your report and I
will either agree to it or explain why not - which is the same conversation this
section was going to start anyway.

