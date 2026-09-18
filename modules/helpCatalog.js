const {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  StringSelectMenuBuilder,
} = require("discord.js");

/**
 * Game Bot `/help` catalog.
 *
 * How-to recipes are curated (the reported deck gap). Command lists are
 * generated from the live slash-command collection so new commands show up
 * automatically. Add a COMMAND_BLURBS one-liner when the slash description
 * is too terse ("game", "cards").
 *
 * Owner-only commands stay visible and are labeled — they are not hidden.
 */

const HELP_COLOR = 0xc27c0e;
const HELP_SELECT_ID = "help:topic";
const COLLECTOR_MS = 180_000;
const FIELD_VALUE_MAX = 1024;
const DESCRIPTION_MAX = 4096;
const SELECT_DESC_MAX = 100;

const OVERVIEW_ID = "overview";

const COMMAND_AREA = {
  help: "lookup",
  game: "table",
  lfg: "table",
  visual: "table",
  players: "table",
  team: "table",
  cards: "cards",
  catalog: "catalog",
  bgg: "lookup",
  rules: "lookup",
  suggest: "lookup",
  releasenotes: "lookup",
  tokens: "extras",
  money: "extras",
  secret: "extras",
  winshare: "extras",
  config: "admin",
  migrate: "admin",
  diagnostic: "admin",
  settings: "admin",
  dice: "utilities",
  roll: "utilities",
  rollcust: "utilities",
  yahtzee: "utilities",
  choose: "utilities",
  reminder: "utilities",
  timezone: "utilities",
};

const AREA_META = {
  table: {
    label: "Start a table",
    emoji: "🎲",
    order: 10,
    description: "Open a game in this channel, seats, turns, and pinned status.",
  },
  cards: {
    label: "Cards & decks",
    emoji: "🃏",
    order: 20,
    description: "Decks, hands, piles, play area, draft, and the game board.",
  },
  catalog: {
    label: "Catalog",
    emoji: "📚",
    order: 30,
    description: "Global deck templates. Bot owner only.",
  },
  lookup: {
    label: "Lookup",
    emoji: "🔎",
    order: 40,
    description: "BoardGameGeek, rules questions, suggestions, and this help.",
  },
  extras: {
    label: "Tokens, money, secrets",
    emoji: "🪙",
    order: 50,
    description: "Tokens, money, hidden info, teams, and win share.",
  },
  admin: {
    label: "Admin / config",
    emoji: "🛠️",
    order: 60,
    description: "Guild setup and owner-only maintenance.",
  },
  utilities: {
    label: "Dice & utilities",
    emoji: "🔧",
    order: 70,
    description: "Dice, choose, reminders, and timezone.",
  },
  more: {
    label: "More",
    emoji: "📁",
    order: 90,
    description: "Other loaded slash commands.",
  },
};

const COMMAND_BLURBS = {
  help: "Discover commands and how-tos",
  game: "Start a table, turns, status, pin, history",
  lfg: "Gather Interest panel; host can Start game into a thread",
  visual: "Open visual mode in this channel",
  players: "Add/remove seats, first player, score, color",
  team: "Team names, colors, join, randomize",
  cards: "Decks, hands, piles, play area, draft, board",
  catalog: "Inspect and publish global deck templates",
  bgg: "Look up a game on Board Game Geek",
  rules: "Ask an AI rules question for the current game",
  suggest: "Add, list, and vote on bot suggestions",
  releasenotes: "Read Game Bot release notes",
  tokens: "Create and move tokens",
  money: "Deal, pay, spend, and check money",
  secret: "Hidden info, reveal, super-secret mode",
  winshare: "Who won a game in another channel",
  config: "Set the games channel for /lfg Start game",
  migrate: "Seed built-in deck catalog templates",
  diagnostic: "Data persistence diagnostics",
  settings: "Adjust bot settings",
  dice: "Create and manage custom dice",
  roll: "Roll dice (d20+5, 4d6, …)",
  rollcust: "Roll a saved custom die",
  yahtzee: "Roll six-sided dice",
  choose: "Pick randomly from a comma-separated list",
  reminder: "Remind you at a future time",
  timezone: "Set your timezone for reminders",
};

