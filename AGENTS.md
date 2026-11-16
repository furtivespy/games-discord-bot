# Agent Guidance

A Discord bot for board and card games (Bun, discord.js, SQLite) with an
embedded Discord Activity client in `embedded-client/`. Agents open most PRs;
the owner owns product decisions.

## Verify

`bun run verify` is the one local gate: Biome lint, `bun test`, and the
embedded-client build. CI runs the same three steps as the `lint` and `test`
jobs. Run it before you push. `bun run hooks:install` (once per clone) makes
`git push` run the lint step first.

## Map

- Merging, risk tiers, the QA Status block: [docs/merge-policy.md](docs/merge-policy.md)
- Shipping a PR: [.agents/skills/ship-pr/SKILL.md](.agents/skills/ship-pr/SKILL.md)
- Decisions to read before proposing big changes: [docs/adr/](docs/adr/)
- Rolling back a release: [docs/runbooks/rollback.md](docs/runbooks/rollback.md)

## Linear

This repo's Linear project is **Game Bot** (team **Furtivespy**, key `FUR`).

- **Project name:** Game Bot
- **Project ID:** `25f57271-2db4-4e27-aa45-f40219aa5bb6`
- **URL:** https://linear.app/furtivespy/project/game-bot-3db2f0748b50

When the user mentions Linear, issues, or project tracking for this codebase, scope work to the Game Bot project unless they say otherwise.

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
