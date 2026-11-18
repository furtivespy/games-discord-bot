const { afterAll, afterEach, beforeAll, describe, expect, test } = require("bun:test");
const {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  parseActionCount,
} = require("../modules/actionCount");
const {
  applyVisualCardAction,
  createActionIdempotencyCache,
  drainLockedVisualActions,
  applyVisualScoreAction,
  parseVisualActionBody,
  runVisualCardAction,
  runVisualScoreAction,
  visualActionErrorMessage,
  withGameDocumentLock,
} = require("../modules/embeddedActions");
const CardMoves = require("../modules/gameLogic/cardMoves");
const { PermissionsBitField } = require("discord.js");
const GameDB = require("../db/anygame");
const Formatter = require("../modules/GameFormatter");
const GameStatusHelper = require("../modules/GameStatusHelper");
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
      message: "Deal, Draw, Play, Discard, Show, and Edit Scores are the only visual actions.",
    });
    expect(
      parseVisualActionBody({ action: "play", cardId: "hand-1", requestId: "req-play-1" })
    ).toEqual({ action: "play", cardId: "hand-1", requestId: "req-play-1" });
    expect(parseVisualActionBody({ action: "discard", cardId: "  hand-1  " })).toEqual({
      action: "discard",
      cardId: "hand-1",
      requestId: null,
    });
    expect(parseVisualActionBody({ action: "show" })).toEqual({
      error: "missing_card",
      status: 400,
      message: "Pick a card first.",
    });
    expect(parseVisualActionBody({ action: "deal", count: 1 })).toEqual({
      error: "missing_deck",
      status: 400,
      message: "Pick a deck first.",
    });
    expect(
      parseVisualActionBody({
        action: "scores",
        scores: { "user-1": "12", "user-2": 7 },
        requestId: "req-score-1",
      })
    ).toEqual({
      action: "scores",
      scores: { "user-1": "12", "user-2": "7" },
      requestId: "req-score-1",
    });
    expect(
      parseVisualActionBody({
        action: "scores",
        scores: [{ userId: "user-1", score: "12" }],
      })
    ).toEqual({
      action: "scores",
      scores: {},
      requestId: null,
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

  test("play, discard, and show follow /cards hand play, discard, and show", () => {
    const playGame = gameWithDeck();
    const played = applyVisualCardAction(playGame, {
      action: "play",
      cardId: "hand-1",
      actor,
      userId: actor.id,
    });
    expect(played.ok).toBe(true);
    expect(played.revealCard).toBe(true);
    expect(played.content).toBe("Will has Played to discard pile:");
    expect(playGame.players[0].hands.main).toEqual([]);
    expect(playGame.decks[0].piles.discard.cards.map((card) => card.id)).toEqual(["hand-1"]);
    expect(playGame.history.at(-1).summary).toBe("Will played Copper to discard pile");

    const discardGame = gameWithDeck();
    const discarded = applyVisualCardAction(discardGame, {
      action: "discard",
      cardId: "hand-1",
      actor,
      userId: actor.id,
    });
    expect(discarded.ok).toBe(true);
    expect(discarded.revealCard).toBe(false);
    expect(discarded.content).toBe("Will has Discarded a card");
    expect(discardGame.players[0].hands.main).toEqual([]);
    expect(discardGame.history.at(-1).summary).toBe(
      "Will discarded a card to Main discard pile"
    );

    const showGame = gameWithDeck();
    const shown = applyVisualCardAction(showGame, {
      action: "show",
      cardId: "hand-1",
      actor,
      userId: actor.id,
    });
    expect(shown.ok).toBe(true);
    expect(shown.revealCard).toBe(true);
    expect(shown.content).toBe("Showing a card:");
    expect(showGame.players[0].hands.main.map((card) => card.id)).toEqual(["hand-1"]);
    expect(showGame.history.at(-1).summary).toBe("Will revealed Copper from hand");
  });

  test("playToPlayArea sends the card to the play area instead of discard", () => {
    const game = gameWithDeck();
    game.playToPlayArea = true;
    const played = applyVisualCardAction(game, {
      action: "play",
      cardId: "hand-1",
      actor,
      userId: actor.id,
    });
    expect(played.ok).toBe(true);
    expect(played.content).toBe("Will has Played to play area:");
    expect(game.players[0].hands.main).toEqual([]);
    expect(game.players[0].playArea.map((card) => card.id)).toEqual(["hand-1"]);
    expect(game.decks[0].piles.discard.cards).toEqual([]);
  });

  test("a card from another seat is card_not_in_hand and leaves both hands", () => {
    const game = gameWithDeck();
    game.players[1].hands.main = [createCard({ id: "other-hand-1", name: "Village" })];
    const played = applyVisualCardAction(game, {
      action: "play",
      cardId: "other-hand-1",
      actor,
      userId: actor.id,
    });
    expect(played).toMatchObject({
      ok: false,
      status: 409,
      error: "card_not_in_hand",
    });
    expect(game.players[0].hands.main.map((card) => card.id)).toEqual(["hand-1"]);
    expect(game.players[1].hands.main.map((card) => card.id)).toEqual(["other-hand-1"]);
  });

  test("hand actions without a player are not_a_player", () => {
    const game = gameWithDeck();
    const played = applyVisualCardAction(game, {
      action: "play",
      cardId: "hand-1",
      actor: { id: "stranger", username: "nope", displayName: "Nope" },
      userId: "stranger",
    });
    expect(played).toMatchObject({
      ok: false,
      status: 403,
      error: "not_a_player",
    });
    expect(game.players[0].hands.main.map((card) => card.id)).toEqual(["hand-1"]);
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

describe("applyVisualScoreAction", () => {
  test("follows /players scoreall modal submit using shared playerScores logic", () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    game.players[1].score = "";
    const applied = applyVisualScoreAction(game, {
      scores: { "snowflake-user": "21", "other-player": "9" },
      actor,
    });
    expect(applied.ok).toBe(true);
    expect(applied.changed).toBe(true);
    expect(applied.content).toBe("Player scores updated successfully.");
    expect(game.players[0].score).toBe("21");
    expect(game.players[1].score).toBe("9");
    expect(game.history.at(-1).summary).toBe(
      "Will updated player scores:\nWill's score changed from 1 to 21\nRiley's score changed from 0 to 9"
    );
    expect(game.history.at(-1).action).toEqual({ category: "player", type: "score" });
  });

  test("history uses provided player display names like the scoreall modal", () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    const applied = applyVisualScoreAction(game, {
      scores: { "snowflake-user": "21" },
      actor,
      playerNames: { "snowflake-user": "WillOnServer" },
    });
    expect(applied.ok).toBe(true);
    expect(game.history.at(-1).summary).toBe(
      "Will updated player scores:\nWillOnServer's score changed from 1 to 21"
    );
  });
});

describe("runVisualCardAction", () => {
  const originalCreateGameStatusReply = Formatter.createGameStatusReply;

  beforeAll(() => {
    Formatter.createGameStatusReply = async (gameData, _guild, _clientUserId, options = {}) => {
      const draw = gameData?.decks?.[0]?.piles?.draw?.cards;
      const hand = gameData?.players?.[0]?.hands?.main;
      return {
        content: options.content ?? "📊",
        embeds: [
          ...(Array.isArray(draw)
            ? [
                {
                  title: "Game Status",
                  remaining: draw.length,
                  handSize: Array.isArray(hand) ? hand.length : 0,
                },
              ]
            : []),
          ...(options.additionalEmbeds || []),
        ],
        files: [...(options.additionalFiles || [])],
      };
    };
  });

  afterAll(() => {
    Formatter.createGameStatusReply = originalCreateGameStatusReply;
  });

  afterEach(async () => {
    await drainLockedVisualActions();
  });

  function isPinnedStatusPayload(payload) {
    return (
      typeof payload?.content === "string" &&
      payload.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    );
  }

  function cloneGameDoc(data) {
    return data == null ? null : JSON.parse(JSON.stringify(data));
  }

  function clientForGame(gameData, { send } = {}) {
    const posted = [];
    const messages = new Map();
    let seq = 0;

    function registerMessage(payload, id) {
      const message = {
        id,
        content: payload?.content,
        embeds: payload?.embeds || [],
        pinned: false,
        async pin() {
          message.pinned = true;
        },
        async unpin() {
          message.pinned = false;
        },
        async delete() {
          messages.delete(id);
          message.pinned = false;
        },
        async edit(next) {
          if (typeof next?.content === "string") message.content = next.content;
          if (next?.embeds) message.embeds = next.embeds;
          return message;
        },
      };
      messages.set(id, message);
      return message;
    }

    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      permissionsFor: () => ({
        has: (flag) => flag === PermissionsBitField.Flags.ManageMessages,
      }),
      messages: {
        fetch: async (idOrOptions) => {
          const id =
            typeof idOrOptions === "object" && idOrOptions
              ? idOrOptions.message || idOrOptions.id
              : idOrOptions;
          return messages.get(id) || null;
        },
      },
      send: async (payload) => {
        let result;
        if (typeof send === "function") {
          result = await send(payload, posted);
        } else {
          posted.push(payload);
          result = { id: `msg-${posted.length}` };
        }
        const id = result?.id || `msg-${++seq}`;
        if (messages.has(id)) return messages.get(id);
        return registerMessage(payload, id);
      },
    };
    const store = new Map();
    store.set("guild-1:game:thread-game", cloneGameDoc(gameData));
    return {
      posted,
      messages,
      channel,
      pinnedStatusMessages() {
        return [...messages.values()].filter(
          (message) =>
            message.pinned &&
            typeof message.content === "string" &&
            message.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
        );
      },
      store,
      discordClient: {
        user: { id: "bot-1" },
        channels: {
          cache: { get: (id) => (id === "thread-game" ? channel : null) },
        },
        async getGameDataV2(guildId, collection, channelId) {
          return cloneGameDoc(store.get(`${guildId}:${collection}:${channelId}`));
        },
        async setGameDataV2(guildId, collection, channelId, data) {
          store.set(`${guildId}:${collection}:${channelId}`, cloneGameDoc(data));
        },
      },
    };
  }

  function gameWithPinnedDeck({ drawCount = 20 } = {}) {
    const game = gameWithDeck();
    game.pinnedStatusEnabled = true;
    game.pinnedStatusMode = "on";
    game.decks[0].piles.draw.cards = Array.from({ length: drawCount }, (_, i) =>
      createCard({ id: `d${i + 1}`, name: `Card${i + 1}` })
    );
    return game;
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
    await drainLockedVisualActions();

    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Will drew 2 cards from Main");
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace", "King"]);
    expect(result.body.status.history.at(-1).summary).toBe("Will drew 2 cards from Main");
    expect(posted[0].content).toContain("Will drew 2 cards from Main");
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.history.at(-1).action.type).toBe(GameDB.ACTION_TYPES.DRAW);
  });

  test("play, discard, and show save, post, and return an updated snapshot", async () => {
    const playClient = clientForGame(gameWithDeck());
    const played = await runVisualCardAction({
      action: "play",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: playClient.discordClient,
    });
    await drainLockedVisualActions();
    expect(played.status).toBe(200);
    expect(played.body.message).toBe("Will has Played to discard pile:");
    expect(played.body.hand).toEqual([]);
    expect(playClient.posted[0].content).toContain("Will has Played to discard pile:");
    expect(playClient.posted[0].embeds?.length).toBeGreaterThan(0);

    const discardClient = clientForGame(gameWithDeck());
    const discarded = await runVisualCardAction({
      action: "discard",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: discardClient.discordClient,
    });
    await drainLockedVisualActions();
    expect(discarded.status).toBe(200);
    expect(discarded.body.message).toBe("Will has Discarded a card");
    expect(discarded.body.hand).toEqual([]);
    expect(discardClient.posted[0].content).toContain("Will has Discarded a card");
    expect(discardClient.posted[0].embeds?.some((embed) => embed?.data?.title || embed?.title)).toBe(
      true
    );

    const showClient = clientForGame(gameWithDeck());
    const shown = await runVisualCardAction({
      action: "show",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient: showClient.discordClient,
    });
    await drainLockedVisualActions();
    expect(shown.status).toBe(200);
    expect(shown.body.message).toBe("Showing a card:");
    expect(shown.body.hand.map((card) => card.id)).toEqual(["hand-1"]);
    expect(showClient.posted[0].content).toContain("Showing a card:");
  });

  test("a crafted cardId from another seat returns 409 and leaves that hand unchanged", async () => {
    const game = gameWithDeck();
    game.players[1].hands.main = [
      createCard({ id: "riley-secret", name: "Village", origin: "Main" }),
    ];
    const { store, discordClient } = clientForGame(game);
    const result = await runVisualCardAction({
      action: "play",
      cardId: "riley-secret",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    await drainLockedVisualActions();
    expect(result.status).toBe(409);
    expect(result.body.error).toBe("card_not_in_hand");
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[1].hands.main.map((card) => card.id)).toEqual(["riley-secret"]);
    expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["hand-1"]);
    expect(saved.history).toEqual([]);
  });

  test("concurrent SHOW of the same card coalesces duplicate requestIds", async () => {
    const { posted, store, discordClient } = clientForGame(gameWithDeck());
    const cache = createActionIdempotencyCache();
    const args = {
      action: "show",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      idempotency: cache,
    };
    const [first, second] = await Promise.all([
      runVisualCardAction({ ...args, requestId: "show-req-aaaa" }),
      runVisualCardAction({ ...args, requestId: "show-req-bbbb" }),
    ]);
    await drainLockedVisualActions();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.history.filter((entry) => entry.action?.type === GameDB.ACTION_TYPES.REVEAL)).toHaveLength(
      1
    );
    expect(posted).toHaveLength(1);
    expect(saved.players[0].hands.main.map((card) => card.id)).toEqual(["hand-1"]);
  });

  test("duplicate SHOW requestIds reuse the first successful result", async () => {
    const { posted, discordClient } = clientForGame(gameWithDeck());
    const cache = createActionIdempotencyCache();
    const args = {
      action: "show",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
      requestId: "show-same-req-01",
      idempotency: cache,
    };
    const first = await runVisualCardAction(args);
    const second = await runVisualCardAction(args);
    await drainLockedVisualActions();
    expect(first.status).toBe(200);
    expect(second.body.hand).toEqual(first.body.hand);
    expect(posted).toHaveLength(1);
  });

  test("slash-style hand mutate waits for an in-flight visual persist", async () => {
    const game = gameWithDeck();
    game.players[0].hands.main = [
      createCard({ id: "hand-1", name: "Copper", origin: "Main" }),
      createCard({ id: "hand-2", name: "Silver", origin: "Main" }),
    ];
    const { store, discordClient } = clientForGame(game);
    let releaseLoad;
    const loadGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });
    let loads = 0;
    const originalGet = discordClient.getGameDataV2.bind(discordClient);
    discordClient.getGameDataV2 = async (...args) => {
      loads += 1;
      if (loads === 1) await loadGate;
      return originalGet(...args);
    };

    const visual = runVisualCardAction({
      action: "play",
      cardId: "hand-1",
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });

    const start = Date.now();
    while (loads < 1) {
      if (Date.now() - start > 2000) throw new Error("visual load never started");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    let slashSawHand1 = null;
    const slash = withGameDocumentLock("guild-1", "thread-game", async () => {
      const current = await originalGet("guild-1", "game", "thread-game");
      slashSawHand1 = current.players[0].hands.main.some((card) => card.id === "hand-1");
      CardMoves.playFromHand(current, {
        player: current.players[0],
        cardId: "hand-2",
        actor,
      });
      await discordClient.setGameDataV2("guild-1", "game", "thread-game", current);
    });

    releaseLoad();
    await Promise.all([visual, slash]);
    await drainLockedVisualActions();

    const saved = store.get("guild-1:game:thread-game");
    expect(slashSawHand1).toBe(false);
    expect(saved.players[0].hands.main.map((card) => card.id)).toEqual([]);
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
    await drainLockedVisualActions();
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
    await drainLockedVisualActions();
  });

  test("uses the guild nickname in history and the channel post", async () => {
    const gameData = gameWithDeck();
    const posted = [];
    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      messages: { fetch: async () => null },
      send: async (payload) => {
        posted.push(payload);
        return { id: "msg-1" };
      },
    };
    const store = new Map();
    store.set("guild-1:game:thread-game", cloneGameDoc(gameData));
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
        return cloneGameDoc(store.get(`${guildId}:${collection}:${channelId}`));
      },
      async setGameDataV2(guildId, collection, channelId, data) {
        store.set(`${guildId}:${collection}:${channelId}`, cloneGameDoc(data));
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
    await drainLockedVisualActions();

    expect(result.status).toBe(200);
    expect(result.body.message).toBe("WillOnServer drew 1 cards from Main");
    expect(result.body.status.history.at(-1).summary).toBe(
      "WillOnServer drew 1 cards from Main"
    );
    expect(posted[0].content).toContain("WillOnServer drew 1 cards from Main");
  });

  test("channel post failure still leaves the saved table in the HTTP body", async () => {
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
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
    expect(store.get("guild-1:game:thread-game").players[0].hands.main).toHaveLength(2);
    await drainLockedVisualActions();
  });

  test("failed channel post still refreshes the live pin", async () => {
    const originalRefresh = GameStatusHelper.refreshPinnedStatusAfterGameSave;
    const refreshes = [];
    GameStatusHelper.refreshPinnedStatusAfterGameSave = async (...args) => {
      refreshes.push(args);
    };
    try {
      const { discordClient } = clientForGame(gameWithDeck(), {
        send: async () => {
          throw new Error("cannot send");
        },
      });
      const result = await runVisualCardAction({
        action: "deal",
        deckName: "Main",
        count: 1,
        user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
        guildId: "guild-1",
        channelId: "thread-game",
        discordClient,
      });
      expect(result.status).toBe(200);
      await drainLockedVisualActions();
      expect(refreshes).toHaveLength(1);
      expect(refreshes[0][1]).toEqual({ guildId: "guild-1", channelId: "thread-game" });
    } finally {
      GameStatusHelper.refreshPinnedStatusAfterGameSave = originalRefresh;
    }
  });

  function concurrentActionClient() {
    const stored = JSON.parse(JSON.stringify(gameWithDeck()));
    const store = new Map();
    store.set("guild-1:game:race-thread", stored);
    const posted = [];
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const discordClient = {
      user: { id: "bot-1" },
      channels: {
        cache: {
          get: (id) =>
            id === "race-thread"
              ? {
                  id: "race-thread",
                  guild: { id: "guild-1" },
                  messages: { fetch: async () => null },
                  send: async (payload) => {
                    posted.push(payload);
                    return { id: `msg-${posted.length}` };
                  },
                }
              : null,
        },
      },
      guilds: {
        cache: { get: () => null },
        fetch: async () => ({
          members: {
            cache: { get: () => null },
            fetch: async (userId) => {
              if (userId === "snowflake-user") await delay(150);
              return {
                displayName: userId === "snowflake-user" ? "WillOnServer" : "Riley",
              };
            },
          },
        }),
      },
      async getGameDataV2(guildId, collection, channelId) {
        const data = store.get(`${guildId}:${collection}:${channelId}`);
        return data ? JSON.parse(JSON.stringify(data)) : null;
      },
      async setGameDataV2(guildId, collection, channelId, data) {
        await delay(20);
        store.set(
          `${guildId}:${collection}:${channelId}`,
          JSON.parse(JSON.stringify(data))
        );
      },
    };
    return { posted, store, discordClient };
  }

  test("concurrent draws with a slow nick lookup each persist a different card", async () => {
    const { posted, store, discordClient } = concurrentActionClient();
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "race-thread",
      discordClient,
    };
    const [first, second] = await Promise.all([
      runVisualCardAction({ ...draw, requestId: "race-request-aaa" }),
      runVisualCardAction({ ...draw, requestId: "race-request-bbb" }),
    ]);
    await drainLockedVisualActions();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const saved = store.get("guild-1:game:race-thread");
    expect(saved.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
      "King",
    ]);
    expect(saved.decks[0].piles.draw.cards.map((card) => card.name)).toEqual([
      "Queen",
      "Jack",
    ]);
    const lastDrawn = new Set([
      first.body.hand.at(-1).name,
      second.body.hand.at(-1).name,
    ]);
    expect(lastDrawn).toEqual(new Set(["Ace", "King"]));
    const drawHistory = saved.history
      .filter((entry) => entry?.action?.type === GameDB.ACTION_TYPES.DRAW)
      .map((entry) => entry.summary);
    expect(drawHistory).toEqual([
      "Will drew 1 cards from Main",
      "Will drew 1 cards from Main",
    ]);
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts).toHaveLength(2);
    expect(
      chatPosts.every((payload) => payload.content === "Will drew 1 cards from Main")
    ).toBe(true);
  });

  test("concurrent deals with a slow nick lookup each persist a different pair", async () => {
    const { posted, store, discordClient } = concurrentActionClient();
    const deal = {
      action: "deal",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "race-thread",
      discordClient,
    };
    const [first, second] = await Promise.all([
      runVisualCardAction({ ...deal, requestId: "race-deal-aaa" }),
      runVisualCardAction({ ...deal, requestId: "race-deal-bbb" }),
    ]);
    await drainLockedVisualActions();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const saved = store.get("guild-1:game:race-thread");
    expect(saved.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
      "Queen",
    ]);
    expect(saved.players[1].hands.main.map((card) => card.name)).toEqual([
      "King",
      "Jack",
    ]);
    expect(saved.decks[0].piles.draw.cards).toEqual([]);
    const dealHistory = saved.history
      .filter((entry) => entry?.action?.type === GameDB.ACTION_TYPES.DEAL)
      .map((entry) => entry.summary);
    expect(dealHistory).toEqual([
      "Will dealt 2 cards from Main to all players",
      "Will dealt 2 cards from Main to all players",
    ]);
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts).toHaveLength(2);
    expect(
      chatPosts.every((payload) => payload.content === "Dealt out a total of 2 cards from Main.")
    ).toBe(true);
  });

  test("loads an Enmap-only game through getGameDataV2 when sqlite has no row", async () => {
    const gameData = gameWithDeck();
    const result = await runVisualCardAction({
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      gameStore: {
        getSpecificGameData() {
          return null;
        },
        upsertGameData() {},
      },
      discordClient: {
        user: { id: "bot-1" },
        channels: { cache: { get: () => null } },
        async getGameDataV2() {
          return gameData;
        },
        async setGameDataV2(_guildId, _collection, _channelId, data) {
          Object.assign(gameData, data);
        },
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
    expect(gameData.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
    ]);
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
    await drainLockedVisualActions();
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
    await drainLockedVisualActions();
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
    await drainLockedVisualActions();
    expect(draw.status).toBe(200);
    expect(deal.status).toBe(200);
    expect(posted).toHaveLength(2);
    expect(deal.body.message).toContain("Dealt out");
  });

  test("the in-memory requestId map drops the oldest entry at the size cap", async () => {
    const cache = createActionIdempotencyCache({ maxSize: 1, ttlMs: 60_000 });
    const firstClient = clientForGame(gameWithDeck());
    const first = await runVisualCardAction({
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
    const second = await runVisualCardAction({
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
    await drainLockedVisualActions();
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
    await drainLockedVisualActions();
    expect(firstClient.posted).toHaveLength(2);
    expect(replayFirst.status).toBe(200);
  });

  test("returns the updated table without waiting for a slow channel post or member fetch", async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let memberFetches = 0;
    let releasePost;
    const postGate = new Promise((resolve) => {
      releasePost = resolve;
    });
    const posted = [];
    const gameData = gameWithDeck();
    const store = new Map();
    store.set("guild-1:game:thread-game", cloneGameDoc(gameData));
    const discordClient = {
      user: { id: "bot-1" },
      channels: {
        cache: {
          get: (id) =>
            id === "thread-game"
              ? {
                  id: "thread-game",
                  guild: { id: "guild-1" },
                  messages: { fetch: async () => null },
                  send: async (payload) => {
                    await postGate;
                    posted.push(payload);
                    return { id: "msg-1" };
                  },
                }
              : null,
        },
      },
      guilds: {
        cache: { get: () => null },
        fetch: async () => {
          memberFetches += 1;
          await delay(400);
          return {
            members: {
              cache: { get: () => null },
              fetch: async () => ({ displayName: "SlowNick" }),
            },
          };
        },
      },
      async getGameDataV2(guildId, collection, channelId) {
        return cloneGameDoc(store.get(`${guildId}:${collection}:${channelId}`));
      },
      async setGameDataV2(guildId, collection, channelId, data, options = {}) {
        expect(options.skipPinnedRefresh).toBe(true);
        store.set(`${guildId}:${collection}:${channelId}`, cloneGameDoc(data));
      },
    };
    const pending = runVisualCardAction({
      action: "deal",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    const result = await pending;
    try {
      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Dealt out a total of 2 cards from Main.");
      expect(result.body.hand.map((card) => card.name)).toEqual(["Copper", "Ace"]);
      expect(typeof result.body.version).toBe("string");
      expect(posted).toHaveLength(0);
      expect(memberFetches).toBe(0);
    } finally {
      releasePost();
    }
    await drainLockedVisualActions();
    expect(posted).toHaveLength(1);
    expect(posted[0].content).toContain("Dealt out a total of 2 cards from Main.");
  });

  test("a hung channel post does not stall the next same-channel Deal/Draw", async () => {
    let releaseSend;
    const sendGate = new Promise((resolve) => {
      releaseSend = resolve;
    });
    const { posted, store, discordClient } = clientForGame(gameWithDeck(), {
      send: async (payload, postedMessages) => {
        await sendGate;
        postedMessages.push(payload);
        return { id: `msg-${postedMessages.length}` };
      },
    });
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    };
    const first = await runVisualCardAction({ ...draw, requestId: "hung-post-aaa" });
    expect(first.status).toBe(200);
    expect(first.body.hand.at(-1).name).toBe("Ace");
    expect(posted).toHaveLength(0);

    let timeoutId;
    const secondPromise = runVisualCardAction({ ...draw, requestId: "hung-post-bbb" });
    const timedOut = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("next visual action waited on hung channel.send")),
        500
      );
    });
    let second;
    try {
      second = await Promise.race([secondPromise, timedOut]);
    } finally {
      clearTimeout(timeoutId);
    }

    expect(second.status).toBe(200);
    expect(new Set([first.body.hand.at(-1).name, second.body.hand.at(-1).name])).toEqual(
      new Set(["Ace", "King"])
    );
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Ace",
      "King",
    ]);
    expect(posted).toHaveLength(0);
    releaseSend();
    await drainLockedVisualActions();
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts).toHaveLength(2);
    const afterPosts = store.get("guild-1:game:thread-game");
    expect(afterPosts.lastStatusMessageId).toBe("msg-2");
  });

  test("out-of-order send completion leaves one pin showing the latest board", async () => {
    let releaseFirstChat;
    const firstChatGate = new Promise((resolve) => {
      releaseFirstChat = resolve;
    });
    let firstChatStarted = false;
    const game = gameWithPinnedDeck({ drawCount: 10 });
    const { store, discordClient, pinnedStatusMessages } = clientForGame(game, {
      send: async (payload, postedMessages) => {
        if (!isPinnedStatusPayload(payload) && !firstChatStarted) {
          firstChatStarted = true;
          await firstChatGate;
        }
        postedMessages.push(payload);
        return { id: `msg-${postedMessages.length}` };
      },
    });
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    };

    const first = await runVisualCardAction({ ...draw, requestId: "pin-order-aaa" });
    expect(first.status).toBe(200);
    expect(first.body.hand.at(-1).name).toBe("Card1");

    let timeoutId;
    const secondPromise = runVisualCardAction({ ...draw, requestId: "pin-order-bbb" });
    const timedOut = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("next visual action waited on hung channel.send")),
        500
      );
    });
    let second;
    try {
      second = await Promise.race([secondPromise, timedOut]);
    } finally {
      clearTimeout(timeoutId);
    }
    expect(second.status).toBe(200);
    expect(new Set([first.body.hand.at(-1).name, second.body.hand.at(-1).name])).toEqual(
      new Set(["Card1", "Card2"])
    );
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Card1",
      "Card2",
    ]);
    expect(pinnedStatusMessages()).toHaveLength(0);

    releaseFirstChat();
    await drainLockedVisualActions();

    const pins = pinnedStatusMessages();
    expect(pins).toHaveLength(1);
    expect(pins[0].embeds[0].remaining).toBe(8);
    expect(pins[0].embeds[0].handSize).toBe(3);
    const afterPosts = store.get("guild-1:game:thread-game");
    expect(afterPosts.pinnedStatusMessageId).toBe(pins[0].id);
    expect(afterPosts.lastStatusMessageId).toBeTruthy();
  });

  test("a burst of parallel draws leaves one pinned status reflecting final state", async () => {
    const burst = 8;
    const drawCount = 20;
    const game = gameWithPinnedDeck({ drawCount });
    const { posted, store, discordClient, pinnedStatusMessages } = clientForGame(game);
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    };
    const results = await Promise.all(
      Array.from({ length: burst }, (_, i) =>
        runVisualCardAction({
          ...draw,
          requestId: `pin-burst-${String(i + 1).padStart(2, "0")}`,
        })
      )
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    await drainLockedVisualActions();

    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[0].hands.main).toHaveLength(1 + burst);
    expect(saved.decks[0].piles.draw.cards).toHaveLength(drawCount - burst);
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts).toHaveLength(burst);
    const pins = pinnedStatusMessages();
    expect(pins).toHaveLength(1);
    expect(pins[0].embeds[0].remaining).toBe(drawCount - burst);
    expect(pins[0].embeds[0].handSize).toBe(1 + burst);
    expect(saved.pinnedStatusMessageId).toBe(pins[0].id);
  });

  test("game delete mid-queue does not resurrect the document or re-pin", async () => {
    let releaseSend;
    const sendGate = new Promise((resolve) => {
      releaseSend = resolve;
    });
    const game = gameWithPinnedDeck({ drawCount: 10 });
    const { posted, store, discordClient, pinnedStatusMessages } = clientForGame(game, {
      send: async (payload, postedMessages) => {
        await sendGate;
        postedMessages.push(payload);
        return { id: `msg-${postedMessages.length}` };
      },
    });
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    };
    const first = await runVisualCardAction({ ...draw, requestId: "delete-mid-aaa" });
    expect(first.status).toBe(200);
    const second = await runVisualCardAction({ ...draw, requestId: "delete-mid-bbb" });
    expect(second.status).toBe(200);

    const key = "guild-1:game:thread-game";
    const live = store.get(key);
    store.set(
      key,
      cloneGameDoc({
        ...live,
        isdeleted: true,
        pinnedStatusMessageId: null,
        pinnedStatusChannelId: null,
        pinnedStatusPinned: false,
        lastStatusMessageId: null,
        lastStatusMessageTimestamp: null,
      })
    );

    releaseSend();
    await drainLockedVisualActions();

    const saved = store.get(key);
    expect(saved.isdeleted).toBe(true);
    expect(saved.pinnedStatusMessageId).toBeNull();
    expect(saved.lastStatusMessageId).toBeNull();
    expect(pinnedStatusMessages()).toHaveLength(0);
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts.length).toBeLessThanOrEqual(1);
  });

  test("channel delete mid-queue does not create a pin for the queued post", async () => {
    let releaseSend;
    const sendGate = new Promise((resolve) => {
      releaseSend = resolve;
    });
    const game = gameWithPinnedDeck({ drawCount: 10 });
    const { posted, store, discordClient, pinnedStatusMessages } = clientForGame(game, {
      send: async (payload, postedMessages) => {
        await sendGate;
        postedMessages.push(payload);
        return { id: `msg-${postedMessages.length}` };
      },
    });
    const draw = {
      action: "draw",
      deckName: "Main",
      count: 1,
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    };
    const first = await runVisualCardAction({ ...draw, requestId: "chan-del-aaa" });
    expect(first.status).toBe(200);
    const second = await runVisualCardAction({ ...draw, requestId: "chan-del-bbb" });
    expect(second.status).toBe(200);

    discordClient.channels.cache.get = () => null;

    releaseSend();
    await drainLockedVisualActions();

    const saved = store.get("guild-1:game:thread-game");
    expect(saved.isdeleted).toBe(false);
    expect(saved.players[0].hands.main.map((card) => card.name)).toEqual([
      "Copper",
      "Card1",
      "Card2",
    ]);
    expect(pinnedStatusMessages()).toHaveLength(0);
    const chatPosts = posted.filter((payload) => !isPinnedStatusPayload(payload));
    expect(chatPosts.length).toBeLessThanOrEqual(1);
  });

  test("persistPinFields failure discards the extra pin", async () => {
    const game = gameWithPinnedDeck({ drawCount: 5 });
    const { store, discordClient, pinnedStatusMessages, messages } = clientForGame(game);
    const originalSet = discordClient.setGameDataV2.bind(discordClient);
    discordClient.setGameDataV2 = async (guildId, collection, channelId, data, options) => {
      if (data?.pinnedStatusMessageId) {
        throw new Error("pin persist failed");
      }
      return originalSet(guildId, collection, channelId, data, options);
    };
    const originalError = console.error;
    console.error = () => {};
    try {
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
      await drainLockedVisualActions();
    } finally {
      console.error = originalError;
    }

    expect(pinnedStatusMessages()).toHaveLength(0);
    const leftoverPins = [...messages.values()].filter(
      (message) =>
        typeof message.content === "string" &&
        message.content.startsWith(GameStatusHelper.PINNED_STATUS_HEADER)
    );
    expect(leftoverPins).toHaveLength(0);
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.pinnedStatusMessageId == null).toBe(true);
  });

  test("scores save uses applyPlayerScores, persists, and posts the scoreall message", async () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    const { posted, store, discordClient } = clientForGame(game);
    const result = await runVisualScoreAction({
      scores: { "snowflake-user": "21", "other-player": "9" },
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    await drainLockedVisualActions();

    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Player scores updated successfully.");
    expect(result.body.status.players.map((player) => player.score)).toEqual([
      "21",
      "9",
    ]);
    expect(posted[0].content).toContain("Player scores updated successfully.");
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[0].score).toBe("21");
    expect(saved.players[1].score).toBe("9");
    expect(saved.history.at(-1).action.type).toBe("score");
  });

  test("score history uses cached guild display names when present", async () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    const { posted, discordClient } = clientForGame(game);
    discordClient.guilds = {
      cache: {
        get: (guildId) =>
          guildId === "guild-1"
            ? {
                members: {
                  cache: {
                    get: (userId) =>
                      userId === "snowflake-user"
                        ? { displayName: "WillOnServer" }
                        : userId === "other-player"
                          ? { displayName: "RileyOnServer" }
                          : null,
                  },
                },
              }
            : null,
      },
    };
    const result = await runVisualScoreAction({
      scores: { "snowflake-user": "21", "other-player": "9" },
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    await drainLockedVisualActions();
    expect(result.status).toBe(200);
    expect(posted[0].content).toContain("Player scores updated successfully.");
    expect(result.body.status.history.at(-1).summary).toBe(
      "WillOnServer updated player scores:\nWillOnServer's score changed from 1 to 21\nRileyOnServer's score changed from 0 to 9"
    );
  });

  test("scores from a non-player is 403 not_a_player and does not rewrite seats", async () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    const { store, discordClient } = clientForGame(game);
    const result = await runVisualScoreAction({
      scores: { "snowflake-user": "99", "other-player": "88" },
      user: { id: "spectator", username: "eve", global_name: "Eve" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    await drainLockedVisualActions();

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      error: "not_a_player",
      message: "You're not a player in this game.",
    });
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.players[0].score).toBe("1");
    expect(saved.players[1].score).toBe("");
    expect(saved.history).toEqual([]);
  });

  test("scores history uses guild display names from members.fetch", async () => {
    const game = gameWithDeck();
    game.players[0].score = "1";
    const memberFetches = [];
    const posted = [];
    const store = new Map();
    store.set("guild-1:game:thread-game", cloneGameDoc(game));
    const channel = {
      id: "thread-game",
      guild: { id: "guild-1" },
      messages: { fetch: async () => null },
      send: async (payload) => {
        posted.push(payload);
        return { id: "msg-1" };
      },
    };
    const discordClient = {
      user: { id: "bot-1" },
      channels: {
        cache: { get: (id) => (id === "thread-game" ? channel : null) },
      },
      guilds: {
        cache: { get: () => null },
        fetch: async () => ({
          members: {
            cache: { get: () => null },
            fetch: async (userId) => {
              memberFetches.push(userId);
              return {
                displayName:
                  userId === "snowflake-user" ? "WillOnServer" : "RileyOnServer",
              };
            },
          },
        }),
      },
      async getGameDataV2(guildId, collection, channelId) {
        return cloneGameDoc(store.get(`${guildId}:${collection}:${channelId}`));
      },
      async setGameDataV2(guildId, collection, channelId, data) {
        store.set(`${guildId}:${collection}:${channelId}`, cloneGameDoc(data));
      },
    };
    const result = await runVisualScoreAction({
      scores: { "snowflake-user": "21", "other-player": "9" },
      user: { id: "snowflake-user", username: "willsullivan", global_name: "Will" },
      member: { displayName: "Will" },
      guildId: "guild-1",
      channelId: "thread-game",
      discordClient,
    });
    await drainLockedVisualActions();

    expect(result.status).toBe(200);
    expect(memberFetches).toEqual(
      expect.arrayContaining(["snowflake-user", "other-player"])
    );
    const saved = store.get("guild-1:game:thread-game");
    expect(saved.history.at(-1).summary).toBe(
      "Will updated player scores:\nWillOnServer's score changed from 1 to 21\nRileyOnServer's score changed from 0 to 9"
    );
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
    expect(visualActionErrorMessage("card_not_in_hand")).toBe("You don't have that card.");
    expect(visualActionErrorMessage("missing_card")).toBe("Pick a card first.");
    expect(visualActionErrorMessage("discard_pile_missing")).toBe(
      "Error: Could not find the discard pile. Card returned to hand."
    );
  });
});
