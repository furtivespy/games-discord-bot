const { describe, expect, test } = require("bun:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const featureMap = require("../scripts/control/featureMap");
const { allText, runFixtureFile } = require("../scripts/control/execute");
const { checkBunVersion, checkDependencies } = require("../scripts/control/doctor");
const { findChrome } = require("../scripts/control/dev");
const { checkHealth, healthUrl } = require("../scripts/control/health");
const { main } = require("../scripts/control-gamebot");

const FIXTURES = path.join(__dirname, "..", "scripts", "control-fixtures");

// The first command load constructs every slash command (cold requires).
const SLOW = 30_000;

describe("Feature Map", () => {
  test(
    "INDEX.md and notes.md match the slash commands",
    () => {
      expect(featureMap.check()).toEqual([]);
    },
    SLOW
  );

  const commands = [
    {
      name: "demo",
      description: "Demo",
      source: "slashcommands/demo.js",
      permLevel: "User",
      subcommands: [{ path: "deck draw" }, { path: "hand view" }],
      handlers: [],
      tests: [],
    },
  ];
  const index = featureMap.renderIndex(commands);
  const goodNotes = "## /demo\n\n- Seed: none\n- Reach: `/demo deck draw`\n";

  test("a matching map has no problems", () => {
    expect(featureMap.checkFeatureMap({ commands, index, notes: goodNotes })).toEqual([]);
  });

  test("reports an out-of-date index", () => {
    const problems = featureMap.checkFeatureMap({ commands, index: "stale", notes: goodNotes });
    expect(problems.join("\n")).toContain("INDEX.md is out of date");
  });

  test("reports a command with no note", () => {
    const problems = featureMap.checkFeatureMap({ commands, index, notes: "" });
    expect(problems.join("\n")).toContain("No note for /demo");
  });

  test("reports a note for a command that does not exist", () => {
    const notes = `${goodNotes}\n## /ghost\n\n- Seed: none\n- Reach: none\n`;
    expect(featureMap.checkFeatureMap({ commands, index, notes }).join("\n")).toContain(
      "/ghost, which is not a slash command"
    );
  });

  test("requires Seed and Reach lines", () => {
    const problems = featureMap.checkFeatureMap({ commands, index, notes: "## /demo\n\nHello\n" });
    expect(problems.join("\n")).toContain('needs a "- Seed: ..." line');
    expect(problems.join("\n")).toContain('needs a "- Reach: ..." line');
  });

  test("reports a reference to a subcommand that does not exist", () => {
    const notes = "## /demo\n\n- Seed: none\n- Reach: `/demo deck burn` and `/demo nope`\n";
    const text = featureMap.checkFeatureMap({ commands, index, notes }).join("\n");
    expect(text).toContain("`/demo deck burn`");
    expect(text).toContain("`/demo nope`");
  });
});

describe("primitives catalog", () => {
  test("every code root listed in docs/primitives.md exists", () => {
    const root = path.join(__dirname, "..");
    const text = fs.readFileSync(path.join(root, "docs", "primitives.md"), "utf8");
    const missing = [];
    for (const line of text.split(/\r?\n/).filter((l) => l.startsWith("- Code:"))) {
      for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
        if (!/[/.]/.test(span) || span.startsWith("/") || span.startsWith("client.")) continue;
        if (!fs.existsSync(path.join(root, span))) missing.push(span);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("execute fixtures", () => {
  test("roll replies with a total and logs no errors", async () => {
    const { results } = await runFixtureFile(path.join(FIXTURES, "roll.js"));
    expect(allText(results)).toContain("Total rolled:");
    expect(results.flatMap((r) => r.logged)).toEqual([]);
  }, SLOW);

  test("cards-draw carries the game between runs", async () => {
    const { results, returned } = await runFixtureFile(path.join(FIXTURES, "cards-draw.js"));
    expect(results.map((r) => r.command)).toEqual(["/cards deck draw", "/cards deck peek"]);
    expect(allText(results)).toContain("Alice drew a card from Main");
    // The peek saw the second card because the draw was saved.
    expect(allText(results)).toContain("King");
    expect(returned).toEqual({ handCount: 1 });
  }, SLOW);

  test("dice stores a server die through the guild store stub", async () => {
    const { results } = await runFixtureFile(path.join(FIXTURES, "dice.js"));
    expect(allText(results)).toContain("**loaded**: [1, 2, 3, 4, 5, 6, 7, 8]");
    expect(results.flatMap((r) => r.logged)).toEqual([]);
  }, SLOW);

  test("timezone stores a preference through the map stub", async () => {
    const { returned } = await runFixtureFile(path.join(FIXTURES, "timezone.js"));
    expect(returned.stored).toEqual([["user-1", { timezone: "America/New_York" }]]);
  }, SLOW);

  test("errors a command catches and logs are surfaced", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "control-")), "bad.js");
    // /dice add without guild data throws inside the command's own try/catch.
    fs.writeFileSync(
      file,
      `module.exports = async (ctx) => { await ctx.run("dice", { subcommand: "list" }); };`
    );
    const { results } = await runFixtureFile(file);
    expect(results[0].logged.length).toBeGreaterThan(0);
    expect(results[0].logged[0].level).toBe("error");
  }, SLOW);

  test("a fixture that is not a function is rejected", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "control-")), "nope.js");
    fs.writeFileSync(file, "module.exports = { not: 'a function' };");
    await expect(runFixtureFile(file)).rejects.toThrow("must export an async function");
  });
});

