const { afterEach, describe, expect, test } = require("bun:test");
const { HarmCategory, HarmBlockThreshold, Modality } = require("@google/genai");
const {
  createGeminiAI,
  extractInlineImage,
  resolveImageModel,
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_RULES_MODEL,
} = require("../modules/GoogleGemini");

const PNG_BYTES = Buffer.from("fake-png-bytes");
const originalFetch = globalThis.fetch;

function fakeClient(config = {}) {
  return {
    config: { geminiKey: "test-key", ...config },
    logger: { warn() {}, error() {} },
  };
}

function captureGeminiFetch(responseJson) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    let body = null;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ href, method: init?.method, body });
    return new Response(JSON.stringify(responseJson), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
  delete process.env.GOOGLE_GENAI_USE_ENTERPRISE;
  delete process.env.GOOGLE_GENAI_API_VERSION;
});

describe("Gemini models and extraction", () => {
  test("defaults off gemini-2.5-flash and gemini-2.5-flash-image", () => {
    expect(DEFAULT_GEMINI_IMAGE_MODEL).toBe("gemini-3.1-flash-lite-image");
    expect(DEFAULT_GEMINI_RULES_MODEL).toBe("gemini-3.8-flash");
    expect(DEFAULT_GEMINI_IMAGE_MODEL).not.toContain("2.5");
    expect(DEFAULT_GEMINI_RULES_MODEL).not.toContain("2.5");
  });

  test("uses the configured image model name instead of a hardcoded one", () => {
    expect(
      resolveImageModel({ config: { geminiImageModel: "my-custom-image-model" } })
    ).toBe("my-custom-image-model");
    expect(resolveImageModel({ config: {} })).toBe(DEFAULT_GEMINI_IMAGE_MODEL);
  });

  test("answerRulesQuestion uses gemini-3.8-flash with googleSearch and urlContext", async () => {
    const gemini = createGeminiAI(fakeClient());
    let captured = null;
    gemini.AI2 = {
      models: {
        generateContent: async (params) => {
          captured = params;
          return {
            candidates: [
              {
                content: { parts: [{ text: "You draw two cards." }] },
                groundingMetadata: {
                  groundingChunks: [
                    {
                      web: {
                        title: "BGG",
                        uri: "https://boardgamegeek.com/thread/1",
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      },
    };

    const chunks = await gemini.answerRulesQuestion("How many cards?");

    expect(captured.model).toBe(DEFAULT_GEMINI_RULES_MODEL);
    expect(captured.config.tools).toEqual([
      { urlContext: {} },
      { googleSearch: {} },
    ]);
    expect(chunks.join("\n")).toContain("You draw two cards.");
    expect(chunks.join("\n")).toContain("BGG");
  });

  test("generateImage sends avatars as inline data and requests TEXT+IMAGE", async () => {
    const gemini = createGeminiAI(
      fakeClient({ geminiImageModel: "configured-image-model" })
    );
    let captured = null;
    gemini.AI2 = {
      models: {
        generateContent: async (params) => {
          captured = params;
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: PNG_BYTES.toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      },
    };

    const result = await gemini.generateImage({
      prompt: "royalty",
      images: [{ mimeType: "image/png", data: "avatar-base64" }],
    });

    expect(captured.model).toBe("configured-image-model");
    expect(captured.contents[0].text).toBe("royalty");
    expect(captured.contents[1].inlineData).toEqual({
      mimeType: "image/png",
      data: "avatar-base64",
    });
    expect(captured.config.responseModalities).toEqual([
      Modality.TEXT,
      Modality.IMAGE,
    ]);
    expect(result.buffer.equals(PNG_BYTES)).toBe(true);
  });

  test("safety blocks and missing images return null instead of throwing", () => {
    expect(
      extractInlineImage({
        promptFeedback: { blockReason: "SAFETY" },
      })
    ).toBeNull();
    expect(
      extractInlineImage({
        candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }],
      })
    ).toBeNull();
    expect(extractInlineImage({ candidates: [] })).toBeNull();
  });

  test("processResponse returns the extract-error string for a missing or empty candidate and does not throw", async () => {
    const gemini = createGeminiAI(fakeClient());
    const missing = await gemini.processResponse({});
    expect(missing).toEqual(["Error: Could not extract AI response text."]);

    const emptyCandidates = await gemini.processResponse({ candidates: [] });
    expect(emptyCandidates).toEqual([
      "Error: Could not extract AI response text.",
    ]);

    const emptyParts = await gemini.processResponse({
      candidates: [{ content: { parts: [] } }],
    });
    expect(emptyParts).toEqual(["Error: Could not extract AI response text."]);

    const noTextParts = await gemini.processResponse({
      response: { candidates: [{ content: { parts: [{ inlineData: {} }] } }] },
    });
    expect(noTextParts).toEqual(["Error: Could not extract AI response text."]);
  });

  test("processResponse still extracts /rules text from a valid candidate", async () => {
    const gemini = createGeminiAI(fakeClient());
    const chunks = await gemini.processResponse({
      candidates: [
        {
          content: {
            parts: [{ text: "Draw two cards. " }, { text: "Then discard one." }],
          },
        },
      ],
    });
    expect(chunks).toEqual(["Draw two cards. Then discard one."]);
  });

  test("processResponse skips grounding chunks that have no web payload", async () => {
    const gemini = createGeminiAI(fakeClient());
    const chunks = await gemini.processResponse({
      candidates: [
        {
          content: { parts: [{ text: "Draw two cards." }] },
          groundingMetadata: {
            groundingChunks: [
              { retrievedContext: { title: "forum", uri: "https://example/x" } },
              { web: { title: "BGG", uri: "https://boardgamegeek.com/thread/1" } },
              {},
            ],
          },
        },
      ],
    });
    const text = chunks.join("\n");
    expect(text).toContain("Draw two cards.");
    expect(text).toContain("[BGG](<https://boardgamegeek.com/thread/1>)");
    expect(text).not.toContain("forum");
    expect(text).not.toContain("undefined");
  });
});

describe("@google/genai serialized generateContent", () => {
  test("answerRulesQuestion POSTs v1beta with systemInstruction, tools, and safetySettings", async () => {
    const calls = captureGeminiFetch({
      candidates: [
        {
          content: { parts: [{ text: "You draw two cards." }] },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  title: "BGG",
                  uri: "https://boardgamegeek.com/thread/1",
                },
              },
            ],
          },
        },
      ],
    });

    const gemini = createGeminiAI(fakeClient());
    const chunks = await gemini.answerRulesQuestion("How many cards?");

    expect(calls).toHaveLength(1);
    const { href, method, body } = calls[0];
    const url = new URL(href);
    expect(method).toBe("POST");
    expect(url.pathname).toContain("/v1beta/");
    expect(url.pathname).not.toContain("/v1/");
    expect(url.pathname).toContain(`models/${DEFAULT_GEMINI_RULES_MODEL}:generateContent`);

    const instructionText = JSON.stringify(body.systemInstruction);
    expect(instructionText).toContain("Games Bot");
    expect(instructionText).toContain("Always look up the rules");

    expect(body.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ urlContext: {} }),
        expect.objectContaining({ googleSearch: {} }),
      ])
    );
    expect(body.safetySettings).toEqual(
      expect.arrayContaining([
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ])
    );
    expect(chunks.join("\n")).toContain("You draw two cards.");
    expect(chunks.join("\n")).toContain("BGG");
  });

  test("generateImage POSTs v1beta with responseModalities TEXT+IMAGE", async () => {
    const calls = captureGeminiFetch({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: PNG_BYTES.toString("base64"),
                },
              },
            ],
          },
        },
      ],
    });

    const gemini = createGeminiAI(fakeClient());
    const result = await gemini.generateImage({
      prompt: "royalty portrait",
      images: [{ mimeType: "image/png", data: "avatar-base64" }],
    });

    expect(calls).toHaveLength(1);
    const { href, method, body } = calls[0];
    const url = new URL(href);
    expect(method).toBe("POST");
    expect(url.pathname).toContain("/v1beta/");
    expect(url.pathname).not.toContain("/v1/");
    expect(url.pathname).toContain(
      `models/${DEFAULT_GEMINI_IMAGE_MODEL}:generateContent`
    );
    expect(body.generationConfig.responseModalities).toEqual([
      Modality.TEXT,
      Modality.IMAGE,
    ]);
    expect(JSON.stringify(body.contents)).toContain("royalty portrait");
    expect(JSON.stringify(body.contents)).toContain("avatar-base64");
    expect(result.buffer.equals(PNG_BYTES)).toBe(true);
  });
});
