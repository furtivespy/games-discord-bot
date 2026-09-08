const { expect, test } = require("bun:test");
const Suggest = require("../slashcommands/info/suggestions.js");
const { createMember, createUser, withHarness } = require("./helpers/harness");

test("/suggest add uses bot-wide storage", async () => {
  await withHarness(
    {
      guildId: "server-that-should-not-be-used",
      user: createUser({ id: "user-id", username: "Test User" }),
      member: createMember({
        id: "user-id",
        username: "Test User",
        displayName: "Test User",
      }),
      options: {
        subcommand: "add",
        strings: { suggestion: "Shared idea" },
      },
    },
    async (harness) => {
      const command = new Suggest(harness.client);
      await command.execute(harness.interaction);

      expect(harness.getCalls).toEqual([["global", "suggest", "x"]]);
      expect(harness.persistCalls).toHaveLength(1);
      expect(harness.persistCalls[0].slice(0, 3)).toEqual(["global", "suggest", "x"]);
      expect(harness.persistCalls[0][3].suggestions[0]).toMatchObject({
        user: "Test User",
        userId: "user-id",
        suggestion: "Shared idea",
      });
    }
  );
});

test("/suggest list identifies the bot-wide feature-request list", async () => {
  await withHarness(
    {
      options: { subcommand: "list" },
    },
    async (harness) => {
      harness.seedCollection(
        "suggest",
        {
          suggestions: [
            {
              id: "suggestion-id",
              user: "Test User",
              suggestion: "Shared idea",
              status: "SUGGESTED",
              votes: { count: 0, voters: [] },
            },
          ],
        },
        { serverId: "global", channel: "x" }
      );

      const command = new Suggest(harness.client);
      await command.execute(harness.interaction);

      expect(harness.calls.editReply[0].embeds[0]).toMatchObject({
        title: "Game Bot Feature Requests",
        description: expect.stringContaining("Global Feature Requests"),
        footer: {
          text: expect.stringContaining("Global across all servers"),
        },
      });
    }
  );
});
