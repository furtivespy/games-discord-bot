const fs = require("fs");
const os = require("os");
const path = require("path");
const { PermissionsBitField } = require("discord.js");
const GameDB = require("../../db/anygame.js");
const GameStore = require("../../db/gameStore.js");
const Formatter = require("../../modules/GameFormatter");

const DEFAULT_GUILD_ID = "guild-1";
const DEFAULT_CHANNEL_ID = "channel-1";

const formatterOriginals = {
  createGameStatusReply: Formatter.createGameStatusReply,
  playerSecretHandAndImages: Formatter.playerSecretHandAndImages,
  playerSecretTokens: Formatter.playerSecretTokens,
  genericCardZoneDisplay: Formatter.genericCardZoneDisplay,
  multiCard: Formatter.multiCard,
  GameStatusV2: Formatter.GameStatusV2,
};

function createUser({ id = "user-1", username = "Alice" } = {}) {
  return {
    id,
    username,
    toString() {
      return `<@${id}>`;
    },
  };
}

function createMember({
  id = "user-1",
  username = "Alice",
  displayName = username,
} = {}) {
  return {
    id,
    displayName,
    user: createUser({ id, username }),
  };
}

function createPlayer(overrides = {}) {
  return Object.assign({}, structuredClone(GameDB.defaultPlayer), {
    guildId: overrides.guildId || DEFAULT_GUILD_ID,
    userId: overrides.userId || "user-1",
    order: overrides.order ?? 0,
    name: overrides.name || "Alice",
    score: overrides.score ?? "",
    hands: overrides.hands || {
      main: [],
      played: [],
      passed: [],
      received: [],
      simultaneous: [],
    },
    playArea: overrides.playArea || [],
    color: overrides.color ?? null,
    tokens: overrides.tokens || {},
    teamId: overrides.teamId ?? null,
    ...overrides,
  });
}

function createCard(overrides = {}) {
  return {
    id: overrides.id || "card-1",
    name: overrides.name || "Ace",
    description: overrides.description || "",
    type: overrides.type || "",
    suit: overrides.suit || "",
    value: overrides.value || "",
    url: overrides.url ?? null,
    origin: overrides.origin || "Main",
    format: overrides.format || "A",
  };
}

function createDeck({
  name = "Main",
  draw = [],
  discard = [],
  shuffleStyle = "standard",
} = {}) {
  const deck = Object.assign({}, structuredClone(GameDB.defaultDeck), { name });
  deck.piles.draw.cards = draw;
  deck.piles.discard.cards = discard;
  deck.shuffleStyle = shuffleStyle;
  deck.allCards = [...draw, ...discard];
  return deck;
}

function createActiveGame(overrides = {}) {
  const { players: overridePlayers, ...rest } = overrides;
  const players = overridePlayers || [
    createPlayer({ userId: "user-1", name: "Alice", order: 0 }),
    createPlayer({ userId: "user-2", name: "Bob", order: 1 }),
  ];
  return Object.assign({}, structuredClone(GameDB.defaultGameData), {
    isdeleted: false,
    name: "test-channel",
    ...rest,
    players,
  });
}

function replyContent(payload) {
  if (payload == null) return undefined;
  if (typeof payload === "string") return payload;
  return payload.content;
}

function stubGameFormatter() {
  Formatter.createGameStatusReply = async (_gameData, _guild, _clientUserId, options = {}) => ({
    content: options.content ?? "📊",
    embeds: [{ title: "Game Status" }],
    files: [],
  });
  Formatter.playerSecretHandAndImages = async () => ({ embeds: [], attachments: [] });
  Formatter.playerSecretTokens = async () => null;
  Formatter.genericCardZoneDisplay = async () => null;
  Formatter.multiCard = async (_cards, title) => [[{ title: title || "Cards" }], []];
  Formatter.GameStatusV2 = async () => ({ attachment: null, embed: { title: "Game Status" } });
}

function restoreGameFormatter() {
  Object.assign(Formatter, formatterOriginals);
}

function createMessage({
  id = "chat-1",
  content = "",
  componentInteraction = null,
} = {}) {
  return {
    id,
    content,
    pinned: false,
    awaitMessageComponent: async ({ filter } = {}) => {
      if (!componentInteraction) {
        const error = new Error("Collector timed out");
        error.code = "InteractionCollectorError";
        throw error;
      }
      if (filter && !filter(componentInteraction)) {
        throw new Error("Collector filter rejected the queued component");
      }
      return componentInteraction;
    },
  };
}

