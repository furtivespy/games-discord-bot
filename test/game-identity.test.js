const { describe, expect, test } = require("bun:test");
const GameIdentity = require("../modules/GameIdentity");

describe("GameIdentity for /game newgame", () => {
  test("resolves a BGG numeric id", () => {
    expect(GameIdentity.resolveNewGameIdentity({ game: "13" })).toEqual({
      kind: "bgg",
      bggGameId: "13",
    });
  });

  test("resolves and trims a custom playtest name", () => {
    expect(
      GameIdentity.resolveNewGameIdentity({ customname: "  My Prototype v3  " })
    ).toEqual({
      kind: "custom",
      name: "My Prototype v3",
    });
  });

  test("refuses BGG and custom name together", () => {
    expect(
      GameIdentity.resolveNewGameIdentity({
        game: "13",
        customname: "My Prototype v3",
      })
    ).toEqual({ error: GameIdentity.BOTH_OPTIONS_ERROR });
  });

  test("refuses whitespace-only custom names", () => {
    expect(GameIdentity.resolveNewGameIdentity({ customname: "   " })).toEqual({
      error: GameIdentity.INVALID_CUSTOM_ERROR,
    });
  });

  test("refuses custom names over 100 characters", () => {
    expect(
      GameIdentity.resolveNewGameIdentity({ customname: "x".repeat(101) })
    ).toEqual({ error: GameIdentity.INVALID_CUSTOM_ERROR });
  });

  test("refuses a missing identity", () => {
    expect(GameIdentity.resolveNewGameIdentity({})).toEqual({
      error: GameIdentity.MISSING_IDENTITY_ERROR,
    });
  });

  test("refuses a non-numeric BGG id", () => {
    expect(GameIdentity.resolveNewGameIdentity({ game: "not-an-id" })).toEqual({
      error: GameIdentity.INVALID_BGG_ERROR,
    });
  });

  test("stores a custom / not-on-BGG flag without inventing a BGG id", () => {
    const gameData = { name: "channel-name", bggGameId: "99", isCustomGame: false };
    GameIdentity.applyCustomGameIdentity(gameData, "My Prototype v3");
    expect(gameData).toMatchObject({
      name: "My Prototype v3",
      bggGameId: null,
      isCustomGame: true,
    });
  });

  test("status label marks custom games and create embed has no BGG url", () => {
    const gameData = { name: "My Prototype v3", isCustomGame: true };
    expect(GameIdentity.statusGameLabel(gameData)).toBe("My Prototype v3 (Custom game)");
    expect(GameIdentity.statusGameLabel({ name: "test-channel" })).toBe("test-channel");

    const embed = GameIdentity.buildCustomGameCreateEmbed("My Prototype v3");
    const data = embed.toJSON();
    expect(data.title).toBe("My Prototype v3");
    expect(data.description).toContain("Custom game");
    expect(data.description).toContain("not on BoardGameGeek");
    expect(data.url).toBeUndefined();
  });
});