const HOWTO_SESSION = [
  "**Create a game session**",
  "",
  "1. In the play channel (or game thread), run `/game newgame`. Pick the game from autocomplete (or `customname` for a playtest not on BGG) and add at least **player1**.",
  "2. Optional: `/game pinnedstatus` with `on` (pin + chat table) or `full` (pin only; `/game status` still prints the table).",
  "3. Change seats with `/players add` / `remove`. Set the start player with `/players first`.",
  "4. `/game next` pings the next player; `/game reverse` flips turn order.",
  "5. `/game status` shows the table. `/game winner` then `/game delete` (type `delete`) when you are done.",
  "",
  "To start from a public interest panel instead, see `/help topic:lfg`.",
].join("\n");

const HOWTO_DECKS = [
  "**Create a deck and add a card**",
  "",
  "Decks attach to the **game in this channel**. Start a table first.",
  "",
  "1. `/game newgame` — pick the game and at least **player1**.",
  "2. `/cards deck new`",
  "   • `name` — e.g. Main",
  "   • `cardset` — **empty (start from scratch)** for a blank recipe, a catalog set, or **custom-csv** plus `customlist` (comma-separated names)",
  "3. `/cards deck addcard` — required `name`. Optional: image `url`, `type`, `suit`, `value`, `description`, `copies`, `format`.",
  "   • New cards go to **discard**, not draw, and are added to the deck recipe.",
  "4. `/cards deck shuffle` — mix discard into draw.",
  "5. `/cards deck draw` — top card into your hand. `/cards hand view` to see it (only you). `/cards hand show` and `/cards hand showall` show card(s) to the table without leaving your hand.",
  "",
  "In-game card edit (`/cards deck editcard`) is coming soon. Many names at once: `/help topic:addlist`.",
].join("\n");

const HOWTO_ADDLIST = [
  "**Add many cards**",
  "",
  "1. Have a game and a deck (`/help topic:decks`).",
  "2. `/cards deck addlist` with `customlist` like `Forest, Village, Smithy, Smithy` (comma-separated names; repeats add extra copies).",
  "3. Those cards are name-only and land in **discard**, not draw — shuffle when you want them drawable.",
  "4. Same comma-separated list works at create time: `/cards deck new` with `cardset` **custom-csv** and `customlist`.",
  "",
  "Headered CSV import (name, image URL, type, …) is coming soon.",
].join("\n");

const HOWTO_DRAW = [
  "**Draw, shuffle, and recall**",
  "",
  "1. `/cards deck draw` or `/cards deck drawmultiple` — from the draw pile into your hand.",
  "2. `/cards deck shuffle` — discard into draw. Bag-style decks also reshuffle remaining draw (`/cards deck configure`).",
  "3. `/cards deck recall` — pull every card of that deck back (hands, piles, board) and reshuffle to start over.",
  "4. `/cards deck flipcard` / `flipmultiple` — turn the top card(s) face-up onto discard or a destination.",
  "5. `/cards hand play` shows the card to the table; `/cards hand discard` does not. `/cards hand view` is private. `/cards hand show` (one card) and `/cards hand showall` are public; cards stay in hand.",
].join("\n");

const HOWTO_LFG = [
  "**Start from Gather Interest**",
  "",
  "1. In the public LFG channel, run `/lfg` and pick a BoardGameGeek game.",
  "2. People tap **Very** / **Somewhat** / **Flexibly** interested.",
  "3. Host clicks **Start game**, then picks seated players from the interest list and/or anyone on the server.",
  "4. The bot opens a play thread in the configured **games channel** (not the LFG channel), pins live status, and creates the table.",
  "5. If Start game says the games channel is not set, a server admin runs `/config games-channel`.",
  "",
  "`/config` is administrator-only.",
].join("\n");

