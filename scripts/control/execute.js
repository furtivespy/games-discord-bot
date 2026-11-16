"use strict";

// `execute`: run a fixture through the real slash-command code.
//
// Uses the same fake Discord interaction as the tests (test/helpers/harness.js):
// SQLite lives in a temp dir, GameFormatter and canvas are stubbed, nothing
// talks to Discord. It proves what a command replies and saves, not how
// Discord renders it.
//
// A fixture exports `async (ctx) => { ... }`. See scripts/control-fixtures/.

const path = require("node:path");
const { MessageFlags } = require("discord.js");
const harnessModule = require("../../test/helpers/harness");
const { embedPlainText } = require("../../modules/DiscordEmbeds");
const { loadCommands } = require("./featureMap");

const ROOT = path.resolve(__dirname, "..", "..");
const OPTION_KEYS = [
  "subcommand",
  "subcommandGroup",
  "strings",
  "integers",
  "booleans",
  "users",
  "channels",
  "focused",
  "focusedName",
];

function commandClass(name) {
  const wanted = String(name).replace(/^\//, "");
  const entry = loadCommands().find((c) => c.name === wanted);
  if (!entry) {
    const known = loadCommands().map((c) => c.name).join(", ");
    throw new Error(`Unknown slash command "${wanted}". Known: ${known}`);
  }
  return require(path.join(ROOT, entry.source));
}

function isEphemeral(payload) {
  const flags = payload?.flags;
  if (Array.isArray(flags)) return flags.includes(MessageFlags.Ephemeral);
  if (typeof flags === "number" || typeof flags === "bigint") {
    return (BigInt(flags) & BigInt(MessageFlags.Ephemeral)) !== 0n;
  }
  return false;
}

function summarizePayload(kind, payload) {
  return {
    kind,
    text: harnessModule.replyContent(payload) ?? null,
    embeds: (payload?.embeds || []).map((e) => embedPlainText(e)).filter(Boolean),
    visibility: isEphemeral(payload) ? "ephemeral" : "public",
    components: payload?.components?.length ?? 0,
    files: payload?.files?.length ?? 0,
  };
}

// Swallowed errors are the most useful signal: most commands catch and log.
function captureLogs(client) {
  const logged = [];
  const record = (level) => (message, type) => {
    const effective = level === "log" ? type : level;
    if (effective !== "error" && effective !== "warn") return;
    logged.push({
      level: effective,
      message: message instanceof Error ? message.stack || message.message : String(message),
    });
  };
  client.logger.log = record("log");
  client.logger.error = record("error");
  client.logger.warn = record("warn");
  return logged;
}

function splitOptions(options) {
  const interaction = {};
  const rest = {};
  for (const [key, value] of Object.entries(options)) {
    if (OPTION_KEYS.includes(key)) interaction[key] = value;
    else rest[key] = value;
  }
  return { interaction, rest };
}

// A session keeps the channel's game between runs, so a fixture can set up a
// game, run one command, then run another against the result.
function createSession(base = {}, results = []) {
  let gameData = base.gameData ?? null;

  async function run(name, options = {}) {
    const Command = commandClass(name);
    const { interaction: optionValues, rest } = splitOptions(options);
    const harness = harnessModule.createHarness({
      ...base,
      gameData,
      ...rest,
      options: { ...(base.options || {}), ...optionValues },
    });
    const logged = captureLogs(harness.client);
    try {
      const command = new Command(harness.client);
      await command.execute(harness.interaction);
      const saved = await harness.getSavedGame();
      if (saved) gameData = saved;
      const summary = {
        command: [
          `/${String(name).replace(/^\//, "")}`,
          optionValues.subcommandGroup,
          optionValues.subcommand,
        ]
          .filter(Boolean)
          .join(" "),
        replies: [
          ...harness.calls.reply.map((p) => summarizePayload("reply", p)),
          ...harness.calls.editReply.map((p) => summarizePayload("editReply", p)),
          ...harness.calls.followUp.map((p) => summarizePayload("followUp", p)),
        ],
        deferred: harness.calls.deferReply.length,
        modals: harness.calls.showModal.length,
        autocomplete: harness.calls.respond.map((choices) =>
          choices.map((c) => c.name ?? c)
        ),
        saves: harness.persistCalls.length,
        logged,
      };
      results.push(summary);
      return summary;
    } finally {
      harness.cleanup();
    }
  }

  return {
    run,
    results,
    get game() {
      return gameData;
    },
  };
}

function mapStore(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (key) => store.get(key),
    set(key, value) {
      store.set(key, value);
      return this;
    },
    has: (key) => store.has(key),
    delete: (key) => store.delete(key),
    ensure(key, fallback) {
      if (!store.has(key)) store.set(key, fallback);
      return store.get(key);
    },
    entries: () => [...store.entries()],
  };
}

// For commands that read guild-wide data (for example /dice, /rollcust).
function guildStore(initial = {}) {
  let data = structuredClone(initial);
  return {
    getGuildData: async () => data,
    setGuildData: async (_guildId, next) => {
      data = next;
    },
  };
}

function createContext() {
  const results = [];
  const session = createSession({}, results);
  return {
    run: session.run,
    session: (base) => createSession(base, results),
    results,
    game: {
      createActiveGame: harnessModule.createActiveGame,
      createPlayer: harnessModule.createPlayer,
      createCard: harnessModule.createCard,
      createDeck: harnessModule.createDeck,
    },
    stubs: { mapStore, guildStore },
    harness: harnessModule,
  };
}

async function runFixtureFile(file) {
  const abs = path.resolve(file);
  const mod = require(abs);
  const fn = typeof mod === "function" ? mod : mod.default || mod.run;
  if (typeof fn !== "function") {
    throw new Error(`${file} must export an async function (ctx) => { ... }`);
  }
  const ctx = createContext();
  const returned = await fn(ctx);
  return { results: ctx.results, returned };
}

function formatSummary(summary) {
  const lines = [summary.command];
  if (summary.deferred) lines.push(`  deferred reply x${summary.deferred}`);
  for (const reply of summary.replies) {
    const flag = reply.visibility === "ephemeral" ? " (ephemeral)" : "";
    const extras = [
      reply.components ? `${reply.components} component row(s)` : null,
      reply.files ? `${reply.files} file(s)` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`  ${reply.kind}${flag}: ${JSON.stringify(reply.text)}${extras ? ` [${extras}]` : ""}`);
    for (const embed of reply.embeds) {
      lines.push(`    embed: ${JSON.stringify(embed)}`);
    }
  }
  if (summary.modals) lines.push(`  modal shown x${summary.modals}`);
  for (const choices of summary.autocomplete) {
    lines.push(`  autocomplete: ${JSON.stringify(choices)}`);
  }
  lines.push(`  game saves: ${summary.saves}`);
  for (const entry of summary.logged) {
    lines.push(`  LOGGED ${entry.level.toUpperCase()}: ${entry.message.split("\n")[0]}`);
  }
  return lines.join("\n");
}

function allText(results) {
  return results
    .flatMap((r) => r.replies.flatMap((p) => [p.text, ...p.embeds]))
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  allText,
  commandClass,
  createContext,
  createSession,
  formatSummary,
  guildStore,
  mapStore,
  runFixtureFile,
};
