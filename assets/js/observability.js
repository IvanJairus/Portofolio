/*
  Vercel serves its own analytics from this origin, so the script fits the page's
  existing `script-src 'self'`. The measurement goes to
  vitals.vercel-insights.com, which is the one host `connect-src` allows.

  The hostname test is the point of this file. A missing `/_vercel/...` script is
  logged as a failed request in the console, and this page is judged on its
  engineering hygiene, so the script is only requested where it is meant to
  exist: not on a laptop, not on a preview deployment.

  Before this does anything, enable Web Analytics for the project in the Vercel
  dashboard. Speed Insights uses a per-project path that the dashboard shows
  when the feature is turned on; paste it below and it loads the same way.
*/
const PRODUCTION = "www.ivanjairus.xyz";
const SPEED_INSIGHTS_PATH = "";

if (location.hostname === PRODUCTION) {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  addScript("/_vercel/insights/script.js");

  if (SPEED_INSIGHTS_PATH) {
    window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    addScript(SPEED_INSIGHTS_PATH);
  }
}

function addScript(src) {
  const tag = document.createElement("script");
  tag.src = src;
  tag.defer = true;
  document.head.appendChild(tag);
}
