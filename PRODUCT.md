# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Discord users who play asynchronous board games run by a host. Players take turns on their own time, in the Discord server where the table lives. The host runs the table: starts games, manages players and turns, and keeps the session moving.

## Product Purpose
A Discord bot that runs asynchronous tabletop and card games inside the server where people already chat. It holds game state, turns, hands, decks, and boards, and gives players a shared visual table through a Discord Activity. Success means asynchronous games still feel social and friendly, like a live game night, even when players take turns hours or days apart.

## Positioning
Closest to Board Game Arena, but built around the chat where the players already talk. It is more capable than a dice or card-draw bot: it runs full game sessions with turn order, hands, decks, scores, and a shared table. The chat stays the social center of the game; the bot does not replace it.

## Operating Context
- Games run in Discord server channels and threads. The host opens a game, players join, and the bot posts turn notices and status.
- `/lfg` gathers interest in a game and can start a play thread in a configured games channel.
- Players use slash commands (`/game`, `/cards`) and the embedded Discord Activity to view the shared table, their hand, and the play area.
- Card sets come from a shared catalog (`/catalog`), so one server can publish sets that other games use.

## Capabilities and Constraints
- Up to 8 players per game.
- Game state is stored per server in SQLite. Turn order, scores, hands, decks, and boards are tracked per game.
- The Discord Activity runs inside Discord's content security policy. Card art is served through a signed bot proxy, not loaded from its original host.
- Built to be extensible and to support many different games. It must not be shaped around one game's rules. The Inis rules are one existing set, not the default.
- Integrates with BoardGameGeek for game lookup.
- Undecided: which games beyond Inis are planned first.

## Evidence on Hand
- Working slash commands for game sessions, cards, `/lfg`, `/bgg`, `/config`, and `/catalog`.
- Embedded Discord Activity client in `embedded-client/`, with a mock mode and fixture game states for screenshots outside Discord (`embedded-client/src/mockFixtures.ts`).
- Mock table artwork in `embedded-client/public/` (card back, host setup, host reference).
- No customer, testimonial, or benchmark evidence is recorded here.

## Product Principles
- Keep the table social: chat and the host stay central, and the bot supports the conversation rather than replacing it.
- Stay game-agnostic: the core handles sessions, turns, and shared state, and game-specific rules plug in without prescribing one design.
- Make asynchronous play feel live: turn notices and visible table state should make a delayed turn feel like part of an ongoing game night.
- Give the host control: the host runs the table and decides how the session moves.
