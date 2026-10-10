/*
 * Turn a Lighthouse JSON report into a pass/fail gate.
 *
 * Used by .github/workflows/quality.yml. Run with:
 *   node .github/scripts/assert-lighthouse.mjs <path-to-report.json>
 *
 * Exits 0 when every category score and every performance budget holds, 1
 * otherwise, printing one line per check so a failure reads as a table rather
 * than as a stack trace.
 *
 * No dependencies on purpose: this file uses only the node built-in fs module,
 * so it cannot add a supply-chain surface to a repository that has no
 * package.json. It is CI tooling and is never loaded by the site.
 *
 * Budgets come from the measured baseline of this page under mobile emulation
 * (Lighthouse 13.5.0, simulate throttling), recorded 2026-10-07:
 *   Performance 93, Accessibility 99, Best-Practices 100, SEO 100
 *   FCP 2.1 s, LCP 2.9 s, TBT 0 ms, CLS 0, total weight 345 KiB (353074 B)
 * Each threshold below sits clearly outside that baseline, so the gate fails on
 * a regression rather than on measurement noise from a shared CI runner.
 */

import { readFileSync } from "node:fs";

const CATEGORY_MIN = {
  performance: 85, // measured 93
  accessibility: 95, // measured 99; the page does not score 100 and should not claim to
  "best-practices": 92, // measured 100 (dua run lokal) dan 96 (satu run lain dengan flag sama);
                          // 95 akan hanya berjarak 1 poin dari observasi terburuk, jadi 92:
                          // gerbang ini harus gagal karena regresi, bukan karena variasi runner
  seo: 95, // measured 100
};

// numericValue is milliseconds for the timing audits and bytes for weight.
const BUDGET_MAX = {
  "first-contentful-paint": 3000, // measured 2105
  "largest-contentful-paint": 4000, // measured 2892
  "total-blocking-time": 250, // measured 0
  "cumulative-layout-shift": 0.1, // measured 0
  /* Ceiling raised 400 -> 512 KiB on 2026-10-08 by the owner, to buy motion and
     imagery. Two facts kept honest: this number is measured against a local
     python http.server that sends NOTHING compressed, while the deployed page
     transfers ~131 KiB over the wire; and every other budget here is untouched,
     including the ones a visitor actually feels (FCP, LCP, TBT, CLS). A weight
     ceiling is the cheapest budget to move, which is exactly why it is the only
     one moved, with the reason written down instead of the number nudged. */
  "total-byte-weight": 524288, // measured 394876 = 512 KiB ceiling
};

const path = process.argv[2];
if (!path) {
  console.error("usage: node assert-lighthouse.mjs <lighthouse-report.json>");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch (error) {
  console.error(`FAIL  could not read the Lighthouse report at ${path}: ${error.message}`);
  process.exit(2);
}

const failures = [];
const rows = [];
const audit = (id) => (report.audits && report.audits[id]) || null;

function check(label, actual, operator, limit, detail) {
  const pass =
    actual !== null && actual !== undefined && operator === ">=" ? actual >= limit : actual <= limit;
  rows.push(`${pass ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${String(actual)} ${operator} ${limit}`);
  if (!pass) failures.push(`${label}: ${detail} ${actual}, needs ${operator} ${limit}`);
}

for (const [id, min] of Object.entries(CATEGORY_MIN)) {
  const category = report.categories && report.categories[id];
  if (!category || category.score === null || category.score === undefined) {
    failures.push(`${id}: the category is missing from the report (did Lighthouse run?)`);
    rows.push(`FAIL  category ${id.padEnd(25)} missing`);
    continue;
  }
  check(`category ${id}`, Math.round(category.score * 100), ">=", min, "scored");
}

for (const [id, max] of Object.entries(BUDGET_MAX)) {
  const result = audit(id);
  if (!result || result.numericValue === undefined) {
    failures.push(`${id}: the audit is missing from the report`);
    rows.push(`FAIL  audit ${id.padEnd(27)} missing`);
    continue;
  }
  check(id, Math.round(result.numericValue * 1000) / 1000, "<=", max, "measured");
}

// axe-core backs the accessibility color-contrast audit, so an empty item list
// is the assertion behind the site's "0 contrast findings" statement.
const contrast = audit("color-contrast");
if (!contrast) {
  failures.push("color-contrast: the audit is missing from the report");
  rows.push("FAIL  audit color-contrast             missing");
} else {
  const findings = (contrast.details && contrast.details.items ? contrast.details.items : []).length;
  check("color-contrast findings", findings, "<=", 0, "axe reported");
  if (findings > 0) {
    for (const item of contrast.details.items.slice(0, 12)) {
      console.error(`  offending node: ${(item.node && item.node.snippet) || item.snippet || "(unknown)"}`);
    }
  }
}

// A console error is the failure mode that already happened once on this page:
// rounding the inlined SVG path data corrupted arc flags and produced six
// path-parse errors, which cost a best-practices point (commit 05dd9d0).
const consoleErrors = audit("errors-in-console");
if (consoleErrors) {
  const count = (consoleErrors.details && consoleErrors.details.items ? consoleErrors.details.items : []).length;
  check("errors-in-console", count, "<=", 0, "reported");
}

console.log(`\nLighthouse gate: ${report.finalDisplayedUrl || report.requestedUrl || "target"} ` +
  `(lighthouse ${report.lighthouseVersion || "?"}, ${report.configSettings ? report.configSettings.formFactor : "?"} emulation)\n`);
console.log(rows.join("\n"));

if (failures.length) {
  console.error(`\nGate failed on ${failures.length} check(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nAll checks passed.\n");
