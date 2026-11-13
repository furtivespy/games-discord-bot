const { describe, expect, test } = require("bun:test");
const {
  cardImageRequestUrl,
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
const {
  STACK_ABOVE_HOVER,
  applyCardOffset,
  enableCardDrag,
  isMovedOffset,
  nextCardStackOrder,
  nextOffset,
  translateCss,
} = require("../embedded-client/src/drag.ts");
const {
  asCardList,
  createRequestSeq,
  createSnapshotLoader,
  isAbortError,
  shouldApplySnapshot,
} = require("../embedded-client/src/requestSeq.ts");
const { MockDiscordSDK } = require("../embedded-client/src/mockSdk.ts");
const {
  MOCK_OAUTH_CODE,
  MOCK_USER,
  isPickerFixture,
  isSnapshotFixture,
} = require("../embedded-client/src/mockFixtures.ts");
const {
  CUSTOM_GAME_LABEL,
  DEFAULT_CARD_BACK,
  autoSelectGameId,
  deckCountLabel,
  handCountLabel,
  initialsFromName,
  statusGameTitle,
  suitGlyph,
  visibleDecks,
} = require("../embedded-client/src/tableLayout.ts");

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
    expect(main).toContain("snapshotLoader");
    expect(main).toContain("createSnapshotLoader");
    expect(main).toContain("liveSelectedChannelId");
    expect(main).toContain("SNAPSHOT_LOADING_MESSAGE");
    expect(main).toContain("Picker option value is the game document key");
    expect(main).toContain("renderGameStatus");
    expect(main).toContain("renderOtherPlayers");
    expect(main).toContain("renderDecks");
    expect(main).toContain("autoSelectGameId");
    const requestSeq = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "requestSeq.ts"),
      "utf8"
    );
    expect(requestSeq).toContain("AbortController");
    expect(requestSeq).toContain("shouldApplySnapshot");
    expect(requestSeq).toContain("abortInFlight");
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

  test("card images load only from the bot's signed proxy path", () => {
    const signed = "/api/card-image?u=https%3A%2F%2Ffurtivespy.com%2Fa.png&s=sig";
    expect(cardImageRequestUrl("", "https:", signed)).toBe(signed);
    expect(cardImageRequestUrl("123.discordsays.com", "https:", signed)).toBe(signed);
    expect(cardImageRequestUrl("gamebot.example.com", "https:", signed)).toBe(
      `https://gamebot.example.com${signed}`
    );
    expect(
      cardImageRequestUrl("", "https:", "https://furtivespy.com/a.png")
    ).toBeNull();
    expect(cardImageRequestUrl("", "https:", "/api/card-imagex?u=1")).toBeNull();
    expect(cardImageRequestUrl("", "https:", null)).toBeNull();
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

describe("visual table layout helpers", () => {
  test("keeps at most two decks and formats Balatro-style counts", () => {
    expect(visibleDecks([{ name: "a" }, { name: "b" }, { name: "c" }])).toEqual([
      { name: "a" },
      { name: "b" },
    ]);
    expect(visibleDecks(null)).toEqual([]);
    expect(deckCountLabel(30, 42)).toBe("30/42");
    expect(deckCountLabel("?", 42)).toBe("?/42");
    expect(handCountLabel(1)).toBe("1 card");
    expect(handCountLabel(4)).toBe("4 cards");
    expect(handCountLabel("?")).toBe("? cards");
    expect(DEFAULT_CARD_BACK).toBe("/card-back.svg");
    expect(
      require("fs").existsSync(
        require("path").join(__dirname, "..", "embedded-client", "public", "card-back.svg")
      )
    ).toBe(true);
  });

  test("status title, initials, suits, and mock auto-select", () => {
    expect(statusGameTitle({ gameName: "Inis", isCustomGame: true })).toBe(
      `Inis (${CUSTOM_GAME_LABEL}) Status`
    );
    expect(initialsFromName("QA Tester")).toBe("QT");
    expect(suitGlyph("hearts")).toBe("♥");
    expect(autoSelectGameId("?fixture=several-games&game=newest-thread", true)).toBe(
      "newest-thread"
    );
    expect(autoSelectGameId("?game=newest-thread", false)).toBe("");
  });
});

function createFakeTile() {
  const classSet = new Set();
  const listeners = new Map();
  const docListeners = new Map();
  const ownerDocument = {
    addEventListener(type, fn) {
      const list = docListeners.get(type) || [];
      list.push(fn);
      docListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = (docListeners.get(type) || []).filter((handler) => handler !== fn);
      docListeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of docListeners.get(event.type) || []) handler(event);
      return true;
    },
  };
  const tile = {
    style: { transform: "", zIndex: "" },
    classList: {
      add: (name) => classSet.add(name),
      remove: (name) => classSet.delete(name),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classSet.has(name)) classSet.delete(name);
          else classSet.add(name);
        } else if (force) classSet.add(name);
        else classSet.delete(name);
        return classSet.has(name);
      },
      contains: (name) => classSet.has(name),
    },
    ownerDocument,
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
      return true;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  return tile;
}

function pointerEvent(type, { pointerId = 1, button = 0, clientX, clientY } = {}) {
  return {
    type,
    pointerId,
    button,
    clientX,
    clientY,
    preventDefault() {},
  };
}

