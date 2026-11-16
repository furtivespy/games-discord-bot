"use strict";

// A command that needs more than game data: /dice reads and writes guild-wide
// data, so give the fake client an in-memory guild store.
module.exports = async (ctx) => {
  const clientExtras = ctx.stubs.guildStore({ customDice: [] });
  const session = ctx.session({
    gameData: ctx.game.createActiveGame(),
    clientExtras,
  });
  await session.run("dice", {
    subcommand: "add",
    strings: { name: "loaded", sides: "1,2,3,4,5,6,7,8" },
    booleans: { is_server: true },
  });
  await session.run("dice", { subcommand: "list" });
};
