const { afterEach, describe, expect, test } = require("bun:test");
const Rules = require("../slashcommands/info/rules");
const GoogleGemini = require("../modules/GoogleGemini");
const { collectedReplyText, withHarness } = require("./helpers/harness");

const originalCreateGeminiAI = GoogleGemini.createGeminiAI;
const ERROR_MESSAGE =
  "I encountered an error while processing your question. Please try again later.";

afterEach(() => {
  GoogleGemini.createGeminiAI = originalCreateGeminiAI;
});

function vertexGroundingUri(index) {
  const prefix = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";
  return `${prefix}${"A".repeat(237 - prefix.length)}${index}`;
}

function stubGroundedRules(answer, groundingChunks) {
  GoogleGemini.createGeminiAI = (client) => {
    const gemini = originalCreateGeminiAI({
      ...client,
      config: { ...client.config, geminiKey: "test-key" },
      logger: client.logger || { warn() {}, error() {} },
    });
    gemini.AI2 = {
      models: {
        generateContent: async () => ({
          candidates: [
            {
              content: { parts: [{ text: answer }] },
              groundingMetadata: { groundingChunks },
            },
          ],
        }),
      },
    };
    return gemini;
  };
}

function stubRulesChunks(chunks) {
  GoogleGemini.createGeminiAI = () => ({
    answerRulesQuestion: async () => chunks,
  });
}

async function runRules(harness) {
  await new Rules(harness.client).execute(harness.interaction);
}

describe("/rules", () => {
  test("sends a heavily grounded Sources list as follow-ups within Discord's 2000-char limit", async () => {
    await withHarness(
      { options: { strings: { question: "Catan robber distance?" } } },
      async (harness) => {
        const groundingChunks = Array.from({ length: 8 }, (_, i) => ({
          web: {
            title: `Catan Distance Rule ${i + 1}`,
            uri: vertexGroundingUri(i),
          },
        }));
        stubGroundedRules(
          "The robber must be at least two roads away.",
          groundingChunks
        );

        await runRules(harness);

        const payloads = [
          ...harness.calls.editReply,
          ...harness.calls.followUp,
        ];
        expect(payloads.length).toBeGreaterThan(1);
        for (const payload of payloads) {
          expect(String(payload.content).length).toBeLessThanOrEqual(
            GoogleGemini.DISCORD_CONTENT_MAX
          );
        }
        expect(harness.calls.editReply[0].content).toContain(
          "The robber must be at least two roads away."
        );
        expect(collectedReplyText(harness)).not.toContain(ERROR_MESSAGE);
        const allText = collectedReplyText(harness);
        expect(allText).toContain("Sources:");
        for (let i = 0; i < 8; i++) {
          expect(allText).toContain(
            `[Catan Distance Rule ${i + 1}](<${vertexGroundingUri(i)}>)`
          );
        }
      }
    );
  });

  test("follow-up failure does not replace the posted answer with an error", async () => {
    await withHarness(
      { options: { strings: { question: "Catan robber distance?" } } },
      async (harness) => {
        stubRulesChunks([
          "The robber must be at least two roads away.",
          "Sources: [BGG](<https://boardgamegeek.com/thread/1>)",
        ]);
        harness.interaction.followUp = async () => {
          throw new Error("DiscordAPIError[50035] content[BASE_TYPE_MAX_LENGTH]");
        };

        await runRules(harness);

        expect(harness.calls.editReply).toHaveLength(1);
        expect(harness.calls.editReply[0].content).toBe(
          "The robber must be at least two roads away."
        );
        expect(harness.calls.editReply[0].content).not.toContain(ERROR_MESSAGE);
        expect(collectedReplyText(harness)).not.toContain(ERROR_MESSAGE);
      }
    );
  });
});
