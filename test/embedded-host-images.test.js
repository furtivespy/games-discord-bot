const { describe, expect, test } = require("bun:test");
const GameDB = require("../db/anygame");
const {
  HOST_IMAGE_MESSAGE_LIMIT,
  MAX_HOST_BOARD_IMAGES,
  gameBoardHasCards,
  gameHostUserId,
  hostBoardImagesFromMessages,
  hostImageMessagesPath,
  isImageAttachment,
  loadHostBoardImages,
  shouldUseHostBoardImages,
} = require("../modules/embeddedHostImages");

function createEntry({
  category = GameDB.ACTION_CATEGORIES.GAME,
  type = GameDB.ACTION_TYPES.CREATE,
  userId = "host-1",
  timestamp = "2026-11-17T12:00:00.000Z",
} = {}) {
  return {
    timestamp,
    actor: { userId },
    action: { category, type },
  };
}

function attachment(id, extras = {}) {
  return {
    id,
    filename: extras.filename ?? `${id}.png`,
    content_type: extras.content_type ?? "image/png",
    url: extras.url ?? `https://cdn.discordapp.com/attachments/1/2/${id}.png`,
    ...extras,
  };
}

function message({ id, authorId, attachments = [], timestamp } = {}) {
  return {
    id,
    timestamp,
    author: { id: authorId },
    attachments,
  };
}

describe("game host", () => {
  test("is the earliest GAME CREATE actor, not first player or later activity", () => {
    expect(
      gameHostUserId({
        players: [{ userId: "first-player", order: 0 }],
        history: [
          createEntry({
            userId: "later-host",
            timestamp: "2026-11-17T14:00:00.000Z",
          }),
          createEntry({
            userId: "real-host",
            timestamp: "2026-11-17T12:00:00.000Z",
          }),
          {
            timestamp: "2026-11-17T13:00:00.000Z",
            actor: { userId: "card-player" },
            action: {
              category: GameDB.ACTION_CATEGORIES.CARD,
              type: GameDB.ACTION_TYPES.PLAY,
            },
          },
        ],
      })
    ).toBe("real-host");
  });

  test("returns null without a CREATE actor", () => {
    expect(gameHostUserId({})).toBeNull();
    expect(
      gameHostUserId({
        history: [
          createEntry({
            type: GameDB.ACTION_TYPES.DELETE,
            userId: "host-1",
          }),
          {
            timestamp: "2026-11-17T12:00:00.000Z",
            action: {
              category: GameDB.ACTION_CATEGORIES.GAME,
              type: GameDB.ACTION_TYPES.CREATE,
            },
          },
        ],
      })
    ).toBeNull();
  });
});

describe("empty game board", () => {
  test("treats missing, empty, and null-only boards as unused", () => {
    expect(gameBoardHasCards({})).toBe(false);
    expect(gameBoardHasCards({ gameBoard: [] })).toBe(false);
    expect(gameBoardHasCards({ gameBoard: [null, "x"] })).toBe(false);
    expect(shouldUseHostBoardImages({ gameBoard: [] })).toBe(true);
    expect(gameBoardHasCards({ gameBoard: [{ id: "b1" }] })).toBe(true);
    expect(shouldUseHostBoardImages({ gameBoard: [{ id: "b1" }] })).toBe(false);
  });
});

