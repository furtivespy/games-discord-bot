const { snapshotFromGameData } = require("./embeddedGames");

const ENV_NAME = "EMBEDDED_APP_MOCK";
const TRUTHY = new Set(["1", "true", "yes", "on"]);

const DEFAULT_MOCK_CLIENT_ID = "mock-client-id";
const DEFAULT_MOCK_CHANNEL_ID = "mock-channel";
const DEFAULT_MOCK_GUILD_ID = "mock-guild";
const DEFAULT_MOCK_CHANNEL_NAME = "Mock Table";
const MOCK_ACCESS_TOKEN = "mock-access-token";
const MOCK_OAUTH_CODE = "mock-oauth-code";

const MOCK_FIXTURE_NAMES = Object.freeze([
  "populated",
  "team-game",
  "no-game",
  "not-a-player",
]);

const GAME_LIST_FIXTURE_NAMES = Object.freeze([
  "several-games",
  "one-game",
  "no-games",
  "team-game",
]);

const GAME_LIST_FIXTURE_ALIASES = Object.freeze({
  populated: "several-games",
  "no-game": "no-games",
  "not-a-player": "no-games",
});

const TEAM_GAME_CHANNEL_ID = "team-thread";
const TEAM_GAME_CHANNEL_NAME = "Game 🎲 time";
const TEAM_CRAB_ID = "team-crab";
const TEAM_FISH_ID = "team-fish";

// Newest first: Friday Inis is the most recently created game.
const SEVERAL_GAMES_FIXTURE = Object.freeze([
  Object.freeze({
    channelId: "newest-thread",
    channelName: "Friday Inis",
  }),
  Object.freeze({
    channelId: "mid-table",
    channelName: "Thursday Root",
  }),
  Object.freeze({
    channelId: "oldest-channel",
    channelName: "Monday Poker",
  }),
  Object.freeze({
    channelId: TEAM_GAME_CHANNEL_ID,
    channelName: TEAM_GAME_CHANNEL_NAME,
  }),
]);

const ONE_GAME_FIXTURE = Object.freeze([
  Object.freeze({
    channelId: "solo-thread",
    channelName: "Solo Table",
  }),
]);

const TEAM_GAME_FIXTURE = Object.freeze([
  Object.freeze({
    channelId: TEAM_GAME_CHANNEL_ID,
    channelName: TEAM_GAME_CHANNEL_NAME,
  }),
]);

const MOCK_USER = Object.freeze({
  id: "mock-user-1",
  username: "qatester",
  global_name: "QA Tester",
});

function isTruthyEnvValue(value) {
  if (value == null) return false;
  return TRUTHY.has(String(value).trim().toLowerCase());
}

