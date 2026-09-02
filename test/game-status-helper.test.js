const { describe, expect, test, beforeEach, afterAll } = require("bun:test");
const { PermissionsBitField } = require("discord.js");
const GameStatusHelper = require("../modules/GameStatusHelper");
const Formatter = require("../modules/GameFormatter");
const GameDB = require("../db/anygame");

const originalCreateGameStatusReply = Formatter.createGameStatusReply;

function snapshotReply(content = "📊") {
  return {
    content,
    embeds: [{ title: "Game Status" }],
    files: [{ name: "table.png" }],
  };
}

function createGameData(overrides = {}) {
  return {
    lastStatusMessageId: null,
    lastStatusMessageTimestamp: null,
    pinnedStatusEnabled: false,
    pinnedStatusMessageId: null,
    pinnedStatusChannelId: null,
    pinnedStatusPinned: false,
    ...overrides,
  };
}

function createHarness({
  gameData = createGameData(),
  manageMessages = true,
  pinThrows = null,
  fetchImpl = null,
  deferred = true,
} = {}) {
  const pinCalls = [];
  const sendCalls = [];
  const fetchCalls = [];
  const editCalls = [];
  const chatReplyCalls = [];
  const persistCalls = [];
  const unpinCalls = [];

  const pinMessage = {
    id: "pin-1",
    pinned: false,
    content: "",
    pin: async () => {
      pinCalls.push("pin");
      if (pinThrows) {
        throw pinThrows;
      }
      pinMessage.pinned = true;
    },
    unpin: async () => {
      unpinCalls.push("unpin");
      pinMessage.pinned = false;
    },
    edit: async (payload) => {
      editCalls.push(payload);
      if (typeof payload.content === "string") {
        pinMessage.content = payload.content;
      }
      return pinMessage;
    },
  };

  const channel = {
    id: "channel-1",
    guild: { id: "guild-1" },
    permissionsFor: () => ({
      has: (flag) => manageMessages && flag === PermissionsBitField.Flags.ManageMessages,
    }),
    messages: {
      fetch: async (idOrOptions) => {
        const id = typeof idOrOptions === "object" && idOrOptions
          ? (idOrOptions.message || idOrOptions.id)
          : idOrOptions;
        fetchCalls.push(id);
        if (fetchImpl) {
          return fetchImpl(id, pinMessage);
        }
        if (id === pinMessage.id) {
          return pinMessage;
        }
        return {
          id,
          content: "old chat status",
          edit: async (payload) => {
            editCalls.push({ id, ...payload });
          },
        };
      },
    },
    send: async (payload) => {
      sendCalls.push(payload);
      if (typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)) {
        return pinMessage;
      }
      return { id: "chat-1" };
    },
  };

  const interaction = {
    guildId: "guild-1",
    channelId: "channel-1",
    guild: channel.guild,
    channel,
    deferred,
    replied: false,
    editReply: async (payload) => {
      chatReplyCalls.push(payload);
      return { id: "chat-1" };
    },
    reply: async (payload) => {
      chatReplyCalls.push(payload);
      return { id: "chat-1" };
    },
  };

  const storedGame = structuredClone(gameData);

  const client = {
    user: { id: "bot-1" },
    getGameDataV2: async () => structuredClone(storedGame),
    setGameDataV2: async (...args) => {
      Object.assign(storedGame, args[3]);
      persistCalls.push(args);
    },
  };

  return {
    gameData,
    storedGame,
    channel,
    interaction,
    client,
    pinMessage,
    pinCalls,
    sendCalls,
    fetchCalls,
    editCalls,
    chatReplyCalls,
    persistCalls,
    unpinCalls,
  };
}

