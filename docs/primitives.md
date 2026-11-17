# Primitives

The shared pieces of this codebase and which decisions constrain them. Read the entry before changing a primitive; if you add one, add an entry.

Each entry lists its code roots and the ADRs that apply. ADRs live in [docs/adr/](adr/).

## Game state

Per-channel game documents (players, decks, piles, tokens, history), saved to SQLite.

- Code: `db/anygame.js` (defaults and schema), `db/gameStore.js` and `db/db.js` (storage), `modules/GlobalGameHelper.js`, `client.getGameDataV2` / `setGameDataV2` in `DiscordBot.js`
- ADRs: [0001](adr/0001-data-scope-changes-need-migration.md)
- Notes: the same store holds bot-wide data under the `global` scope (suggestions, deck catalog). Changing a record's scope needs a migration.

## Slash commands

Command classes under `slashcommands/<group>/`, with subcommand handlers under `subcommands/<dir>/`.

- Code: `slashcommands/`, `subcommands/`, `base/SlashCommand.js`, `modules/helpCatalog.js`
- ADRs: [0002](adr/0002-pr-scope-and-approved-design.md), [0003](adr/0003-agent-defaults-to-no.md)
- Notes: renaming a command or option changes the user contract, which is a "hesitate" item. The generated [Feature Map](feature-map/INDEX.md) lists every command, its subcommands, handlers, and tests.

## Deck catalog

Shared, publishable decks that games can start from.

- Code: `db/deckCatalog.js`, `db/catalogDecks.js`, `db/catalogPublish.js`, `db/seedDeckCatalog.js`, `slashcommands/genericgame/catalog.js`, `slashcommands/util/migrate.js`
- ADRs: [0001](adr/0001-data-scope-changes-need-migration.md)

## Shared game logic

Pure game-document mutations used by both slash/chat commands and visual mode.

- Code: `modules/gameLogic/playerScores.js`, `modules/gameLogic/cardMoves.js`
- ADRs: [0002](adr/0002-pr-scope-and-approved-design.md)
- Notes: slash handlers and `modules/embeddedActions.js` are adapters (load/save, Discord UX, Activity HTTP). Put new shared mutations here rather than duplicating them in a command and the Activity.

## Embedded Activity

The Discord Activity (visual mode): an Express server and a Vite client.

- Code: `modules/embeddedApp.js` (server, `/health`), `embedded-client/` (client), `scripts/embedded-app-mock.js` (mock mode)
- ADRs: [0003](adr/0003-agent-defaults-to-no.md)
- Notes: `bun run control browse` screenshots the mock. Real Discord auth and the Activity iframe are not covered.

## Release pipeline

Merge to `master` tags a version, builds one Docker image, and pushes it; the host pulls `latest`.

- Code: `.github/workflows/`, `Dockerfile`, `scripts/check-deployed-version.js`
- ADRs: [0003](adr/0003-agent-defaults-to-no.md)
- Notes: workflow, Dockerfile, and `/data` layout changes are high risk and need a human merge. See [merge-policy](merge-policy.md) and the [rollback runbook](runbooks/rollback.md).

## Verification harness

Fake Discord interaction and client used by tests and `bun run control execute`.

- Code: `test/helpers/harness.js`, `test/helpers/preload.js`, `scripts/control/`, `scripts/control-fixtures/`
- ADRs: none
- Notes: a fake, not Discord. See `.agents/skills/control-gamebot/SKILL.md` for what it cannot prove.
