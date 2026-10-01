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

  test("with a BGG id links the game name to BoardGameGeek and mentions the channel", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Ankh", winner: "user-1", bggGameId: "285774" },
      guildStub(),
      "thread-99"
    );

    expect(embed.data.description).toBe(
      "For winning [Ankh](https://boardgamegeek.com/boardgame/285774) in <#thread-99>"
    );
  });

  test("without a BGG id uses a plain escaped name and still mentions the channel", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Ankh", winner: "user-1", bggGameId: null },
      guildStub(),
      "thread-99"
    );

    expect(embed.data.description).toBe("For winning Ankh in <#thread-99>");
    expect(embed.data.description).not.toContain("boardgamegeek.com");
    expect(embed.data.description).not.toContain("discord.com/channels");
  });

  test("does not invent a BGG url from a blank or non-numeric id", async () => {
    for (const bggGameId of ["", "  ", "not-an-id", "13abc"]) {
      const embed = await GameFormatter.GameWinner(
        { name: "Ankh", winner: "user-1", bggGameId },
        guildStub(),
        "thread-99"
      );
      expect(embed.data.description).toBe("For winning Ankh in <#thread-99>");
    }
  });

  test("escapes markdown in the BGG-linked game name so the url still parses", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Star*[Wars]", winner: "user-1", bggGameId: "13" },
      guildStub(),
      "channel-2"
    );

    expect(embed.data.description).toBe(
      "For winning [Star\\*\\[Wars\\]](https://boardgamegeek.com/boardgame/13) in <#channel-2>"
    );
  });

  test("escapes markdown in an unlinked custom game name", async () => {
    const embed = await GameFormatter.GameWinner(
      { name: "Star*[Wars]", winner: "user-1", bggGameId: null },
      guildStub(),
      "channel-2"
    );

    expect(embed.data.description).toBe(
      "For winning Star\\*\\[Wars\\] in <#channel-2>"
    );
  });
});
