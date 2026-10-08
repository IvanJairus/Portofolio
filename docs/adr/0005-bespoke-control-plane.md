# 0005. Built the control plane, did not buy one

Status: accepted, with an exit condition

## Context

Releases needed a board, an audit trail and a report. The industry answers are
ArgoCD, GitLab Environments, Spinnaker, Backstage - tools I have read the
documentation of and would happily operate.

## Decision

Build a small control plane on top of the systems that already hold the truth:
an issue board over Jira and GitLab, an append-only release ledger, and generated
release emails. Three dependencies, stdlib elsewhere. Promotion is automated up
to the approval and human at the approval.

## Why the standard tools did not fit

- **The source of truth is the issue board, not a git repository.** A release
  here is "the set of services that diverged between environments", decided per
  stage. Argo reconciles one application from one repo toward one desired state;
  that model does not describe this transaction.
- **Each stage belongs to a different group.** GitLab Environments assume one
  approver per environment; here approval is a five-layer chain (team, business,
  product, architecture, engineering) and the ledger has to show who carried the
  risk.
- **On-premise OpenShift, no cloud tenancy.** The hosted conveniences that make
  the standard tools cheap to run are not available, and the ones that are do not
  reach the artifact types in play (jar, image, apk/aab, ipa, web bundle).

## Consequences

- The board, ledger and emails match the process exactly, which is the only
  advantage a bespoke system ever has.
- **Cost, stated plainly:** I own a UI that Argo ships for free. Every feature
  costs me personally. The bus factor is smaller than a mainstream tool's, and
  hiring someone who already knows this product is not possible.
- **Exit condition.** If this platform moved to a public cloud with git-driven
  deploys, I would retire the control plane and run the standard. The standard
  exists because it fits more shops than a bespoke one does; keeping my own
  version past the point where theirs fits is vanity, not engineering.

## What I would do differently

Write this ADR before building, not after. The honest version of this record is
that the comparison with the standard tools was made partly in hindsight, and a
reviewer should read the "did not fit" section as reasoning that was tested by
use rather than by a formal bake-off.
