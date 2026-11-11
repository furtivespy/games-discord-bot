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
  "no-game",
  "not-a-player",
]);

const GAME_LIST_FIXTURE_NAMES = Object.freeze([
  "several-games",
  "one-game",
  "no-games",
]);

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
]);

const ONE_GAME_FIXTURE = Object.freeze([
  Object.freeze({
    channelId: "solo-thread",
    channelName: "Solo Table",
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
  return {
    name: "Fixture Game",
    players: [
      {
        userId: MOCK_USER.id,
        hands: {
          main: [
            fixtureCard("hand-1", "Copper"),
            fixtureCard("hand-2", "Silver"),
            fixtureCard("hand-3", "Gold"),
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
        hands: { main: otherPlayerHand() },
        playArea: [fixtureCard("other-play-1", "Other Play Area")],
      },
    ],
    gameBoard: [
      fixtureCard("board-1", "Province"),
      fixtureCard("board-2", "Duchy"),
      fixtureCard("board-3", "Estate"),
    ],
  };
}

function snapshotFromSeed(seed, { channelId, guildId } = {}) {
  const me = (seed.players || []).find((player) => player.userId === MOCK_USER.id);
  return {
    gameName: seed.name,
    channelId,
    guildId,
    hand: [...(me?.hands?.main || [])],
    playArea: [...(me?.playArea || [])],
    gameBoard: [...(seed.gameBoard || [])],
  };
}

function sanitizeFixtureName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) return "populated";
  return MOCK_FIXTURE_NAMES.includes(name) ? name : null;
}

function sanitizeGamesFixtureName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) return "several-games";
  return GAME_LIST_FIXTURE_NAMES.includes(name) ? name : null;
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
  return {
    status: 200,
    body: snapshotFromSeed(populatedSeed(), {
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
  GAME_LIST_FIXTURE_NAMES,
  MOCK_ACCESS_TOKEN,
  MOCK_FIXTURE_NAMES,
  MOCK_OAUTH_CODE,
  MOCK_USER,
  ONE_GAME_FIXTURE,
  SEVERAL_GAMES_FIXTURE,
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
  sanitizeFixtureName,
  sanitizeGamesFixtureName,
  snapshotFromSeed,
};
