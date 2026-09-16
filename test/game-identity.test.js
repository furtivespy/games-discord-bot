const { describe, expect, test } = require("bun:test");
const GameIdentity = require("../modules/GameIdentity");

describe("GameIdentity for /game newgame", () => {
  test("resolveGameIdentity is the shared helper used by newgame and lfg", () => {
    expect(GameIdentity.resolveGameIdentity).toBe(GameIdentity.resolveNewGameIdentity);
  });

  test("resolves a BGG numeric id", () => {
    expect(GameIdentity.resolveGameIdentity({ game: "13" })).toEqual({
      kind: "bgg",
      bggGameId: "13",
    });
  });

  test("resolves and trims a custom playtest name", () => {
    expect(
      GameIdentity.resolveGameIdentity({ customname: "  My Prototype v3  " })
    ).toEqual({
      kind: "custom",
      name: "My Prototype v3",
    });
  });

  test("refuses BGG and custom name together", () => {
    expect(
      GameIdentity.resolveGameIdentity({
        game: "13",
        customname: "My Prototype v3",
      })
    ).toEqual({ error: GameIdentity.BOTH_OPTIONS_ERROR });
  });

  test("refuses whitespace-only custom names", () => {
    expect(GameIdentity.resolveGameIdentity({ customname: "   " })).toEqual({
      error: GameIdentity.INVALID_CUSTOM_ERROR,
    });
  });

  test("refuses custom names over 100 characters", () => {
    expect(
      GameIdentity.resolveGameIdentity({ customname: "x".repeat(101) })
    ).toEqual({ error: GameIdentity.INVALID_CUSTOM_ERROR });
  });

  test("refuses a missing identity", () => {
    expect(GameIdentity.resolveGameIdentity({})).toEqual({
      error: GameIdentity.MISSING_IDENTITY_ERROR,
    });
  });

  test("refuses a non-numeric BGG id", () => {
    expect(GameIdentity.resolveGameIdentity({ game: "not-an-id" })).toEqual({
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

  test("applyIdentityFromGather maps custom gather snapshots to FUR-91 session fields", () => {
    const gameData = { name: "thread-name", bggGameId: "99", isCustomGame: false };
    GameIdentity.applyIdentityFromGather(gameData, {
      isCustom: true,
      customName: "My Prototype v3",
      name: "My Prototype v3",
      bggId: null,
    });
    expect(gameData).toMatchObject({
      name: "My Prototype v3",
      bggGameId: null,
      isCustomGame: true,
    });
  });

  test("applyIdentityFromGather keeps BGG gathers on the published-title path", () => {
    const gameData = { name: "Wingspan", bggGameId: null, isCustomGame: false };
    GameIdentity.applyIdentityFromGather(gameData, {
      bggId: "266192",
      name: "Wingspan",
    });
    expect(gameData).toMatchObject({
      name: "Wingspan",
      bggGameId: "266192",
      isCustomGame: false,
    });
  });
});