const TOPICS = {
  [OVERVIEW_ID]: {
    id: OVERVIEW_ID,
    label: "Overview",
    emoji: "📋",
    description: "How-tos and every loaded slash command",
    aliases: ["start", "home", "index"],
    kind: "overview",
  },
  session: {
    id: "session",
    label: "How-to: Start a session",
    emoji: "🎲",
    description: "Create a game table in this channel",
    aliases: ["newgame", "table-start"],
    kind: "howto",
    howto: HOWTO_SESSION,
    commandNames: ["game", "players"],
  },
  decks: {
    id: "decks",
    label: "How-to: Create a deck",
    emoji: "🃏",
    description: "New deck, then add a card",
    aliases: ["deck", "addcard"],
    kind: "howto",
    howto: HOWTO_DECKS,
    commandNames: ["cards"],
    groups: ["deck"],
  },
  addlist: {
    id: "addlist",
    label: "How-to: Add many cards",
    emoji: "📝",
    description: "Bulk-add names with addlist",
    aliases: ["bulk", "csv"],
    kind: "howto",
    howto: HOWTO_ADDLIST,
    commandNames: ["cards"],
    groups: ["deck"],
  },
  draw: {
    id: "draw",
    label: "How-to: Draw & shuffle",
    emoji: "🔀",
    description: "Draw, shuffle, recall, flip",
    aliases: ["shuffle", "recall", "view", "show", "showall", "reveal"],
    kind: "howto",
    howto: HOWTO_DRAW,
    commandNames: ["cards"],
    groups: ["deck", "hand"],
  },
  lfg: {
    id: "lfg",
    label: "How-to: Gather Interest",
    emoji: "🙋",
    description: "/lfg then Start game",
    aliases: ["gather", "interest"],
    kind: "howto",
    howto: HOWTO_LFG,
    commandNames: ["lfg", "config"],
  },
  table: {
    id: "table",
    label: "Start a table",
    emoji: "🎲",
    description: "/game, /lfg, players, pin",
    aliases: ["game", "players", "team"],
    kind: "area",
    area: "table",
    intro: HOWTO_SESSION,
    commandNames: ["game", "lfg", "players", "team"],
  },
  cards: {
    id: "cards",
    label: "Cards & decks",
    emoji: "🃏",
    description: "All /cards groups",
    aliases: ["hand", "pile", "playarea", "draft", "gameboard"],
    kind: "area",
    area: "cards",
    intro:
      "Need the deck recipe? `/help topic:decks`. `/cards hand view` is private; `/cards hand show` and `/cards hand showall` are public (cards stay in hand). Commands below are the live `/cards` surface.",
    commandNames: ["cards"],
  },
  catalog: {
    id: "catalog",
    label: "Catalog",
    emoji: "📚",
    description: "Global deck templates (owner-only)",
    aliases: [],
    kind: "area",
    area: "catalog",
    intro:
      "The deck **catalog** is a bot-wide list of templates used by `/cards deck new`. These commands are **owner-only**.",
    commandNames: ["catalog"],
  },
  lookup: {
    id: "lookup",
    label: "Lookup",
    emoji: "🔎",
    description: "BGG, rules, suggestions, help",
    aliases: ["bgg", "rules", "suggest"],
    kind: "area",
    area: "lookup",
    commandNames: ["bgg", "rules", "lfg", "suggest", "releasenotes", "help"],
  },
  extras: {
    id: "extras",
    label: "Tokens, money, secrets",
    emoji: "🪙",
    description: "Tokens, money, secrets, win share",
    aliases: ["tokens", "money", "secret", "winshare"],
    kind: "area",
    area: "extras",
    commandNames: ["tokens", "money", "secret", "winshare"],
  },
  admin: {
    id: "admin",
    label: "Admin / config",
    emoji: "🛠️",
    description: "Guild config and owner tools",
    aliases: ["config", "migrate", "diagnostic", "settings"],
    kind: "area",
    area: "admin",
    intro:
      "`/config` is **administrator-only**. `/catalog`, `/migrate`, `/diagnostic`, and `/settings` are **owner-only**.",
    commandNames: ["config", "catalog", "migrate", "diagnostic", "settings"],
  },
  utilities: {
    id: "utilities",
    label: "Dice & utilities",
    emoji: "🔧",
    description: "Dice, choose, reminders",
    aliases: ["util", "dice", "roll"],
    kind: "area",
    area: "utilities",
    commandNames: ["dice", "roll", "rollcust", "yahtzee", "choose", "reminder", "timezone"],
  },
};

const TOPIC_ALIAS = buildAliasMap(TOPICS);

