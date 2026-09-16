const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const { Collection, MessageFlags } = require("discord.js");
const Help = require("../slashcommands/info/help");
const {
  COMMAND_AREA,
  COMMAND_BLURBS,
  HELP_SELECT_ID,
  HOWTO_ADDLIST,
  HOWTO_DECKS,
  autocompleteTopics,
  embedPlainText,
  helpContainsStaleCopy,
  helpPayload,
  isOwnerOnly,
  listHelpCommands,
  normalizeTopicId,
  resolveHelpView,
  selectOptions,
  topicList,
} = require("../modules/helpCatalog");
const {
  collectedReplyText,
  withHarness,
} = require("./helpers/harness");

const SLASH_ROOT = path.join(__dirname, "..", "slashcommands");

function listSlashCommandFiles(dir = SLASH_ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSlashCommandFiles(full));
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files.sort();
}

function loadSlashCommands(client) {
  const commands = new Collection();
  for (const file of listSlashCommandFiles()) {
    const Command = require(file);
    const command = new Command(client);
    commands.set(command.help.name, command);
  }
  return commands;
}

const stubClient = { logger: { log: () => {} }, config: {} };
const slashcommands = loadSlashCommands(stubClient);

function viewText(topicId) {
  const view = resolveHelpView(slashcommands, { topicId });
  return [view.note, embedPlainText(view.embed)].filter(Boolean).join("\n");
}

describe("help catalog (FUR-95)", () => {
  test("every live slash command appears on the overview", () => {
    const overview = viewText("overview");
    const names = listHelpCommands(slashcommands).map((cmd) => cmd.help.name);
    expect(names.length).toBeGreaterThan(10);
    expect(names).toContain("help");
    expect(names).toContain("cards");
    expect(names).toContain("catalog");
    for (const name of names) {
      expect(overview).toContain(`/${name}`);
    }
    expect(helpContainsStaleCopy(overview)).toBe(false);
    expect(overview).not.toContain("newgameplus");
  });

  test("unmapped live commands still surface under More instead of vanishing", () => {
    const known = new Set(Object.keys(COMMAND_AREA));
    const extras = listHelpCommands(slashcommands).filter(
      (cmd) => !known.has(cmd.help.name)
    );
    expect(extras.map((cmd) => cmd.help.name)).toEqual([]);
  });

  test("create-deck how-to can be followed without asking a human", () => {
    const decks = viewText("decks");
    expect(decks).toContain("/game newgame");
    expect(decks).toContain("/cards deck new");
    expect(decks).toContain("empty");
    expect(decks).toContain("/cards deck addcard");
    expect(decks).toContain("discard");
    expect(decks).toContain("/cards deck shuffle");
    expect(decks).toContain("/cards deck draw");
    expect(HOWTO_DECKS).toMatch(/1\./);
    expect(helpContainsStaleCopy(decks)).toBe(false);
  });

  test("addlist how-to mentions CSV as coming soon", () => {
    const addlist = viewText("addlist");
    expect(addlist).toContain("/cards deck addlist");
    expect(addlist.toLowerCase()).toContain("coming soon");
    expect(HOWTO_ADDLIST.toLowerCase()).toContain("csv");
  });

  test("draw and lfg how-tos match the live surface", () => {
    const draw = viewText("draw");
    expect(draw).toContain("/cards deck draw");
    expect(draw).toContain("/cards deck shuffle");
    expect(draw).toContain("/cards deck recall");

    const lfg = viewText("lfg");
    expect(lfg).toContain("/lfg");
    expect(lfg).toContain("Start game");
    expect(lfg).toContain("/config games-channel");
    expect(lfg.toLowerCase()).not.toContain("coming soon");
  });

  test("owner-only commands are labeled, not hidden", () => {
    const overview = viewText("overview");
    for (const name of ["catalog", "migrate", "diagnostic", "settings"]) {
      const cmd = slashcommands.get(name);
      expect(isOwnerOnly(cmd)).toBe(true);
      expect(overview).toContain(`/${name}`);
      expect(overview).toMatch(new RegExp(`/${name}[^\n]*owner-only`));
    }
    const catalog = viewText("catalog");
    expect(catalog.toLowerCase()).toContain("owner-only");
    expect(catalog).toContain("/catalog list");
    expect(catalog).toContain("/catalog publish");
  });

  test("admin commands are labeled", () => {
    const overview = viewText("overview");
    expect(overview).toMatch(/\/config[^\n]*admin/);
  });

  test("topic aliases deep-link decks for a confused user", () => {
    expect(normalizeTopicId("decks")).toBe("decks");
    expect(normalizeTopicId("deck")).toBe("decks");
    expect(normalizeTopicId("addcard")).toBe("decks");
    expect(normalizeTopicId("/DECKS")).toBe("decks");
    expect(normalizeTopicId("nope")).toBeNull();

    const view = resolveHelpView(slashcommands, { topicId: "nope" });
    expect(view.selectedId).toBe("overview");
    expect(view.note).toContain("nope");
  });

  test("select menu and autocomplete stay within Discord limits", () => {
    const options = selectOptions("decks");
    expect(options.length).toBeGreaterThan(8);
    expect(options.length).toBeLessThanOrEqual(25);
    expect(options.filter((opt) => opt.default)).toHaveLength(1);
    expect(options.find((opt) => opt.value === "decks").default).toBe(true);
    for (const opt of options) {
      expect(opt.label.length).toBeLessThanOrEqual(100);
      expect(opt.description.length).toBeLessThanOrEqual(100);
    }

    const choices = autocompleteTopics("de");
    expect(choices.some((choice) => choice.value === "decks")).toBe(true);
    expect(choices.length).toBeLessThanOrEqual(25);
  });

  test("every topic embed fits Discord field and description limits", () => {
    for (const topic of topicList()) {
      const view = resolveHelpView(slashcommands, { topicId: topic.id });
      const embed = view.embed;
      expect(embed.description.length).toBeLessThanOrEqual(4096);
      expect((embed.fields || []).length).toBeLessThanOrEqual(25);
      for (const field of embed.fields || []) {
        expect(field.name.length).toBeLessThanOrEqual(256);
        expect(field.value.length).toBeGreaterThan(0);
        expect(field.value.length).toBeLessThanOrEqual(1024);
      }
      expect(helpContainsStaleCopy(embedPlainText(embed))).toBe(false);
    }
  });

  test("live /cards deck addcard and addlist appear on the decks topic", () => {
    const decks = viewText("decks");
    expect(decks).toContain("/cards deck addcard");
    expect(decks).toContain("/cards deck addlist");
    expect(decks).toContain("/cards deck new");
    expect(decks).not.toContain("Not Avaialbe Yet");
  });

  test("COMMAND_BLURBS covers every loaded slash command", () => {
    for (const cmd of listHelpCommands(slashcommands)) {
      expect(COMMAND_BLURBS[cmd.help.name]).toBeTruthy();
    }
  });
}, 15_000);