describe("GameStatusHelper pinned live status", () => {
  beforeEach(() => {
    Formatter.createGameStatusReply = async (_gameData, _guild, _clientUserId, options = {}) =>
      snapshotReply(options.content);
  });

  afterAll(() => {
    Formatter.createGameStatusReply = originalCreateGameStatusReply;
  });

  test("new games default pinned live status to off", () => {
    expect(GameDB.defaultGameData.pinnedStatusMode).toBe("off");
    expect(GameDB.defaultGameData.pinnedStatusEnabled).toBe(false);
    expect(GameDB.defaultGameData.pinnedStatusMessageId).toBeNull();
    expect(GameDB.defaultGameData.pinnedStatusChannelId).toBeNull();
    expect(GameDB.defaultGameData.pinnedStatusPinned).toBe(false);
  });

  test("config off (default) does no pin work", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: false }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.sendCalls).toHaveLength(0);
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
    expect(harness.persistCalls).toHaveLength(1);
  });

  test("undefined pinnedStatusEnabled is treated as off", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: undefined }),
    });

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "drew a card",
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content).toBe("drew a card");
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
  });

  test("persistPinFields merges pin ids into the latest saved game state", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        players: [{ userId: "p1", score: 0 }],
      }),
    });

    harness.storedGame.players = [{ userId: "p1", score: 99 }];
    harness.gameData.pinnedStatusMessageId = "pin-1";
    harness.gameData.pinnedStatusChannelId = "channel-1";
    harness.gameData.pinnedStatusPinned = true;

    await GameStatusHelper.persistPinFields(harness.client, harness.interaction, harness.gameData);

    expect(harness.persistCalls).toHaveLength(1);
    const saved = harness.persistCalls[0][3];
    expect(saved.players[0].score).toBe(99);
    expect(saved.pinnedStatusMessageId).toBe("pin-1");
    expect(saved.pinnedStatusChannelId).toBe("channel-1");
    expect(saved.pinnedStatusPinned).toBe(true);
  });

  test("first status with pin enabled creates, pins, and persists a separate pin id", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].content).toBe("📊");
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)).toBe(true);
    expect(harness.sendCalls[0].content.includes("📊")).toBe(false);
    expect(harness.sendCalls[0].embeds).toEqual([{ title: "Game Status" }]);
    expect(harness.pinCalls).toHaveLength(1);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.pinnedStatusChannelId).toBe("channel-1");
    expect(harness.gameData.pinnedStatusPinned).toBe(true);
    expect(harness.persistCalls.length).toBeGreaterThanOrEqual(2);
    const lastPersist = harness.persistCalls[harness.persistCalls.length - 1][3];
    expect(lastPersist.pinnedStatusMessageId).toBe("pin-1");
    expect(lastPersist.lastStatusMessageId).toBe("chat-1");
  });

  test("later status edits the pin in place and still sends a new chat status", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
    });
    harness.pinMessage.pinned = true;

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "Alice drew 3 cards",
    });

    const pinSends = harness.sendCalls.filter((payload) =>
      typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    );
    const chatSends = harness.sendCalls.filter((payload) => payload.content === "Alice drew 3 cards");
    expect(chatSends).toHaveLength(1);
    expect(pinSends).toHaveLength(0);
    expect(harness.fetchCalls).toContain("pin-1");
    expect(harness.editCalls.some((payload) =>
      typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    )).toBe(true);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    // In-place pin edits should not rewrite the whole game document.
    expect(harness.persistCalls).toHaveLength(1);
  });

  test("cleanUpPreviousMessage never fetches or edits the pinned id", async () => {
    const harness = createHarness();
    const gameData = createGameData({
      lastStatusMessageId: "pin-1",
      lastStatusMessageTimestamp: Date.now(),
      pinnedStatusMessageId: "pin-1",
    });

    await GameStatusHelper.cleanUpPreviousMessage(harness.channel, gameData);

    expect(harness.fetchCalls).toHaveLength(0);
    expect(harness.editCalls).toHaveLength(0);
  });

  test("cleanUpPreviousMessage still strips a recent chat status that is not the pin", async () => {
    const harness = createHarness();
    const gameData = createGameData({
      lastStatusMessageId: "chat-old",
      lastStatusMessageTimestamp: Date.now(),
      pinnedStatusMessageId: "pin-1",
    });

    await GameStatusHelper.cleanUpPreviousMessage(harness.channel, gameData);

    expect(harness.fetchCalls).toEqual(["chat-old"]);
    expect(harness.editCalls.some((payload) => payload.id === "chat-old")).toBe(true);
  });

  test("unknown pin message is recreated and the new id is persisted", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "missing-pin",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
      fetchImpl: async (id) => {
        if (id === "missing-pin") {
          const error = new Error("Unknown Message");
          error.code = 10008;
          throw error;
        }
        return { id };
      },
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    const lastPersist = harness.persistCalls[harness.persistCalls.length - 1][3];
    expect(lastPersist.pinnedStatusMessageId).toBe("pin-1");
  });

  test("pin() failure still persists chat status and records pinnedStatusPinned = false", async () => {
    const pinError = new Error("Missing Permissions");
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true }),
      pinThrows: pinError,
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
    expect(harness.persistCalls.some((call) => call[3].lastStatusMessageId === "chat-1")).toBe(true);
  });

  test("clearPinnedStatus marks the pin ended, unpins, and clears pin fields", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
    });
    harness.pinMessage.pinned = true;

    await GameStatusHelper.clearPinnedStatus(harness.channel, harness.client, harness.gameData, { ended: true });

    expect(harness.editCalls.some((payload) =>
      payload.content === `${GameStatusHelper.PINNED_STATUS_HEADER} — this game has ended.`
    )).toBe(true);
    expect(harness.unpinCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
    expect(harness.gameData.pinnedStatusChannelId).toBeNull();
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
  });

  test("clearPinnedStatus marks the pin off when the feature is toggled off", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
    });
    harness.pinMessage.pinned = true;

    await GameStatusHelper.clearPinnedStatus(harness.channel, harness.client, harness.gameData, { ended: false });

    expect(harness.editCalls.some((payload) =>
      payload.content === `${GameStatusHelper.PINNED_STATUS_HEADER} is off for this game.`
    )).toBe(true);
    expect(harness.unpinCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
    expect(harness.gameData.pinnedStatusChannelId).toBeNull();
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
  });

  test("clearPinnedStatus still clears fields when Discord fetch fails", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
      fetchImpl: async () => {
        throw new Error("boom");
      },
    });

    await GameStatusHelper.clearPinnedStatus(harness.channel, harness.client, harness.gameData, { ended: true });

    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
    expect(harness.gameData.pinnedStatusChannelId).toBeNull();
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
  });

  test("missing Manage Messages still creates the live message without pinning", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true }),
      manageMessages: false,
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
  });

  test("pin() permission failure still persists chat status without editing the live message notice", async () => {
    const pinError = Object.assign(new Error("Missing Permissions"), { code: 50013 });
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true }),
      pinThrows: pinError,
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.pinCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
    expect(harness.pinMessage.content).not.toContain(GameStatusHelper.MANUAL_PIN_COMMAND_NOTICE);
  });

  test("buildManualPinCommandNotice prompts manual pin when the bot cannot pin", () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true, pinnedStatusPinned: false }),
      manageMessages: false,
    });

    const notice = GameStatusHelper.buildManualPinCommandNotice(
      harness.channel,
      harness.client,
      harness.gameData
    );

    expect(notice).toBe(GameStatusHelper.MANUAL_PIN_COMMAND_NOTICE);
  });

  test("unpinned live message is re-pinned on a later update", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
    });
    harness.pinMessage.pinned = false;

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "Alice drew 3 cards",
    });

    expect(harness.pinCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusPinned).toBe(true);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });

  test("pin send failure does not fail the chat status", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusEnabled: true }),
    });
    harness.channel.send = async (payload) => {
      harness.sendCalls.push(payload);
      if (typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)) {
        throw new Error("cannot send pin");
      }
      return { id: "chat-1" };
    };

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
  });

  test("missing Manage Messages still edits the live message in place", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusEnabled: true,
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: false,
      }),
      manageMessages: false,
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.sendCalls).toHaveLength(0);
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.editCalls.some((payload) =>
      typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    )).toBe(true);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.pinnedStatusPinned).toBe(false);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
  });
});

