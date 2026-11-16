---
name: control-gamebot
description:
  Verify a change to this Discord bot yourself before asking a human. Use when
  you changed a slash command, game logic, or the embedded Activity and need to
  run it, look at it, or check the machine and deploy state.
---

# control-gamebot

`bun run control <command>` runs the bot's own code without Discord. Add
`--json` to any command for machine-readable output. Exit 0 means success, 1
means a check failed, 2 means the call was wrong.

Start with `bun run control doctor`. If it fails, fix that first: a stale
`node_modules` or a local `.env` makes results untrustworthy.

## Pick the command

| You need to... | Run |
| --- | --- |
| Find what a command does, what it needs, and what already tests it | `bun run control map <command>` |
| See what a slash command replies and saves | `bun run control execute <fixture.js>` |
| Look at the embedded Activity | `bun run control browse [--path "/?fixture=no-games"]` |
| Keep the mock Activity running while you work | `bun run control dev` (`--stop` to end) |
| Check which commit production is serving | `bun run control health [--sha <commit>] [--wait]` |
| Check the Feature Map is current | `bun run control map --check` |

## Run a slash command

1. `bun run control map <command>` shows the generated entry plus the hand-written
   **Seed** (state it needs) and **Reach** (how to run it) notes.
2. Copy the closest file in `scripts/control-fixtures/` and change it. A fixture
   exports `async (ctx) => { ... }`:
   - `ctx.run("roll", { strings: { dice: "2d6" } })` for a command with no state.
   - `ctx.session({ gameData })` keeps the channel's game between runs, so you can
     set up a game, run one command, then run another against the result.
   - Option keys: `subcommandGroup`, `subcommand`, `strings`, `integers`,
     `booleans`, `users`, `channels`.
   - `clientExtras` adds client members the fake client lacks:
     `ctx.stubs.guildStore({...})` for guild data, `ctx.stubs.mapStore()` for
     `userPreferences` or `reminders`.
3. `bun run control execute scripts/control-fixtures/<name>.js [--contains "text"]`.

Read the output for three things: the reply text, the number of game saves, and
any `LOGGED ERROR` lines. Most commands catch their own errors and reply with a
generic message, so a green-looking reply can hide a failure; `execute` exits 1
when a command logged an error.

For a change you are making, also add a regression test under `test/` using the
same harness (`test/helpers/harness.js`). Fixtures are for looking; tests are for
keeping.

## What `execute` cannot prove

It uses a fake interaction with SQLite in a temp directory and stubs canvas and
`GameFormatter`. It cannot show how Discord renders embeds, whether buttons and
select menus work when clicked, Discord permissions and intents, real BGG, GitHub,
or Gemini responses, or timers (reminders firing). List those under "For you to
test" in the PR instead of claiming them verified.

## Keep the map current

When you add, rename, or remove a slash command or subcommand:

1. Update `docs/feature-map/notes.md` (a `## /command` section with `- Seed:` and
   `- Reach:` lines).
2. Run `bun run control map --write`, then `bun run control map --check`.

`bun test` fails when the map drifts, so CI catches a skipped step.

## Output location

Screenshots and the mock server log go to `tmp/control-gamebot/` (not committed).
Attach a screenshot to the PR when the change is visual.