function isProductionEnv(env = process.env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function isEmbeddedAppMockRequested(env = process.env) {
  return isTruthyEnvValue(env[ENV_NAME]);
}

function isEmbeddedAppMockEnabled(env = process.env) {
  return isEmbeddedAppMockRequested(env) && !isProductionEnv(env);
}

function allowEmbeddedAppMock(explicitMock, env = process.env) {
  if (isProductionEnv(env)) return false;
  return Boolean(explicitMock) || isEmbeddedAppMockEnabled(env);
}

function fixtureCard(id, name, extra = {}) {
  return {
    id,
    name,
    description: extra.description || "",
    type: extra.type || "",
    suit: extra.suit || "",
    value: extra.value || "",
    url: extra.url ?? null,
    origin: extra.origin || "Main",
    format: extra.format || "A",
  };
}

function otherPlayerHand() {
  return [fixtureCard("other-secret-1", "Other Player Secret")];
}

function populatedSeed() {
  const drawCards = Array.from({ length: 30 }, (_, i) =>
    fixtureCard(`draw-${i + 1}`, `Draw ${i + 1}`)
  );
  const eventDraw = Array.from({ length: 8 }, (_, i) =>
    fixtureCard(`event-draw-${i + 1}`, `Event ${i + 1}`)
  );
  const extraDraw = Array.from({ length: 12 }, (_, i) =>
    fixtureCard(`extra-draw-${i + 1}`, `Unused Chaos ${i + 1}`)
  );
  return {
    name: "Fixture Game",
    reverseOrder: false,
    isCustomGame: false,
    tokens: [
      { id: "vp", name: "VP", isSecret: false, cap: 20 },
      { id: "clue", name: "Clue", isSecret: true, cap: 8 },
    ],
    teams: [],
    players: [
      {
        userId: MOCK_USER.id,
        name: MOCK_USER.global_name,
        order: 0,
        score: "12",
        color: "gold",
        tokens: { vp: 4, clue: 2 },
        hands: {
          main: [
            fixtureCard("hand-1", "Ace of Spades", {
              suit: "spades",
              value: "A",
              type: "Spades",
            }),
            fixtureCard("hand-2", "King of Hearts", {
              suit: "hearts",
              value: "K",
              type: "Hearts",
            }),
            fixtureCard("hand-3", "Queen of Diamonds", {
              suit: "diamonds",
              value: "Q",
              type: "Diamonds",
            }),
            fixtureCard("hand-4", "Jack of Clubs", {
              suit: "clubs",
              value: "J",
              type: "Clubs",
            }),
            fixtureCard("hand-5", "10 of Spades", {
              suit: "spades",
              value: "10",
              type: "Spades",
            }),
          ],
          draft: [fixtureCard("draft-1", "Draft Only")],
          simultaneous: [fixtureCard("sim-1", "Simultaneous Only")],
        },
        playArea: [
          fixtureCard("play-1", "Village"),
          fixtureCard("play-2", "Market"),
        ],
      },
      {
        userId: "other-player-2",
        name: "Riley",
        order: 1,
        score: "7",
        color: "teal",
        tokens: { vp: 3, clue: 1 },
        hands: { main: otherPlayerHand() },
        playArea: [fixtureCard("other-play-1", "Other Play Area")],
      },
      {
        userId: "other-player-3",
        name: "Sam",
        order: 2,
        score: "4",
        color: "crimson",
        tokens: { vp: 1, clue: 0 },
        hands: {
          main: [
            fixtureCard("sam-1", "Sam Secret 1"),
            fixtureCard("sam-2", "Sam Secret 2"),
            fixtureCard("sam-3", "Sam Secret 3"),
            fixtureCard("sam-4", "Sam Secret 4"),
          ],
        },
        playArea: [],
      },
    ],
    gameBoard: [
      fixtureCard("board-1", "Province"),
      fixtureCard("board-2", "Duchy"),
      fixtureCard("board-3", "Estate"),
    ],
    decks: [
      {
        name: "Main",
        hiddenInfo: "visible",
        allCards: Array.from({ length: 42 }, (_, i) =>
          fixtureCard(`main-all-${i + 1}`, `Main ${i + 1}`)
        ),
        piles: { draw: { cards: drawCards }, discard: { cards: [] } },
      },
      {
        name: "Events",
        hiddenInfo: "visible",
        allCards: Array.from({ length: 15 }, (_, i) =>
          fixtureCard(`event-all-${i + 1}`, `Event All ${i + 1}`)
        ),
        piles: { draw: { cards: eventDraw }, discard: { cards: [] } },
      },
      {
        name: "Unused Chaos Deck",
        hiddenInfo: "visible",
        allCards: Array.from({ length: 20 }, (_, i) =>
          fixtureCard(`chaos-all-${i + 1}`, `Chaos ${i + 1}`)
        ),
        piles: { draw: { cards: extraDraw }, discard: { cards: [] } },
      },
    ],
    globalPiles: [{ name: "Market Row", cards: [{ name: "Copper" }], isSecret: false }],
    history: [
      { summary: "QA Tester drew 2 cards", action: { category: "card" } },
      { summary: "Riley played Village", action: { category: "card" } },
    ],
  };
}

function teamGameSeed() {
  const seed = populatedSeed();
  seed.name = TEAM_GAME_CHANNEL_NAME;
  seed.teams = [
    { id: TEAM_CRAB_ID, name: "🦀🦀", color: null },
    { id: TEAM_FISH_ID, name: "💪🐟", color: null },
  ];
  seed.players[0].order = 0;
  seed.players[0].teamId = TEAM_CRAB_ID;
  seed.players[1].order = 1;
  seed.players[1].teamId = TEAM_CRAB_ID;
  seed.players[2].order = 2;
  seed.players[2].teamId = TEAM_CRAB_ID;
  seed.players.push(
    {
      userId: "other-player-4",
      name: "Alex",
      order: 3,
      score: "9",
      color: "navy",
      teamId: TEAM_FISH_ID,
      tokens: { vp: 2, clue: 1 },
      hands: { main: [fixtureCard("alex-1", "Alex Secret")] },
      playArea: [],
    },
    {
      userId: "other-player-5",
      name: "Jordan",
      order: 4,
      score: "6",
      color: "olive",
      teamId: TEAM_FISH_ID,
      tokens: { vp: 1, clue: 0 },
      hands: {
        main: [
          fixtureCard("jordan-1", "Jordan Secret 1"),
          fixtureCard("jordan-2", "Jordan Secret 2"),
        ],
      },
      playArea: [fixtureCard("jordan-play-1", "Jordan Play Area")],
    },
    {
      userId: "other-player-6",
      name: "Casey",
      order: 5,
      score: "3",
      color: "purple",
      teamId: TEAM_FISH_ID,
      tokens: { vp: 0, clue: 1 },
      hands: { main: [] },
      playArea: [],
    }
  );
  seed.history = [
    { summary: "QA Tester drew 2 cards", action: { category: "card" } },
    { summary: "Riley played Village", action: { category: "card" } },
    { summary: "Alex scored 2 VP", action: { category: "token" } },
  ];
  return seed;
}

function snapshotFromSeed(seed, { channelId, guildId } = {}) {
  return snapshotFromGameData(seed, {
    channelId,
    guildId,
    userId: MOCK_USER.id,
  });
}

function sanitizeFixtureName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) return "populated";
  if (MOCK_FIXTURE_NAMES.includes(name)) return name;
  if (name === "several-games" || name === "one-game") return "populated";
  if (name === "no-games") return "no-game";
  return null;
}

