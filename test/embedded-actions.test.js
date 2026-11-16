const { afterAll, beforeAll, describe, expect, test } = require("bun:test");
const {
  applyVisualCardAction,
  parseVisualActionBody,
  parseVisualActionCount,
  runVisualCardAction,
} = require("../modules/embeddedActions");
const GameDB = require("../db/anygame");
const Formatter = require("../modules/GameFormatter");
const {
  createActiveGame,
  createCard,
  createDeck,
  createPlayer,
} = require("./helpers/harness");

function gameWithDeck() {
  return createActiveGame({
    name: "Friday Inis",
    players: [
      createPlayer({
        userId: "snowflake-user",
        name: "Will",
        order: 0,
        hands: { main: [createCard({ id: "hand-1", name: "Copper" })] },
      }),
      createPlayer({ userId: "other-player", name: "Riley", order: 1 }),
    ],
    decks: [
      createDeck({
        name: "Main",
        draw: [
          createCard({ id: "d1", name: "Ace" }),
          createCard({ id: "d2", name: "King" }),
          createCard({ id: "d3", name: "Queen" }),
          createCard({ id: "d4", name: "Jack" }),
        ],
      }),
    ],
  });
}

const actor = {
  id: "snowflake-user",
  username: "willsullivan",
  displayName: "Will",
};

describe("parseVisualActionBody", () => {
  test("accepts deal/draw with a deck name and count 1-99", () => {
    expect(
      parseVisualActionBody({ action: "deal", deck: "Main", count: 3 })
    ).toEqual({ action: "deal", deckName: "Main", count: 3 });
    expect(
      parseVisualActionBody({ action: "DRAW", deck: " Events ", count: 1 })
    ).toEqual({ action: "draw", deckName: "Events", count: 1 });
    expect(parseVisualActionCount(0)).toBeNull();
    expect(parseVisualActionCount(100)).toBeNull();
    expect(parseVisualActionBody({ action: "shuffle", deck: "Main", count: 1 })).toEqual({
      error: "invalid_action",
      status: 400,
      message: "Deal and Draw are the only visual actions.",
    });
    expect(parseVisualActionBody({ action: "deal", count: 1 })).toEqual({
      error: "missing_deck",
      status: 400,
      message: "Pick a deck first.",
    });
    expect(parseVisualActionBody({ action: "deal", deck: "Main", count: 0 })).toEqual({
      error: "invalid_count",
      status: 400,
      message: "Enter a number from 1 to 99.",
    });
  });
});

describe("applyVisualCardAction", () => {
  test("deal follows /cards deck deal and draw follows drawmultiple", () => {
    const dealGame = gameWithDeck();
    const dealt = applyVisualCardAction(dealGame, {
      action: "deal",
      deckName: "Main",
      count: 1,
      actor,
      userId: actor.id,
    });
    expect(dealt.ok).toBe(true);
    expect(dealt.content).toBe("Dealt out a total of 2 cards from Main.");
    expect(dealGame.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
    ]);
    expect(dealGame.players[1].hands.main.map((card) => card.name)).toEqual(["King"]);

    const drawGame = gameWithDeck();
    const drawn = applyVisualCardAction(drawGame, {
      action: "draw",
      deckName: "Main",
      count: 2,
      actor,
      userId: actor.id,
    });
    expect(drawn.ok).toBe(true);
    expect(drawn.content).toBe("Will drew 2 cards from Main");
    expect(drawGame.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
      "King",
    ]);
    expect(drawGame.history.at(-1).summary).toBe("Will drew 2 cards from Main");
  });
});

describe("runVisualCardAction", () => {
  const originalCreateGameStatusReply = Formatter.createGameStatusReply;

  beforeAll(() => {
    Formatter.createGameStatusReply = async (_gameData, _guild, _clientUserId, options = {}) => ({
      content: options.content ?? "📊",
      embeds: [],
      files: [],
    });
  });

  afterAll(() => {
    Formatter.createGameStatusReply = originalCreateGameStatusReply;
  });

  test("saves the game, posts to the channel, and returns an updated snapshot", async () => {
    const gameData = gameWithDeck();
    const posted = [];
    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      send: async (payload) => {
        posted.push(payload);
        return { id: "msg-1" };
      },
    };
    const store = new Map();
    store.set("guild-1:game:thread-game", gameData);
    const discordClient = {
      user: { id: "bot-1" },
      channels: {
        cache: { get: (id) => (id === "thread-game" ? channel : null) },
      },
      async getGameDataV2(guildId, collection, channelId) {
        return store.get(`${guildId}:${collection}:${channelId}`) || null;
      },
      async setGameDataV2(guildId, collection, channelId, data) {
        store.set(`${guildId}:${collection}:${channelId}`, data);
      },
    };

    const result = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 2,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });

    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Will drew 2 cards from Main");
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace", "King"]);
    expect(result.body.status.history.at(-1).summary).toBe("Will drew 2 cards from Main");
    expect(posted[0].content).toContain("Will drew 2 cards from Main");
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.history.at(-1).action.type).toBe(GameDB.ACTION_TYPES.DRAW);
  });

  test("non-players cannot run visual actions", async () => {
    const result = await runVisualCardAction({
      action: "deal",
      deckName: "Main",
      count: 1,
      user: { id: "stranger", username: "nope" },
      guildId: "guild-1",
      channelId: "thread-game",
      getGameData: async () => gameWithDeck(),
    });
    expect(result).toEqual({
      status: 403,
      body: {
        error: "not_a_player",
        message: "You're not a player in this game.",
      },
    });
  });

  test("uses the guild nickname in history and the channel post", async () => {
    const gameData = gameWithDeck();
    const posted = [];
    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      send: async (payload) => {
        posted.push(payload);
        return { id: "msg-1" };
      },
    };
    const store = new Map();
    store.set("guild-1:game:thread-game", gameData);
    const discordClient = {
      user: { id: "bot-1" },
      channels: {
        cache: { get: (id) => (id === "thread-game" ? channel : null) },
      },
      guilds: {
        cache: {
          get: (guildId) =>
            guildId === "guild-1"
              ? {
                  members: {
                    cache: {
                      get: (userId) =>
                        userId === "snowflake-user"
                          ? { displayName: "WillOnServer" }
                          : null,
                    },
                  },
                }
              : null,
        },
      },
      async getGameDataV2(guildId, collection, channelId) {
        return store.get(`${guildId}:${collection}:${channelId}`) || null;
      },
      async setGameDataV2(guildId, collection, channelId, data) {
        store.set(`${guildId}:${collection}:${channelId}`, data);
      },
    };

    const result = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });

    expect(result.status).toBe(200);
    expect(result.body.message).toBe("WillOnServer drew 1 cards from Main");
    expect(result.body.status.history.at(-1).summary).toBe(
      "WillOnServer drew 1 cards from Main"
    );
    expect(posted[0].content).toContain("WillOnServer drew 1 cards from Main");
  });

  test("still returns the updated table if the follow-up snapshot load fails", async () => {
    const gameData = gameWithDeck();
    let loads = 0;
    const result = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      getGameData: async () => {
        loads += 1;
        if (loads === 1) return gameData;
        throw new Error("snapshot lookup failed");
      },
      gameStore: {
        upsertGameData() {},
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Will drew 1 cards from Main");
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
  });
});