describe("doctor", () => {
  test("flags a dependency older than package.json asks for", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
    fs.mkdirSync(path.join(root, "node_modules", "left-pad"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "node_modules", "left-pad", "package.json"),
      JSON.stringify({ version: "0.300.0" })
    );
    const pkg = { dependencies: { "left-pad": "^0.301.2", missing: "^1.0.0", local: "github:a/b" } };
    const result = checkDependencies(pkg, { root });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("left-pad 0.300.0 does not satisfy ^0.301.2");
    expect(result.detail).toContain("missing is not installed");
    expect(result.detail).not.toContain("local");
    expect(result.fix).toBe("bun install --frozen-lockfile");
  });

  test("passes when installed versions satisfy the ranges", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
    fs.mkdirSync(path.join(root, "node_modules", "left-pad"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "node_modules", "left-pad", "package.json"),
      JSON.stringify({ version: "0.301.3" })
    );
    expect(checkDependencies({ dependencies: { "left-pad": "^0.301.2" } }, { root }).status).toBe("ok");
  });

  test("warns when Bun differs from the pin", () => {
    expect(checkBunVersion({ packageManager: "bun@1.4.4" }, "1.3.14").status).toBe("warn");
    expect(checkBunVersion({ packageManager: "bun@1.4.4" }, "1.4.4").status).toBe("ok");
    expect(checkBunVersion({}, "1.3.14").status).toBe("ok");
  });
});

describe("health", () => {
  const respond = (body) => async () => ({ ok: true, json: async () => body });

  test("reports the deployed sha", async () => {
    const result = await checkHealth({
      origin: "https://example.test/",
      fetchImpl: respond({ status: "ok", sha: "abc1234" }),
    });
    expect(result).toMatchObject({ ok: true, deployed: "abc1234", url: "https://example.test/health" });
  });

  test("matches the expected sha", async () => {
    const result = await checkHealth({
      expected: "abc1234",
      fetchImpl: respond({ status: "ok", sha: "abc1234" }),
    });
    expect(result).toMatchObject({ ok: true, outcome: "match" });
  });

  test("waits when a different sha is deployed and it cannot be shown to contain the expected one", async () => {
    const result = await checkHealth({
      expected: "abc1234",
      fetchImpl: respond({ status: "ok", sha: "unknown" }),
    });
    expect(result).toMatchObject({ ok: false, outcome: "wait" });
  });

  test("is unreachable when the request fails", async () => {
    const result = await checkHealth({
      fetchImpl: async () => {
        throw new Error("down");
      },
    });
    expect(result).toMatchObject({ ok: false, deployed: null, outcome: "unreachable" });
  });

  test("defaults to the production origin", () => {
    expect(healthUrl()).toBe("https://gamebot.willsullivan.dev/health");
  });
});

describe("browser lookup", () => {
  test("prefers CHROME_PATH, then known install paths", () => {
    expect(findChrome({ CHROME_PATH: "/custom/chrome" }, (p) => p === "/custom/chrome")).toBe(
      "/custom/chrome"
    );
    expect(findChrome({}, () => false)).toBeNull();
  });
});

describe("control-gamebot CLI", () => {
  async function run(argv) {
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => logs.push(args.join(" "));
    console.error = (...args) => logs.push(args.join(" "));
    try {
      return { code: await main(argv), output: logs.join("\n") };
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  }

  test("an unknown command is a usage error", async () => {
    const { code, output } = await run(["bogus"]);
    expect(code).toBe(2);
    expect(output).toContain('Unknown command "bogus"');
  });

  test("execute without a fixture is a usage error", async () => {
    expect((await run(["execute"])).code).toBe(2);
  });

  test("execute --contains fails when no reply matches", async () => {
    const { code, output } = await run([
      "execute",
      path.join(FIXTURES, "roll.js"),
      "--contains",
      "definitely not in the reply",
    ]);
    expect(code).toBe(1);
    expect(output).toContain("No reply contained");
  }, SLOW);

  test("--json prints machine-readable output", async () => {
    const { code, output } = await run(["execute", path.join(FIXTURES, "roll.js"), "--json"]);
    expect(code).toBe(0);
    expect(JSON.parse(output)).toMatchObject({ command: "execute", ok: true });
  }, SLOW);

  test("map names a command that does not exist", async () => {
    const { code, output } = await run(["map", "nope"]);
    expect(code).toBe(1);
    expect(output).toContain('No slash command "nope"');
  }, SLOW);
});
