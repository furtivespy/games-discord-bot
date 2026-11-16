const { afterAll, beforeAll, describe, expect, test } = require("bun:test");
const {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  parseActionCount,
} = require("../modules/actionCount");
const {
  applyVisualCardAction,
  createActionIdempotencyCache,
  parseVisualActionBody,
  runVisualCardAction,
  visualActionErrorMessage,
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
  test("accepts deal/draw with a deck name and the shared count range", () => {
    expect(
      parseVisualActionBody({ action: "deal", deck: "Main", count: 3 })
    ).toEqual({ action: "deal", deckName: "Main", count: 3, requestId: null });
    expect(
      parseVisualActionBody({
        action: "DRAW",
        deck: " Events ",
        count: 1,
        requestId: "req-12345678",
      })
    ).toEqual({
      action: "draw",
      deckName: "Events",
      count: 1,
      requestId: "req-12345678",
    });
    expect(parseActionCount(0)).toBeNull();
    expect(parseActionCount(ACTION_COUNT_MAX + 1)).toBeNull();
    expect(parseActionCount(99)).toBe(99);
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
      message: `Enter a whole number from ${ACTION_COUNT_MIN} to ${ACTION_COUNT_MAX}.`,
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

  test("draw without a player is not_a_player until the caller auto-joins", () => {
    const game = gameWithDeck();
    const drawn = applyVisualCardAction(game, {
      action: "draw",
      deckName: "Main",
      count: 1,
      actor: { id: "stranger", username: "nope", displayName: "Nope" },
      userId: "stranger",
    });
    expect(drawn).toMatchObject({
      ok: false,
      status: 403,
      error: "not_a_player",
    });
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

  function clientForGame(gameData, { send } = {}) {
    const posted = [];
    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      send: async (payload) => {
        if (typeof send === "function") return send(payload, posted);
        posted.push(payload);
        return { id: "msg-1" };
      },
    };
    const store = new Map();
    store.set("guild-1:game:thread-game", gameData);
    return {
      posted,
      store,
      discordClient: {
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
      },
    };
  }

  test("saves the game, posts to the channel, and returns an updated snapshot", async () => {
    const { posted, store, discordClient } = clientForGame(gameWithDeck());
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
    expect(result.body.channelPosted).toBe(true);
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace", "King"]);
    expect(result.body.status.history.at(-1).summary).toBe("Will drew 2 cards from Main");
    expect(posted[0].content).toContain("Will drew 2 cards from Main");
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.history.at(-1).action.type).toBe(GameDB.ACTION_TYPES.DRAW);
  });

  test("draw auto-joins a non-player the way /cards deck drawmultiple does", async () => {
    const { store, discordClient } = clientForGame(gameWithDeck());
    const result = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "stranger", username: "nope", global_name: "Guest" },
      member: { nick: "ChannelGuest" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe("ChannelGuest drew 1 cards from Main");
    expect(result.body.hand.map((card) => card.name)).toEqual(["Ace"]);
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players.some((player) => String(player.userId) === "stranger")).toBe(
      true
    );
  });

  test("deal does not require the caller to already be a player", async () => {
    const { discordClient } = clientForGame(gameWithDeck());
    const result = await runVisualCardAction({
      action: "deal",
      deckName: "Main",
      count: 1,
      user: { id: "stranger", username: "nope" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Dealt out a total of 2 cards from Main.");
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

  test("channelPosted is false when the public post fails and the game still stands", async () => {
    const { store, discordClient } = clientForGame(gameWithDeck(), {
      send: async () => {
        throw new Error("cannot send");
      },
    });
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
    expect(result.body.channelPosted).toBe(false);
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
    expect(store.get("guild-1:game:thread-game").players[0].hands.main).toHaveLength(2);
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
    expect(result.body.channelPosted).toBe(false);
  });

  test("duplicate request ids reuse the first successful result", async () => {
    const { posted, discordClient } = clientForGame(gameWithDeck());
    const cache = createActionIdempotencyCache();
    const first = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      requestId: "same-request-id-01",
      idempotency: cache,
    });
    const second = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      requestId: "same-request-id-01",
      idempotency: cache,
    });
    expect(first.status).toBe(200);
    expect(second.body.hand).toEqual(first.body.hand);
    expect(posted).toHaveLength(1);
  });

  test("the same requestId still runs when action, deck, or count differs", async () => {
    const { posted, discordClient } = clientForGame(gameWithDeck());
    const cache = createActionIdempotencyCache();
    const draw = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      requestId: "same-request-id-01",
      idempotency: cache,
    });
    const deal = await runVisualCardAction({
      action: "deal",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      requestId: "same-request-id-01",
      idempotency: cache,
    });
    expect(draw.status).toBe(200);
    expect(deal.status).toBe(200);
    expect(posted).toHaveLength(2);
    expect(deal.body.message).toContain("Dealt out");
  });

  test("the in-memory requestId map drops the oldest entry at the size cap", async () => {
    const cache = createActionIdempotencyCache({ maxSize: 1, ttlMs: 60_000 });
    const firstClient = clientForGame(gameWithDeck());
    await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: firstClient.discordClient,
      requestId: "first-request-01",
      idempotency: cache,
    });
    expect(cache.size()).toBe(1);
    const secondClient = clientForGame(gameWithDeck());
    await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: secondClient.discordClient,
      requestId: "second-request-01",
      idempotency: cache,
    });
    expect(cache.size()).toBe(1);
    const replayFirst = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: firstClient.discordClient,
      requestId: "first-request-01",
      idempotency: cache,
    });
    expect(firstClient.posted).toHaveLength(2);
    expect(replayFirst.status).toBe(200);
  });
});

describe("visualActionErrorMessage", () => {
  test("maps raw codes to friendly copy", () => {
    expect(visualActionErrorMessage("invalid_count")).toContain("whole number");
    expect(visualActionErrorMessage("not_a_player")).toBe(
      "You're not a player in this game."
    );
    expect(visualActionErrorMessage("not_a_guild_member")).toBe(
      "You're not a member of this server."
    );
    expect(visualActionErrorMessage("try_again")).toContain("Try again");
    expect(visualActionErrorMessage("no_cards_to_deal")).toBe("No cards to deal.");
  });
});
