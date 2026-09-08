const { describe, expect, test, afterEach } = require("bun:test");
const GameFormatter = require("../modules/GameFormatter");

const originalFetchCardImageBuffer = GameFormatter.fetchCardImageBuffer;

describe("GameFormatter.oneCardReplyParts", () => {
  afterEach(() => {
    GameFormatter.fetchCardImageBuffer = originalFetchCardImageBuffer;
  });

  test("cards without a url stay embed-only", async () => {
    const { embed, files } = await GameFormatter.oneCardReplyParts({
      id: "no-art",
      name: "Blank",
      type: "Plot",
      description: "No picture",
    });

    expect(files).toEqual([]);
    expect(embed.data.title).toContain("Blank");
    expect(embed.data.image).toBeUndefined();
  });

  test("cards with a url attach original bytes and point the embed at the file", async () => {
    GameFormatter.fetchCardImageBuffer = async (url) => {
      expect(url).toBe("https://cards.example/staged.jpg");
      return Buffer.from("fake-jpg");
    };

    const { embed, files } = await GameFormatter.oneCardReplyParts({
      id: "staged-1",
      name: "Staged Incident",
      type: "Combat",
      description: "Lose three troops",
      url: "https://cards.example/staged.jpg",
    });

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("played-card-staged-1.jpg");
    expect(embed.data.image.url).toBe("attachment://played-card-staged-1.jpg");
  });

  test("keeps the URL embed when downloading the image fails", async () => {
    GameFormatter.fetchCardImageBuffer = async () => {
      throw new Error("404");
    };

    const { embed, files } = await GameFormatter.oneCardReplyParts({
      id: "double",
      name: "Double Cross",
      type: "Plot",
      description: "1 Solari",
      url: "https://cards.example/double.jpg",
    });

    expect(files).toEqual([]);
    expect(embed.data.image.url).toBe("https://cards.example/double.jpg");
  });
});
