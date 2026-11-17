# Cleanup automations

Scheduled [Cursor Automations](https://cursor.com/docs/cloud-agent/automations.md) that open small PRs from the backlog. Automations are configured in the Cursor UI (`cursor.com/automations`), so this file is the versioned source of truth: change the prompt here first, then paste it into the automation.

Two exist today: the daily friction sweep and the daily docs freshness check. The weekly legacy reaper comes later.

## Rules every automation follows

- One PR per run, or none when there is nothing to do.
- It opens PRs; it never merges, approves, or force-pushes. A person runs the `ship-pr` loop ([skill](../.agents/skills/ship-pr/SKILL.md)) on each PR. Merging stays manual for now.
- It follows [AGENTS.md](../AGENTS.md), the [ADRs](adr/), and [merge-policy](merge-policy.md): default to "no" on the hesitate list, no change to data scope without a migration path, no behavior beyond the issue.
- `bun run verify` passes before it opens the PR.
- It does not edit: `.github/`, `Dockerfile`, `db/`, `scripts/migrate*`, `docs/adr/`, `docs/merge-policy.md`, `.agents/skills/ship-pr/`, `.cursor/`. A fix that needs one of these becomes a `needs-decision` issue instead.

The VM is prepared by [`.cursor/environment.json`](../.cursor/environment.json), which runs [`scripts/cloud-agent-install.sh`](../scripts/cloud-agent-install.sh): Bun at the pinned version, the native libraries `canvas` needs, and `bun install --frozen-lockfile`. Keep that script in step with `.github/workflows/test.yml`.

## Daily friction sweep

Fixes open `friction` issues, highest priority first: up to three per run, in one PR with one commit per issue. How friction is filed and ranked: [friction-log skill](../.agents/skills/friction-log/SKILL.md).

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
You are the daily friction sweep for the furtivespy/games-discord-bot repo. You fix at most three friction issues per run, all in one PR with one commit per issue. You open at most one PR.

Read first: AGENTS.md, docs/merge-policy.md, every file in docs/adr/, docs/cleanup-automations.md, and .agents/skills/friction-log/SKILL.md. Their rules bind you.

1. Find work. Using the Linear tools, list open issues in team Furtivespy, project Game Bot, with label `friction`, excluding any that also have `needs-decision` or `friction-skipped`. Order by Linear priority (Urgent, High, Medium, Low, then no priority), and by oldest first within a priority. If the list is empty, stop. Do not comment, do not open a PR.

2. Work the list in order. For each issue, read it and its comments, then reproduce it on the current default branch. If it no longer reproduces, comment what you checked and move its status to Done (already fixed) or Canceled (not valid), then continue with the next issue.

3. Decide whether you may fix it. Do NOT fix it if any of these is true:
   - It needs a product or design decision.
   - The fix changes a slash command name or option, Discord permissions or intents, the Docker image or /data layout, the release workflow, or adds a paid service.
   - The fix changes where data is stored or its scope (ADR 0001).
   - The fix needs a file you must not edit (see "It does not edit" in docs/cleanup-automations.md).
   - It is unclear, cannot be reproduced and still seems real, or needs more than one focused PR.
   In those cases add the label `friction-skipped`, add `needs-decision` as well when the owner must choose, and comment in one or two sentences why. Then continue with the next issue.

4. Fix the cause, not the symptom, with the smallest change, one commit per issue (message `FUR-<n>: <what changed>`). Add or update a test when behavior changes. Never weaken, skip, or delete a test to make it pass. Run `bun run verify` after each commit; it must pass. If an issue's fix cannot be made to pass quickly, drop that commit, comment what failed on the issue, add `friction-skipped`, and continue.

5. Stop adding issues when any of these is true:
   - You have fixed three.
   - You have looked at eight issues in this run (fixed, skipped, or closed).
   - Another fix would make the PR hard to review, or would touch a different area than the commits already in it.
   Keep it to small, low-risk fixes; a PR with several issues is only as safe as its riskiest commit.

6. If you made at least one commit, open one PR from a branch named `friction/fur-<n>-<short-slug>`, where `<n>` is the highest-priority issue in it:
   - Title: `FUR-<n>: <what changed>`. For several issues, list them: `FUR-<a>, FUR-<b>: <summary>`.
   - Body: the repo PR template. Fill Intent, Linear (one `Fixes FUR-<n>` line per issue), Door (two-way unless it is not), and Testing (the commands you ran and their result, and what you could not verify). Leave the QA Status block exactly as the template has it.
   - Label: `patch`, if you can set labels. If you cannot, say so at the top of Testing so the owner adds it; a PR without one of major, minor, or patch does not get released.
   - Comment on each Linear issue with the PR link.

7. Stop. Do not merge, approve, or request review from anyone.

Never put secrets, tokens, .env contents, or production Discord IDs in an issue, comment, or PR.
```

### Set up and try it

1. In Cursor settings, connect the Linear integration and add a Linear MCP server for your account.
2. Confirm the Cursor GitHub app is installed on `furtivespy/games-discord-bot`.
3. Create the automation with the settings above. Do not enable the schedule yet.
4. File one to three small real friction issues by following the friction-log skill.
5. Run the automation once by hand. Check that it picked them in priority order, made one commit per issue, ran `bun run verify`, opened one PR with the template filled in, and commented on each issue.
6. Enable the schedule.

### Shipping its PRs

Run the `ship-pr` loop on each PR the sweep opens, as for any other PR. A friction fix touching only code and tests is normally low or medium risk. A PR that covers several issues takes the risk tier of its riskiest commit; if one issue is high risk, ask the sweep (or do it by hand) to split it out. Check that the PR has a `patch` label before merging.

If a run fails before it opens a PR, look at the run in the Cursor automations page. A failing `install` step usually means `scripts/cloud-agent-install.sh` drifted from the CI workflow.

## Daily docs freshness

Fixes the docs that recent commits made stale. It does not rewrite style, add new docs, or delete anything. How the docs are organized: [AGENTS.md](../AGENTS.md).

### Automation settings

| Setting | Value |
| --- | --- |
| Name | `Docs freshness` |
| Trigger | Scheduled, daily (for example `30 13 * * *`, 30 minutes after the friction sweep) |
| Repository | `furtivespy/games-discord-bot` |
| Run as | Me |
| Tools | Pull request creation: on. Comment on pull request: on. Approvals: off. Computer use: off |
| MCP | None needed |
| Memories | Off |
| Access | Private |

### Prompt

```text
You are the daily docs freshness check for the furtivespy/games-discord-bot repo. You open at most one PR, and none when the docs are already right.

Read first: AGENTS.md, docs/merge-policy.md, every file in docs/adr/, and docs/cleanup-automations.md. Their rules bind you.

1. Look for work. List commits on the default branch from the last 24 hours (`git log --since="24 hours ago" --no-merges`). If there are none, stop: no PR, no comment.

2. For those commits, find docs that now say something untrue. Check these, in this order:
   - Run `bun run control map --check`. If it fails, fix docs/feature-map/notes.md for the commands and subcommands that changed (add, rename, or remove sections and Seed/Reach lines), then run `bun run control map --write` and `bun run control map --check` again. Describe a command only from its source and tests; read them, and use `bun run control execute` on a fixture when a Reach line needs proving.
   - docs/primitives.md: every path in a "Code:" line must exist, and an entry must match what the code now does. Fix paths and facts.
   - AGENTS.md and README.md: every file path, link, `bun run` script, and command they name must exist and still behave as described. Check scripts against package.json.
   - .agents/skills/control-gamebot/SKILL.md, .agents/skills/friction-log/SKILL.md, and docs/runbooks/: the commands and file names they cite must exist.
   Only fix a statement when a recent commit (or the checks above) shows it is wrong. Do not fix style, wording, or anything you merely find unclear.

3. Fix it with the smallest edit that makes it true. Keep each doc's voice and structure. Do not delete a doc, a section, or a skill, and do not add new docs. If a doc is stale in a way you cannot tell how to fix (the right behavior is a product decision), open nothing for it; instead add a short note to your PR body under "Needs a decision".

4. Do NOT edit: .github/, Dockerfile, db/, scripts/migrate*, scripts/pr-risk.js, docs/adr/, docs/merge-policy.md, .agents/skills/ship-pr/, .cursor/, docs/cleanup-automations.md. If one of those is stale, say so under "Needs a decision" in the PR body.

5. If you changed anything, run `bun run verify` (it must pass), then open one PR from a branch named `docs/freshness-<yyyy-mm-dd>`:
   - Title: `Docs freshness: <what changed>`. There is no Linear issue; leave the Linear section as "none (scheduled docs freshness)".
   - Body: the repo PR template. In Intent, list each fix and the commit that made it stale. Door: two-way. Testing: the commands you ran and their results. Leave the QA Status block exactly as the template has it.
   - Label: `patch`, if you can set labels. If you cannot, say so at the top of Testing so the owner adds it.
   - Keep the diff under 200 changed lines. If more is stale, fix the most recent and say so in the PR body.

6. Stop. Do not merge, approve, or request review from anyone.

Never put secrets, tokens, .env contents, or production Discord IDs in a PR.
```

### Set up and try it

1. Create the automation with the settings above. Do not enable the schedule yet.
2. Run it once by hand. If nothing merged in the last 24 hours it should stop without a PR; that is a correct result. To force a real check, run it right after merging a PR that added or changed a slash command or a script.
3. Check that the PR (if any) fixes only things a recent commit made stale, passes `bun run verify`, and leaves the merge-gate files alone.
4. Enable the schedule.

### Shipping its PRs

Docs-only PRs are normally low risk. If one lists items under "Needs a decision", handle those separately. Check that it has a `patch` label before merging. A PR that touches a merge-gate file is high risk by path and needs a human merge; the prompt tells the agent not to touch those files, so treat any such change as a bug in the prompt.