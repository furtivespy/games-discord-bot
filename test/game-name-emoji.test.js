const { afterEach, describe, expect, test, jest } = require("bun:test");
const GoogleGemini = require("../modules/GoogleGemini");
const GameNameEmoji = require("../modules/GameNameEmoji");
// slashcommands/info/lfg.js — Start game prefixes the play thread via GameNameEmoji.

const originalCreateGeminiAI = GoogleGemini.createGeminiAI;

afterEach(() => {
  GoogleGemini.createGeminiAI = originalCreateGeminiAI;
  jest.useRealTimers();
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

function stubGeminiGenerateContent(impl) {
  GoogleGemini.createGeminiAI = (client) => {
    const gemini = originalCreateGeminiAI(client);
    gemini.AI2 = {
      models: {
        generateContent: impl,
      },
    };
    return gemini;
  };
}

describe("GameNameEmoji extraction", () => {
  test("accepts a single standard unicode emoji", () => {
    expect(GameNameEmoji.extractUnicodeEmoji("🚂")).toBe("🚂");
    expect(GameNameEmoji.extractUnicodeEmoji(" 🐦\n")).toBe("🐦");
    expect(GameNameEmoji.extractUnicodeEmoji("❤️")).toBe("❤️");
    expect(GameNameEmoji.extractUnicodeEmoji("🇺🇸")).toBe("🇺🇸");
    expect(GameNameEmoji.extractUnicodeEmoji("👍🏽")).toBe("👍🏽");
    expect(GameNameEmoji.extractUnicodeEmoji("1️⃣")).toBe("1️⃣");
    expect(GameNameEmoji.extractUnicodeEmoji("👨‍👩‍👧‍👦")).toBe("👨‍👩‍👧‍👦");
  });

  test("allows a single emoji wrapped in whitespace, quotes, or markdown", () => {
    expect(GameNameEmoji.extractUnicodeEmoji('"🐦"')).toBe("🐦");
    expect(GameNameEmoji.extractUnicodeEmoji("`🚂`")).toBe("🚂");
    expect(GameNameEmoji.extractUnicodeEmoji("**🎲**")).toBe("🎲");
  });

  test("rejects extra words, several emoji, shortcodes, and Discord custom emojis", () => {
    expect(GameNameEmoji.extractUnicodeEmoji("")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("train")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("🚂 Brass")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("Use 🎲 for this game.")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("🚂🐦")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji(":train:")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji(":+1:")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("🚂 :train:")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji(":smile: 🚂")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("<:brass:123456789012345678>")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("<a:spin:123456789012345678>")).toBeNull();
    expect(GameNameEmoji.extractUnicodeEmoji("🚂 <:brass:123456789012345678>")).toBeNull();
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
    expect(GameNameEmoji.formatChannelName("Brass", "🚂🐦")).toBe("Brass");
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

  test("truncates on grapheme boundaries so surrogate pairs stay well-formed", () => {
    const prefix = "🚂 ";
    const remaining = GameNameEmoji.DISCORD_CHANNEL_NAME_MAX - prefix.length;
    const atCut = `${"A".repeat(remaining - 1)}😀`;
    const result = GameNameEmoji.formatChannelName(atCut, "🚂");

    expect(result.isWellFormed()).toBe(true);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.startsWith(prefix)).toBe(true);
    expect(result).toBe(`${prefix}${"A".repeat(remaining - 1)}`);
    expect(result).not.toContain("😀");
    expect(result.charCodeAt(result.length - 1)).toBe("A".charCodeAt(0));
  });

  test("does not split a ZWJ emoji grapheme at the 100-unit cut", () => {
    const family = "👨‍👩‍👧‍👦";
    const prefix = "🚂 ";
    const remaining = GameNameEmoji.DISCORD_CHANNEL_NAME_MAX - prefix.length;
    const name = `${"A".repeat(remaining - family.length + 1)}${family}`;
    const result = GameNameEmoji.formatChannelName(name, "🚂");

    expect(result.isWellFormed()).toBe(true);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.startsWith(prefix)).toBe(true);
    expect(result.endsWith("\u200D")).toBe(false);
    expect(result.endsWith(family)).toBe(false);
    expect(result).toBe(`${prefix}${"A".repeat(remaining - family.length + 1)}`);
  });

  test("keeps an astral emoji that fits entirely in the remaining units", () => {
    const kept = GameNameEmoji.formatChannelName(`${"A".repeat(95)}😀`, "🚂");
    expect(kept.isWellFormed()).toBe(true);
    expect(kept.length).toBe(100);
    expect(kept.endsWith("😀")).toBe(true);
  });

  test("unprefixed truncation drops a surrogate pair that would exceed 100 units", () => {
    const result = GameNameEmoji.formatChannelName(`${"A".repeat(99)}😀`, null);
    expect(result.isWellFormed()).toBe(true);
    expect(result.length).toBe(99);
    expect(result).toBe("A".repeat(99));
  });

  test("drops an unpaired surrogate even when the string is already 100 units", () => {
    const ill = `${"A".repeat(99)}\uD83D`;
    expect(ill.length).toBe(100);
    expect(ill.isWellFormed()).toBe(false);
    const result = GameNameEmoji.formatChannelName(ill, null);
    expect(result.isWellFormed()).toBe(true);
    expect(result).toBe("A".repeat(99));
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

  test("skips Gemini when the game name already starts with a unicode emoji", async () => {
    let called = false;
    GoogleGemini.createGeminiAI = () => {
      called = true;
      throw new Error("should not construct Gemini");
    };
    expect(
      await GameNameEmoji.chooseForGame(fakeClient(), "🚂 Express Test")
    ).toBeNull();
    expect(called).toBe(false);
  });

  test("returns a validated emoji from the model", async () => {
    stubGeminiGenerateContent(async () => ({
      candidates: [{ content: { parts: [{ text: "🚂\n" }] } }],
    }));
    expect(await GameNameEmoji.chooseForGame(fakeClient(), "Brass")).toBe("🚂");
  });

  test("falls back when the model returns extra words or several emoji", async () => {
    const client = fakeClient();
    stubGeminiGenerateContent(async () => ({
      candidates: [{ content: { parts: [{ text: "A train: 🚂" }] } }],
    }));
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toBe("Game name emoji skipped: invalid model output");
  });

  test("falls back when the model returns text or a custom emoji", async () => {
    const client = fakeClient();
    stubGeminiGenerateContent(async () => ({
      candidates: [{ content: { parts: [{ text: ":train:" }] } }],
    }));
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toBe("Game name emoji skipped: invalid model output");
  });

  test("falls back when Gemini returns MAX_TOKENS with no emoji text", async () => {
    const client = fakeClient();
    stubGeminiGenerateContent(async () => ({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [{ thought: true }] },
        },
      ],
    }));
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toContain("truncated (MAX_TOKENS)");
  });

  test("does not log Google error JSON for an invalid API key", async () => {
    const client = fakeClient();
    stubGeminiGenerateContent(async () => {
      throw new Error(
        '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}'
      );
    });
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toBe(
      "Game name emoji skipped: Gemini request failed (INVALID_ARGUMENT 400)"
    );
    expect(client.warnings.join("\n")).not.toContain("API key not valid");
    expect(client.warnings.join("\n")).not.toContain('"error"');
  });

  test("falls back on a blocked SAFETY response without logging raw output", async () => {
    const client = fakeClient();
    stubGeminiGenerateContent(async () => ({
      promptFeedback: { blockReason: "SAFETY" },
      candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "🚂" }] } }],
    }));
    expect(await GameNameEmoji.chooseForGame(client, "Brass")).toBeNull();
    expect(client.warnings[0]).toContain("blocked (SAFETY)");
    expect(client.warnings.join("\n")).not.toContain("🚂");
  });

  test("falls back when Gemini times out through withTimeout", async () => {
    jest.useFakeTimers();
    const client = fakeClient({ geminiEmojiTimeoutMs: 8000 });
    let capturedSignal = null;
    stubGeminiGenerateContent(({ config }) => {
      capturedSignal = config.abortSignal;
      return new Promise(() => {});
    });

    const pending = GameNameEmoji.chooseForGame(client, "Brass");
    jest.advanceTimersByTime(8000);
    expect(await pending).toBeNull();
    expect(capturedSignal?.aborted).toBe(true);
    expect(client.warnings[0]).toContain("Gemini emoji selection timed out");
  });
});
