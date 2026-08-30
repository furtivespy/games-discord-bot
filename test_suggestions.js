const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SuggestionStore = require("./modules/SuggestionStore");

function testNormalize() {
  console.log("Running test: testNormalize");
  assert.strictEqual(
    SuggestionStore.normalizeSuggestionText("  Add Dice-Rolling!! "),
    "add dice rolling"
  );
  assert.strictEqual(
    SuggestionStore.normalizeSuggestionText("ADD   DICE rolling"),
    "add dice rolling"
  );
  assert.strictEqual(SuggestionStore.normalizeSuggestionText(""), "");
  console.log("testNormalize passed");
}

function testFindMatchingSuggestion() {
  console.log("Running test: testFindMatchingSuggestion");
  const suggestions = [
    { id: "1", suggestion: "Add a timer" },
    { id: "2", suggestion: "Show win-share history" },
  ];
  const match = SuggestionStore.findMatchingSuggestion(suggestions, "add a TIMER!");
  assert.ok(match);
  assert.strictEqual(match.id, "1");
  assert.strictEqual(
    SuggestionStore.findMatchingSuggestion(suggestions, "something else"),
    null
  );
  console.log("testFindMatchingSuggestion passed");
}

function testConsolidateByIdAndText() {
  console.log("Running test: testConsolidateByIdAndText");

  const guildA = [
    {
      id: "shared",
      suggestion: "Add dice rolling",
      status: "SUGGESTED",
      user: "Alice",
      userId: "a",
      votes: { count: 1, voters: ["a"] },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "only-a",
      suggestion: "Unique to A",
      status: "SUGGESTED",
      user: "Alice",
      userId: "a",
      votes: { count: 1, voters: ["a"] },
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  ];

  const guildB = [
    {
      id: "shared",
      suggestion: "Add dice rolling please",
      status: "IN_PROGRESS",
      user: "Bob",
      userId: "b",
      votes: { count: 2, voters: ["b", "c"] },
      createdAt: "2024-02-01T00:00:00.000Z",
      updatedAt: "2024-03-01T00:00:00.000Z",
    },
    {
      id: "dup-text",
      suggestion: "Unique to A",
      status: "SUGGESTED",
      user: "Bob",
      userId: "b",
      votes: { count: 1, voters: ["b"] },
      createdAt: "2024-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    },
  ];

  const merged = SuggestionStore.consolidateSuggestions([guildA, guildB]);
  assert.strictEqual(merged.length, 2, "Expected two unique suggestions after merge");

  const dice = merged.find((s) => SuggestionStore.suggestionKey(s) === "add dice rolling please");
  assert.ok(dice, "Merged dice suggestion should keep the longer text");
  assert.strictEqual(dice.status, "IN_PROGRESS");
  assert.deepStrictEqual(dice.votes.voters.sort(), ["a", "b", "c"]);
  assert.strictEqual(dice.votes.count, 3);

  const unique = merged.find((s) => SuggestionStore.suggestionKey(s) === "unique to a");
  assert.ok(unique);
  assert.deepStrictEqual(unique.votes.voters.sort(), ["a", "b"]);
  assert.strictEqual(unique.votes.count, 2);

  console.log("testConsolidateByIdAndText passed");
}

function testStatusPreference() {
  console.log("Running test: testStatusPreference");
  const merged = SuggestionStore.mergeTwoSuggestions(
    { id: "1", suggestion: "x", status: "REJECTED", votes: { voters: [] } },
    { id: "1", suggestion: "x", status: "COMPLETED", votes: { voters: [] } }
  );
  assert.strictEqual(merged.status, "COMPLETED");
  console.log("testStatusPreference passed");
}

function createMockClient(store) {
  return {
    db: store,
    async getGameDataV2(guildId, collection, channelId) {
      return store.getSpecificGameData(guildId, collection, channelId);
    },
    async setGameDataV2(guildId, collection, channelId, data) {
      store.upsertGameData(guildId, collection, channelId, data);
    },
  };
}

async function testLoadConsolidatesGuildScopedDocs() {
  console.log("Running test: testLoadConsolidatesGuildScopedDocs");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-store-"));
  process.env.GAMEBOT_DATA_DIR = tmp;

  const GameStore = require("./db/gameStore");
  const store = new GameStore();
  const client = createMockClient(store);

  store.upsertGameData("guild-1", "suggest", "x", {
    suggestions: [
      {
        id: "one",
        suggestion: "Global timer",
        status: "SUGGESTED",
        user: "Ada",
        userId: "1",
        votes: { count: 1, voters: ["1"] },
      },
    ],
  });
  store.upsertGameData("guild-2", "suggest", "x", {
    suggestions: [
      {
        id: "two",
        suggestion: "Global timer",
        status: "SUGGESTED",
        user: "Bea",
        userId: "2",
        votes: { count: 1, voters: ["2"] },
      },
      {
        id: "three",
        suggestion: "Card history",
        status: "SUGGESTED",
        user: "Bea",
        userId: "2",
        votes: { count: 1, voters: ["2"] },
      },
    ],
  });

  const loaded = await SuggestionStore.loadGlobalSuggestions(client);
  assert.strictEqual(loaded.suggestions.length, 2);
  const timer = loaded.suggestions.find((s) => SuggestionStore.suggestionKey(s) === "global timer");
  assert.ok(timer);
  assert.deepStrictEqual(timer.votes.voters.sort(), ["1", "2"]);

  const leftover = store.listDocumentsByCollection("suggest");
  assert.strictEqual(leftover.length, 1, "Guild-scoped suggest docs should be removed after consolidate");
  assert.strictEqual(leftover[0].guildId, SuggestionStore.GLOBAL_SUGGEST_SCOPE);

  const secondLoad = await SuggestionStore.loadGlobalSuggestions(client);
  assert.strictEqual(secondLoad.suggestions.length, 2);

  store.db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("testLoadConsolidatesGuildScopedDocs passed");
}

async function main() {
  testNormalize();
  testFindMatchingSuggestion();
  testConsolidateByIdAndText();
  testStatusPreference();
  await testLoadConsolidatesGuildScopedDocs();
  console.log("All suggestion tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
