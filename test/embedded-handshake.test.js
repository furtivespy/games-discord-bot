const { describe, expect, test } = require("bun:test");
const {
  cardImageRequestUrl,
  resolveCardImageUrl,
  firstNonEmptyName,
  GAMES_EMPTY_MESSAGE,
  GAMES_SELECT_PLACEHOLDER,
  SNAPSHOT_LOADING_MESSAGE,
  SNAPSHOT_STALE_MESSAGE,
  gamesRequestUrl,
  helloGreeting,
  isDiscordProxyHost,
  originLine,
  OUTSIDE_DISCORD_FALLBACK,
  actionRequestUrl,
  snapshotRequestUrl,
  tokenRequestUrl,
  urlMappingsForApiHost,
  versionRequestUrl,
} = require("../embedded-client/src/handshake.ts");
const {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  CHANNEL_POST_FAILED_NOTICE,
  DEFAULT_ACTION_COUNT,
  GAME_CHANNEL_LINK_LABEL,
  actionDialogCopy,
  deckActionFromDataset,
  gameChannelUrl,
  parseActionCount,
  shouldUseOpenExternalLink,
  tryOpenExternalLink,
  HAND_CARD_ACTIONS,
  visualActionBody,
  visualActionErrorMessage,
  visualHandActionBody,
} = require("../embedded-client/src/visualActions.ts");
const {
  EDIT_SCORES_LABEL,
  SAVE_SCORES_LABEL,
  SCORE_EDITING_CLASS,
  SCORE_MAX_LENGTH,
  baselineScores,
  changedScores,
  collectScoreInputs,
  visualScoreBody,
} = require("../embedded-client/src/scoreEdit.ts");
const {
  CLICK_SLOP_PX,
  SNAP_BACK_DURATION_MS,
  STACK_ABOVE_HOVER,
  applyCardOffset,
  copyOffset,
  enableCardDrag,
  isMovedOffset,
  nextCardStackOrder,
  nextOffset,
  parseTranslate,
  translateCss,
  visualOffset,
} = require("../embedded-client/src/drag.ts");
const {
  HOST_IMAGE_ID_PREFIX,
  INSPECT_PHOTO_CLASS,
  INSPECT_PHOTO_LABEL,
  INSPECT_NEXT_LABEL,
  INSPECT_PREV_LABEL,
  inspectCardCaption,
  inspectCardTitle,
  inspectKeyDirection,
  inspectNavDirectionFromDataset,
  isInspectTypingTarget,
  inspectNavIndex,
  inspectNavState,
  inspectContainedImageRect,
  inspectHandActionsVisible,
  inspectSequenceIndex,
  inspectView,
  isHostThreadImage,
  isInspectOutsideClick,
  resolveInspectSession,
} = require("../embedded-client/src/cardInspect.ts");
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
  DEFAULT_CARD_BACK,
  UNASSIGNED_TEAM_LABEL,
  autoSelectGameId,
  DEFAULT_DECK_ACTIONS,
  deckActionsFor,
  deckCountLabel,
  groupPlayersByTeam,
  handCountLabel,
  initialsFromName,
  statusPlayerScoreLabel,
  statusPlayerSeatName,
  suitGlyph,
  playerSeatOrder,
  tablePlayersInSeatOrder,
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
    expect(SNAPSHOT_STALE_MESSAGE).toContain("Reopen visual mode");
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
    expect(main).toContain("enableHoverZoomClamp");
    expect(main).toContain("onInspect");
    expect(main).toContain("openCardInspect");
    expect(main).toContain("InspectSequenceItem");
    expect(main).toContain(
      "openCardInspect(card, imageSrc, tile, enableInspectNav ? sequence : undefined, {"
    );
    expect(main).toContain("enableCardInspectDialog");
    expect(main).toContain("closeCardInspect");
    expect(main).toContain("submitHandCardAction");
    expect(main).toContain("visualHandActionBody");
    expect(main).toContain("setInspectCardActionHandler");
    expect(main).toContain("snapshotLoader");
    expect(main).toContain("createSnapshotLoader");
    expect(main).toContain("liveSelectedChannelId");
    expect(main).toContain("SNAPSHOT_LOADING_MESSAGE");
    expect(main).toContain("Picker option value is the game document key");
    expect(main).toContain("renderGameStatus");
    expect(main).toContain("renderOtherPlayers");
    expect(main).toContain("tablePlayersInSeatOrder");
    expect(main).toContain("const seated = tablePlayersInSeatOrder");
    expect(main).toContain("dataset.userId");
    expect(main).toContain("renderDecks");
    expect(main).toContain("renderDeckActions");
    expect(main).toContain("deckActionsFor");
    expect(main).toContain("dataset.deckAction");
    expect(main).toContain("dataset.deckName");
    expect(main).toContain("onDeckActionButtonClick");
    expect(main).toContain("openActionDialog");
    expect(main).toContain("submitDeckAction");
    expect(main).toContain("submitScoreEdits");
    expect(main).toContain("visualScoreBody");
    const submitDeckAction = main.slice(
      main.indexOf("async function submitDeckAction"),
      main.indexOf("function bindActionDialog")
    );
    expect(submitDeckAction.indexOf("closeActionDialog();")).toBeGreaterThan(-1);
    expect(submitDeckAction.indexOf("closeActionDialog();")).toBeLessThan(
      submitDeckAction.indexOf("await fetch(")
    );
    expect(submitDeckAction).toContain("shouldApplySnapshot");
    expect(main).toContain("select.disabled = locked");
    expect(main).toContain("actionRequestUrl");
    expect(main).toContain("applySnapshot");
    expect(main).toContain("renderGameChannelLink");
    expect(main).toContain("createSnapshotPoller");
    expect(main).toContain("versionRequestUrl");
    expect(main).toContain("HISTORY_CHANGED_CLASS");
    expect(main).toContain("SNAPSHOT_STALE_MESSAGE");
    expect(main).toContain("pendingSnapshot");
    expect(main).toContain('kind: "painted"');
    expect(main).toContain('kind: "deferred"');
    expect(main).toContain('kind: "unchanged"');
    expect(main).toContain('kind: "failed"');
    expect(main).toMatch(
      /pendingSnapshot = \{ config, payload \};\s*return false;/
    );
    expect(main).toContain("scheduleHistoryFlashClear");
    const embeddedApp = require("fs").readFileSync(
      require("path").join(__dirname, "..", "modules", "embeddedApp.js"),
      "utf8"
    );
    expect(embeddedApp).toContain("authenticateEmbeddedGameRead");
    expect(embeddedApp).toContain("resolveDiscordUser");
    expect(main).not.toContain("tabIndex");
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

  test("version URL is same-origin inside Discord and carries fixture query params", () => {
    expect(versionRequestUrl("", "https:")).toBe("/api/game/version");
    expect(
      versionRequestUrl("123.discordsays.com", "https:", {
        fixture: "populated",
      })
    ).toBe("/api/game/version?fixture=populated");
    expect(
      versionRequestUrl("gamebot.example.com", "https:", {
        fixture: "populated",
        channelId: "ch-1",
        guildId: "g-1",
      })
    ).toBe(
      "https://gamebot.example.com/api/game/version?fixture=populated&channelId=ch-1&guildId=g-1"
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
    expect(resolveCardImageUrl("", "https:", "/mock-host-setup.svg", true)).toBe(
      "/mock-host-setup.svg"
    );
    expect(resolveCardImageUrl("", "https:", "/api/evil", true)).toBeNull();
    expect(
      resolveCardImageUrl("", "https:", "https://cdn.discordapp.com/a.png", true)
    ).toBeNull();
    expect(resolveCardImageUrl("", "https:", "/mock-host-setup.svg", false)).toBeNull();
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
    expect(isPickerFixture("team-game")).toBe(true);
    expect(isPickerFixture("no-game")).toBe(false);
    expect(isPickerFixture("not-a-player")).toBe(false);
    expect(isPickerFixture("host-images")).toBe(false);
    expect(isSnapshotFixture("no-game")).toBe(true);
    expect(isSnapshotFixture("not-a-player")).toBe(true);
    expect(isSnapshotFixture("host-images")).toBe(true);
    expect(isSnapshotFixture("populated")).toBe(true);
    expect(isSnapshotFixture("team-game")).toBe(true);
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
    expect(sdk.isMock).toBe(true);
    expect(await sdk.commands.authorize({})).toEqual({ code: MOCK_OAUTH_CODE });
    const auth = await sdk.commands.authenticate({
      access_token: "mock-access-token",
    });
    expect(auth.user).toEqual({
      id: MOCK_USER.id,
      username: MOCK_USER.username,
      global_name: MOCK_USER.global_name,
    });
    expect(
      await sdk.commands.openExternalLink({
        url: "https://discord.com/channels/seeded-guild/seeded-channel",
      })
    ).toEqual({ opened: true });
    expect(sdk.openedExternalLinks).toEqual([
      "https://discord.com/channels/seeded-guild/seeded-channel",
    ]);
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

  test("compact sidebar player lines, initials, suits, and mock auto-select", () => {
    expect(playerSeatOrder({ order: Infinity })).toBe(0);
    expect(playerSeatOrder({ order: "nope" })).toBe(0);
    expect(tablePlayersInSeatOrder([
      { name: "Third", order: 2 },
      { name: "Will", order: 0, isYou: true },
      { name: "Second", order: 1 },
    ]).map((player) => [player.name, player.isYou])).toEqual([
      ["Will", true],
      ["Second", undefined],
      ["Third", undefined],
    ]);
    expect(
      tablePlayersInSeatOrder([
        { name: "Inf", order: Infinity },
        { name: "Second", order: 1 },
      ]).map((player) => player.name)
    ).toEqual(["Inf", "Second"]);
    expect(statusPlayerSeatName({ name: "QA Tester", order: 0 })).toBe("(1) QA Tester");
    expect(statusPlayerScoreLabel({ score: "12" })).toBe("12");
    expect(statusPlayerScoreLabel({ score: "" })).toBe("—");
    expect(initialsFromName("QA Tester")).toBe("QT");
    expect(suitGlyph("hearts")).toBe("♥");
    expect(autoSelectGameId("?fixture=several-games&game=newest-thread", true)).toBe(
      "newest-thread"
    );
    expect(autoSelectGameId("?game=newest-thread", false)).toBe("");
    const main = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "main.ts"),
      "utf8"
    );
    expect(main).not.toContain("statusGameTitle");
    expect(main).not.toContain("status-title");
    expect(main).not.toContain("status-player-meta");
    expect(main).toContain("renderPlayerScoreBlock");
    expect(main).toContain("groupPlayersByTeam");
    expect(main).toContain('player.isYou ? " is-you" : ""');
    const scoreEdit = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "scoreEdit.ts"),
      "utf8"
    );
    expect(scoreEdit).toContain("statusPlayerSeatName");
    expect(scoreEdit).toContain("EDIT_SCORES_LABEL");
    expect(scoreEdit).toContain("SAVE_SCORES_LABEL");
    expect(scoreEdit).toContain("changedScores");
    expect(scoreEdit).toContain("SCORE_MAX_LENGTH");
  });

  test("groups board players by roster team and keeps a flat row without teams", () => {
    const players = [
      { name: "Riley", teamId: "crab", teamName: "🦀🦀" },
      { name: "Alex", teamId: "fish", teamName: "💪🐟" },
      { name: "Sam", teamId: "crab", teamName: "🦀🦀" },
      { name: "Solo", teamName: "" },
    ];
    expect(groupPlayersByTeam(players, [])).toEqual([
      { label: "🦀🦀", unassigned: false, color: null, players: [players[0], players[2]] },
      { label: "💪🐟", unassigned: false, color: null, players: [players[1]] },
      { label: UNASSIGNED_TEAM_LABEL, unassigned: true, color: null, players: [players[3]] },
    ]);
    expect(
      groupPlayersByTeam(players, [
        { id: "fish", name: "💪🐟", color: "navy" },
        { id: "crab", name: "🦀🦀" },
      ])
    ).toEqual([
      { label: "💪🐟", unassigned: false, color: "navy", players: [players[1]] },
      { label: "🦀🦀", unassigned: false, color: null, players: [players[0], players[2]] },
      { label: UNASSIGNED_TEAM_LABEL, unassigned: true, color: null, players: [players[3]] },
    ]);
    expect(
      groupPlayersByTeam(
        [
          { name: "Riley", teamName: "" },
          { name: "Alex" },
        ],
        []
      )
    ).toBeNull();
    expect(groupPlayersByTeam([{ name: "Riley" }, { name: "Alex" }], [{}])).toBeNull();
    expect(
      groupPlayersByTeam(
        [{ name: "Riley" }, { name: "Alex" }],
        [{ id: "empty", name: "🦀🦀" }]
      )
    ).toBeNull();
    const twins = [
      { name: "A", teamId: "1", teamName: "Red" },
      { name: "B", teamId: "2", teamName: "Red" },
    ];
    expect(
      groupPlayersByTeam(twins, [
        { id: "1", name: "Red" },
        { id: "2", name: "Red" },
      ])
    ).toEqual([
      { label: "Red", unassigned: false, color: null, players: [twins[0]] },
      { label: "Red", unassigned: false, color: null, players: [twins[1]] },
    ]);
    expect(
      groupPlayersByTeam(
        [{ name: "Riley", teamId: 7, teamName: "🦀🦀" }],
        [{ id: "7", name: "🦀🦀" }]
      )
    ).toEqual([
      {
        label: "🦀🦀",
        unassigned: false,
        color: null,
        players: [{ name: "Riley", teamId: 7, teamName: "🦀🦀" }],
      },
    ]);
    const withYou = tablePlayersInSeatOrder([
      { name: "Riley", teamId: "crab", teamName: "🦀🦀", order: 1 },
      { name: "QA Tester", teamId: "crab", teamName: "🦀🦀", order: 0, isYou: true },
      { name: "Alex", teamId: "fish", teamName: "💪🐟", order: 2 },
    ]);
    expect(withYou.map((player) => player.name)).toEqual(["QA Tester", "Riley", "Alex"]);
    expect(
      groupPlayersByTeam(withYou, [
        { id: "crab", name: "🦀🦀" },
        { id: "fish", name: "💪🐟" },
      ])
    ).toEqual([
      { label: "🦀🦀", unassigned: false, color: null, players: [withYou[0], withYou[1]] },
      { label: "💪🐟", unassigned: false, color: null, players: [withYou[2]] },
    ]);
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
    listenerCount(type) {
      return (docListeners.get(type) || []).length;
    },
  };
  const tile = {
    style: { transform: "", zIndex: "", transitionDuration: "" },
    isConnected: true,
    classList: {
      add: (...names) => {
        for (const name of names) classSet.add(name);
      },
      remove: (...names) => {
        for (const name of names) classSet.delete(name);
      },
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
    removeEventListener(type, fn) {
      const list = (listeners.get(type) || []).filter((handler) => handler !== fn);
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

  test("raises a card's z-index while dragging, then snaps back to the rest slot", () => {
    const before = nextCardStackOrder();
    const tile = createFakeTile();
    tile.classList.add("selected");
    const positions = new Map();
    enableCardDrag(tile, "hand-1", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    const duringDrag = Number(tile.style.zIndex);
    expect(duringDrag).toBeGreaterThan(before);
    expect(tile.classList.contains("dragging")).toBe(true);

    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 40, clientY: 80 })
    );
    expect(tile.style.transform).toBe(translateCss(30, 70));
    expect(tile.classList.contains("moved")).toBe(true);

    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 40, clientY: 80 })
    );
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(tile.classList.contains("moved")).toBe(false);
    expect(tile.classList.contains("snapping")).toBe(false);
    expect(tile.classList.contains("selected")).toBe(true);
    expect(tile.style.transform).toBe("");
    expect(tile.style.zIndex).toBe("");
    expect(positions.get("hand-1")).toEqual({ x: 0, y: 0 });
  });

  test("a later drag still raises that card above others while the pointer is down", () => {
    const province = createFakeTile();
    const village = createFakeTile();
    const market = createFakeTile();
    const positions = new Map();
    enableCardDrag(province, "board-1", positions);
    enableCardDrag(village, "play-1", positions);
    enableCardDrag(market, "play-2", positions);

    province.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    const provinceZ = Number(province.style.zIndex);
    province.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 10, clientY: 80 })
    );
    province.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 10, clientY: 80 })
    );

    market.dispatchEvent(pointerEvent("pointerdown", { clientX: 20, clientY: 0 }));
    const marketZ = Number(market.style.zIndex);
    expect(provinceZ).toBeGreaterThan(Number(village.style.zIndex || 0));
    expect(marketZ).toBeGreaterThan(provinceZ);
    market.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 20, clientY: 120 })
    );
    market.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 20, clientY: 120 })
    );

    expect(positions.get("board-1")).toEqual({ x: 0, y: 0 });
    expect(positions.get("play-2")).toEqual({ x: 0, y: 0 });
    expect(province.style.transform).toBe("");
    expect(market.style.transform).toBe("");
  });

  test("a drop target that consumes the drop keeps the card where it landed", () => {
    const tile = createFakeTile();
    const positions = new Map();
    const hits = [];
    enableCardDrag(tile, "hand-2", positions, {
      findDropTarget: (ctx) => {
        hits.push(ctx);
        return { id: "future-play-area" };
      },
      onDropTarget: ({ target }) => target.id === "future-play-area",
    });

    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 4, clientY: 4 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 24, clientY: 54 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 24, clientY: 54 })
    );

    expect(hits).toHaveLength(1);
    expect(hits[0].cardId).toBe("hand-2");
    expect(hits[0].point).toEqual({ x: 24, y: 54 });
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(tile.classList.contains("moved")).toBe(true);
    expect(tile.style.transform).toBe(translateCss(20, 50));
  });

  test("a drop target that does not consume still snaps the card back", () => {
    const tile = createFakeTile();
    const positions = new Map();
    enableCardDrag(tile, "hand-3", positions, {
      findDropTarget: () => ({ id: "ignored" }),
      onDropTarget: () => false,
    });

    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 12, clientY: 8 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 12, clientY: 8 })
    );

    expect(tile.style.transform).toBe("");
    expect(tile.classList.contains("moved")).toBe(false);
    expect(positions.get("hand-3")).toEqual({ x: 0, y: 0 });
  });

  test("copyOffset snapshots rest state without sharing the original object", () => {
    const origin = { x: 3, y: 5, z: 41 };
    const copied = copyOffset(origin);
    origin.x = 99;
    expect(copied).toEqual({ x: 3, y: 5, z: 41 });
    expect(copyOffset(undefined)).toEqual({ x: 0, y: 0 });
    expect(SNAP_BACK_DURATION_MS).toBe(220);
    const css = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).not.toMatch(/\.card-tile\.snapping\s*\{[^}]*0\.22s/);
    const drag = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "drag.ts"),
      "utf8"
    );
    expect(drag).toContain("tile.style.transitionDuration = `${SNAP_BACK_DURATION_MS}ms`");
  });

  test("pointercancel snaps the card back like pointerup", () => {
    const tile = createFakeTile();
    const positions = new Map();
    enableCardDrag(tile, "hand-4", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 18, clientY: 9 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointercancel", { clientX: 18, clientY: 9 })
    );
    expect(tile.style.transform).toBe("");
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(positions.get("hand-4")).toEqual({ x: 0, y: 0 });
  });

  test("parseTranslate reads 2d and 3d matrix translates", () => {
    expect(parseTranslate("none")).toEqual({ x: 0, y: 0 });
    expect(parseTranslate("matrix(1, 0, 0, 1, 18, -120)")).toEqual({ x: 18, y: -120 });
    expect(
      parseTranslate("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 30, -165, 0, 1)")
    ).toEqual({ x: 30, y: -165 });
  });

  test("a new drag during snap-back is not reset by the previous snap", async () => {
    const tile = createFakeTile();
    tile.ownerDocument.defaultView = {
      getComputedStyle: () => ({
        transform: tile.classList.contains("snapping")
          ? "matrix(1, 0, 0, 1, 18, -120)"
          : "none",
        transitionDuration: `${SNAP_BACK_DURATION_MS}ms`,
      }),
    };
    const positions = new Map();
    enableCardDrag(tile, "hand-5", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 30, clientY: 40 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 30, clientY: 40 })
    );
    expect(tile.classList.contains("snapping")).toBe(true);
    expect(visualOffset(tile)).toEqual({ x: 18, y: -120 });

    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    expect(tile.classList.contains("dragging")).toBe(true);
    expect(tile.classList.contains("snapping")).toBe(false);
    expect(tile.style.transform).toBe(translateCss(18, -120));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 10, clientY: 20 })
    );
    await new Promise((resolve) => setTimeout(resolve, SNAP_BACK_DURATION_MS + 80));
    expect(tile.classList.contains("dragging")).toBe(true);
    expect(tile.style.transform).toBe(translateCss(28, -100));
  });

  test("re-grab during snap-back starts from the computed mid-animation offset", () => {
    const mid = { x: 18, y: -99 };
    const tile = createFakeTile();
    const styled = [];
    tile.ownerDocument.defaultView = {
      getComputedStyle: (el) => {
        styled.push(el);
        return { transform: "matrix(1, 0, 0, 1, 18, -99)" };
      },
    };
    const positions = new Map();
    enableCardDrag(tile, "hand-5b", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 30, clientY: -165 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 30, clientY: -165 })
    );
    expect(tile.classList.contains("snapping")).toBe(true);
    expect(tile.style.transform).toBe("");

    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 18, clientY: -99 }));
    expect(styled[styled.length - 1]).toBe(tile);
    expect(tile.classList.contains("dragging")).toBe(true);
    expect(tile.classList.contains("snapping")).toBe(false);
    expect(tile.style.transitionDuration).toBe("");
    expect(tile.style.transform).toBe(translateCss(mid.x, mid.y));
    expect(positions.get("hand-5b")).toEqual({
      x: mid.x,
      y: mid.y,
      z: Number(tile.style.zIndex),
    });

    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 28, clientY: -89 })
    );
    expect(tile.style.transform).toBe(translateCss(28, -89));
  });

  test("transitionend from a child does not end the snap early", () => {
    const tile = createFakeTile();
    tile.ownerDocument.defaultView = {
      getComputedStyle: () => ({ transitionDuration: `${SNAP_BACK_DURATION_MS}ms` }),
    };
    const positions = new Map();
    enableCardDrag(tile, "hand-5c", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 4, clientY: 4 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 20, clientY: 20 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 20, clientY: 20 })
    );
    expect(tile.classList.contains("snapping")).toBe(true);

    const face = { nodeName: "DIV" };
    tile.dispatchEvent({
      type: "transitionend",
      target: face,
      propertyName: "transform",
    });
    expect(tile.classList.contains("snapping")).toBe(true);
    expect(tile.style.transitionDuration).toBe(`${SNAP_BACK_DURATION_MS}ms`);

    tile.dispatchEvent({
      type: "transitionend",
      target: tile,
      propertyName: "opacity",
    });
    expect(tile.classList.contains("snapping")).toBe(true);

    tile.dispatchEvent({
      type: "transitionend",
      target: tile,
      propertyName: "transform",
    });
    expect(tile.classList.contains("snapping")).toBe(false);
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(tile.style.transform).toBe("");
    expect(tile.style.transitionDuration).toBe("");
  });

  test("a pending snap is a no-op after the tile is replaced", async () => {
    const tile = createFakeTile();
    tile.ownerDocument.defaultView = {
      getComputedStyle: () => ({ transitionDuration: `${SNAP_BACK_DURATION_MS}ms` }),
    };
    const positions = new Map();
    enableCardDrag(tile, "hand-6", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 10, clientY: 10 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 10, clientY: 10 })
    );
    expect(tile.classList.contains("snapping")).toBe(true);
    tile.isConnected = false;
    await new Promise((resolve) => setTimeout(resolve, SNAP_BACK_DURATION_MS + 80));
    expect(tile.classList.contains("snapping")).toBe(true);
  });

  test("removing the tile mid-drag drops document listeners", () => {
    const tile = createFakeTile();
    const positions = new Map();
    enableCardDrag(tile, "hand-7", positions);
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 12, clientY: 8 })
    );
    expect(tile.ownerDocument.listenerCount("pointermove")).toBe(1);
    tile.isConnected = false;
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 40, clientY: 40 })
    );
    expect(tile.ownerDocument.listenerCount("pointermove")).toBe(0);
    expect(tile.ownerDocument.listenerCount("pointerup")).toBe(0);
    expect(tile.ownerDocument.listenerCount("pointercancel")).toBe(0);
    expect(tile.style.transform).toBe(translateCss(12, 8));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 99, clientY: 99 })
    );
    expect(tile.style.transform).toBe(translateCss(12, 8));
  });

  test("a click with no movement inspects the card and does not snap", () => {
    const tile = createFakeTile();
    const positions = new Map();
    const inspected = [];
    enableCardDrag(tile, "hand-inspect", positions, {
      onInspect: (ctx) => inspected.push(ctx),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 10 + CLICK_SLOP_PX - 1, clientY: 10 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 10 + CLICK_SLOP_PX - 1, clientY: 10 })
    );
    expect(inspected).toEqual([{ cardId: "hand-inspect", tile }]);
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(tile.classList.contains("snapping")).toBe(false);
    expect(tile.style.transform).toBe("");
    expect(positions.get("hand-inspect")).toEqual({ x: 0, y: 0 });
  });

  test("a pointerup that jumps past slop without pointermove does not inspect", () => {
    const tile = createFakeTile();
    const inspected = [];
    enableCardDrag(tile, "hand-jump", new Map(), {
      onInspect: (ctx) => inspected.push(ctx),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 40, clientY: 0 })
    );
    expect(inspected).toEqual([]);
    expect(tile.classList.contains("dragging")).toBe(false);
  });

  test("dragging past the click slop does not inspect", () => {
    const tile = createFakeTile();
    const positions = new Map();
    const inspected = [];
    enableCardDrag(tile, "hand-drag", positions, {
      onInspect: (ctx) => inspected.push(ctx),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: CLICK_SLOP_PX, clientY: 0 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: CLICK_SLOP_PX, clientY: 0 })
    );
    expect(inspected).toEqual([]);
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(positions.get("hand-drag")).toEqual({ x: 0, y: 0 });
  });

  test("pointercancel without movement does not inspect", () => {
    const tile = createFakeTile();
    const inspected = [];
    enableCardDrag(tile, "hand-cancel", new Map(), {
      onInspect: (ctx) => inspected.push(ctx),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 3, clientY: 3 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointercancel", { clientX: 3, clientY: 3 })
    );
    expect(inspected).toEqual([]);
    expect(tile.classList.contains("dragging")).toBe(false);
  });
});