/**
 * Shared Option 2 harness: duck-typed Discord interaction + client.
 * Does not require DiscordBot.js (that file logs in).
 */
function createHarness({
  gameData = null,
  collectionData = {},
  options: optionValues = {},
  user = createUser(),
  member = null,
  members = [],
  guildId = DEFAULT_GUILD_ID,
  channelId = DEFAULT_CHANNEL_ID,
  channelName = "test-channel",
  deferred = false,
  replied = false,
  manageMessages = true,
  useGameStore = false,
  componentInteraction = null,
  modalFields = {},
  isAutocomplete = false,
  isModalSubmit = false,
  modalCustomId = "",
  stubFormatter = true,
} = {}) {
  if (stubFormatter) {
    stubGameFormatter();
  }

  const previousDataDir = process.env.GAMEBOT_DATA_DIR;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gamebot-test-"));
  process.env.GAMEBOT_DATA_DIR = dataDir;

  const resolvedMember = member || createMember({
    id: user.id,
    username: user.username,
    displayName: user.username,
  });

  const memberById = new Map();
  memberById.set(user.id, resolvedMember);
  for (const extra of members) {
    memberById.set(extra.id, extra);
  }
  if (gameData?.players) {
    for (const player of gameData.players) {
      if (!memberById.has(player.userId)) {
        memberById.set(
          player.userId,
          createMember({
            id: player.userId,
            username: player.name || player.userId,
            displayName: player.name || player.userId,
          })
        );
      }
    }
  }

  const membersCache = {
    get: (id) => memberById.get(id) || null,
  };

  const pinCalls = [];
  const unpinCalls = [];
  const sendCalls = [];
  const fetchCalls = [];
  const editCalls = [];
  const persistCalls = [];
  let chatMessageSeq = 1;

  const pinMessage = {
    id: "pin-1",
    pinned: false,
    content: "",
    pin: async () => {
      pinCalls.push("pin");
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

  const guild = {
    id: guildId,
    members: {
      cache: membersCache,
      fetch: async (id) => memberById.get(id) || null,
    },
  };

  const channel = {
    id: channelId,
    name: channelName,
    guild,
    permissionsFor: () => ({
      has: (flag) => manageMessages && flag === PermissionsBitField.Flags.ManageMessages,
    }),
    messages: {
      fetch: async (idOrOptions) => {
        const id =
          typeof idOrOptions === "object" && idOrOptions
            ? idOrOptions.message || idOrOptions.id
            : idOrOptions;
        fetchCalls.push(id);
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
      if (
        typeof payload.content === "string" &&
        payload.content.startsWith("📌 Live game status")
      ) {
        return pinMessage;
      }
      return { id: `chat-${++chatMessageSeq}` };
    },
  };

  const calls = {
    deferReply: [],
    reply: [],
    editReply: [],
    followUp: [],
    showModal: [],
    respond: [],
  };

  const memory = new Map();
  const memoryKey = (serverId, collection, channel) =>
    `${serverId}:${collection}:${channel}`;

  let store = null;
  if (useGameStore) {
    store = new GameStore();
  }

  const client = {
    user: { id: "bot-1" },
    config: { BGGToken: "test-token", botOwnerId: "owner-1" },
    logger: { log: () => {}, error: () => {} },
    googleClient: {
      getRandomGoogleImg: async () => ({ link: "https://example.test/img.png" }),
    },
    users: {
      fetch: async (id) => ({
        id,
        send: async () => {},
      }),
    },
    async getGameDataV2(serverId, collection, channel) {
      if (store) {
        return store.getSpecificGameData(serverId, collection, channel);
      }
      return memory.get(memoryKey(serverId, collection, channel)) ?? null;
    },
    async setGameDataV2(serverId, collection, channel, data) {
      persistCalls.push([serverId, collection, channel, structuredClone(data)]);
      if (store) {
        store.upsertGameData(serverId, collection, channel, data);
        return;
      }
      memory.set(memoryKey(serverId, collection, channel), structuredClone(data));
    },
  };

  function seedCollection(collection, data, { serverId = guildId, channel = channelId } = {}) {
    if (store) {
      store.upsertGameData(serverId, collection, channel, data);
      return;
    }
    memory.set(memoryKey(serverId, collection, channel), structuredClone(data));
  }

  if (gameData) {
    seedCollection("game", gameData);
  }
  for (const [collection, data] of Object.entries(collectionData)) {
    seedCollection(collection, data);
  }

  const optionBag = {
    subcommand: optionValues.subcommand ?? null,
    subcommandGroup: optionValues.subcommandGroup ?? null,
    strings: optionValues.strings || {},
    integers: optionValues.integers || {},
    booleans: optionValues.booleans || {},
    users: optionValues.users || {},
    focused: optionValues.focused ?? null,
    focusedName: optionValues.focusedName ?? null,
  };

  function makeReplyMessage(payload) {
    const content = replyContent(payload) || "";
    return createMessage({
      id: `chat-${++chatMessageSeq}`,
      content,
      componentInteraction,
    });
  }

  const interaction = {
    guildId,
    channelId,
    guild,
    channel,
    user,
    member: resolvedMember,
    client,
    deferred,
    replied,
    customId: modalCustomId,
    isAutocomplete: () => isAutocomplete,
    isModalSubmit: () => isModalSubmit,
    options: {
      getSubcommand: () => optionBag.subcommand,
      getSubcommandGroup: (required = true) => {
        if (optionBag.subcommandGroup == null && required) {
          return null;
        }
        return optionBag.subcommandGroup;
      },
      getString: (name) =>
        Object.prototype.hasOwnProperty.call(optionBag.strings, name)
          ? optionBag.strings[name]
          : null,
      getInteger: (name) =>
        Object.prototype.hasOwnProperty.call(optionBag.integers, name)
          ? optionBag.integers[name]
          : null,
      getBoolean: (name) =>
        Object.prototype.hasOwnProperty.call(optionBag.booleans, name)
          ? optionBag.booleans[name]
          : null,
      getUser: (name) => optionBag.users[name] || null,
      getFocused: (whole = false) => {
        if (whole) {
          return {
            name: optionBag.focusedName || "query",
            value: optionBag.focused ?? "",
          };
        }
        return optionBag.focused ?? "";
      },
    },
    fields: {
      getTextInputValue: (name) => modalFields[name] ?? "",
    },
    deferReply: async (payload) => {
      calls.deferReply.push(payload ?? {});
      interaction.deferred = true;
    },
    reply: async (payload) => {
      calls.reply.push(payload);
      interaction.replied = true;
      return makeReplyMessage(payload);
    },
    editReply: async (payload) => {
      calls.editReply.push(payload);
      interaction.replied = true;
      return makeReplyMessage(payload);
    },
    followUp: async (payload) => {
      calls.followUp.push(payload);
      return makeReplyMessage(payload);
    },
    showModal: async (modal) => {
      calls.showModal.push(modal);
    },
    respond: async (choices) => {
      calls.respond.push(choices);
    },
  };

  function lastPayload() {
    return calls.editReply.at(-1) ?? calls.reply.at(-1);
  }

  function cleanup() {
    if (store) {
      try {
        store.db.close();
      } catch (_) {
        // already closed
      }
    }
    if (previousDataDir === undefined) {
      delete process.env.GAMEBOT_DATA_DIR;
    } else {
      process.env.GAMEBOT_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (stubFormatter) {
      restoreGameFormatter();
    }
  }

  return {
    interaction,
    client,
    channel,
    guild,
    user,
    member: resolvedMember,
    dataDir,
    calls,
    persistCalls,
    pinCalls,
    unpinCalls,
    sendCalls,
    fetchCalls,
    editCalls,
    pinMessage,
    optionBag,
    seedCollection,
    getSavedGame: () => client.getGameDataV2(guildId, "game", channelId),
    lastPayload,
    lastContent: () => replyContent(lastPayload()),
    cleanup,
  };
}

async function withHarness(options, run) {
  const harness = createHarness(options);
  try {
    return await run(harness);
  } finally {
    harness.cleanup();
  }
}

module.exports = {
  DEFAULT_GUILD_ID,
  DEFAULT_CHANNEL_ID,
  createUser,
  createMember,
  createPlayer,
  createCard,
  createDeck,
  createActiveGame,
  createHarness,
  withHarness,
  stubGameFormatter,
  restoreGameFormatter,
  replyContent,
};
