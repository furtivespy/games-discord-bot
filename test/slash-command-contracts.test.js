const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");

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

function collectOptionNames(options = []) {
  const names = [];
  for (const option of options) {
    names.push(option.name);
    if (option.options) {
      names.push(...collectOptionNames(option.options));
    }
  }
  return names;
}

describe("slash command definition contracts", () => {
  const files = listSlashCommandFiles();
  const stubClient = { logger: { log: () => {} }, config: {} };

  test("every slashcommands file exports a constructable command with toJSON()", () => {
    expect(files.length).toBeGreaterThan(10);

    const names = [];
    for (const file of files) {
      const Command = require(file);
      const command = new Command(stubClient);
      expect(command.data).toBeDefined();
      const json = command.data.toJSON();
      expect(json.name).toBe(command.help.name);
      expect(json.description).toBeTruthy();
      names.push(json.name);
    }

    expect(new Set(names).size).toBe(names.length);
  });

  test("/game registers the core table-management subcommands", () => {
    const Game = require("../slashcommands/genericgame/game");
    const json = new Game(stubClient).data.toJSON();
    const subcommands = json.options.map((option) => option.name);
    expect(subcommands).toEqual(
      expect.arrayContaining([
        "newgame",
        "next",
        "reverse",
        "status",
        "delete",
        "winner",
        "history",
        "historyadd",
        "playarea",
        "pinnedstatus",
        "help",
      ])
    );

    const newgame = json.options.find((option) => option.name === "newgame");
    expect(newgame.options.find((option) => option.name === "game")).toMatchObject({
      required: true,
      autocomplete: true,
    });
    expect(newgame.options.find((option) => option.name === "player1").required).toBe(
      true
    );
  });

  test("/cards registers deck, hand, and pile groups", () => {
    const Cards = require("../slashcommands/genericgame/cards");
    const json = new Cards(stubClient).data.toJSON();
    const groups = Object.fromEntries(json.options.map((option) => [option.name, option]));

    expect(groups.help).toBeDefined();
    expect(groups.deck.options.map((option) => option.name)).toEqual(
      expect.arrayContaining(["new", "draw", "shuffle", "pick"])
    );
    expect(groups.hand.options.map((option) => option.name)).toEqual(
      expect.arrayContaining(["play", "discard", "show"])
    );
    expect(groups.pile.options.map((option) => option.name)).toEqual(
      expect.arrayContaining(["create", "draw", "list"])
    );
  });

  test("/players registers add, remove, score, and first", () => {
    const Players = require("../slashcommands/players/players");
    const json = new Players(stubClient).data.toJSON();
    expect(json.options.map((option) => option.name)).toEqual(
      expect.arrayContaining(["add", "remove", "first", "score", "color", "help"])
    );
  });

  test("required and autocomplete flags stay set on high-traffic options", () => {
    const Cards = require("../slashcommands/genericgame/cards");
    const json = new Cards(stubClient).data.toJSON();
    const names = collectOptionNames(json.options);
    expect(names).toContain("cardset");

    const deckNew = json.options
      .find((option) => option.name === "deck")
      .options.find((option) => option.name === "new");
    expect(deckNew.options.find((option) => option.name === "cardset")).toMatchObject({
      required: true,
      autocomplete: true,
    });
  });
});
