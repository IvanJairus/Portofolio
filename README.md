# Portfolio — Ivan Jairus

Static portfolio site: plain HTML + vanilla JS + CSS. No build step, no CDN, no dependencies.

![security](https://github.com/IvanJairus/Portofolio/actions/workflows/security.yml/badge.svg)

## Run locally

```bash
python3 -m http.server 8731
# open http://localhost:8731
```

## Deploy

Push to `main` — Vercel serves the repo statically; `vercel.json` sets CSP and security headers.

## Notes

- All figures, names, hosts and screenshots on the site are sanitized dummy data; the engineering described is real.
- Translations live in `assets/js/i18n.js` (EN + ID kept in sync); identity data in `assets/js/config.js`.