describe("card inspect modal content", () => {
  test("uses the card name as title and description as caption", () => {
    expect(inspectCardTitle({ name: "  Village  " })).toBe("Village");
    expect(inspectCardTitle({})).toBe("Card");
    expect(inspectCardCaption({ description: "  Worth 1 action.  " })).toBe(
      "Worth 1 action."
    );
    expect(inspectCardCaption({ description: "" })).toBe("");
    expect(inspectView({ name: "Province", description: "8 points" }, "/art.png")).toEqual({
      title: "Province",
      caption: "8 points",
      showTitle: true,
      showArt: true,
      artSrc: "/art.png",
      showProxy: false,
      layout: "card",
    });
    expect(inspectView({ name: "Copper" }, null)).toEqual({
      title: "Copper",
      caption: "",
      showTitle: true,
      showArt: false,
      artSrc: null,
      showProxy: true,
      layout: "card",
    });
  });

  test("thread host images enlarge as a nameless photo, not a titled card", () => {
    expect(HOST_IMAGE_ID_PREFIX).toBe("host-image:");
    expect(INSPECT_PHOTO_CLASS).toBe("is-photo");
    expect(INSPECT_PHOTO_LABEL).toBe("Enlarged photo");
    expect(isHostThreadImage({ id: "host-image:m1:a1", name: "Image" })).toBe(true);
    expect(isHostThreadImage({ id: "card-12", name: "Image" })).toBe(false);
    expect(isHostThreadImage({ name: "Image" })).toBe(false);
    expect(
      inspectView(
        { id: "host-image:host-msg-1:att-1", name: "Image" },
        "/mock-host-setup.svg"
      )
    ).toEqual({
      title: "",
      caption: "",
      showTitle: false,
      showArt: true,
      artSrc: "/mock-host-setup.svg",
      showProxy: false,
      layout: "photo",
    });
    expect(
      inspectView({ id: "host-image:m1:a1", name: "map", description: "ignored" }, null)
    ).toEqual({
      title: "",
      caption: "",
      showTitle: false,
      showArt: false,
      artSrc: null,
      showProxy: true,
      layout: "photo",
    });
    const inspectSrc = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "cardInspect.ts"),
      "utf8"
    );
    expect(inspectSrc).toContain("dialog.classList.toggle(INSPECT_PHOTO_CLASS");
    expect(inspectSrc).toContain("title.hidden = !view.showTitle");
    const html = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toContain('class="card-inspect-close-form"');
    expect(html).not.toMatch(/class="card-inspect-close"[^>]*>\s*Close\s*</);
  });
});

