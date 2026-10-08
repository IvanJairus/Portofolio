# 0003. Two CI engines, one stage contract

Status: accepted (2024), ongoing

## Context

GitLab CI was the target platform. Twenty-nine pipelines still ran on Jenkins
with a Groovy shared library, and the teams that own them had release dates that
did not move because of a platform preference.

## Decision

Keep both engines running side by side, and define one stage contract per
artifact type - the names, inputs, outputs and pass conditions a stage must
satisfy. Each engine implements the contract in its own language: YAML and
Groovy on one side, a shared-library abstraction on the other. A service sees one
standard regardless of which engine runs it.

## Alternatives rejected

- **Big-bang migration to one engine.** Rejected: it converts a platform decision
  into 29 delivery risks at once, and the migration would have been the project,
  not the outcome.
- **Freeze the legacy engine and let it decay.** Rejected: decaying pipelines get
  bypassed, and a bypassed pipeline is where the findings come from.

## Consequences

- Legacy services keep shipping while the new standard arrives on their terms.
- Security scans and gates land on both engines simultaneously, so nothing has to
  wait for the migration to be protected.
- **Cost:** dual maintenance, plus the abstraction layer itself, which is
  invisible to every team and exists only to absorb this difference. It is
  genuinely more work, and it is the kind of work that is hard to justify in a
  roadmap review.
- The contract has to be versioned and tested twice, once per engine, or the
  abstraction becomes a lie.
