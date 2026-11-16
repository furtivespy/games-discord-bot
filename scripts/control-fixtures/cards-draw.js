"use strict";

// A game command: seed an active game with a deck, draw a card, then peek.
// The session keeps the channel's game between the two runs.
module.exports = async (ctx) => {
  const { createActiveGame, createPlayer, createCard, createDeck } = ctx.game;
  const session = ctx.session({
    gameData: createActiveGame({
      players: [createPlayer({ userId: "user-1", name: "Alice", order: 1 })],
      decks: [
        createDeck({
          name: "Main",
          draw: [createCard({ id: "ace", name: "Ace" }), createCard({ id: "king", name: "King" })],
        }),
      ],
    }),
  });
  await session.run("cards", { subcommandGroup: "deck", subcommand: "draw" });
  await session.run("cards", { subcommandGroup: "deck", subcommand: "peek" });
  return { handCount: session.game.players[0]?.hands?.main?.length };
};