describe("GameStatusHelper pinnedStatusMode", () => {
  beforeEach(() => {
    Formatter.createGameStatusReply = async (_gameData, _guild, _clientUserId, options = {}) =>
      snapshotReply(options.content);
  });

  afterAll(() => {
    Formatter.createGameStatusReply = originalCreateGameStatusReply;
  });

  test("legacy boolean true/false/undefined map to on/off, and an existing mode wins", () => {
    expect(GameStatusHelper.resolvePinnedStatusMode({ pinnedStatusEnabled: true })).toBe("on");
    expect(GameStatusHelper.resolvePinnedStatusMode({ pinnedStatusEnabled: false })).toBe("off");
    expect(GameStatusHelper.resolvePinnedStatusMode({ pinnedStatusEnabled: undefined })).toBe("off");
    expect(GameStatusHelper.resolvePinnedStatusMode({})).toBe("off");
    expect(GameStatusHelper.resolvePinnedStatusMode({
      pinnedStatusMode: "full",
      pinnedStatusEnabled: false,
    })).toBe("full");
    expect(GameStatusHelper.resolvePinnedStatusMode({
      pinnedStatusMode: "on",
      pinnedStatusEnabled: false,
    })).toBe("on");
    expect(GameStatusHelper.resolvePinnedStatusMode({
      pinnedStatusMode: "off",
      pinnedStatusEnabled: true,
    })).toBe("off");
  });

  test("applyPinnedStatusModeDefaults is idempotent and does not overwrite a migrated mode", () => {
    const fromTrue = { pinnedStatusEnabled: true };
    GameStatusHelper.applyPinnedStatusModeDefaults(fromTrue);
    GameStatusHelper.applyPinnedStatusModeDefaults(fromTrue);
    expect(fromTrue.pinnedStatusMode).toBe("on");
    expect(fromTrue.pinnedStatusEnabled).toBe(true);

    const fromFalse = { pinnedStatusEnabled: false };
    GameStatusHelper.applyPinnedStatusModeDefaults(fromFalse);
    GameStatusHelper.applyPinnedStatusModeDefaults(fromFalse);
    expect(fromFalse.pinnedStatusMode).toBe("off");
    expect(fromFalse.pinnedStatusEnabled).toBe(false);

    const fromUndefined = {};
    GameStatusHelper.applyPinnedStatusModeDefaults(fromUndefined);
    GameStatusHelper.applyPinnedStatusModeDefaults(fromUndefined);
    expect(fromUndefined.pinnedStatusMode).toBe("off");
    expect(fromUndefined.pinnedStatusEnabled).toBe(false);

    const alreadyFull = { pinnedStatusMode: "full", pinnedStatusEnabled: false };
    GameStatusHelper.applyPinnedStatusModeDefaults(alreadyFull);
    GameStatusHelper.applyPinnedStatusModeDefaults(alreadyFull);
    expect(alreadyFull.pinnedStatusMode).toBe("full");
    expect(alreadyFull.pinnedStatusEnabled).toBe(false);
  });

  test("setPinnedStatusMode dual-writes the legacy boolean without deleting it", () => {
    const gameData = createGameData({ pinnedStatusEnabled: false });
    GameStatusHelper.setPinnedStatusMode(gameData, "full");
    expect(gameData.pinnedStatusMode).toBe("full");
    expect(gameData.pinnedStatusEnabled).toBe(true);

    GameStatusHelper.setPinnedStatusMode(gameData, "off");
    expect(gameData.pinnedStatusMode).toBe("off");
    expect(gameData.pinnedStatusEnabled).toBe(false);
  });

  test("mode on with a conflicting false boolean still pins (mode wins)", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusMode: "on",
        pinnedStatusEnabled: false,
      }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].embeds).toEqual([{ title: "Game Status" }]);
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });

  test("mode off with a conflicting true boolean does not pin", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusMode: "off",
        pinnedStatusEnabled: true,
      }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.sendCalls).toHaveLength(0);
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
  });

  test("full mode sendGameStatus skips the chat table but still updates the pin", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "full" }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "Alice drew a card",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].content).toBe("Alice drew a card");
    expect(harness.chatReplyCalls[0].embeds).toBeUndefined();
    expect(harness.chatReplyCalls[0].files).toBeUndefined();
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)).toBe(true);
    expect(harness.sendCalls[0].embeds).toEqual([{ title: "Game Status" }]);
    expect(harness.pinCalls).toHaveLength(1);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.lastStatusMessageId).toBeNull();
  });

  test("full mode sendPublicStatusUpdate skips the chat table but still updates the pin", async () => {
    const harness = createHarness({
      gameData: createGameData({
        pinnedStatusMode: "full",
        pinnedStatusMessageId: "pin-1",
        pinnedStatusChannelId: "channel-1",
        pinnedStatusPinned: true,
      }),
    });
    harness.pinMessage.pinned = true;

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "Alice drew 3 cards",
    });

    const pinSends = harness.sendCalls.filter((payload) =>
      typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    );
    const chatSends = harness.sendCalls.filter((payload) => payload.content === "Alice drew 3 cards");
    expect(chatSends).toHaveLength(0);
    expect(pinSends).toHaveLength(0);
    expect(harness.chatReplyCalls).toHaveLength(0);
    expect(harness.editCalls.some((payload) =>
      typeof payload.content === "string" && payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    )).toBe(true);
    expect(harness.gameData.lastStatusMessageId).toBeNull();
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });

  test("full mode plus explicitStatus still posts the chat table and updates the pin", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "full" }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
      explicitStatus: true,
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].content).toBe("📊");
    expect(harness.chatReplyCalls[0].embeds).toEqual([{ title: "Game Status" }]);
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)).toBe(true);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });

  test("on mode with pinnedStatusMode still posts chat status and updates the pin", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "on" }),
    });

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "📊",
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].embeds).toEqual([{ title: "Game Status" }]);
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.gameData.lastStatusMessageId).toBe("chat-1");
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });

  test("off mode with pinnedStatusMode still posts chat status and does not pin", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "off" }),
    });

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "drew a card",
    });

    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content).toBe("drew a card");
    expect(harness.pinCalls).toHaveLength(0);
    expect(harness.gameData.pinnedStatusMessageId).toBeNull();
  });

  test("full mode resolveDeferredReply resolves the interaction without the table", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "full" }),
    });

    await GameStatusHelper.sendPublicStatusUpdate(harness.interaction, harness.client, harness.gameData, {
      content: "created a new pile",
      resolveDeferredReply: true,
    });

    expect(harness.chatReplyCalls).toHaveLength(1);
    expect(harness.chatReplyCalls[0].content).toBe("created a new pile");
    expect(harness.chatReplyCalls[0].embeds).toBeUndefined();
    const chatSends = harness.sendCalls.filter((payload) => payload.content === "created a new pile");
    expect(chatSends).toHaveLength(0);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
    expect(harness.gameData.lastStatusMessageId).toBeNull();
  });

  test("full mode does not overwrite an interaction that already has a bespoke reply", async () => {
    const harness = createHarness({
      gameData: createGameData({ pinnedStatusMode: "full" }),
    });
    harness.interaction.replied = true;
    harness.interaction.deferred = true;

    await GameStatusHelper.sendGameStatus(harness.interaction, harness.client, harness.gameData, {
      content: "should not replace bespoke reply",
    });

    expect(harness.chatReplyCalls).toHaveLength(0);
    expect(harness.sendCalls).toHaveLength(1);
    expect(harness.sendCalls[0].content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)).toBe(true);
    expect(harness.gameData.pinnedStatusMessageId).toBe("pin-1");
  });
});