function buildAliasMap(topics) {
  const map = new Map();
  for (const topic of Object.values(topics)) {
    map.set(topic.id, topic.id);
    map.set(topic.label.toLowerCase(), topic.id);
    for (const alias of topic.aliases || []) {
      map.set(String(alias).toLowerCase(), topic.id);
    }
  }
  return map;
}

function normalizeTopicId(raw) {
  if (raw == null || raw === "") return OVERVIEW_ID;
  const key = String(raw)
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
  return TOPIC_ALIAS.get(key) || null;
}

function topicList() {
  return [
    TOPICS[OVERVIEW_ID],
    TOPICS.session,
    TOPICS.decks,
    TOPICS.addlist,
    TOPICS.draw,
    TOPICS.lfg,
    TOPICS.table,
    TOPICS.cards,
    TOPICS.catalog,
    TOPICS.lookup,
    TOPICS.extras,
    TOPICS.admin,
    TOPICS.utilities,
  ];
}

function commandJson(cmd) {
  if (!cmd?.data) return {};
  if (typeof cmd.data.toJSON === "function") return cmd.data.toJSON();
  return cmd.data;
}

function commandByName(slashcommands, name) {
  if (!slashcommands) return null;
  if (typeof slashcommands.get === "function") {
    return slashcommands.get(name) || null;
  }
  return slashcommands[name] || null;
}

function listHelpCommands(slashcommands) {
  const commands = [];
  if (!slashcommands) return commands;
  const values =
    typeof slashcommands.values === "function"
      ? [...slashcommands.values()]
      : Object.values(slashcommands);
  for (const cmd of values) {
    if (!cmd?.help?.name || cmd.conf?.enabled === false) continue;
    if (cmd.conf?.hidden) continue;
    commands.push(cmd);
  }
  return commands.sort((a, b) => a.help.name.localeCompare(b.help.name));
}

function isOwnerOnly(cmd) {
  return cmd?.conf?.permLevel === "Bot Owner";
}

function isAdminOnly(cmd) {
  if (cmd?.conf?.permLevel === "Administrator") return true;
  const perms = commandJson(cmd).default_member_permissions;
  if (perms == null || perms === "0") return false;
  try {
    return new PermissionsBitField(perms).has(
      PermissionsBitField.Flags.Administrator
    );
  } catch {
    return false;
  }
}

function accessLabel(cmd) {
  if (isOwnerOnly(cmd)) return " *(owner-only)*";
  if (isAdminOnly(cmd)) return " *(admin)*";
  return "";
}

