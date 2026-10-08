# 0004. No database, no queue, no auto-merge

Status: accepted (2024)

## Context

The ChatOps orchestrator and the release control plane needed somewhere to keep
state: which phase a card is in, who approved what, which services are in a
release, whether a deploy is already running. The obvious engineering answer is
a database, a queue, and a bot that completes the last step for people.

## Decision

Refuse all three. State lives inside the Jira ticket and the GitLab objects that
already exist; the board is a view over them, not a copy. There is no deploy
queue: if a deploy is running, a second one is refused and the operator is told
why. The merge stays human - the bot prepares the merge request, records the
evidence, waits, and writes the result back, but never clicks merge on someone's
behalf.

## Alternatives rejected

- **Postgres for state.** Rejected: a second source of truth needs sync,
  migration, backup and reconciliation, and every one of those is a way to be
  wrong in a way the ticket is not.
- **A queue for busy deploys.** Rejected: a queue makes ordering and staleness my
  problem, and in a bank "your change is queued behind someone else's" is a
  conversation that belongs to a human, not to a retry policy.
- **Auto-merge once the gate is green.** Rejected: approval is a control held by
  a group that carries the risk of the next stage. Automating the click would
  remove the accountability the click exists to record.

## Consequences

- Fewer moving parts, fewer ways to be wrong, and no reconciliation job.
- The whole history of a release is readable by anyone with ticket access, which
  is what an auditor asks for.
- **Cost:** promotion lead time is dominated by human wait, not by tooling. That
  is now the bottleneck, and it is measured before it is argued about.
- Refusing a second deploy instead of queueing it means someone occasionally
  retries by hand. Accepted, deliberately.
