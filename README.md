# Portfolio site of Ivan Jairus

Static portfolio site: plain HTML, vanilla JS and CSS. No build step, no CDN, no
npm dependencies. The only third party involved is the host itself; see
[SECURITY.md](SECURITY.md) for what that means for analytics.

![security](https://github.com/IvanJairus/Portofolio/actions/workflows/security.yml/badge.svg)

## Run locally

```bash
python3 -m http.server 8731
# open http://localhost:8731
```

## Deploy

Push to `main`. Vercel serves the repo statically and `vercel.json` sets the CSP, the
security headers, the cache policy and the apex redirect.

## Notes

- All figures, names, hosts and screenshots on the site are sanitized dummy data; the engineering described is real.
- All page text lives in `assets/js/i18n.js` (English only) and every value is duplicated as the HTML fallback in `index.html`. Run
`node scripts/sync-i18n.mjs` after editing it, or `--check` in CI to catch drift. Identity data lives in `assets/js/config.js`.

## Licence

- Code: [MIT](LICENSE.md#1-code-licence-mit) (`SPDX: MIT`)
- Content & Media: [CC BY-NC-ND 4.0](LICENSE.md#2-content-licence-cc-by-nc-nd-40) (`SPDX: CC-BY-NC-ND-4.0`)
- Inlined SVG icons from Simple Icons (`CC0 1.0`)
