const { describe, expect, test } = require("bun:test");
const {
  firstNonEmptyName,
  GAMES_EMPTY_MESSAGE,
  GAMES_SELECT_PLACEHOLDER,
  SNAPSHOT_LOADING_MESSAGE,
  gamesRequestUrl,
  helloGreeting,
  isDiscordProxyHost,
  originLine,
  OUTSIDE_DISCORD_FALLBACK,
  snapshotRequestUrl,
  tokenRequestUrl,
  urlMappingsForApiHost,
} = require("../embedded-client/src/handshake.ts");
const { nextOffset, translateCss } = require("../embedded-client/src/drag.ts");
const {
  asCardList,
  createRequestSeq,
  shouldApplySnapshot,
} = require("../embedded-client/src/requestSeq.ts");
const { MockDiscordSDK } = require("../embedded-client/src/mockSdk.ts");
const {
  MOCK_OAUTH_CODE,
  MOCK_USER,
  isPickerFixture,
  isSnapshotFixture,
} = require("../embedded-client/src/mockFixtures.ts");

describe("embedded client handshake URLs", () => {
  test("maps the public API host onto /api so fetch is not raw cross-origin", () => {
    expect(urlMappingsForApiHost("gamebot.example.com")).toEqual([
      { prefix: "/api", target: "gamebot.example.com/api" },
    ]);
    expect(tokenRequestUrl("gamebot.example.com", "https:")).toBe(
      "https://gamebot.example.com/api/token"
    );
  });

  test("uses a same-origin /api/token path inside the Discord proxy", () => {
    expect(isDiscordProxyHost("123.discordsays.com")).toBe(true);
    expect(urlMappingsForApiHost("123.discordsays.com")).toEqual([]);
    expect(tokenRequestUrl("123.discordsays.com", "https:")).toBe("/api/token");
    expect(tokenRequestUrl("", "https:")).toBe("/api/token");
  });

  test("skips blank global_name when greeting", () => {
    expect(firstNonEmptyName("   ", "Will")).toBe("Will");
    expect(firstNonEmptyName(null, undefined, "")).toBeNull();
  });

  test("in-place hello has no origin line; bridge hello includes the channel name", () => {
    expect(helloGreeting("Will")).toBe("Hello, Will");
    expect(originLine(null)).toBeNull();
    expect(originLine("   ")).toBeNull();
    expect(originLine("Inis Friday")).toBe("from Inis Friday");
  });

  test("outside-Discord fallback still tells you to open visual mode from Discord", () => {
    expect(OUTSIDE_DISCORD_FALLBACK).toBe(
      "Open visual mode from Discord (App Launcher → Game Bot, or /visual)."
    );
    const main = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "main.ts"),
      "utf8"
    );
    expect(main).toContain("OUTSIDE_DISCORD_FALLBACK");
    expect(main).toContain("config.mock");
    expect(main).toContain("loadGames");
    expect(main).toContain("gamesRequestUrl");
    expect(main).toContain("isPickerFixture");
    expect(main).toContain("isSnapshotFixture");
    expect(main).toContain('"several-games"');
    expect(main).toContain("loadSnapshot");
    expect(main).toContain("enableCardDrag");
    expect(main).toContain("snapshotRequests");
    expect(main).toContain("shouldApplySnapshot");
    expect(main).toContain("AbortController");
    expect(main).toContain("SNAPSHOT_LOADING_MESSAGE");
    expect(main).toContain("Picker option value is the game document key");
    expect(main).not.toContain("consumeOrigin");
    expect(main).not.toContain("loadMockSnapshot");
  });

  test("snapshot URL is same-origin inside Discord and carries fixture query params", () => {
    expect(snapshotRequestUrl("", "https:")).toBe("/api/game/snapshot");
    expect(
      snapshotRequestUrl("123.discordsays.com", "https:", {
        fixture: "no-game",
      })
    ).toBe("/api/game/snapshot?fixture=no-game");
    expect(
      snapshotRequestUrl("gamebot.example.com", "https:", {
        fixture: "populated",
        channelId: "ch-1",
        guildId: "g-1",
      })
    ).toBe(
      "https://gamebot.example.com/api/game/snapshot?fixture=populated&channelId=ch-1&guildId=g-1"
    );
  });

  test("games URL is same-origin inside Discord and carries guild plus mock fixture", () => {
    expect(gamesRequestUrl("", "https:")).toBe("/api/games");
    expect(
      gamesRequestUrl("123.discordsays.com", "https:", {
        fixture: "no-games",
        guildId: "g-1",
      })
    ).toBe("/api/games?fixture=no-games&guildId=g-1");
    expect(
      gamesRequestUrl("gamebot.example.com", "https:", {
        guildId: "g-1",
      })
    ).toBe("https://gamebot.example.com/api/games?guildId=g-1");
    expect(GAMES_EMPTY_MESSAGE).toContain("not in any active games");
    expect(GAMES_SELECT_PLACEHOLDER).toBe("Select a game");
  });

  test("default and populated are picker fixtures; no-game stays snapshot-only", () => {
    expect(isPickerFixture("several-games")).toBe(true);
    expect(isPickerFixture("one-game")).toBe(true);
    expect(isPickerFixture("no-games")).toBe(true);
    expect(isPickerFixture("populated")).toBe(true);
    expect(isPickerFixture("no-game")).toBe(false);
    expect(isPickerFixture("not-a-player")).toBe(false);
    expect(isSnapshotFixture("no-game")).toBe(true);
    expect(isSnapshotFixture("not-a-player")).toBe(true);
    expect(isSnapshotFixture("populated")).toBe(true);
    expect(isSnapshotFixture("several-games")).toBe(false);
  });
});