describe("inspect photo letterbox click-outside", () => {
  const photoBox = { left: 50, top: 40, width: 200, height: 200 };

  test("object-fit contain paints a landscape image as a centered strip", () => {
    expect(inspectContainedImageRect(photoBox, 400, 100)).toEqual({
      left: 50,
      top: 115,
      width: 200,
      height: 50,
    });
  });

  test("object-fit contain paints a portrait image as a centered column", () => {
    expect(inspectContainedImageRect(photoBox, 100, 400)).toEqual({
      left: 125,
      top: 40,
      width: 50,
      height: 200,
    });
  });

  test("a matching aspect ratio fills the box", () => {
    expect(inspectContainedImageRect(photoBox, 100, 100)).toEqual(photoBox);
  });

  test("unloaded or empty natural size has no painted rect", () => {
    expect(inspectContainedImageRect(photoBox, 0, 100)).toBeNull();
    expect(inspectContainedImageRect(photoBox, 100, 0)).toBeNull();
    expect(inspectContainedImageRect({ left: 0, top: 0, width: 0, height: 200 }, 100, 100)).toBeNull();
    expect(inspectContainedImageRect(null, 100, 100)).toBeNull();
  });

  test("dialog chrome is outside; painted pixels are not; letterbox is", () => {
    const dialog = {
      classList: { contains: (name) => name === INSPECT_PHOTO_CLASS },
    };
    const art = {
      naturalWidth: 400,
      naturalHeight: 100,
      getBoundingClientRect: () => photoBox,
    };
    const closeBtn = { id: "close" };
    expect(isInspectOutsideClick({ target: dialog }, dialog, art)).toBe(true);
    expect(isInspectOutsideClick({ target: closeBtn }, dialog, art)).toBe(false);
    expect(isInspectOutsideClick({ target: art, clientX: 150, clientY: 140 }, dialog, art)).toBe(
      false
    );
    expect(isInspectOutsideClick({ target: art, clientX: 150, clientY: 50 }, dialog, art)).toBe(
      true
    );
    expect(isInspectOutsideClick({ target: art, clientX: 150, clientY: 185 }, dialog, art)).toBe(
      true
    );
  });

  test("letterbox hits do not close card inspect or an unloaded photo", () => {
    const cardDialog = { classList: { contains: () => false } };
    const photoDialog = {
      classList: { contains: (name) => name === INSPECT_PHOTO_CLASS },
    };
    const art = {
      naturalWidth: 400,
      naturalHeight: 100,
      getBoundingClientRect: () => photoBox,
    };
    const unloaded = {
      naturalWidth: 0,
      naturalHeight: 0,
      getBoundingClientRect: () => photoBox,
    };
    expect(isInspectOutsideClick({ target: art, clientX: 150, clientY: 50 }, cardDialog, art)).toBe(
      false
    );
    expect(
      isInspectOutsideClick({ target: unloaded, clientX: 150, clientY: 50 }, photoDialog, unloaded)
    ).toBe(false);
    expect(isInspectOutsideClick({ target: art, clientX: 150, clientY: 50 }, photoDialog, null)).toBe(
      false
    );
    expect(isInspectOutsideClick(null, photoDialog, art)).toBe(false);
  });
});

