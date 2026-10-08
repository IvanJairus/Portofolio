# Architecture decision records

Five decisions from the delivery platform described on [the site](https://portofolio-six-delta-18.vercel.app),
written down as ADRs. They are the same decisions the "Decisions and what they
cost" section makes, in the form a reviewer can hold me to: context, decision,
what I rejected, what it costs, and status.

Numbers inside are the published, sanitized ones. Anything that could identify
an employer system is deliberately absent.

| # | Title | Status |
|---|---|---|
| [0001](0001-single-gateway.md) | One gateway include, not per-repo templates | Accepted |
| [0002](0002-fail-closed-gates.md) | Gates fail closed | Accepted |
| [0003](0003-two-ci-engines-one-contract.md) | Two CI engines, one stage contract | Accepted |
| [0004](0004-state-lives-in-the-ticket.md) | No database, no queue, no auto-merge | Accepted |
| [0005](0005-bespoke-control-plane.md) | Built the control plane, did not buy one | Accepted, with an exit condition |

Written 2026-10-08. These are reconstructions of decisions already made, not a
decision log kept during the work - which is itself a gap worth naming: the
original reasoning lived in tickets and in my head, and the cost of that is that
some dates and alternatives below are approximate.