describe("mock Discord SDK shim", () => {
  test("ready/authorize/authenticate and configurable channel/guild ids", async () => {
    const sdk = new MockDiscordSDK("mock-client-id", {
      channelId: "seeded-channel",
      guildId: "seeded-guild",
    });
    await sdk.ready();
    expect(sdk.channelId).toBe("seeded-channel");
    expect(sdk.guildId).toBe("seeded-guild");
    expect(await sdk.commands.authorize({})).toEqual({ code: MOCK_OAUTH_CODE });
    const auth = await sdk.commands.authenticate({
      access_token: "mock-access-token",
    });
    expect(auth.user).toEqual({
      id: MOCK_USER.id,
      username: MOCK_USER.username,
      global_name: MOCK_USER.global_name,
    });
  });
});

describe("client-only card drag", () => {
  test("stores translate(x, y) from pointer deltas", () => {
    expect(translateCss(12, -4)).toBe("translate(12px, -4px)");
    expect(nextOffset({ x: 10, y: 20 }, { x: 5, y: 5 }, { x: 15, y: 8 })).toEqual({
      x: 20,
      y: 23,
    });
  });
});

describe("snapshot request sequencing", () => {
  test("a later pick invalidates the earlier snapshot apply", () => {
    const seq = createRequestSeq();
    const first = seq.next();
    const second = seq.next();
    expect(seq.isCurrent(first)).toBe(false);
    expect(seq.isCurrent(second)).toBe(true);
    seq.invalidate();
    expect(seq.isCurrent(second)).toBe(false);
  });

  test("asCardList ignores non-arrays and non-object entries", () => {
    expect(asCardList("xxxx")).toEqual([]);
    expect(asCardList(null)).toEqual([]);
    expect(asCardList([{ id: "hand-1", name: "Copper" }, "nope", null])).toEqual([
      { id: "hand-1", name: "Copper" },
    ]);
  });

  test("slow game A cannot replace the table after picking game B", () => {
    const seq = createRequestSeq();
    const requestA = seq.next();
    const requestB = seq.next();
    expect(
      shouldApplySnapshot({
        isCurrent: seq.isCurrent(requestA),
        selectedChannelId: "mid-table",
        requestedChannelId: "newest-thread",
        payloadChannelId: "newest-thread",
      })
    ).toBe(false);
    expect(
      shouldApplySnapshot({
        isCurrent: seq.isCurrent(requestB),
        selectedChannelId: "mid-table",
        requestedChannelId: "mid-table",
        payloadChannelId: "mid-table",
      })
    ).toBe(true);
    seq.invalidate();
    expect(
      shouldApplySnapshot({
        isCurrent: seq.isCurrent(requestA),
        selectedChannelId: "",
        requestedChannelId: "newest-thread",
        payloadChannelId: "newest-thread",
      })
    ).toBe(false);
    expect(SNAPSHOT_LOADING_MESSAGE).toContain("Loading");
  });
});
