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

## Response commitment

> **TO BE CONFIRMED BY THE OWNER — do not publish this section until filled in.**
>
> - First response: _[hours/business days the owner can actually keep]_
> - Status update cadence while a report is open: _[interval]_
> - Publication of a fix or advisory: _[condition, if any]_

An honest, unmet-able number is better than an aspirational one. Until these
lines are filled in, treat the commitment as unpublished rather than as a
default.