describe("host board images from messages", () => {
  test("Discord's per-message attachment cap is 10", () => {
    expect(MAX_HOST_BOARD_IMAGES).toBe(10);
    expect(HOST_IMAGE_MESSAGE_LIMIT).toBe(50);
    expect(hostImageMessagesPath("thread-1")).toBe(
      "/channels/thread-1/messages?limit=50"
    );
  });

  test("uses every image on the host's latest image post, newest message first", () => {
    const cards = hostBoardImagesFromMessages(
      [
        message({
          id: "m-new-other",
          authorId: "other",
          attachments: [attachment("other-photo")],
        }),
        message({
          id: "m-new-host-text",
          authorId: "host-1",
          attachments: [
            attachment("notes", {
              filename: "notes.txt",
              content_type: "text/plain",
              url: "https://cdn.discordapp.com/attachments/1/2/notes.txt",
              width: undefined,
              height: undefined,
            }),
          ],
        }),
        message({
          id: "m-host-photos",
          authorId: "host-1",
          attachments: [
            attachment("map", { filename: "map.png" }),
            attachment("ref", {
              filename: "ref.jpg",
              content_type: "image/jpeg",
              url: "https://cdn.discordapp.com/attachments/1/2/ref.jpg",
            }),
            attachment("rules", {
              filename: "rules.pdf",
              content_type: "application/pdf",
              url: "https://cdn.discordapp.com/attachments/1/2/rules.pdf",
            }),
          ],
        }),
        message({
          id: "m-old-host",
          authorId: "host-1",
          attachments: [attachment("stale")],
        }),
      ],
      "host-1"
    );
    expect(cards.map((card) => card.id)).toEqual([
      "host-image:m-host-photos:map",
      "host-image:m-host-photos:ref",
    ]);
    expect(cards.map((card) => card.name)).toEqual(["map", "ref"]);
    expect(cards[0].url).toBe("https://cdn.discordapp.com/attachments/1/2/map.png");
  });

  test("caps a single host post at Discord's 10-attachment limit", () => {
    const attachments = Array.from({ length: 12 }, (_, i) =>
      attachment(`img-${i + 1}`)
    );
    const cards = hostBoardImagesFromMessages(
      [message({ id: "m1", authorId: "host-1", attachments })],
      "host-1"
    );
    expect(cards).toHaveLength(10);
    expect(cards[0].id).toBe("host-image:m1:img-1");
    expect(cards[9].id).toBe("host-image:m1:img-10");
  });

  test("treats discord.js collections and proxyURL as images", () => {
    const attachments = {
      values() {
        return [
          {
            id: "a1",
            name: "photo.webp",
            contentType: "image/webp",
            proxyURL: "https://media.discordapp.net/attachments/1/2/photo.webp",
          },
        ][Symbol.iterator]();
      },
    };
    const messages = {
      values() {
        return [
          {
            id: "200000000000000000",
            author: { id: "host-1" },
            attachments,
          },
        ][Symbol.iterator]();
      },
    };
    expect(
      hostBoardImagesFromMessages(messages, "host-1")
    ).toEqual([
      {
        id: "host-image:200000000000000000:a1",
        name: "photo",
        url: "https://media.discordapp.net/attachments/1/2/photo.webp",
      },
    ]);
  });

  test("filename and pixel size still count when content type is missing", () => {
    expect(
      isImageAttachment({ filename: "board.PNG", url: "https://cdn.example/a.PNG" })
    ).toBe(true);
    expect(
      isImageAttachment({
        filename: "blob",
        url: "https://cdn.example/blob",
        width: 800,
        height: 600,
      })
    ).toBe(true);
    expect(
      isImageAttachment({
        filename: "notes.txt",
        content_type: "text/plain",
        url: "https://cdn.example/notes.txt",
      })
    ).toBe(false);
  });

  test("returns nothing without a host or without host images", () => {
    expect(
      hostBoardImagesFromMessages(
        [message({ id: "m1", authorId: "other", attachments: [attachment("x")] })],
        "host-1"
      )
    ).toEqual([]);
    expect(
      hostBoardImagesFromMessages(
        [message({ id: "m1", authorId: "host-1", attachments: [] })],
        "host-1"
      )
    ).toEqual([]);
    expect(hostBoardImagesFromMessages([], "")).toEqual([]);
  });
});

describe("loadHostBoardImages", () => {
  const emptyBoardGame = {
    gameBoard: [],
    history: [createEntry({ userId: "host-1" })],
  };

  test("does not list messages when the card board is in use", async () => {
    let listed = false;
    const cards = await loadHostBoardImages({
      data: { gameBoard: [{ id: "b1" }], history: [createEntry()] },
      listMessages: async () => {
        listed = true;
        return [message({ id: "m1", authorId: "host-1", attachments: [attachment("x")] })];
      },
    });
    expect(cards).toEqual([]);
    expect(listed).toBe(false);
  });

  test("returns host images from listed messages when the board is empty", async () => {
    const cards = await loadHostBoardImages({
      data: emptyBoardGame,
      listMessages: async () => [
        message({
          id: "m1",
          authorId: "host-1",
          attachments: [attachment("setup", { filename: "setup.png" })],
        }),
      ],
    });
    expect(cards).toEqual([
      {
        id: "host-image:m1:setup",
        name: "setup",
        url: "https://cdn.discordapp.com/attachments/1/2/setup.png",
      },
    ]);
  });

  test("fails closed when listing throws or the host is unknown", async () => {
    expect(
      await loadHostBoardImages({
        data: emptyBoardGame,
        listMessages: async () => {
          throw new Error("discord down");
        },
      })
    ).toEqual([]);
    expect(
      await loadHostBoardImages({
        data: { gameBoard: [], history: [] },
        listMessages: async () => {
          throw new Error("should not run");
        },
      })
    ).toEqual([]);
  });
});
