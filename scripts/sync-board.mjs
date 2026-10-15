/*
  Fill the recruiter-facing board from the sentences the site already publishes,
  and report when the two have drifted apart.

  Two decisions in here are load-bearing. Cards are Issues rather than draft
  issues, because a draft issue has no comment thread and the move summaries have
  to live somewhere a reader can find. And the two tokens are kept apart: the
  project PAT holds only the project scope, so the secret sitting in a public
  repository cannot reach the code.

  Nothing in the write path runs by itself. `plan` needs no token and sends no
  request, `check` only reads, and `build` and `summaries` are the two modes that
  change things a stranger can see.

    node scripts/sync-board.mjs --mode=plan
    node scripts/sync-board.mjs --mode=check
    node scripts/sync-board.mjs --mode=build
    node scripts/sync-board.mjs --mode=summaries

  Env: PORTFOLIO_BOARD_PAT for board writes, GITHUB_TOKEN for Issues and
  comments, PORTFOLIO_BOARD_PROJECT for the project number (default 1),
  BOARD_VERBOSE=1 for per-call payloads.
*/
import {
  FIELDS, VIEWS, buildCards, guard, gql, rest, log, vlog,
  repoOwner, repoName,
} from "./board-lib.mjs";

const MODE = (process.argv.find((a) => a.startsWith("--mode=")) || "--mode=plan").split("=")[1];
const PROJECT_NUMBER = Number(process.env.PORTFOLIO_BOARD_PROJECT || 1);
const OWNER = process.env.BOARD_OWNER || repoOwner;
const REPO = process.env.BOARD_REPO || repoName;
const DONE = "Done";

const QUERIES = {
  readProject: /* GraphQL */ `
    query ReadProject($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
          fields(first: 30) {
            nodes {
              ... on ProjectV2FieldCommon { id name dataType }
              ... on ProjectV2SingleSelectField { options { id name } }
            }
          }
          items(first: 100) {
            nodes {
              id
              type
              content {
                ... on Issue { id number title url repository { nameWithOwner } }
                ... on DraftIssue { id title }
              }
              fieldValues(first: 30) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { name } } }
                }
              }
            }
          }
        }
      }
    }`,

  createField: /* GraphQL */ `
    mutation CreateField($input: CreateProjectV2FieldInput!) {
      createProjectV2Field(input: $input) {
        projectV2Field {
          ... on ProjectV2FieldCommon { id name dataType }
          ... on ProjectV2SingleSelectField { options { id name } }
        }
      }
    }`,

  createView: /* GraphQL */ `
    mutation CreateView($input: CreateProjectV2ViewInput!) {
      createProjectV2View(input: $input) { projectV2View { id number name } }
    }`,

  addItem: /* GraphQL */ `
    mutation AddItem($input: AddProjectV2ItemByIdInput!) {
      addProjectV2ItemById(input: $input) { item { id } }
    }`,

  setFieldValue: /* GraphQL */ `
    mutation SetFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) { projectV2Item { id } }
    }`,

  addSubIssue: /* GraphQL */ `
    mutation AddSubIssue($input: AddSubIssueInput!) {
      addSubIssue(input: $input) { issue { number title } }
    }`,

  moves: /* GraphQL */ `
    query Moves($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          number
          timelineItems(first: 50, itemTypes: [PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
            nodes {
              ... on ProjectV2ItemStatusChangedEvent {
                createdAt
                status
                previousStatus
                wasAutomated
                actor { login }
                project { number }
              }
            }
          }
        }
      }
    }`,
};

function fieldMap(fields) {
  const byName = new Map();
  for (const f of fields || []) if (f?.name) byName.set(f.name, f);
  return byName;
}

function itemsByKey(items) {
  const map = new Map();
  const unkeyed = [];
  for (const it of items || []) {
    const values = {};
    for (const v of it?.fieldValues?.nodes || []) {
      const name = v?.field?.name;
      if (!name) continue;
      values[name] = v.text ?? v.name ?? "";
    }
    if (!values.Key) {
      if (it?.id) unkeyed.push({ itemId: it.id, type: it.type, title: it.content?.title ?? "" });
      continue;
    }
    map.set(values.Key, { itemId: it.id, issueNumber: it.content?.number ?? null, values, type: it.type });
  }
  return { map, unkeyed };
}

