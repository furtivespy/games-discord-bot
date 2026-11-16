const { afterEach, describe, expect, test } = require("bun:test");
const GoogleGemini = require("../modules/GoogleGemini");
const GameNameEmoji = require("../modules/GameNameEmoji");
// slashcommands/info/lfg.js — Start game prefixes the play thread via GameNameEmoji.

const originalCreateGeminiAI = GoogleGemini.createGeminiAI;

afterEach(() => {
  GoogleGemini.createGeminiAI = originalCreateGeminiAI;
});

function fakeClient({ geminiKey = "test-key", ...config } = {}) {
  const warnings = [];
  return {
    warnings,
    config: { geminiKey, ...config },
    logger: {
      warn(message) {
        warnings.push(message);
      },
    },
  };
}

describe("GameNameEmoji extraction", () => {
  test("accepts a single standard unicode emoji", () => {
    expect(GameNameEmoji.extractUnicodeEmoji("🚂")).toBe("🚂");
    expect(GameNameEmoji.extractUnicodeEmoji(" 🐦\n")).toBe("🐦");
    expect(GameNameEmoji.extractUnicodeEmoji("❤️")).toBe("❤️");
    expect(GameNameEmoji.extractUnicodeEmoji("🇺🇸")).toBe("🇺🇸");
  });

  test("strips surrounding text and extracts the first emoji", () => {
    expect(GameNameEmoji.extractUnicodeEmoji("🚂 Brass")).toBe("🚂");
    expect(GameNameEmoji.extractUnicodeEmoji('"🐦"')).toBe("🐦");
    expect(GameNameEmoji.extractUnicodeEmoji("Use 🎲 for this game.")).toBe("🎲");
  });

  test("rejects text, shortcodes, and Discord custom emojis", () => {
    expect(GameNameEmoji.extractUnicodeEmoji("")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("train")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji(":train:")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji(":+1:")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("<:brass:123456789012345678>")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("<a:spin:123456789012345678>")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("use :train: please")).toBeNull();
  });

  test("detects a name that already starts with an emoji", () => {
    expect(GameNameEmoji.startsWithUnicodeEmoji("🚂 Brass")).toBe(true);
    expect(GameNameEmoji.startsWithUnicodeEmoji("Brass")).toBe(false);
    expect(GameNameEmoji.startsWithUnicodeEmoji(":train: Brass")).toBe(false);
  });
});

describe("GameNameEmoji.formatChannelName", () => {
  test("prefixes with the emoji and a space", () => {
    expect(GameNameEmoji.formatChannelName("Brass", "🚂")).toBe("🚂 Brass");
  });

  test("does not double-prefix when the name already starts with an emoji", () => {
    expect(GameNameEmoji.formatChannelName("🚂 Brass", "🐦")).toBe("🚂 Brass");
  });

  test("omits a missing or invalid emoji", () => {
    expect(GameNameEmoji.formatChannelName("Brass", null)).toBe("Brass");
    expect(GameNameEmoji.formatChannelName("Brass", ":train:")).toBe("Brass");
    expect(GameNameEmoji.formatChannelName("Brass", "not-an-emoji")).toBe("Brass");
  });

  test("stays within Discord's 100-character channel name limit", () => {
    const longName = "A".repeat(120);
    const without = GameNameEmoji.formatChannelName(`${longName}\nB`, null);
    expect(without.length).toBe(100);
    expect(without).not.toContain("\n");

    const withEmoji = GameNameEmoji.formatChannelName("A".repeat(100), "🚂");
    expect(withEmoji.length).toBe(100);
    expect(withEmoji.startsWith("🚂 ")).toBe(true);
  });
});

describe("GameNameEmoji.chooseForGame", () => {
  test("skips Gemini when the API key is missing", async () => {
    let called = false;
    GoogleGemini.createGeminiAI = () => {
      called = true;
      throw new Error("should not construct Gemini");
    };
    expect(await GameNameEmoji.chooseForGame(fakeClient({ geminiKey: "" }), "Brass")).toBeNull();
    expect(await GameNameEmoji.chooseForGame(fakeClient({ geminiKey: "   " }), "Brass")).toBeNull();
    expect(await GameNameEmoji.chooseForGame({ config: {} }, "Brass")).toBeNull();
    expect(called).toBe(false);
  });

  test("returns a validated emoji from the model", async () => {
    GoogleGemini.createGeminiAI = () => ({
      suggestGameEmoji: async (gameName) => {
        expect(gameName).toBe("Brass");
        return "🚂\n";
      },
    });
    expect(await GameNameEmoji.chooseForGame(fakeClient(), "Brass")).toBe("🚂");
  });

  test("extracts an emoji from a chatty model reply", async () => {
    GoogleGemini.createGeminiAI = () => ({
      suggestGameEmoji: async () => "A train: 🚂",
    });
    expect(await GameNameEmoji.chooseForGame(fakeClient(), "Brass")).toBe("🚂");
  });

  test("falls back when the model returns text or a custom emoji", async () => {
    const client = fakeClient();
    GoogleGemini.createGeminiAI = () => ({
      suggestGameEmoji: async () => ":train:",
    });
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toContain("invalid model output");
  });

  test("falls back when Gemini throws or times out", async () => {
    const client = fakeClient();
    GoogleGemini.createGeminiAI = () => ({
      suggestGameEmoji: async () => {
        throw new Error("Gemini emoji selection timed out");
      },
    });
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toContain("Gemini emoji selection timed out");
  });
});
