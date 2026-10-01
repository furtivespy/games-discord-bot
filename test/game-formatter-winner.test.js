const { describe, expect, test } = require("bun:test");
const GameFormatter = require("../modules/GameFormatter");

function guildStub({
  id = "guild-1",
  members = { "user-1": "Alice" },
} = {}) {
  return {
    id,
    members: {
      cache: {
        get: (memberId) =>
          members[memberId] ? { displayName: members[memberId] } : undefined,
      },
    },
  };
}

describe("GameFormatter.GameWinner", () => {
  test("without a channel id keeps a plain game-name description", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Ankh", winner: "user-1" },
      guildStub()
    );

    expect(embed.data.title).toBe("👑 Congratulations Alice 👑");
    expect(embed.data.description).toBe("For winning Ankh");
  });

  test("with a channel id links the game name and mentions the channel", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Ankh", winner: "user-1" },
      guildStub(),
      "thread-99"
    );

    expect(embed.data.description).toBe(
      "For winning [Ankh](<https://discord.com/channels/guild-1/thread-99>) in <#thread-99>"
    );
  });

  test("escapes markdown in the linked game name so the jump URL still parses", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Star*[Wars]", winner: "user-1" },
      guildStub(),
      "channel-2"
    );

    expect(embed.data.description).toBe(
      "For winning [Star\\*\\[Wars\\]](<https://discord.com/channels/guild-1/channel-2>) in <#channel-2>"
    );
  });
});