async function readProject() {
  const data = await gql(QUERIES.readProject, { login: OWNER, number: PROJECT_NUMBER });
  const project = data?.user?.projectV2;
  if (!project) throw new Error(`project ${PROJECT_NUMBER} not visible for ${OWNER}`);
  const { map, unkeyed } = itemsByKey(project.items.nodes);
  log(`board "${project.title}" number=${PROJECT_NUMBER} fields=${project.fields.nodes.length} items=${project.items.nodes.length} keyed=${map.size} unkeyed=${unkeyed.length}`);
  return { id: project.id, fields: fieldMap(project.fields.nodes), items: map, unkeyed };
}

const cards = buildCards();
const problems = guard(cards);

function planText() {
  const lines = [];
  lines.push(`cards: ${cards.length} (${cards.filter((c) => c.card === "Project").length} project, ${cards.filter((c) => c.card === "Proof").length} proof)`);
  for (const c of cards) {
    lines.push(`  ${c.key.padEnd(12)} ${c.card.padEnd(8)} ${c.area.padEnd(13)} "${c.title}"`);
    lines.push(`  ${"".padEnd(12)} source=${c.source}${c.evidence ? ` evidence=${c.evidence}` : ""}`);
    lines.push(`  ${"".padEnd(12)} status=${DONE} parent=${c.parentKey ?? "-"}`);
  }
  lines.push("");
  lines.push(`fields to ensure: ${FIELDS.map((f) => `${f.name}:${f.dataType}`).join(", ")}`);
  lines.push(`views to ensure: ${VIEWS.map((v) => `${v.name}:${v.layout}`).join(", ")}`);
  const perCard = 1 + FIELDS.length + 1;
  lines.push(`mutation budget: ${FIELDS.length} createProjectV2Field + ${VIEWS.length} createProjectV2View + ${cards.length} (POST issue + addProjectV2ItemById + ${FIELDS.length} updateProjectV2ItemFieldValue)`);
  lines.push(`  worst case ${FIELDS.length + VIEWS.length + cards.length * perCard} calls; GraphQL PAT budget is 5000 points/hour`);
  return lines.join("\n");
}