function commandBlurb(cmd) {
  const name = cmd.help.name;
  if (COMMAND_BLURBS[name]) return COMMAND_BLURBS[name];
  return String(cmd.help.description || commandJson(cmd).description || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCommandLine(cmd) {
  return `\`/${cmd.help.name}\`${accessLabel(cmd)} — ${commandBlurb(cmd)}`;
}

function areaIdFor(cmd) {
  return COMMAND_AREA[cmd.help.name] || "more";
}

function shortDesc(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupSubcommands(cmd) {
  const json = commandJson(cmd);
  const groups = [];
  const loose = [];
  for (const opt of json.options || []) {
    if (opt.type === 2) {
      groups.push({
        name: opt.name,
        description: opt.description || "",
        lines: (opt.options || [])
          .filter((child) => child.name !== "help")
          .map(
            (child) =>
              `\`/${cmd.help.name} ${opt.name} ${child.name}\` — ${shortDesc(
                child.description
              )}`
          ),
      });
    } else if (opt.type === 1 && opt.name !== "help") {
      loose.push(
        `\`/${cmd.help.name} ${opt.name}\` — ${shortDesc(opt.description)}`
      );
    }
  }
  return { groups, loose };
}

function fieldsFromNamedLines(name, lines) {
  const fields = [];
  let chunk = [];
  let size = 0;
  let part = 1;

  const flush = () => {
    if (!chunk.length) return;
    const title =
      part === 1 && fields.length === 0 ? name : `${name} (${part})`;
    fields.push({ name: title, value: chunk.join("\n").slice(0, FIELD_VALUE_MAX) });
    chunk = [];
    size = 0;
    part += 1;
  };

  for (const line of lines) {
    const extra = (chunk.length ? 1 : 0) + line.length;
    if (chunk.length && size + extra > FIELD_VALUE_MAX) flush();
    chunk.push(line);
    size += extra;
  }
  flush();
  return fields;
}

function commandDetailFields(cmd, { groups: onlyGroups } = {}) {
  const { groups, loose } = groupSubcommands(cmd);
  const fields = [];
  const prefix = `/${cmd.help.name}`;
  if (loose.length) {
    fields.push(...fieldsFromNamedLines(prefix, loose));
  }
  for (const group of groups) {
    if (onlyGroups && !onlyGroups.includes(group.name)) continue;
    fields.push(
      ...fieldsFromNamedLines(`${prefix} ${group.name}`, group.lines)
    );
  }
  return fields;
}

function overviewDescription() {
  return [
    "Game Bot runs tabletop sessions in a Discord channel: seats, turns, cards, tokens, and BoardGameGeek lookup.",
    "",
    "**How-tos** — pick one from the menu, or deep-link with `/help topic:decks`:",
    "1. Start a table — `/help topic:session`",
    "2. Create a deck and add a card — `/help topic:decks`",
    "3. Add many cards — `/help topic:addlist`",
    "4. Draw, shuffle, recall — `/help topic:draw`",
    "5. Start from Gather Interest — `/help topic:lfg`",
    "",
    "Slash autocomplete is not enough when a flow spans several commands. Owner-only commands are labeled.",
  ].join("\n");
}

function groupByArea(commands) {
  const groups = new Map();
  for (const cmd of commands) {
    const id = areaIdFor(cmd);
    const meta = AREA_META[id] || AREA_META.more;
    if (!groups.has(id)) {
      groups.set(id, { meta, commands: [] });
    }
    groups.get(id).commands.push(cmd);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
    return a.meta.label.localeCompare(b.meta.label);
  });
}

function overviewEmbed(commands) {
  const groups = groupByArea(commands);
  const fields = groups.flatMap(({ meta, commands: cmds }) =>
    fieldsFromNamedLines(
      `${meta.emoji} ${meta.label}`,
      cmds.map(formatCommandLine)
    )
  );
  const embed = {
    color: HELP_COLOR,
    title: "Game Bot help",
    description: overviewDescription().slice(0, DESCRIPTION_MAX),
    footer: {
      text: "Live slash commands · /help topic:decks to deep-link · owner-only is labeled",
    },
  };
  if (fields.length) embed.fields = fields;
  return embed;
}

function topicEmbed(topic, slashcommands) {
  if (!topic || topic.kind === "overview") {
    return overviewEmbed(listHelpCommands(slashcommands));
  }

  const fields = [];
  const summary = [];
  const wanted = topic.commandNames || [];
  for (const name of wanted) {
    const cmd = commandByName(slashcommands, name);
    if (!cmd) continue;
    summary.push(formatCommandLine(cmd));
    fields.push(
      ...commandDetailFields(cmd, {
        groups: topic.groups,
      })
    );
  }

  const parts = [];
  if (topic.intro) parts.push(topic.intro);
  if (topic.howto) {
    if (parts.length) parts.push("");
    parts.push(topic.howto);
  }
  if (summary.length) {
    if (parts.length) parts.push("");
    parts.push(summary.join("\n"));
  }
  if (!parts.length) {
    parts.push(topic.description || "Nothing to show for this topic.");
  }

  const embed = {
    color: HELP_COLOR,
    title: `${topic.emoji || ""} ${topic.label}`.trim(),
    description: parts.join("\n").slice(0, DESCRIPTION_MAX),
    footer: {
      text: "Live slash commands · pick another topic below or /help topic:…",
    },
  };
  if (fields.length) embed.fields = fields.slice(0, 25);
  return embed;
}

function selectOptions(selectedId) {
  return topicList()
    .map((topic) => ({
      label: topic.label.slice(0, 100),
      value: topic.id,
      description: String(topic.description || "").slice(0, SELECT_DESC_MAX),
      emoji: topic.emoji,
      default: selectedId === topic.id,
    }))
    .slice(0, 25);
}

function autocompleteTopics(query) {
  const q = String(query || "").toLowerCase();
  return topicList()
    .filter((topic) => {
      if (!q) return true;
      if (topic.id.includes(q)) return true;
      if (topic.label.toLowerCase().includes(q)) return true;
      return (topic.aliases || []).some((alias) =>
        String(alias).toLowerCase().includes(q)
      );
    })
    .slice(0, 25)
    .map((topic) => {
      const name = `${topic.label} — ${topic.description}`.slice(0, 100);
      return { name, value: topic.id };
    });
}

function resolveHelpView(slashcommands, { topicId } = {}) {
  const requested = topicId == null || topicId === "" ? OVERVIEW_ID : topicId;
  const resolved = normalizeTopicId(requested);
  if (!resolved) {
    return {
      embed: overviewEmbed(listHelpCommands(slashcommands)),
      selectedId: OVERVIEW_ID,
      note: `\`${requested}\` is not a help topic. Try \`/help topic:decks\` or pick from the menu.`,
    };
  }
  const topic = TOPICS[resolved];
  return {
    embed: topicEmbed(topic, slashcommands),
    selectedId: resolved,
    note: null,
  };
}

function helpPayload(slashcommands, { topicId } = {}) {
  const view = resolveHelpView(slashcommands, { topicId });
  const embed = new EmbedBuilder(view.embed);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(HELP_SELECT_ID)
      .setPlaceholder("Browse a topic")
      .addOptions(selectOptions(view.selectedId))
  );
  const payload = {
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
  if (view.note) payload.content = view.note;
  return payload;
}

function attachHelpCollector(interaction, client, message) {
  if (!message || typeof message.createMessageComponentCollector !== "function") {
    return;
  }
  const collector = message.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === interaction.user.id && i.customId === HELP_SELECT_ID,
    time: COLLECTOR_MS,
  });

  collector.on("collect", async (select) => {
    try {
      const next = helpPayload(client.slashcommands, {
        topicId: select.values[0],
      });
      await select.update({
        content: next.content || null,
        embeds: next.embeds,
        components: next.components,
      });
    } catch (e) {
      client.logger?.log?.(e, "error");
    }
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {
      // Token may already be gone.
    }
  });
}

