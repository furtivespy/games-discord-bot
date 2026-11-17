# Agent Guidance

A Discord bot for board and card games (Bun, discord.js, SQLite) with an
embedded Discord Activity client in `embedded-client/`. Agents open most PRs;
the owner owns product decisions.

## Verify

`bun run verify` is the one local gate: Biome lint, `bun test`, and the
embedded-client build. CI runs the same three steps as the `lint` and `test`
jobs. Run it before you push. `bun run hooks:install` (once per clone) makes
`git push` run the lint step first.

Beyond tests, `bun run control` lets you run and look at your change yourself
(`doctor`, `map`, `execute`, `browse`, `dev`, `health`). Start with
[.agents/skills/control-gamebot/SKILL.md](.agents/skills/control-gamebot/SKILL.md).
Anything it cannot prove (real Discord rendering, clicks, permissions, network
services) goes under "For you to test" in the PR.

## Map

- Slash commands, what each needs, and how to run it: [docs/feature-map/INDEX.md](docs/feature-map/INDEX.md) and [notes.md](docs/feature-map/notes.md) (`bun run control map <command>`). Update `notes.md` and run `bun run control map --write` when you add, rename, or remove a command or subcommand.
- Shared pieces and the ADRs that constrain them: [docs/primitives.md](docs/primitives.md)
- Merging, risk tiers, the QA Status block: [docs/merge-policy.md](docs/merge-policy.md)
- Shipping a PR: [.agents/skills/ship-pr/SKILL.md](.agents/skills/ship-pr/SKILL.md)
- Filing friction (repo papercuts) in Linear: [.agents/skills/friction-log/SKILL.md](.agents/skills/friction-log/SKILL.md)
- Scheduled cleanup agents and their prompts: [docs/cleanup-automations.md](docs/cleanup-automations.md)
- Decisions to read before proposing big changes: [docs/adr/](docs/adr/)
- Rolling back a release: [docs/runbooks/rollback.md](docs/runbooks/rollback.md)

## Linear

This repo's Linear project is **Game Bot** (team **Furtivespy**, key `FUR`).

- **Project name:** Game Bot
- **Project ID:** `25f57271-2db4-4e27-aa45-f40219aa5bb6`
- **URL:** https://linear.app/furtivespy/project/game-bot-3db2f0748b50

When the user mentions Linear, issues, or project tracking for this codebase, scope work to the Game Bot project unless they say otherwise.

## Cleanup tickets

If your PR leaves something that should be removed later, file a `Cleanup:` issue
before you finish, and link it in the PR's Cleanup section. Examples: a
compatibility shim, an old code path kept during a rollout, old records preserved
by a migration (see below), a flag past its removal date. Nothing left behind?
Write `none`.

Create it in Linear (team Furtivespy, project Game Bot) from the **Cleanup**
template, with label `cleanup`. Fill every section:

- **What to clean up:** one thing, naming the files.
- **Why it is safe:** what proves nothing depends on it.
- **Ready when:** a check anyone can run that is true exactly when the cleanup is
  safe to do now, for example "`rg legacyFoo` finds no callers outside
  `modules/legacyFoo.js`". If you cannot write one, it is not ready; say what
  you would need to know and add `needs-decision`.
- **Door:** `two-way` or `one-way`. Deleting stored data is one-way: add
  `needs-decision`, because the weekly legacy reaper does not do those alone.

Use a priority; Low is the default. See `docs/cleanup-automations.md` for what the
weekly reaper will and will not do with these.

## Data migrations

- Do not change data scope (for example, guild- or channel-scoped data to bot-wide data) without an explicit migration path.
- Preserve old records as backups unless deletion is explicitly approved.
- Migration defaults must not silently overwrite or delete scoped records.
- Make consolidation idempotent: re-running it should produce the same global result.
- Define duplicate precedence before coding. Preserve the existing global record unless the user specifies another rule.
- Keep migration work out of normal command and autocomplete paths. Commands should read only their final storage location.
- Test migrations with multiple source records, duplicate IDs, an existing global record, and retained old rows.

## Pull request scope

- Do not add product behavior beyond an approved design without first getting confirmation.
- Keep required storage migrations separate from optional UX or behavior changes, such as duplicate-submit behavior, vote merging, or DM support.