async function main() {
  if (problems.length) {
    for (const p of problems) log(`FAIL ${p}`);
    log(`${problems.length} problem(s): a card that cannot be traced to the published page is not sent to a public board.`);
    process.exit(1);
  }

  if (MODE === "plan") {
    console.log(planText());
    console.log(`\nguard: ${cards.length} cards carry the exact string published in i18n.js and index.html, no em dash, no internal identifier.`);
    console.log("ok: plan only, nothing was sent. Re-run with --mode=build to write.");
    return;
  }

  const board = await readProject();

  if (MODE === "check") {
    let drift = 0;
    for (const c of cards) {
      const found = board.items.get(c.key);
      if (!found) { log(`MISSING ${c.key} (${c.title.slice(0, 48)})`); drift += 1; continue; }
      const issue = found.issueNumber ? await rest(`/repos/${OWNER}/${REPO}/issues/${found.issueNumber}`, {}, "issue") : null;
      if (issue && issue.title !== c.title) { log(`TITLE ${c.key} board issue #${issue.number} says "${issue.title}"`); drift += 1; }
      if (found.values.Status !== DONE) { log(`STATUS ${c.key} is "${found.values.Status}", expected "${DONE}"`); drift += 1; }
      if (found.values.Source !== c.source) { log(`SOURCE ${c.key} is "${found.values.Source}"`); drift += 1; }
      if (found.values.Card !== c.card) { log(`CARD ${c.key} is "${found.values.Card}"`); drift += 1; }
      vlog(`ok ${c.key} item=${found.itemId} issue=${found.issueNumber}`);
    }
    for (const [key, it] of board.items) {
      if (cards.some((c) => c.key === key)) continue;
      log(`STALE ${key} is on the board but no longer published on the site (item ${it.itemId})`);
      drift += 1;
    }
    for (const u of board.unkeyed) log(`KEEP ${u.type} ${u.itemId} "${u.title.slice(0, 48)}": no Key, so this script did not make it and will not touch it`);
    if (drift) { console.log(`${drift} drift item(s). The board and the site do not say the same thing.`); process.exit(1); }
    console.log(`ok: ${cards.length} cards on the board match the published site, all in ${DONE}.`);
    return;
  }

  if (MODE === "build") {
    for (const spec of FIELDS) {
      if (board.fields.has(spec.name)) { log(`field "${spec.name}" exists id=${board.fields.get(spec.name).id}`); continue; }
      const input = { projectId: board.id, name: spec.name, dataType: spec.dataType };
      if (spec.options) input.singleSelectOptions = spec.options.map((o) => ({ ...o }));
      const created = await gql(QUERIES.createField, { input });
      const f = created?.createProjectV2Field?.projectV2Field;
      if (!f?.id) throw new Error(`field "${spec.name}": created but no id came back`);
      board.fields.set(f.name, f);
      log(`field "${f.name}" created id=${f.id}${f.options ? ` options=${f.options.map((o) => o.name).join("/")}` : ""}`);
    }

    const status = board.fields.get("Status");
    if (!status) throw new Error("the board has no Status field; this script will not guess which column means Done");
    const doneOption = (status.options || []).find((o) => o.name === DONE);
    if (!doneOption) throw new Error(`Status has no "${DONE}" option (has: ${(status.options || []).map((o) => o.name).join(", ")})`);

    const wanted = [...cards].sort((a, b) => (a.card === b.card ? 0 : a.card === "Project" ? -1 : 1));
    let wrote = 0;
    const done = [];
    try {
      for (const c of wanted) {
        const existing = board.items.get(c.key);
        let itemId = existing?.itemId ?? null;
        let issue = existing?.issueNumber
          ? await rest(`/repos/${OWNER}/${REPO}/issues/${existing.issueNumber}`, {}, "issue")
          : null;
        if (!issue) {
          issue = await rest(`/repos/${OWNER}/${REPO}/issues`, {
            method: "POST",
            body: { title: c.title, body: c.body },
          }, "issue");
          log(`issue #${issue.number} created for ${c.key}`);
        } else {
          log(`issue #${issue.number} already exists for ${c.key}`);
          if (issue.title !== c.title) {
            await rest(`/repos/${OWNER}/${REPO}/issues/${issue.number}`, { method: "PATCH", body: { title: c.title, body: c.body } }, "issue");
            log(`issue #${issue.number} retitled to the published string`);
          }
        }
        c.issueNumber = issue.number;
        c.issueId = issue.node_id;
        if (!itemId) {
          const added = await gql(QUERIES.addItem, { input: { projectId: board.id, contentId: issue.node_id } });
          itemId = added?.addProjectV2ItemById?.item?.id;
          if (!itemId) throw new Error(`${c.key}: item added but no id came back`);
          log(`${c.key} -> item ${itemId}`);
        } else {
          log(`${c.key} keeps item ${itemId}`);
        }

        const values = {
          Key: { text: c.key },
          Card: { singleSelectOptionId: optionId(board.fields.get("Card"), c.card) },
          Area: { singleSelectOptionId: optionId(board.fields.get("Area"), c.area) },
          Source: { text: c.source },
          Evidence: { text: c.evidence },
          Status: { singleSelectOptionId: doneOption.id },
        };
        for (const [name, value] of Object.entries(values)) {
          const field = board.fields.get(name);
          if (!field) throw new Error(`field "${name}" is missing from the board`);
          if (existing?.values?.[name] === displayOf(value, field)) { vlog(`${c.key} ${name} already "${existing.values[name]}"`); continue; }
          await gql(QUERIES.setFieldValue, { input: { projectId: board.id, itemId, fieldId: field.id, value } });
          log(`  set ${c.key}.${name}`);
        }
        wrote += 1;
        done.push(c.key);
      }

      for (const c of wanted) {
        if (!c.parentKey) continue;
        const parent = wanted.find((p) => p.key === c.parentKey);
        if (!parent?.issueId || !c.issueId) { vlog(`sub-issue skipped for ${c.key}`); continue; }
        await gql(QUERIES.addSubIssue, { input: { issueId: parent.issueId, subIssueId: c.issueId } });
        log(`sub-issue ${c.key} -> parent ${parent.key}`);
      }

      for (const spec of VIEWS) {
        const list = await gql(
          `query Views($id: ID!) { node(id: $id) { ... on ProjectV2 { views(first: 20) { nodes { name } } } } }`,
          { id: board.id }
        );
        const names = (list?.node?.views?.nodes || []).map((v) => v.name);
        if (names.includes(spec.name)) { log(`view "${spec.name}" exists`); continue; }
        const visibleFieldIds = spec.visible.map((n) => board.fields.get(n)?.id).filter(Boolean);
        const created = await gql(QUERIES.createView, { input: { projectId: board.id, name: spec.name, layout: spec.layout, configuration: { visibleFieldIds } } });
        log(`view "${spec.name}" created number=${created?.createProjectV2View?.projectV2View?.number} (filter and grouping are set once in the UI; the API cannot write them)`);
      }
    } catch (err) {
      console.log(`WROTE ${wrote}/${cards.length} keys completed: ${done.join(", ")}`);
      console.log(`FAIL ${err.message}`);
      process.exit(1);
    }
    console.log(`ok: ${wrote} cards built or verified, ${wrote ? "board written" : "no card needed writing"}. Keys: ${done.join(", ")}`);
    return;
  }

  if (MODE === "summaries") {
    const marker = /<!-- board-sync (\d+) ([0-9T:.Z-]+) -->/;
    let posted = 0;
    let seen = 0;
    for (const [key, it] of board.items) {
      if (!it.issueNumber) continue;
      seen += 1;
      const data = await gql(QUERIES.moves, { owner: OWNER, name: REPO, number: it.issueNumber });
      const nodes = data?.repository?.issue?.timelineItems?.nodes || [];
      /* An item arriving on the board is logged as a status change from an empty
         value by github-project-automation. That is the card being created, not a
         column being moved, and summarizing it would present the initial build as
         if it were activity someone performed. */
      const events = nodes.filter((e) => e?.createdAt && e.previousStatus && e.project?.number === PROJECT_NUMBER);
      const created = nodes.length - events.length;
      if (!events.length) { log(`${key}: no recorded move (${created} creation event(s) ignored)`); continue; }
      const comments = await rest(`/repos/${OWNER}/${REPO}/issues/${it.issueNumber}/comments`, {}, "issue");
      let lastSeen = "";
      for (const c of comments) {
        const m = marker.exec(c.body || "");
        if (m && m[1] === String(it.issueNumber) && m[2] > lastSeen) lastSeen = m[2];
      }
      const fresh = events.filter((e) => e.createdAt > lastSeen);
      log(`${key}: ${events.length} recorded move(s), ${fresh.length} not yet summarized`);
      if (!fresh.length) continue;
      const newest = fresh[fresh.length - 1];
      const c = cards.find((x) => x.key === it.values.Key);
      const lines = [
        ...fresh.map((e) => `Moved from "${e.previousStatus}" to "${e.status}" by @${e.actor?.login ?? "?"} at ${e.createdAt}${e.wasAutomated ? " (automation)" : ""}.`),
        "",
        `This card carries the claim \`${it.values.Key}\`, published at ${c?.source ?? it.values.Source}.`,
        `<!-- board-sync ${it.issueNumber} ${newest.createdAt} -->`,
      ];
      await rest(`/repos/${OWNER}/${REPO}/issues/${it.issueNumber}/comments`, { method: "POST", body: { body: lines.join("\n") } }, "issue");
      log(`comment posted on #${it.issueNumber} for ${key}`);
      posted += 1;
    }
    console.log(`ok: ${seen} issue-backed cards read, ${posted} summary comment(s) posted. A second run over the same moves posts nothing.`);
    return;
  }

  console.error(`unknown --mode=${MODE} (plan, check, build, summaries)`);
  process.exit(1);
}

function optionId(field, name) {
  const opt = (field?.options || []).find((o) => o.name === name);
  if (!opt) throw new Error(`field "${field?.name}" has no option "${name}"`);
  return opt.id;
}

/* The board reports a select value by name and a text value by text, so a
   planned value can be compared against what is already there. */
function displayOf(value, field) {
  if (value.singleSelectOptionId !== undefined) {
    return (field?.options || []).find((o) => o.id === value.singleSelectOptionId)?.name ?? "";
  }
  return value.text ?? "";
}

main().catch((err) => {
  console.log(`FAIL ${err.message}`);
  process.exit(1);
});