describe("card inspect sequence navigation", () => {
  const tiles = [{ id: "t0" }, { id: "t1" }, { id: "t2" }];
  const copper = { id: "hand-1", name: "Copper" };
  const silver = { id: "hand-2", name: "Silver" };
  const gold = { id: "hand-3", name: "Gold" };
  const sequence = [
    { card: copper, imageSrc: "/copper.png", tile: tiles[0] },
    { card: silver, imageSrc: "/silver.png", tile: tiles[1] },
    { card: gold, imageSrc: "/gold.png", tile: tiles[2] },
  ];

  test("hides the left arrow on the first card and the right arrow on the last", () => {
    expect(inspectNavState(0, 0)).toEqual({ index: 0, hasPrev: false, hasNext: false });
    expect(inspectNavState(1, 0)).toEqual({ index: 0, hasPrev: false, hasNext: false });
    expect(inspectNavState(3, 0)).toEqual({ index: 0, hasPrev: false, hasNext: true });
    expect(inspectNavState(3, 1)).toEqual({ index: 1, hasPrev: true, hasNext: true });
    expect(inspectNavState(3, 2)).toEqual({ index: 2, hasPrev: true, hasNext: false });
    expect(inspectNavState(3, 99)).toEqual({ index: 2, hasPrev: true, hasNext: false });
    expect(inspectNavIndex(3, 0, "prev")).toBeNull();
    expect(inspectNavIndex(3, 0, "next")).toBe(1);
    expect(inspectNavIndex(3, 1, "prev")).toBe(0);
    expect(inspectNavIndex(3, 1, "next")).toBe(2);
    expect(inspectNavIndex(3, 2, "next")).toBeNull();
    expect(inspectNavIndex(3, 2, "prev")).toBe(1);
  });

  test("does not wrap from the last card back to the first", () => {
    expect(inspectNavIndex(5, 4, "next")).toBeNull();
    expect(inspectNavIndex(5, 0, "prev")).toBeNull();
    expect(inspectNavIndex(2, 1, "next")).toBeNull();
  });

  test("arrow keys step without wrapping and ignore modifiers", () => {
    expect(inspectKeyDirection({ key: "ArrowLeft" })).toBe("prev");
    expect(inspectKeyDirection({ key: "ArrowRight" })).toBe("next");
    expect(inspectKeyDirection({ key: "ArrowUp" })).toBeNull();
    expect(inspectKeyDirection({ key: "Escape" })).toBeNull();
    expect(inspectKeyDirection({ key: "ArrowLeft", altKey: true })).toBeNull();
    expect(inspectKeyDirection({ key: "ArrowRight", ctrlKey: true })).toBeNull();
    expect(inspectKeyDirection({ key: "ArrowRight", metaKey: true })).toBeNull();
    expect(inspectKeyDirection({ key: "ArrowLeft", shiftKey: true })).toBeNull();
    expect(isInspectTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isInspectTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isInspectTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isInspectTypingTarget({ tagName: "BUTTON", isContentEditable: true })).toBe(true);
    expect(isInspectTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isInspectTypingTarget(null)).toBe(false);
    expect(inspectNavDirectionFromDataset("prev")).toBe("prev");
    expect(inspectNavDirectionFromDataset("next")).toBe("next");
    expect(inspectNavDirectionFromDataset("close")).toBeNull();
  });

  test("opens a zone sequence from the clicked tile and stays in that zone", () => {
    expect(inspectSequenceIndex(sequence, tiles[1])).toBe(1);
    expect(inspectSequenceIndex(sequence, { id: "other" })).toBe(-1);
    expect(inspectSequenceIndex(sequence, { id: "missing" })).toBe(-1);
    const middle = resolveInspectSession(silver, "/silver.png", tiles[1], sequence);
    expect(middle.index).toBe(1);
    expect(middle.nav).toEqual({ index: 1, hasPrev: true, hasNext: true });
    expect(middle.items).toEqual(sequence);
    const first = resolveInspectSession(copper, "/copper.png", tiles[0], sequence);
    expect(first.nav).toEqual({ index: 0, hasPrev: false, hasNext: true });
    const last = resolveInspectSession(gold, "/gold.png", tiles[2], sequence);
    expect(last.nav).toEqual({ index: 2, hasPrev: true, hasNext: false });
    const play = [
      { card: { id: "play-1", name: "Village" }, imageSrc: null, tile: tiles[0] },
      { card: { id: "play-2", name: "Smithy" }, imageSrc: null, tile: tiles[1] },
    ];
    const playSession = resolveInspectSession(play[0].card, null, tiles[0], play);
    expect(playSession.items).toHaveLength(2);
    expect(playSession.nav.hasPrev).toBe(false);
    expect(playSession.nav.hasNext).toBe(true);
    const lone = resolveInspectSession(copper, "/copper.png", tiles[0]);
    expect(lone.items).toHaveLength(1);
    expect(lone.nav).toEqual({ index: 0, hasPrev: false, hasNext: false });
    const missing = resolveInspectSession(copper, "/copper.png", tiles[0], [
      { card: silver, imageSrc: "/silver.png", tile: tiles[1] },
    ]);
    expect(missing.items).toHaveLength(1);
    expect(missing.items[0].card).toBe(copper);
    expect(missing.nav.hasNext).toBe(false);
  });

  test("overlay markup hides nav buttons until a neighbor exists", () => {
    expect(INSPECT_PREV_LABEL).toBe("Previous card");
    expect(INSPECT_NEXT_LABEL).toBe("Next card");
    const html = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toContain('id="card-inspect-prev"');
    expect(html).toContain('id="card-inspect-next"');
    expect(html).toContain('id="card-inspect-actions"');
    expect(html).toContain('data-card-action="play"');
    expect(html).toContain('data-card-action="discard"');
    expect(html).toContain('data-card-action="show"');
    expect(html).toContain(`title="${HAND_CARD_ACTIONS[0].tooltip}"`);
    expect(html).toContain(`title="${HAND_CARD_ACTIONS[1].tooltip}"`);
    expect(html).toContain(`title="${HAND_CARD_ACTIONS[2].tooltip}"`);
    expect(html).toContain(">PLAY<");
    expect(html).toContain(">DISCARD<");
    expect(html).toContain(">SHOW<");
    expect(html.indexOf('id="card-inspect-actions"')).toBeLessThan(
      html.indexOf('id="card-inspect-meta"')
    );
    expect(html.indexOf('id="card-inspect-meta"')).toBeLessThan(
      html.indexOf('id="card-inspect-error"')
    );
    expect(html).toContain(`aria-label="${INSPECT_PREV_LABEL}"`);
    expect(html).toContain(`aria-label="${INSPECT_NEXT_LABEL}"`);
    expect(html).toContain('data-inspect-nav="prev"');
    expect(html).toContain('data-inspect-nav="next"');
    expect(html).toMatch(/<button\s+type="button"\s+id="card-inspect-prev"/);
    expect(html).toMatch(/<button\s+type="button"\s+id="card-inspect-next"/);
    expect(html).toMatch(/id="card-inspect-prev"[\s\S]*?\bhidden\b/);
    expect(html).toMatch(/id="card-inspect-next"[\s\S]*?\bhidden\b/);
    const css = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).toContain(".card-inspect-stage");
    expect(css).toContain(".card-inspect-nav[hidden]");
    expect(css).toMatch(/#card-inspect-prev\s*\{[^}]*left:\s*0\.7rem/);
    expect(css).toMatch(/#card-inspect-next\s*\{[^}]*right:\s*0\.7rem/);
    expect(css).toMatch(/\.card-inspect-sheet\s*\{[^}]*padding:\s*0\.7rem 3\.4rem 1rem/);
    expect(css).toContain(".card-inspect-actions");
    expect(css).toMatch(/\.card-inspect-actions\s*\{[^}]*justify-content:\s*space-between/);
    expect(css).toContain(".card-inspect-action");
    expect(css).not.toContain("calc(-100% - 0.7rem)");
    expect(css).not.toContain("calc(100% + 0.7rem)");
    expect(css).not.toContain(".card-inspect-dialog.is-photo #card-inspect-prev");
    const main = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "main.ts"),
      "utf8"
    );
    const renderCards = main.slice(
      main.indexOf("function renderCards"),
      main.indexOf("function appendPlayerChip")
    );
    expect(renderCards).toContain("enableInspectNav = false");
    expect(renderCards).toContain("if (enableInspectNav) sequence.push({ card, imageSrc, tile, handActions })");
    expect(renderCards).toContain(
      "openCardInspect(card, imageSrc, tile, enableInspectNav ? sequence : undefined, {"
    );
    expect(main).toContain('renderCards(config, "board-cards", payload.gameBoard, cardPositions)');
    expect(main).not.toContain(
      'renderCards(config, "board-cards", payload.gameBoard, cardPositions, true)'
    );
    expect(main).toContain(
      'renderCards(config, "play-area-cards", payload.playArea, cardPositions, true)'
    );
    expect(main).toContain('renderCards(config, "hand-cards", payload.hand, cardPositions, true)');
  });
});

