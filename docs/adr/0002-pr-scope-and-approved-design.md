# 0002: A PR does not add behavior beyond the approved design

Status: accepted
Date: 2026-11-15

## Decision

Do not add product behavior that the approved design (the Linear issue or
design doc) does not describe. Get confirmation first.

Keep required storage migrations in their own PR, separate from optional UX or
behavior changes such as duplicate-submit handling, vote merging, or DM
support.

## Why

Users and the owner review one thing per PR. A migration that rides along with
a behavior change cannot be rolled back or reviewed on its own, and an agent
that "improves" scope on its own produces behavior nobody asked for.

## Revisit if

- most PRs are small enough that the QA review reliably catches out-of-scope
  behavior without a rule.
