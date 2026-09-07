const { describe, expect, test, afterEach } = require("bun:test");
const GameFormatter = require("../modules/GameFormatter");

const originalImagefromUrlList = GameFormatter.ImagefromUrlList;

describe("GameFormatter.oneCardReplyParts", () => {
  afterEach(() => {
    GameFormatter.ImagefromUrlList = originalImagefromUrlList;
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

  test("cards with a url attach a file and point the embed at it", async () => {
    GameFormatter.ImagefromUrlList = async (urls) => {
      expect(urls).toEqual(["https://cards.example/staged.jpg"]);
      return Buffer.from("fake-png");
    };

    const { embed, files } = await GameFormatter.oneCardReplyParts({
      id: "staged-1",
      name: "Staged Incident",
      type: "Combat",
      description: "Lose three troops",
      url: "https://cards.example/staged.jpg",
    });

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("played-card-staged-1.png");
    expect(embed.data.image.url).toBe("attachment://played-card-staged-1.png");
  });

  test("keeps the URL embed when rendering the attachment fails", async () => {
    GameFormatter.ImagefromUrlList = async () => {
      throw new Error("canvas down");
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
