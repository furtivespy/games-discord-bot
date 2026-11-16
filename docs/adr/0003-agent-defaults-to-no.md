# 0003: Agents default to "no" on these changes

Status: accepted
Date: 2026-11-15

## Decision

Never add a paid service (hosted API, SaaS, paid tier) or a new recurring cost.
This is not a judgement call.

Do the following only when the task or Linear issue explicitly asks for it. Without
that, stop and ask:

- rename a slash command or change its options (a user-facing break);
- change Discord permissions or gateway intents;
- change the Docker image layout, the `/data` volume, or where data is stored;
- change the release or tag workflow (`.github/workflows/release.yml`);
- anything users would need explained or called out (release notes).

An explicit request in the task is the approval. A PR that does one of these
is high risk and a human merges it (see
[merge policy](../merge-policy.md)).

## Why

These changes break users, cost money, or are hard to undo. Each one is easy
for an agent to propose and expensive to reverse. Asking first is cheap.

## Revisit if

- one of these becomes routine and low risk (for example a release workflow
  that is fully covered by tests);
- the bot gains a budget for paid services.