describe("client-only card drag", () => {
  test("stores translate(x, y) from pointer deltas", () => {
    expect(translateCss(12, -4)).toBe("translate(12px, -4px)");
    expect(nextOffset({ x: 10, y: 20 }, { x: 5, y: 5 }, { x: 15, y: 8 })).toEqual({
      x: 20,
      y: 23,
    });
    expect(
      nextOffset({ x: 10, y: 20, z: 41 }, { x: 5, y: 5 }, { x: 15, y: 8 })
    ).toEqual({
      x: 20,
      y: 23,
      z: 41,
    });
    expect(isMovedOffset({ x: 141, y: 126 })).toBe(true);
    expect(isMovedOffset({ x: 0, y: 0 })).toBe(false);
    expect(isMovedOffset(undefined)).toBe(false);
  });

  test("stack order stays above hover and increases per raise", () => {
    const first = nextCardStackOrder();
    const second = nextCardStackOrder();
    expect(first).toBeGreaterThan(STACK_ABOVE_HOVER);
    expect(second).toBeGreaterThan(first);
    const tile = {
      style: {},
      classList: { toggle() {} },
    };
    applyCardOffset(tile, { x: 8, y: -4, z: first });
    expect(tile.style.transform).toBe("translate(8px, -4px)");
    expect(tile.style.zIndex).toBe(String(first));
  });

  test("raises a card's z-index on drag start and again on drop", () => {
    const before = nextCardStackOrder();
    const tile = createFakeTile();
    enableCardDrag(tile, "board-1", new Map());
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    const duringDrag = Number(tile.style.zIndex);
    expect(duringDrag).toBeGreaterThan(before);
    expect(tile.classList.contains("dragging")).toBe(true);

    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 40, clientY: 80 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 40, clientY: 80 })
    );
    const afterDrop = Number(tile.style.zIndex);
    expect(afterDrop).toBeGreaterThan(duringDrag);
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(tile.classList.contains("moved")).toBe(true);
    expect(tile.style.transform).toBe(translateCss(30, 70));
  });

  test("a later drag raises that card above an earlier drop", () => {
    const province = createFakeTile();
    const village = createFakeTile();
    const market = createFakeTile();
    const positions = new Map();
    enableCardDrag(province, "board-1", positions);
    enableCardDrag(village, "play-1", positions);
    enableCardDrag(market, "play-2", positions);

    province.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    province.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 10, clientY: 80 })
    );
    province.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 10, clientY: 80 })
    );

    market.dispatchEvent(pointerEvent("pointerdown", { clientX: 20, clientY: 0 }));
    market.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 20, clientY: 120 })
    );
    market.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 20, clientY: 120 })
    );

    const provinceZ = Number(province.style.zIndex);
    const marketZ = Number(market.style.zIndex);
    expect(provinceZ).toBeGreaterThan(Number(village.style.zIndex || 0));
    expect(marketZ).toBeGreaterThan(provinceZ);
    expect(positions.get("board-1").z).toBe(provinceZ);
    expect(positions.get("play-2").z).toBe(marketZ);
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

function abortableDeferred() {
  let resolveFn;
  let aborted = false;
  return {
    get aborted() {
      return aborted;
    },
    start(signal) {
      return new Promise((resolve, reject) => {
        const abort = () => {
          aborted = true;
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        };
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        resolveFn = (value) => resolve(value);
      });
    },
    resolve(value) {
      resolveFn?.(value);
    },
  };
}

function snapshotBody(channelId, name) {
  return {
    ok: true,
    status: 200,
    payload: {
      channelId,
      gameName: name,
      hand: [{ id: `${channelId}-hand`, name }],
    },
  };
}

describe("snapshot load races", () => {
  test("isAbortError only matches AbortError", () => {
    const abort = new Error("nope");
    abort.name = "AbortError";
    expect(isAbortError(abort)).toBe(true);
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  test("out-of-order resolve (A slow, B fast) keeps B and drops A", async () => {
    const loader = createSnapshotLoader();
    const a = abortableDeferred();
    const b = abortableDeferred();
    let selected = "newest-thread";

    const pA = loader.load(
      "newest-thread",
      (signal) => a.start(signal),
      () => selected
    );
    selected = "mid-table";
    const pB = loader.load(
      "mid-table",
      (signal) => b.start(signal),
      () => selected
    );

    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(false);

    b.resolve(snapshotBody("mid-table", "Thursday Root"));
    expect(await pB).toEqual({
      status: "applied",
      result: snapshotBody("mid-table", "Thursday Root"),
    });

    a.resolve(snapshotBody("newest-thread", "Friday Inis"));
    expect(await pA).toEqual({ status: "aborted" });
  });

  test("switching back to none while a request is pending aborts and does not error", async () => {
    const loader = createSnapshotLoader();
    const pending = abortableDeferred();
    let selected = "newest-thread";

    const pLoad = loader.load(
      "newest-thread",
      (signal) => pending.start(signal),
      () => selected
    );
    selected = "";
    loader.clear();
    expect(pending.aborted).toBe(true);
    expect(
      await loader.load("", async () => snapshotBody("newest-thread", "Friday Inis"))
    ).toEqual({ status: "cleared" });

    pending.resolve(snapshotBody("newest-thread", "Friday Inis"));
    expect(await pLoad).toEqual({ status: "aborted" });
  });

  test("a late response after Select a game is stale, not an error", async () => {
    const loader = createSnapshotLoader();
    let resolveFetch;
    const pLoad = loader.load("newest-thread", () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    loader.clear();
    resolveFetch(snapshotBody("newest-thread", "Friday Inis"));
    expect(await pLoad).toEqual({ status: "stale" });
  });
});
