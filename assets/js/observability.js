/*
  Vercel serves both of its scripts from this origin, so they fit the page's
  existing `script-src 'self'`. Both post their measurements to
  vitals.vercel-insights.com, the one host `connect-src` allows, so neither
  feature needs a second exception: Web Analytics sends a pageview, Speed
  Insights sends LCP, CLS and INP on visibilitychange via sendBeacon.

  The hostname test is the point of this file. A missing `/_vercel/...` script is
  logged as a failed request in the console, and this page is judged on its
  engineering hygiene, so the scripts are only requested where they are meant to
  exist: not on a laptop, not on a preview deployment.
*/
const PRODUCTION = "www.ivanjairus.xyz";
const WEB_ANALYTICS_PATH = "/_vercel/insights/script.js";
const SPEED_INSIGHTS_PATH = "/_vercel/speed-insights/script.js";

if (location.hostname === PRODUCTION) {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  addScript(WEB_ANALYTICS_PATH);

  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
  addScript(SPEED_INSIGHTS_PATH);
}

function addScript(src) {
  const tag = document.createElement("script");
  tag.src = src;
  tag.defer = true;
  document.head.appendChild(tag);
}

