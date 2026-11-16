"use strict";

// Per-user preferences live in client.userPreferences (an Enmap in the bot).
// Give the fake client an in-memory stand-in and check what was stored.
module.exports = async (ctx) => {
  const userPreferences = ctx.stubs.mapStore();
  await ctx.run("timezone", {
    strings: { timezone: "America/New_York" },
    clientExtras: { userPreferences },
  });
  return { stored: userPreferences.entries() };
};