function isTeamGameChannel(channelId) {
  return String(channelId || "").trim() === TEAM_GAME_CHANNEL_ID;
}

function sanitizeGamesFixtureName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) return "several-games";
  if (GAME_LIST_FIXTURE_NAMES.includes(name)) return name;
  return GAME_LIST_FIXTURE_ALIASES[name] || null;
}

function getMockGames({ fixture } = {}) {
  const name = sanitizeGamesFixtureName(fixture);
  if (!name) {
    return { status: 400, body: { error: "unknown_fixture" } };
  }
  if (name === "no-games") {
    return { status: 200, body: { games: [] } };
  }
  if (name === "one-game") {
    return {
      status: 200,
      body: { games: ONE_GAME_FIXTURE.map((game) => ({ ...game })) },
    };
  }
  if (name === "team-game") {
    return {
      status: 200,
      body: { games: TEAM_GAME_FIXTURE.map((game) => ({ ...game })) },
    };
  }
  return {
    status: 200,
    body: { games: SEVERAL_GAMES_FIXTURE.map((game) => ({ ...game })) },
  };
}

function getMockSnapshot({ fixture, channelId, guildId } = {}) {
  const name = sanitizeFixtureName(fixture);
  if (!name) {
    return { status: 400, body: { error: "unknown_fixture" } };
  }
  if (name === "no-game") {
    return { status: 404, body: { error: "no_game" } };
  }
  if (name === "not-a-player") {
    return { status: 403, body: { error: "not_a_player" } };
  }
  const seed =
    name === "team-game" || isTeamGameChannel(channelId)
      ? teamGameSeed()
      : populatedSeed();
  return {
    status: 200,
    body: snapshotFromSeed(seed, {
      channelId: channelId || DEFAULT_MOCK_CHANNEL_ID,
      guildId: guildId || DEFAULT_MOCK_GUILD_ID,
    }),
  };
}

function mockUserTokenBody({ originChannelName } = {}) {
  const body = {
    access_token: MOCK_ACCESS_TOKEN,
    display_name: MOCK_USER.global_name,
  };
  const origin = typeof originChannelName === "string" ? originChannelName.trim() : "";
  if (origin) {
    body.origin_channel_name = origin;
  }
  return body;
}

function handleMockTokenExchange({ originChannelName } = {}) {
  return {
    status: 200,
    body: mockUserTokenBody({
      originChannelName:
        originChannelName == null ? DEFAULT_MOCK_CHANNEL_NAME : originChannelName,
    }),
  };
}

function resolveMockRuntimeConfig(env = process.env) {
  const channelNameRaw = env.EMBEDDED_APP_MOCK_CHANNEL_NAME;
  return {
    enabled: isEmbeddedAppMockEnabled(env),
    requested: isEmbeddedAppMockRequested(env),
    channelId: String(env.EMBEDDED_APP_MOCK_CHANNEL_ID || DEFAULT_MOCK_CHANNEL_ID).trim(),
    guildId: String(env.EMBEDDED_APP_MOCK_GUILD_ID || DEFAULT_MOCK_GUILD_ID).trim(),
    channelName:
      channelNameRaw == null
        ? DEFAULT_MOCK_CHANNEL_NAME
        : String(channelNameRaw).trim(),
  };
}

module.exports = {
  DEFAULT_MOCK_CHANNEL_ID,
  DEFAULT_MOCK_CHANNEL_NAME,
  DEFAULT_MOCK_CLIENT_ID,
  DEFAULT_MOCK_GUILD_ID,
  ENV_NAME,
  GAME_LIST_FIXTURE_ALIASES,
  GAME_LIST_FIXTURE_NAMES,
  MOCK_ACCESS_TOKEN,
  MOCK_FIXTURE_NAMES,
  MOCK_OAUTH_CODE,
  MOCK_USER,
  ONE_GAME_FIXTURE,
  SEVERAL_GAMES_FIXTURE,
  TEAM_CRAB_ID,
  TEAM_FISH_ID,
  TEAM_GAME_CHANNEL_ID,
  TEAM_GAME_CHANNEL_NAME,
  TEAM_GAME_FIXTURE,
  allowEmbeddedAppMock,
  getMockGames,
  getMockSnapshot,
  handleMockTokenExchange,
  isEmbeddedAppMockEnabled,
  isEmbeddedAppMockRequested,
  isProductionEnv,
  mockUserTokenBody,
  otherPlayerHand,
  populatedSeed,
  resolveMockRuntimeConfig,
  teamGameSeed,
  sanitizeFixtureName,
  sanitizeGamesFixtureName,
  snapshotFromSeed,
};