async function replyHelp(interaction, client, { topicId } = {}) {
  const payload = helpPayload(client.slashcommands, { topicId });
  await interaction.reply(payload);
  let message = null;
  if (typeof interaction.fetchReply === "function") {
    message = await interaction.fetchReply();
  }
  attachHelpCollector(interaction, client, message);
}

function helpContainsStaleCopy(text) {
  const body = String(text || "");
  if (/not avaial?ble yet/i.test(body)) return true;
  if (/\/game newgameplus/i.test(body)) return true;
  if (/\/cards hand reveal\b/i.test(body)) return true;
  // Live `/cards hand show` is public; the old private-hand command is `view`.
  if (/\/cards hand show\b[\s\S]{0,80}(only you|is private|privately)/i.test(body)) {
    return true;
  }
  return false;
}

function embedPlainText(embed) {
  if (!embed) return "";
  const data =
    typeof embed.toJSON === "function" ? embed.toJSON() : embed.data || embed;
  const parts = [];
  if (data.title) parts.push(data.title);
  if (data.description) parts.push(data.description);
  for (const field of data.fields || []) {
    if (field.name) parts.push(field.name);
    if (field.value) parts.push(field.value);
  }
  if (data.footer?.text) parts.push(data.footer.text);
  return parts.filter(Boolean).join("\n");
}

module.exports = {
  AREA_META,
  COMMAND_AREA,
  COMMAND_BLURBS,
  HELP_COLOR,
  HELP_SELECT_ID,
  HOWTO_ADDLIST,
  HOWTO_DECKS,
  HOWTO_DRAW,
  HOWTO_LFG,
  HOWTO_SESSION,
  OVERVIEW_ID,
  TOPICS,
  autocompleteTopics,
  embedPlainText,
  formatCommandLine,
  helpContainsStaleCopy,
  helpPayload,
  isAdminOnly,
  isOwnerOnly,
  listHelpCommands,
  normalizeTopicId,
  replyHelp,
  resolveHelpView,
  selectOptions,
  topicList,
};
