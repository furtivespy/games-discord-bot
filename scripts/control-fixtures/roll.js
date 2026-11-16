"use strict";

// A command with no stored state: roll two dice and read the reply.
module.exports = async (ctx) => {
  await ctx.run("roll", { strings: { dice: "2d6" } });
};
