const { expect, test } = require("bun:test");
const Suggest = require("../slashcommands/info/suggestions.js");

test("/suggest add uses bot-wide storage", async () => {
  const getCalls = [];
  const setCalls = [];
  const client = {
    getGameDataV2: async (...args) => {
      getCalls.push(args);
      return { suggestions: [] };
    },
    setGameDataV2: async (...args) => setCalls.push(args),
    logger: { log: () => {} },
  };
  const command = new Suggest(client);
  const interaction = {
    guildId: "server-that-should-not-be-used",
    isAutocomplete: () => false,
    deferReply: async () => {},
    editReply: async () => {},
    options: {
      getSubcommand: () => "add",
      getString: (name) => (name === "suggestion" ? "Shared idea" : null),
      getInteger: () => null,
    },
    member: { displayName: "Test User" },
    user: { id: "user-id" },
    client: {
      users: {
        fetch: async () => ({ send: async () => {} }),
      },
    },
  };

  await command.execute(interaction);

  expect(getCalls).toEqual([["global", "suggest", "x"]]);
  expect(setCalls).toHaveLength(1);
  expect(setCalls[0].slice(0, 3)).toEqual(["global", "suggest", "x"]);
  expect(setCalls[0][3].suggestions[0]).toMatchObject({
    user: "Test User",
    userId: "user-id",
    suggestion: "Shared idea",
  });
});

test("/suggest list identifies the bot-wide feature-request list", async () => {
  const responses = [];
  const command = new Suggest({
    getGameDataV2: async () => ({
      suggestions: [
        {
          id: "suggestion-id",
          user: "Test User",
          suggestion: "Shared idea",
          status: "SUGGESTED",
          votes: { count: 0, voters: [] },
        },
      ],
    }),
    setGameDataV2: async () => {},
    logger: { log: () => {} },
  });
  const interaction = {
    isAutocomplete: () => false,
    deferReply: async () => {},
    editReply: async (response) => responses.push(response),
    options: {
      getSubcommand: () => "list",
      getString: () => null,
      getInteger: () => null,
    },
  };

  await command.execute(interaction);

  expect(responses[0].embeds[0]).toMatchObject({
    title: "Game Bot Feature Requests",
    description: expect.stringContaining("Global Feature Requests"),
    footer: {
      text: expect.stringContaining("Global across all servers"),
    },
  });
});
