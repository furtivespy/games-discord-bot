# Feature Map notes

Hand-written companion to the generated `INDEX.md`. One section per slash command.

- **Seed**: what state the command needs before it can do anything useful.
- **Reach**: how to run it with `bun run control execute <fixture>`. Fixtures get `ctx.run`, `ctx.session`, `ctx.game.*` and `ctx.stubs.*` (see `scripts/control-fixtures/`). Anything `execute` cannot prove (real Discord rendering, permissions, buttons, network) belongs in a PR's "For you to test".

`bun run control map --check` fails when a command has no section here, a section has no Seed or Reach line, or a `/command subcommand` reference names a subcommand that does not exist. Keep sections short; update them in the same PR that changes the command.

Common recipes:

- **Game commands** need an active game in the channel: `ctx.session({ gameData: ctx.game.createActiveGame({ players, decks }) })`, then `session.run("cards", { subcommandGroup: "deck", subcommand: "draw" })`. The session carries the saved game from one run to the next.
- **Guild-wide data** (`client.getGuildData`/`setGuildData`): pass `clientExtras: ctx.stubs.guildStore({ customDice: [] })`.
- **Per-user maps** (`client.userPreferences`, `client.reminders`): pass `clientExtras: { userPreferences: ctx.stubs.mapStore() }`.
- **BoardGameGeek**: `ctx.harness.withBggStub({ ... }, run)` replaces the network lookups.

## /bgg

BoardGameGeek lookup by name, with autocomplete.

- Seed: none. Needs `client.config` (BGG settings) and the BoardGameGeek client.
- Reach: wrap the run in `ctx.harness.withBggStub`. Real BGG responses are network; see `test/bgg-autocomplete.test.js` for the stub shape.

## /cards

Deck, hand, draft, pile, play area, game board and deck-builder actions for the channel's game.

- Seed: an active game with at least one deck (`createDeck`) and players (`createPlayer`). Most subcommands read the deck named by the optional `deck` option and default to the only deck.
- Reach: `scripts/control-fixtures/cards-draw.js` runs `/cards deck draw` then `/cards deck peek`. Hand actions such as `/cards hand play` need cards in the player's `hands.main`. Interactive pickers (select menus, buttons) show up as component rows in the output; clicking them is not simulated.

## /catalog

Bot Owner tools for the shared deck catalog: list, show, publish, enable and disable decks.

- Seed: catalog rows in the bot-wide store; `publish` also needs a game with a deck.
- Reach: `test/catalog-commands.test.js` shows how the catalog store is seeded. Bot Owner gating is checked against `client.config.botOwnerId`.

## /choose

Pick randomly from a comma-separated list. It first asks how many to pick.

- Seed: none.
- Reach: `ctx.run("choose", { strings: { options: "a, b, c" } })` replies with the "how many" button rows. Clicking them is not simulated, so the final pick is for you to test.

## /config

Administrator settings for the server: games channel, winner portraits, and showing the current values.

- Seed: none; writes per-guild config through `modules/GuildConfig`.
- Reach: `test/guild-config.test.js` and `test/qa-unlock.test.js` cover it. Permission checks (Administrator) are enforced by Discord, so verify those by hand.

## /diagnostic

Bot Owner diagnostic report of the database and settings stores.

- Seed: the real `client.db` and `client.settings`, which the fake client does not have.
- Reach: not reachable with `execute` today. Add `clientExtras: { db, settings }` stubs if a change needs it.

## /dice

Server-wide and per-game custom dice: add, remove and list.

- Seed: guild data with a `customDice` array. Per-game dice need an active game.
- Reach: `scripts/control-fixtures/dice.js` adds a server die and lists it. `sides` is a comma-separated string, not a number.

## /game

Create, advance, inspect and finish games: new game, next and reverse turn, status, winner, history, links and images.

- Seed: `newgame` needs none; every other subcommand needs an active game.
- Reach: `ctx.session({ gameData: ctx.game.createActiveGame() })`, then `session.run("game", { subcommand: "status" })`. Winner portraits use canvas, which the control preload stubs, so image output is not checked.

## /help

Help topics built from `modules/helpCatalog`.

- Seed: none.
- Reach: `ctx.run("help", { strings: { topic: "cards" } })`.

## /lfg

