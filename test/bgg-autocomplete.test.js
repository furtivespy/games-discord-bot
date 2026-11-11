const { afterEach, describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const BoardGameGeek = require("../modules/BoardGameGeek");
const Game = require("../slashcommands/genericgame/game");
const BGG = require("../slashcommands/info/bgg");
const Lfg = require("../slashcommands/info/lfg");
const { withBggStub, withHarness } = require("./helpers/harness");

const SEARCH_XML = fs.readFileSync(
  path.join(__dirname, "fixtures", "bgg-search.xml"),
  "utf8"
);
const CLOUDFLARE_403_HTML = `<!DOCTYPE html><html><body>Cloudflare</body></html>`;
const originalFetch = globalThis.fetch;

const GAME_AUTOCOMPLETE_SUBCOMMANDS = [
  "newgame",
  "addimage",
  "addlink",
  "removeimage",
  "removelink",
];

function listJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "test") continue;
      files.push(...listJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

function fakeAutocompleteInteraction(query, { logger } = {}) {
  const responded = [];
  const logs = [];
  const interaction = {
    options: {
      getString: (name) => (name === "game" ? query : null),
    },
    client: {
      logger: logger || {
        log: (err, level) => logs.push([err, level]),
      },
    },
    respond: async (choices) => {
      responded.push(choices);
    },
  };
  return { interaction, responded, logs };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("BGG XML autocomplete", () => {
  test("Search throws on HTTP 403 instead of treating Cloudflare HTML as results", async () => {
    globalThis.fetch = async (url) => {
      expect(String(url)).toContain("api.geekdo.com/xmlapi2/search");
      return new Response(CLOUDFLARE_403_HTML, {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    };
    await expect(BoardGameGeek.Search("agricola", "test-bgg-token")).rejects.toThrow(
      "BGG search failed with HTTP 403"
    );
  });

  test("respondAutocomplete returns XML search choices", async () => {
    globalThis.fetch = async (url, init) => {
      expect(String(url)).not.toContain("boardgamegeek.com/search");
      expect(String(url)).toContain("api.geekdo.com/xmlapi2/search");
      expect(init?.headers?.Authorization).toBe("Bearer test-bgg-token");
      return new Response(SEARCH_XML, {
        status: 200,
        headers: { "content-type": "text/xml" },
      });
    };
    const { interaction, responded } = fakeAutocompleteInteraction("wonderful");
    await BoardGameGeek.respondAutocomplete(interaction, "test-bgg-token");
    expect(responded).toHaveLength(1);
    expect(responded[0].find((item) => item.value === "266192")).toEqual({
      name: "It\u2019s a Wonderful World (2019)",
      value: "266192",
    });
  });

  test("respondAutocomplete returns a user-facing choice when search 403s", async () => {
    globalThis.fetch = async () =>
      new Response(CLOUDFLARE_403_HTML, {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    const { interaction, responded, logs } = fakeAutocompleteInteraction("agricola");
    await BoardGameGeek.respondAutocomplete(interaction, "test-bgg-token");
    expect(responded).toEqual([[BoardGameGeek.SEARCH_UNAVAILABLE_CHOICE]]);
    expect(responded[0][0].name).toContain("unavailable");
    expect(isNaN(responded[0][0].value)).toBe(true);
    expect(logs[0][1]).toBe("error");
    expect(String(logs[0][0].message)).toContain("403");
  });

  test("respondAutocomplete returns a user-facing choice when fetch throws", async () => {
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    const { interaction, responded } = fakeAutocompleteInteraction("catan");
    await BoardGameGeek.respondAutocomplete(interaction, "test-token");
    expect(responded).toEqual([[BoardGameGeek.SEARCH_UNAVAILABLE_CHOICE]]);
  });

  test("respondAutocomplete returns no choices for an empty query", async () => {
    globalThis.fetch = async () => {
      throw new Error("Search should not run for an empty query");
    };
    const { interaction, responded } = fakeAutocompleteInteraction(null);
    await BoardGameGeek.respondAutocomplete(interaction, "test-token");
    expect(responded).toEqual([[]]);
  });

  test("no production file uses the HTML BGG search URL", () => {
    const root = path.join(__dirname, "..");
    const hits = [];
    for (const file of listJsFiles(root)) {
      const src = fs.readFileSync(file, "utf8");
      if (src.includes("boardgamegeek.com/search/boardgame")) {
        hits.push(path.relative(root, file));
      }
    }
    expect(hits).toEqual([]);
  });

  test("BGG autocomplete callers share respondAutocomplete", () => {
    const root = path.join(__dirname, "..");
    const callers = [
      "slashcommands/info/bgg.js",
      "slashcommands/info/lfg.js",
      "subcommands/genericgame/newgameplus.js",
      "subcommands/genericgame/addimage.js",
      "subcommands/genericgame/addlink.js",
      "subcommands/genericgame/removeimage.js",
      "subcommands/genericgame/removelink.js",
    ];
    for (const file of callers) {
      const src = fs.readFileSync(path.join(root, file), "utf8");
      expect(src).toContain("BoardGameGeek.respondAutocomplete");
      expect(src).not.toContain("BoardGameGeek.Search(");
    }
  });
});

describe("/game BGG autocomplete subcommands", () => {
  for (const subcommand of GAME_AUTOCOMPLETE_SUBCOMMANDS) {
    test(`${subcommand} autocomplete uses BoardGameGeek.Search`, async () => {
      await withBggStub(
        {
          Search: async (query, token) => {
            expect(query).toBe("catan");
            expect(token).toBe("test-token");
            return [{ name: "Catan (1995)", value: "13" }];
          },
        },
        async () => {
          await withHarness(
            {
              isAutocomplete: true,
              options: {
                subcommand,
                strings: { game: "catan" },
              },
            },
            async (harness) => {
              const command = new Game(harness.client);
              await command.execute(harness.interaction);
              expect(harness.calls.respond).toEqual([
                [{ name: "Catan (1995)", value: "13" }],
              ]);
              expect(harness.calls.reply).toHaveLength(0);
            }
          );
        }
      );
    });
  }

  test("addimage autocomplete shows a message instead of crashing on BGG 403", async () => {
    globalThis.fetch = async (url) => {
      expect(String(url)).not.toContain("boardgamegeek.com/search");
      return new Response(CLOUDFLARE_403_HTML, {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    };
    await withHarness(
      {
        isAutocomplete: true,
        options: {
          subcommand: "addimage",
          strings: { game: "agricola" },
        },
      },
      async (harness) => {
        const command = new Game(harness.client);
        await command.execute(harness.interaction);
        expect(harness.calls.respond).toEqual([
          [BoardGameGeek.SEARCH_UNAVAILABLE_CHOICE],
        ]);
        expect(harness.calls.reply).toHaveLength(0);
      }
    );
  });
});

describe("/bgg and /lfg autocomplete", () => {
  test("/bgg autocomplete uses the shared helper", async () => {
    await withBggStub(
      {
        Search: async (query, token) => {
          expect(query).toBe("wing");
          expect(token).toBe("bgg-token");
          return [{ name: "Wingspan (2019)", value: "266192" }];
        },
      },
      async () => {
        const command = new BGG({
          config: { BGGToken: "bgg-token" },
          logger: { log: () => {} },
        });
        const responded = [];
        await command.execute({
          isAutocomplete: () => true,
          options: {
            getString: (name) => (name === "game" ? "wing" : null),
          },
          respond: async (choices) => responded.push(choices),
        });
        expect(responded).toEqual([[{ name: "Wingspan (2019)", value: "266192" }]]);
      }
    );
  });

  test("/lfg autocomplete uses the shared helper", async () => {
    await withBggStub(
      {
        Search: async (query, token) => {
          expect(query).toBe("wing");
          expect(token).toBe("bgg-token");
          return [{ name: "Wingspan (2019)", value: "266192" }];
        },
      },
      async () => {
        const command = new Lfg({
          config: { BGGToken: "bgg-token" },
          logger: { log: () => {} },
        });
        const responded = [];
        await command.execute({
          isAutocomplete: () => true,
          options: {
            getString: (name) => (name === "game" ? "wing" : null),
          },
          respond: async (choices) => responded.push(choices),
        });
        expect(responded).toEqual([[{ name: "Wingspan (2019)", value: "266192" }]]);
      }
    );
  });
});
