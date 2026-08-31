const { describe, expect, test } = require("bun:test");
const {
  consolidateGlobalSuggestions,
  restoreSuggestionDocuments,
} = require("../db/migrateGameDocuments.js");

describe("consolidateGlobalSuggestions", () => {
  test("merges server lists into global storage without deleting backups", () => {
    const documents = [
      {
        guildId: "global",
        channelId: "x",
        data: { suggestions: [{ id: "global-id", suggestion: "Global" }] },
      },
      {
        guildId: "guild-a",
        channelId: "x",
        data: {
          suggestions: [
            { id: "global-id", suggestion: "Stale copy" },
            { id: "guild-a-id", suggestion: "Guild A" },
          ],
        },
      },
      {
        guildId: "guild-b",
        channelId: "x",
        data: { suggestions: [{ id: "guild-b-id", suggestion: "Guild B" }] },
      },
    ];
    const writes = [];
    const store = {
      getDocumentsByCollection: (collection) => {
        expect(collection).toBe("suggest");
        return documents;
      },
      upsertGameData: (...args) => writes.push(args),
    };

    const result = consolidateGlobalSuggestions(store);

    expect(result).toEqual({
      sourceDocumentCount: 2,
      globalDocumentFound: true,
      suggestionsKept: 3,
      duplicateCount: 1,
    });
    expect(writes).toEqual([
      [
        "global",
        "suggest",
        "x",
        {
          suggestions: [
            { id: "global-id", suggestion: "Global" },
            { id: "guild-a-id", suggestion: "Guild A" },
            { id: "guild-b-id", suggestion: "Guild B" },
          ],
        },
      ],
    ]);
    expect(documents).toHaveLength(3);
  });

  test("keeps legacy suggestions without ids", () => {
    const writes = [];
    const store = {
      getDocumentsByCollection: () => [
        {
          guildId: "guild-a",
          channelId: "x",
          data: { suggestions: [{ suggestion: "Legacy" }] },
        },
      ],
      upsertGameData: (...args) => writes.push(args),
    };

    const result = consolidateGlobalSuggestions(store);

    expect(result.suggestionsKept).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(writes[0][3]).toEqual({
      suggestions: [{ suggestion: "Legacy" }],
    });
  });
});

test("restoreSuggestionDocuments preserves server-scoped backups", () => {
  const writes = [];

  restoreSuggestionDocuments(
    {
      upsertGameData: (...args) => writes.push(args),
    },
    [
      {
        guildId: "guild-a",
        channelId: "x",
        data: { suggestions: [{ id: "guild-a-id" }] },
      },
    ]
  );

  expect(writes).toEqual([
    [
      "guild-a",
      "suggest",
      "x",
      { suggestions: [{ id: "guild-a-id" }] },
    ],
  ]);
});
