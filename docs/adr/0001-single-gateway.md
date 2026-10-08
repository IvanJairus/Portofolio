# 0001. One gateway include, not per-repo templates

Status: accepted (2024)

## Context

Every service repository in the domain needs the same delivery pipeline: build,
scan, gate, deploy to SIT, promote, deploy to PROD. Fifty-plus repositories need
it, across five artifact types, on two CI engines, and the standard is owned by a
team of four that cannot afford to chase 40 YAML files every time a scanner
version changes.

## Decision

Pipeline definitions live in one repository group, not in the source
repositories. Most services carry no CI file at all: the release board resolves
the service, the gateway runs its stage set, and a service map of 53 entries
decides what that stage set is. Where a repository is GitLab-native and wants
its own pipeline, it attaches with a four-line `include` pointing at the same
gateway. The standard - 52 rules - lives in the shared library and is versioned
with the same pipeline that enforces it.

## Alternatives rejected

- **Copy-paste a template into each repository.** Rejected because drift is
  guaranteed: the template is copied once and never re-synced, and the only way
  to find the divergence is to diff every repo's copy by hand.
- **Per-repo overrides as the default escape hatch.** Rejected because an
  override nobody can see is how a standard becomes folklore. Overrides exist,
  but they are declared in the service map, so an exception reads as an
  exception.

## Consequences

- A gate change or a fix lands once and reaches every repository the same day.
- Onboarding a service is a service-map entry, not a fork of a template.
- **Cost, and it is the real one:** the gateway is critical path. One bad merge
  to it reaches all 53 services at once. Mitigated by running the gateway through
  the same gates it enforces on others, and by keeping the include surface small
  enough that a service owner can read it.
- A second cost: teams blame the gateway rather than their own config, so
  debugging starts with "what does the service declare" and that is a process
  tax paid every week.