describe("deck hover Deal and Draw", () => {
  test("every deck gets Deal and Draw so later tickets can specialize per deck", () => {
    expect(DEFAULT_DECK_ACTIONS).toEqual([
      { id: "deal", label: "Deal" },
      { id: "draw", label: "Draw" },
    ]);
    expect(deckActionsFor({ name: "Main" })).toEqual(DEFAULT_DECK_ACTIONS);
    expect(deckActionsFor({ name: "Events" })).toEqual(DEFAULT_DECK_ACTIONS);
    expect(deckActionsFor(null)).toEqual(DEFAULT_DECK_ACTIONS);
  });

  test("Deal and Draw clicks read the deck name and build the action request", () => {
    expect(deckActionFromDataset({ deckAction: "deal", deckName: "Main" })).toEqual({
      action: "deal",
      deckName: "Main",
    });
    expect(deckActionFromDataset({ deckAction: "draw" })).toBeNull();
    expect(actionDialogCopy("deal").label).toBe("Cards to deal each player");
    expect(actionDialogCopy("draw").label).toBe("Cards to draw");
    expect(parseActionCount("3")).toBe(3);
    expect(parseActionCount(0)).toBeNull();
    expect(parseActionCount(ACTION_COUNT_MAX + 1)).toBeNull();
    expect(DEFAULT_ACTION_COUNT).toBe(ACTION_COUNT_MIN);
    expect(
      visualActionBody({
        action: "draw",
        deck: "Main",
        count: 2,
        channelId: "newest-thread",
        guildId: "mock-guild",
        requestId: "req-abc-123456",
        fixture: "several-games",
      })
    ).toEqual({
      action: "draw",
      deck: "Main",
      count: 2,
      channelId: "newest-thread",
      guildId: "mock-guild",
      requestId: "req-abc-123456",
      fixture: "several-games",
    });
    expect(shouldUseOpenExternalLink(true, async () => ({}))).toBe(false);
    expect(shouldUseOpenExternalLink(false, async () => ({}))).toBe(true);
    expect(shouldUseOpenExternalLink(false, undefined)).toBe(false);
    expect(visualActionErrorMessage("invalid_count")).toContain("whole number");
    expect(CHANNEL_POST_FAILED_NOTICE).toContain("channel message");
    expect(actionRequestUrl("", "https:")).toBe("/api/game/action");
    expect(actionRequestUrl("gamebot.example.com", "https:")).toBe(
      "https://gamebot.example.com/api/game/action"
    );
    expect(HAND_CARD_ACTIONS.map((action) => action.id)).toEqual([
      "play",
      "discard",
      "show",
    ]);
    expect(HAND_CARD_ACTIONS.map((action) => action.label)).toEqual([
      "PLAY",
      "DISCARD",
      "SHOW",
    ]);
    expect(HAND_CARD_ACTIONS[0].tooltip).toBe("Play a card from your hand.");
    expect(HAND_CARD_ACTIONS[1].tooltip).toBe("discard a card (not shown to everyone)");
    expect(HAND_CARD_ACTIONS[2].tooltip).toBe(
      "Show a card from your hand to other players. The card stays in your hand."
    );
    expect(
      visualHandActionBody({
        action: "play",
        cardId: "hand-1",
        channelId: "newest-thread",
        guildId: "mock-guild",
        requestId: "req-hand-123456",
        fixture: "several-games",
      })
    ).toEqual({
      action: "play",
      cardId: "hand-1",
      channelId: "newest-thread",
      guildId: "mock-guild",
      requestId: "req-hand-123456",
      fixture: "several-games",
    });
    expect(
      inspectHandActionsVisible({ card: { id: "hand-1" }, imageSrc: null, tile: {}, handActions: true }, "card")
    ).toBe(true);
    expect(
      inspectHandActionsVisible({ card: { id: "play-1" }, imageSrc: null, tile: {}, handActions: false }, "card")
    ).toBe(false);
    expect(
      inspectHandActionsVisible({ card: { id: "hand-1" }, imageSrc: null, tile: {}, handActions: true }, "photo")
    ).toBe(false);
  });

  test("a failed PLAY/DISCARD/SHOW closes inspect so snapshot polls resume", () => {
    const main = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "main.ts"),
      "utf8"
    );
    const submit = main.slice(
      main.indexOf("async function submitHandCardAction"),
      main.indexOf("function bindActionDialog")
    );
    expect(submit).toContain("closeInspectAfterFailedAction");
    expect(submit).toMatch(/if \(!response\.ok\) \{[\s\S]*closeInspectAfterFailedAction\(\)/);
    expect(submit).toContain("flushDeferredSnapshot");
    expect(submit).toContain("setActionNotice");
  });

  test("Edit Scores posts the shared scores action body", () => {
    expect(EDIT_SCORES_LABEL).toBe("Edit Scores");
    expect(SAVE_SCORES_LABEL).toBe("Save");
    expect(SCORE_EDITING_CLASS).toBe("status-scores-editing");
    expect(
      visualScoreBody({
        scores: { "mock-user-1": "21", "other-player-2": "9" },
        channelId: "newest-thread",
        guildId: "mock-guild",
        requestId: "req-score-123",
        fixture: "several-games",
      })
    ).toEqual({
      action: "scores",
      scores: { "mock-user-1": "21", "other-player-2": "9" },
      channelId: "newest-thread",
      guildId: "mock-guild",
      requestId: "req-score-123",
      fixture: "several-games",
    });
    expect(
      collectScoreInputs({
        querySelectorAll() {
          return [
            { dataset: { userId: "mock-user-1" }, value: "21" },
            { dataset: { userId: "other-player-2" }, value: "9" },
          ];
        },
      })
    ).toEqual({ "mock-user-1": "21", "other-player-2": "9" });
    expect(SCORE_MAX_LENGTH).toBe(4000);
    expect(
      baselineScores([
        { userId: "mock-user-1", score: "10" },
        { userId: "other-player-2", score: "7" },
      ])
    ).toEqual({ "mock-user-1": "10", "other-player-2": "7" });
    expect(
      changedScores(
        { "mock-user-1": "21", "other-player-2": "7" },
        { "mock-user-1": "10", "other-player-2": "7" }
      )
    ).toEqual({ "mock-user-1": "21" });
  });

  test("game channel link uses the selected guild and channel ids", () => {
    expect(gameChannelUrl("guild-1", "thread-9")).toBe(
      "https://discord.com/channels/guild-1/thread-9"
    );
    expect(gameChannelUrl("", "thread-9")).toBeNull();
    expect(GAME_CHANNEL_LINK_LABEL).toBe("Open Discord channel");
    const html = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "index.html"),
      "utf8"
    );
    expect(html).toContain('id="game-channel-link"');
    expect(html).toContain('id="action-dialog"');
    expect(html).toContain('id="action-count"');
    expect(html).toContain('id="card-inspect"');
    const css = require("fs").readFileSync(
      require("path").join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).toContain("--card-hover-scale: 1.48");
    expect(css).toContain("scale(var(--card-hover-scale))");
    expect(css).not.toContain("scale(1.28)");
    expect(css).toMatch(/\.card-tile img[\s\S]*object-fit:\s*contain/);
    expect(css).toMatch(/\.hand-fan\s*\{[^}]*padding:\s*0\.45rem/);
    expect(css).not.toMatch(/\.hand-fan\s*\{[^}]*padding:\s*5\.6rem/);
    expect(css).toContain("history-changed-flash");
    expect(css).not.toContain(".deck-tile:hover .card-face");
    expect(visualActionErrorMessage("not_a_player")).toBe(
      "You're not a player in this game."
    );
    expect(visualActionErrorMessage("not_a_guild_member")).toBe(
      "You're not a member of this server."
    );
    expect(visualActionErrorMessage("invalid_count")).toBe(
      `Enter a whole number from ${ACTION_COUNT_MIN} to ${ACTION_COUNT_MAX}.`
    );
    expect(visualActionErrorMessage("no_cards_in_draw")).toBe("No cards in draw pile");
    expect(visualActionErrorMessage("mystery", "No cards to deal.")).toBe(
      "No cards to deal."
    );
  });

  test("channel-link SDK success stays in Discord; reject falls back to href", async () => {
    const href = "https://discord.com/channels/guild-1/thread-9";
    expect(
      await tryOpenExternalLink(href, async () => ({ opened: true }))
    ).toBe("opened");
    expect(
      await tryOpenExternalLink(href, async () => ({ opened: false }))
    ).toBe("cancelled");
    expect(await tryOpenExternalLink(href, async () => undefined)).toBe("opened");
    expect(
      await tryOpenExternalLink(href, async () => {
        throw new Error("command failed");
      })
    ).toBe("failed");
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
