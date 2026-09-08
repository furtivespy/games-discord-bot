const { describe, expect, test } = require("bun:test");
const Roll = require("../slashcommands/games/roll");
const { withHarness } = require("./helpers/harness");

describe("/roll", () => {
  test("rejects an invalid dice expression", async () => {
    await withHarness(
      { options: { strings: { dice: "not-dice" } } },
      async (harness) => {
        const command = new Roll(harness.client);
        await command.execute(harness.interaction);
        expect(harness.lastContent()).toContain("I don't know how to roll");
      }
    );
  });

  test("rolls a valid expression and stubs Google image lookup", async () => {
    await withHarness({ options: { strings: { dice: "1d6" } } }, async (harness) => {
      harness.client.googleClient.getRandomGoogleImg = async (query) => {
        expect(query).toMatch(/^number /);
        return { link: "https://example.test/stub.png" };
      };
      const command = new Roll(harness.client);
      await command.execute(harness.interaction);
      const embed = harness.calls.reply[0].embeds[0];
      expect(embed.title).toBe("1d6");
      expect(embed.description).toContain("Total rolled:");
      expect(embed.thumbnail.url).toBe("https://example.test/stub.png");
    });
  });
});
