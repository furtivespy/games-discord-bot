const { describe, expect, test } = require("bun:test");
const {
  firstNonEmptyName,
  helloGreeting,
  isDiscordProxyHost,
  originLine,
  tokenRequestUrl,
  urlMappingsForApiHost,
} = require("../embedded-client/src/handshake.ts");

describe("embedded client handshake URLs", () => {
  test("maps the public API host onto /api so fetch is not raw cross-origin", () => {
    expect(urlMappingsForApiHost("gamebot.example.com")).toEqual([
      { prefix: "/api", target: "gamebot.example.com/api" },
    ]);
    expect(tokenRequestUrl("gamebot.example.com", "https:")).toBe(
      "https://gamebot.example.com/api/token"
    );
  });

  test("uses a same-origin /api/token path inside the Discord proxy", () => {
    expect(isDiscordProxyHost("123.discordsays.com")).toBe(true);
    expect(urlMappingsForApiHost("123.discordsays.com")).toEqual([]);
    expect(tokenRequestUrl("123.discordsays.com", "https:")).toBe("/api/token");
    expect(tokenRequestUrl("", "https:")).toBe("/api/token");
  });

  test("skips blank global_name when greeting", () => {
    expect(firstNonEmptyName("   ", "Will")).toBe("Will");
    expect(firstNonEmptyName(null, undefined, "")).toBeNull();
  });

  test("in-place hello has no origin line; bridge hello includes the channel name", () => {
    expect(helloGreeting("Will")).toBe("Hello, Will");
    expect(originLine(null)).toBeNull();
    expect(originLine("   ")).toBeNull();
    expect(originLine("Inis Friday")).toBe("from Inis Friday");
  });
});