describe("/help slash command", () => {
  test("registers a topic option with autocomplete", () => {
    const json = new Help(stubClient).data.toJSON();
    expect(json.name).toBe("help");
    const topic = json.options.find((option) => option.name === "topic");
    expect(topic).toBeDefined();
    expect(topic.autocomplete).toBe(true);
    expect(topic.required).toBeFalsy();
  });

  test("replies ephemerally with a topic select and the decks recipe", async () => {
    await withHarness(
      { options: { strings: { topic: "decks" } } },
      async (harness) => {
        harness.client.slashcommands = slashcommands;
        const command = new Help(harness.client);
        await command.execute(harness.interaction);
        const payload = harness.calls.reply[0];
        expect(payload.flags).toBe(MessageFlags.Ephemeral);
        expect(payload.components[0].components[0].data.custom_id).toBe(
          HELP_SELECT_ID
        );
        const text = collectedReplyText(harness);
        expect(text).toContain("/cards deck new");
        expect(text).toContain("/cards deck addcard");
      }
    );
  });

  test("autocomplete returns matching topics", async () => {
    await withHarness(
      {
        isAutocomplete: true,
        options: { focused: "deck", focusedName: "topic" },
      },
      async (harness) => {
        harness.client.slashcommands = slashcommands;
        const command = new Help(harness.client);
        await command.execute(harness.interaction);
        expect(harness.calls.respond[0].some((choice) => choice.value === "decks")).toBe(
          true
        );
      }
    );
  });
}, 15_000);

describe("area /help subcommands reuse the catalog", () => {
  test("/game help opens the table topic", async () => {
    const Game = require("../slashcommands/genericgame/game");
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        harness.client.slashcommands = slashcommands;
        await new Game(harness.client).execute(harness.interaction);
        const text = collectedReplyText(harness);
        expect(text).toContain("/game newgame");
        expect(text).toContain("Create a game session");
        expect(harness.calls.followUp).toHaveLength(0);
      }
    );
  });

  test("/cards help opens the decks how-to", async () => {
    const Cards = require("../slashcommands/genericgame/cards");
    await withHarness(
      { options: { subcommand: "help" } },
      async (harness) => {
        harness.client.slashcommands = slashcommands;
        await new Cards(harness.client).execute(harness.interaction);
        const text = collectedReplyText(harness);
        expect(text).toContain("/cards deck addcard");
        expect(text.toLowerCase()).toContain("card");
      }
    );
  });
}, 15_000);
