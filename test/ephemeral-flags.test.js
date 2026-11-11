const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const { MessageFlags } = require("discord.js");
const BGG = require("../slashcommands/info/bgg");
const Cards = require("../slashcommands/genericgame/cards");
const Tokens = require("../slashcommands/genericgame/tokens");
const BoardGameGeek = require("../modules/BoardGameGeek");
const {
  createActiveGame,
  createCard,
  createPlayer,
  withBggStub,
  withHarness,
} = require("./helpers/harness");

const REPO_ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["test", "node_modules", ".git"]);

function listProductionJs(dir = REPO_ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...listProductionJs(full));
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:'"?\\])\/\/.*$/gm, "$1");
}

function deprecatedEphemeralHits(source) {
  const hits = [];
  const cleaned = stripComments(source);
  const lines = cleaned.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/(?:^|[{\s,])ephemeral\s*:/.test(lines[i]) || /\{\s*ephemeral\s*[,}]/.test(lines[i])) {
      hits.push(i + 1);
    }
  }
  return hits;
}

function expectNoDeprecatedEphemeral(payload) {
  expect(payload).toBeDefined();
  expect(payload.ephemeral).toBeUndefined();
}

function gameWithTokens(tokens, playerTokens = {}) {
  return createActiveGame({
    tokens,
    players: [
      createPlayer({
        userId: "user-1",
        name: "Alice",
        order: 0,
        tokens: playerTokens,
      }),
      createPlayer({
        userId: "user-2",
        name: "Bob",
        order: 1,
        tokens: {},
      }),
    ],
  });
}

async function runTokens(harness) {
  await new Tokens(harness.client).execute(harness.interaction);
}

async function runCards(harness) {
  await new Cards(harness.client).execute(harness.interaction);
}

async function runBgg(harness) {
  await new BGG(harness.client).execute(harness.interaction);
}

describe("discord.js ephemeral flags", () => {
  test("production interaction payloads do not pass the deprecated ephemeral option", () => {
    const hits = [];
    for (const file of listProductionJs()) {
      const source = fs.readFileSync(file, "utf8");
      for (const line of deprecatedEphemeralHits(source)) {
        hits.push(`${path.relative(REPO_ROOT, file)}:${line}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("/bgg defers with MessageFlags.Ephemeral for allephemeral details", async () => {
    await withBggStub(
      {
        CreateAndLoad: async () => ({
          embeds: [{ title: "Catan" }],
          attachments: [],
          otherAttachments: [],
          LoadEmbeds: async () => {},
        }),
      },
      async () => {
        await withHarness(
          {
            options: {
              strings: {
                game: "13",
                details: BoardGameGeek.DetailsEnum.ALLEPHEMERAL,
              },
            },
          },
          async (harness) => {
            await runBgg(harness);
            expectNoDeprecatedEphemeral(harness.calls.deferReply[0]);
            expect(harness.calls.deferReply[0].flags).toBe(MessageFlags.Ephemeral);
            expectNoDeprecatedEphemeral(harness.calls.editReply[0]);
            expect(harness.calls.editReply[0].embeds[0].title).toBe("Catan");
          }
        );
      }
    );
  });

  test("/bgg keeps a public defer for default details", async () => {
    await withBggStub(
      {
        CreateAndLoad: async () => ({
          embeds: [{ title: "Catan" }],
          attachments: [],
          otherAttachments: [],
          LoadEmbeds: async () => {},
        }),
      },
      async () => {
        await withHarness(
          {
            options: {
              strings: { game: "13", details: BoardGameGeek.DetailsEnum.ALL },
            },
          },
          async (harness) => {
            await runBgg(harness);
            expectNoDeprecatedEphemeral(harness.calls.deferReply[0]);
            expect(harness.calls.deferReply[0].flags).toBeUndefined();
            expectNoDeprecatedEphemeral(harness.calls.editReply[0]);
          }
        );
      }
    );
  });

  test("/tokens check hides a public token privately unless all=true", async () => {
    const gameData = gameWithTokens(
      [{ id: "tok-coin", name: "Coin", description: "Gold", isSecret: false, cap: null }],
      { "tok-coin": 2 }
    );

    await withHarness(
      {
        gameData,
        options: {
          subcommand: "check",
          strings: { name: "Coin" },
        },
      },
      async (harness) => {
        await runTokens(harness);
        expectNoDeprecatedEphemeral(harness.calls.reply[0]);
        expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
        expect(harness.calls.reply[0].embeds[0].data.title).toBe("Coin Token Counts");
      }
    );

    await withHarness(
      {
        gameData,
        options: {
          subcommand: "check",
          strings: { name: "Coin" },
          booleans: { all: true },
        },
      },
      async (harness) => {
        await runTokens(harness);
        expectNoDeprecatedEphemeral(harness.calls.reply[0]);
        expect(harness.calls.reply[0].flags).toBeUndefined();
      }
    );
  });

  test("/tokens check stays private when listing secret tokens", async () => {
    const gameData = gameWithTokens(
      [
        { id: "tok-coin", name: "Coin", description: "", isSecret: false, cap: null },
        { id: "tok-spy", name: "Spy", description: "", isSecret: true, cap: null },
      ],
      { "tok-coin": 1, "tok-spy": 3 }
    );

    await withHarness(
      {
        gameData,
        options: { subcommand: "check" },
      },
      async (harness) => {
        await runTokens(harness);
        expectNoDeprecatedEphemeral(harness.calls.reply[0]);
        expect(harness.calls.reply[0].flags).toBe(MessageFlags.Ephemeral);
        expect(harness.calls.reply[0].embeds.map((embed) => embed.data.title)).toEqual([
          "Token Counts",
          "Your Secret Token Counts",
        ]);
      }
    );

    await withHarness(
      {
        gameData,
        options: {
          subcommand: "check",
          booleans: { all: true },
        },
      },
      async (harness) => {
        await runTokens(harness);
        expectNoDeprecatedEphemeral(harness.calls.reply[0]);
        expect(harness.calls.reply[0].flags).toBeUndefined();
        expect(harness.calls.reply[0].embeds.map((embed) => embed.data.title)).toEqual([
          "Token Counts",
        ]);
      }
    );
  });

  test("/cards pile move defers a public picker", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: createActiveGame({
          globalPiles: [
            { id: "pile-1", name: "Market", isSecret: false, cards: [ace] },
          ],
        }),
        options: {
          subcommandGroup: "pile",
          subcommand: "move",
          strings: { sourcepile: "pile-1", destination: "hand" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.deferReply[0]).toEqual({});
        expectNoDeprecatedEphemeral(harness.calls.deferReply[0]);
        expectNoDeprecatedEphemeral(harness.calls.editReply[0]);
        expect(harness.calls.editReply[0].flags).toBeUndefined();
        expect(harness.calls.editReply[0].content).toContain("move from Market");
      }
    );
  });

  test("/cards gameboard move defers a public picker", async () => {
    const ace = createCard({ id: "ace-1", name: "Ace", origin: "Main" });
    await withHarness(
      {
        gameData: createActiveGame({ gameBoard: [ace] }),
        options: {
          subcommandGroup: "gameboard",
          subcommand: "move",
          strings: { destination: "hand" },
        },
      },
      async (harness) => {
        await runCards(harness);
        expect(harness.calls.deferReply[0]).toEqual({});
        expectNoDeprecatedEphemeral(harness.calls.deferReply[0]);
        expectNoDeprecatedEphemeral(harness.calls.editReply[0]);
        expect(harness.calls.editReply[0].flags).toBeUndefined();
        expect(harness.calls.editReply[0].content).toContain("move from Game Board");
      }
    );
  });
});