Looking-for-group post for a game, with BGG autocomplete and an interest button.

- Seed: none. Uses BoardGameGeek and `modules/GatherInterest`.
- Reach: `test/gather-interest.test.js` covers the interest flow; use `withBggStub` for game lookups. Button clicks are not simulated by `execute`.

## /migrate

Bot Owner migration of the deck catalog.

- Seed: legacy deck data in the store being migrated; see ADR 0001 before changing what it moves.
- Reach: covered by the catalog migration tests. Do not run against real data without an approved migration plan.

## /money

Per-player money in a game: check, deal, pay, spend, take and reveal.

- Seed: an active game with players.
- Reach: `session.run("money", { subcommand: "deal", integers: { amount: 5 } })` on a game from `createActiveGame`.

## /players

Manage players in a game: add, remove, set first, colors and scores.

- Seed: an active game.
- Reach: `session.run("players", { subcommand: "score", strings: { score: "3" } })` and read `session.game.players`. `score` is a string option.

## /releasenotes

Fetch release notes from GitHub.

- Seed: none.
- Reach: network (`fetch` to api.github.com). A fixture can swap `globalThis.fetch` for the run; otherwise leave it for "For you to test".

## /reminder

Set a reminder in natural language such as "in 2 hours".

- Seed: the user's timezone in `client.userPreferences` (see `/timezone`).
- Reach: `clientExtras: { userPreferences: ctx.stubs.mapStore(), reminders: ctx.stubs.mapStore() }`; read `reminders.entries()` afterwards. Delivery at the due time happens in the bot's scheduler, not here.

## /roll

Roll dice such as `2d6` or `d20+5`.

- Seed: none.
- Reach: `scripts/control-fixtures/roll.js`. The optional image lookup uses `client.googleClient`, which the harness stubs.

## /rollcust

Roll a custom die defined with `/dice`.

- Seed: a die created with `/dice add`, in guild or game data.
- Reach: run `/dice add` and `/rollcust` in one session sharing the same `guildStore`.

## /rules

Answer a rules question using BGG data and Google Gemini.

- Seed: none required. An active game with a `bggGameId` adds BGG context to the prompt.
- Reach: `test/rules-command.test.js` stubs the model. The real model answer is for you to test.

## /secret

Hidden notes per player in a game: add, check, reveal and anonymous reveal.

- Seed: an active game with players.
- Reach: `session.run("secret", { subcommand: "add", strings: { secret: "x" } })`, then `check` as another user.

## /settings

Bot Owner runtime settings, edited in `client.config`.

- Seed: `client.config.botOwnerId` matching the caller.
- Reach: `ctx.run("settings", { strings: { setting: "..." } })`. Owner gating depends on config, so test the denied path too.

## /suggest

Global suggestions: add, list, vote and set status.

- Seed: none. Suggestions are stored bot-wide under the `global` scope, not per guild; see ADR 0001 before changing that.
- Reach: `test/suggestions-global-store.test.js` shows the store setup.

## /team

Team play: roster, colors, join and randomize.

- Seed: an active game with players.
- Reach: `session.run("team", { subcommand: "randomize" })` replies "No teams exist" until the game has teams; seed `teams` on the game or run `/team roster` first.

## /timezone

Set the caller's timezone for reminders.

- Seed: none.
- Reach: `scripts/control-fixtures/timezone.js`. Invalid names are rejected with a reply, which a second run can assert.

## /tokens

Named tokens per game and player: create, gain, lose, give, take and reveal.

- Seed: an active game with players.
- Reach: `session.run("tokens", { subcommand: "create", strings: { name: "gold" } })`, then `gain`.

## /visual

Launch the embedded Activity for a channel.

- Seed: none.
- Reach: the command reply is covered by `test/visual-command.test.js`. To see the Activity itself, use `bun run control browse`. Team grouping: `bun run control browse --path '/?fixture=team-game&game=team-thread'`.

## /winshare

Share a game's winner and portrait to another channel.

- Seed: a game with a `winner` in the channel named by the `gamechannel` option.
- Reach: `test/winshare-command.test.js` and `test/winner-portrait.test.js`. Portrait rendering is stubbed under the control preload.

## /yahtzee

Roll Yahtzee dice.

- Seed: none.
- Reach: `ctx.run("yahtzee", { integers: { dice: 5 } })`.
