# Merge policy

How a pull request gets from "agent opened it" to "merged and running".

## Gates

Required on `master` (ruleset `protect master`): `test` and `lint`
(`.github/workflows/test.yml`). Together they are `bun run verify`.

An agent may merge a PR (`ship-pr --merge`, see
`.agents/skills/ship-pr/SKILL.md`) only when **all** of these hold:

1. `test` and `lint` are green.
2. The PR's **QA Status** block says `Verdict: PASS` and its `Head` equals the
   PR's current head SHA. A new commit makes an old PASS stale.
3. `For you to test` is `none`.
4. The risk tier is **low** or **medium** (below).

The Cursor QA review is not a GitHub check, so GitHub cannot require it. The
`ship-pr` loop enforces rules 2 and 3 instead.

## Risk tiers

**High: a human merges.** Any of:

- touches `db/` or `scripts/migrate*`;
- touches `Dockerfile` or anything under `.github/workflows/`;
- touches the rules that decide merging, so an agent cannot loosen its own gate:
  `.github/ship-pr.json`, `.agents/skills/ship-pr/`, `scripts/pr-risk.js`,
  `docs/merge-policy.md`, or anything under `docs/adr/`;
- changes a slash-command contract: a command or option name, an option type,
  or `permLevel`;
- carries the `major` label;
- `User call-out` is not `none` (users need it explained, for example release
  notes or a changed behavior);
- falls under [ADR 0003](adr/0003-agent-defaults-to-no.md) and the task did not
  explicitly ask for it.

The path rules above are checked in code: `gh pr diff <n> --name-only | node scripts/pr-risk.js`
prints `high` when any changed file is on the list. The other rules need judgement.
Anyone may *propose* a change to these files in a PR; the point is that a person,
not the ship loop, merges it.

**Medium:** new or changed user-facing behavior that is not high (`minor`
label, a new command or subcommand, changed command output).

**Low:** everything else (`patch`: fixes, refactors, tests, docs, dependency
bumps that are not a major version).

## Container test builds

Merging to `master` builds the image once, in `release.yml`, and tags it
`vX.Y.Z` and `latest`. The host pulls `latest` about every 5 minutes.

To test a branch image, add the `container-testing` label to the PR. It builds
`pr-<number>` and the head short SHA on every push while the label is on. It
never touches `latest`.

## After merge

`release.yml` runs `scripts/check-deployed-version.js`, which polls
`https://gamebot.willsullivan.dev/health` until it reports the merge commit (or
a newer commit that contains it). It gives up after 20 minutes and fails the
run; that does not roll anything back. See
[the rollback runbook](runbooks/rollback.md).
