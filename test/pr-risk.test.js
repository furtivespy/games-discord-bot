const { describe, expect, test } = require("bun:test");
const fs = require("node:fs");
const path = require("node:path");
const { HIGH_RISK_PATHS, assess, main } = require("../scripts/pr-risk");

describe("pr-risk", () => {
  test("ordinary code, tests and docs have no path-based high risk", () => {
    const result = assess([
      "src/example.js",
      "test/roll.test.js",
      "docs/primitives.md",
      "docs/feature-map/notes.md",
      "README.md",
    ]);
    expect(result).toEqual({ tier: null, files: [] });
  });

  test.each([
    ["db/gameStore.js", "database code"],
    ["scripts/migrate-to-game-documents.js", "data migration script"],
    ["Dockerfile", "image build"],
    [".github/workflows/release.yml", "CI and release workflows"],
    [".github/ship-pr.json", "merge gate config"],
    [".agents/skills/ship-pr/SKILL.md", "ship loop"],
    ["scripts/pr-risk.js", "risk tier check"],
    ["docs/merge-policy.md", "merge policy"],
    ["docs/adr/0003-agent-defaults-to-no.md", "architecture decision records"],
  ])("%s is high risk", (file, why) => {
    expect(assess([file])).toEqual({ tier: "high", files: [{ file, why }] });
  });

  test("a mixed PR is high and names only the protected files", () => {
    const result = assess(["src/example.js", ".github/ship-pr.json"]);
    expect(result.tier).toBe("high");
    expect(result.files.map((f) => f.file)).toEqual([".github/ship-pr.json"]);
  });

  test("handles Windows separators, a leading ./ and blank lines", () => {
    const result = assess([".\\db\\anygame.js", "./Dockerfile", "", "  "]);
    expect(result.files.map((f) => f.file)).toEqual(["db/anygame.js", "Dockerfile"]);
  });

  test("similar names outside the protected paths are not matched", () => {
    expect(assess(["docs/adr-notes.md", "scripts/pr-risk.test.js", "dbx/file.js"]).tier).toBe(null);
  });

  test("every protected path is named in docs/merge-policy.md", () => {
    const policy = fs.readFileSync(path.join(__dirname, "..", "docs", "merge-policy.md"), "utf8");
    const missing = HIGH_RISK_PATHS.map((r) => r.prefix).filter(
      (prefix) => !policy.includes(prefix.replace(/\/$/, ""))
    );
    expect(missing).toEqual([]);
  });

  test("reads file names from stdin and prints the tier", async () => {
    const logs = [];
    const original = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    try {
      expect(await main(["--json"], async () => "db/db.js\nREADME.md\n")).toBe(0);
    } finally {
      console.log = original;
    }
    expect(JSON.parse(logs.join("\n"))).toEqual({
      tier: "high",
      files: [{ file: "db/db.js", why: "database code" }],
    });
  });
});
