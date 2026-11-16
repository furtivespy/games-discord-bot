# Cleanup automations

Scheduled [Cursor Automations](https://cursor.com/docs/cloud-agent/automations.md) that open small PRs from the backlog. Automations are configured in the Cursor UI (`cursor.com/automations`), so this file is the versioned source of truth: change the prompt here first, then paste it into the automation.

Only the daily friction sweep exists today. Docs freshness and the weekly legacy reaper come later.

## Rules every automation follows

- One PR per run, or none when there is nothing to do.
- It opens PRs; it never merges, approves, or force-pushes. A person runs the `ship-pr` loop ([skill](../.agents/skills/ship-pr/SKILL.md)) on each PR. Merging stays manual for now.
- It follows [AGENTS.md](../AGENTS.md), the [ADRs](adr/), and [merge-policy](merge-policy.md): default to "no" on the hesitate list, no change to data scope without a migration path, no behavior beyond the issue.
- `bun run verify` passes before it opens the PR.
- It does not edit: `.github/`, `Dockerfile`, `db/`, `scripts/migrate*`, `docs/adr/`, `docs/merge-policy.md`, `.agents/skills/ship-pr/`, `.cursor/`. A fix that needs one of these becomes a `needs-decision` issue instead.

The VM is prepared by [`.cursor/environment.json`](../.cursor/environment.json), which runs [`scripts/cloud-agent-install.sh`](../scripts/cloud-agent-install.sh): Bun at the pinned version, the native libraries `canvas` needs, and `bun install --frozen-lockfile`. Keep that script in step with `.github/workflows/test.yml`.

## Daily friction sweep

Fixes open `friction` issues, highest priority first. How friction is filed and ranked: [friction-log skill](../.agents/skills/friction-log/SKILL.md).

### Automation settings

| Setting | Value |
| --- | --- |
| Name | `Friction sweep` |
| Trigger | Scheduled, daily (for example `0 13 * * *`, 8 AM Eastern) |
| Repository | `furtivespy/games-discord-bot` (cron triggers default to no repository; select it) |
| Run as | Me |
| Tools | Pull request creation: on. Comment on pull request: on. Approvals: off. Computer use: off |
| MCP | Linear (read and write issues and comments) |
| Memories | Off. The agent reads issue text that other agents wrote |
| Access | Private |

### Prompt

```text
You are the daily friction sweep for the furtivespy/games-discord-bot repo. You fix at most one friction issue per run and open at most one PR.

Read first: AGENTS.md, docs/merge-policy.md, every file in docs/adr/, docs/cleanup-automations.md, and .agents/skills/friction-log/SKILL.md. Their rules bind you.

1. Find work. Using the Linear tools, list open issues in team Furtivespy, project Game Bot, with label `friction`, excluding any that also have `needs-decision` or `friction-skipped`. Order by Linear priority (Urgent, High, Medium, Low, then no priority), and by oldest first within a priority. If the list is empty, stop. Do not comment, do not open a PR.

2. Take the first issue and read it and its comments. Reproduce it on the current default branch. If it no longer reproduces, comment what you checked and move its status to Done (already fixed) or Canceled (not valid), then continue with the next issue.

3. Decide whether you may fix it. Do NOT fix it if any of these is true:
   - It needs a product or design decision.
   - The fix changes a slash command name or option, Discord permissions or intents, the Docker image or /data layout, the release workflow, or adds a paid service.
   - The fix changes where data is stored or its scope (ADR 0001).
   - The fix needs a file you must not edit (see "It does not edit" in docs/cleanup-automations.md).
   - It is unclear, cannot be reproduced and still seems real, or needs more than one focused PR.
   In those cases add the label `friction-skipped`, add `needs-decision` as well when the owner must choose, and comment in one or two sentences why. Then continue with the next issue. Look at no more than 3 issues per run.

4. Fix the cause, not the symptom, with the smallest change. Add or update a test when behavior changes. Never weaken, skip, or delete a test to make it pass. Run `bun run verify`; it must pass.

5. Open one PR from a branch named `friction/fur-<n>-<short-slug>`:
   - Title: `FUR-<n>: <what changed>`.
   - Body: the repo PR template. Fill Intent, Linear (the issue), Door (two-way unless it is not), and Testing (the commands you ran and their result, and what you could not verify). Leave the QA Status block exactly as the template has it.
   - Label: `patch`, if you can set labels. If you cannot, say so at the top of Testing so the owner adds it; a PR without one of major, minor, or patch does not get released.
   - Comment on the Linear issue with the PR link.

6. Stop. Do not merge, approve, or request review from anyone.

Never put secrets, tokens, .env contents, or production Discord IDs in an issue, comment, or PR.
```

### Set up and try it

1. In Cursor settings, connect the Linear integration and add a Linear MCP server for your account.
2. Confirm the Cursor GitHub app is installed on `furtivespy/games-discord-bot`.
3. Create the automation with the settings above. Do not enable the schedule yet.
4. File a small real friction issue by following the friction-log skill.
5. Run the automation once by hand. Check that it picked that issue, ran `bun run verify`, opened a PR with the template filled in, and commented on the issue.
6. Enable the schedule.

### Shipping its PRs

Run the `ship-pr` loop on each PR the sweep opens, as for any other PR. A friction fix touching only code and tests is normally low or medium risk. Check that the PR has a `patch` label before merging.

If a run fails before it opens a PR, look at the run in the Cursor automations page. A failing `install` step usually means `scripts/cloud-agent-install.sh` drifted from the CI workflow.
