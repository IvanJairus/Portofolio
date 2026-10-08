# 0002. Gates fail closed

Status: accepted (2024)

## Context

A quality gate that cannot evaluate its input has two options: stop the
pipeline, or continue and warn. In a bank, the audit question after an incident
is not "did the pipeline warn" but "did the pipeline let it through".

## Decision

Every gate fails closed. A missing secret, an unevaluable scan result, an
unconfirmed merge, a scanner that returned nothing parseable - each one stops
the job with a non-zero exit rather than continuing with a warning.

## Alternatives rejected

- **Warn and continue, keep builds green.** Rejected: a silently-falling-back
  secret is a compliance incident with a head start, and a green build that
  skipped its checks is worse than a red one because everyone trusts green.
- **Fail closed only on security stages.** Rejected: partial enforcement is the
  version that gets forgotten at 2am, and the whole point is that nobody has to
  remember.

## Consequences

- Config drift stopped shipping: when a value is missing, the pipeline says so
  in the place where it matters.
- **Cost:** builds fail when configuration is incomplete, and the team cursed it
  for a week. Availability of the pipeline is now bounded by the correctness of
  every service's config.
- **Cost nobody budgeted for:** every false-positive block spends the trust the
  gate was built to earn, so a blocked release that turns out to be a scanner
  bug is not a free event. The rule is enforced, and the enforcement is watched.
