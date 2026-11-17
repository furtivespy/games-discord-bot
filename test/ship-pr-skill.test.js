const { expect, test } = require("bun:test");
const fs = require("node:fs");
const path = require("node:path");

const skill = fs.readFileSync(
  path.join(__dirname, "..", ".agents", "skills", "ship-pr", "SKILL.md"),
  "utf8"
);

test("ship-pr parks when QA Head is stale or For you to test is not none", () => {
  expect(skill).toContain("park for the owner");
  expect(skill).toMatch(
    /If `Head` is stale or `For you to test` is not\s+`none`/
  );
  expect(skill).not.toContain(
    "Otherwise leave `reviews` empty and the loop"
  );
});
