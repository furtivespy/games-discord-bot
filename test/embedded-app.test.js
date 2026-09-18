const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CONFIG_PLACEHOLDER,
  DISCORD_ME_URL,
  DISCORD_TOKEN_URL,
  createEmbeddedApp,
  displayNameFromDiscordUser,
  handleTokenExchange,
  hostFromPublicBaseUrl,
  injectEmbeddedConfig,
  resolveEmbeddedAppConfig,
  resolveInjectedApiHost,
  sanitizeApiHost,
  sanitizeClientId,
} = require("../modules/embeddedApp");

const SECRET_TOKEN = "SUPER_SECRET_ACCESS_TOKEN";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockDiscordFetch({
  tokenStatus = 200,
  tokenBody = { access_token: SECRET_TOKEN },
  meStatus = 200,
  meBody = { username: "willsullivan", global_name: "Will" },
  calls = [],
} = {}) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === DISCORD_TOKEN_URL) {
      return jsonResponse(tokenStatus, tokenBody);
    }
    if (String(url) === DISCORD_ME_URL) {
      return jsonResponse(meStatus, meBody);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
    server.on("error", reject);
  });
}

describe("embedded app config", () => {
  test("prefers env over config.json and never requires Mongo", () => {
    const resolved = resolveEmbeddedAppConfig(
      {
        CLIENT_ID: "env-client",
        CLIENT_SECRET: "env-secret",
        PUBLIC_BASE_URL: "https://gamebot.example.com/",
        PORT: "4100",
      },
      {
        clientId: "config-client",
        clientSecret: "config-secret",
        publicBaseUrl: "https://ignored.example.com",
      }
    );
    expect(resolved).toEqual({
      clientId: "env-client",
      clientSecret: "env-secret",
      publicBaseUrl: "https://gamebot.example.com",
      apiHost: "gamebot.example.com",
      port: 4100,
    });
  });

  test("falls back to the bot's existing clientId", () => {
    const resolved = resolveEmbeddedAppConfig({}, { clientId: "548570412959662080" });
    expect(resolved.clientId).toBe("548570412959662080");
    expect(resolved.clientSecret).toBe("");
    expect(resolved.port).toBe(3000);
  });

  test("hostFromPublicBaseUrl strips scheme and path", () => {
    expect(hostFromPublicBaseUrl("https://gamebot.example.com/visual")).toBe(
      "gamebot.example.com"
    );
    expect(hostFromPublicBaseUrl("gamebot.example.com")).toBe("gamebot.example.com");
  });
});

describe("displayNameFromDiscordUser", () => {
  test("prefers global_name then username", () => {
    expect(
      displayNameFromDiscordUser({ global_name: "Will", username: "willsullivan" })
    ).toBe("Will");
    expect(displayNameFromDiscordUser({ username: "willsullivan" })).toBe(
      "willsullivan"
    );
    expect(displayNameFromDiscordUser({})).toBeNull();
  });

  test("skips blank global_name instead of dropping username", () => {
    expect(
      displayNameFromDiscordUser({ global_name: "   ", username: "willsullivan" })
    ).toBe("willsullivan");
  });
});

describe("handleTokenExchange", () => {
  test("exchanges code, resolves @me, and never logs the access token", async () => {
    const logs = [];
    const fetchCalls = [];
    const result = await handleTokenExchange({
      code: "oauth-code",
      clientId: "client-id",
      clientSecret: "client-secret",
      logger: { log: (message) => logs.push(String(message)) },
      fetchImpl: mockDiscordFetch({ calls: fetchCalls }),
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      access_token: SECRET_TOKEN,
      display_name: "Will",
    });

    const tokenCall = fetchCalls.find((call) => call.url === DISCORD_TOKEN_URL);
    expect(tokenCall.options.method).toBe("POST");
    expect(tokenCall.options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const body = String(tokenCall.options.body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=oauth-code");
    expect(body).toContain("client_id=client-id");
    expect(body).toContain("client_secret=client-secret");

    const meCall = fetchCalls.find((call) => call.url === DISCORD_ME_URL);
    expect(meCall.options.headers.Authorization).toBe(`Bearer ${SECRET_TOKEN}`);

    expect(JSON.stringify(logs)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(logs)).not.toContain("client-secret");
  });

  test("rejects a missing code and unconfigured secret", async () => {
    expect(await handleTokenExchange({ code: "" })).toEqual({
      status: 400,
      body: { error: "missing_code" },
    });
    expect(
      await handleTokenExchange({
        code: "abc",
        clientId: "client-id",
        clientSecret: "",
      })
    ).toEqual({
      status: 503,
      body: { error: "oauth_not_configured" },
    });
  });

  test("does not return an access token when Discord rejects the code", async () => {
    const result = await handleTokenExchange({
      code: "bad",
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchImpl: mockDiscordFetch({
        tokenStatus: 400,
        tokenBody: { error: "invalid_grant" },
      }),
    });
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: "token_exchange_failed" });
    expect(result.body.access_token).toBeUndefined();
  });
});

describe("embedded HTTP origin", () => {
  test("POST /api/token and GET / share one origin", async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "embedded-client-"));
    fs.writeFileSync(
      path.join(staticDir, "index.html"),
      `<!doctype html><html><head><script>${CONFIG_PLACEHOLDER}</script></head><body><p id="greeting">Connecting…</p></body></html>`
    );

    const app = createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "server-secret",
      publicBaseUrl: "https://gamebot.example.com",
      staticDir,
      fetchImpl: mockDiscordFetch(),
    });
    const { server, url } = await listen(app);

    try {
      const page = await fetch(url);
      const html = await page.text();
      expect(page.status).toBe(200);
      expect(html).toContain("window.__GAMEBOT_EMBEDDED_CONFIG__=");
      expect(html).toContain('"clientId":"client-123"');
      expect(html).toContain('"apiHost":"gamebot.example.com"');
      expect(html).not.toContain("server-secret");
      expect(html).not.toContain(SECRET_TOKEN);

      const token = await fetch(`${url}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(token.status).toBe(200);
      expect(await token.json()).toEqual({
        access_token: SECRET_TOKEN,
        display_name: "Will",
      });

      const proxied = await fetch(`${url}/.proxy/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "oauth-code" }),
      });
      expect(proxied.status).toBe(200);
      expect(await proxied.json()).toMatchObject({ access_token: SECRET_TOKEN });
    } finally {
      server.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  test("injectEmbeddedConfig replaces the placeholder only", () => {
    const html = `<head><script>${CONFIG_PLACEHOLDER}</script></head>`;
    const injected = injectEmbeddedConfig(html, {
      clientId: "abc",
      apiHost: "gamebot.example.com",
    });
    expect(injected).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"abc","apiHost":"gamebot.example.com"};'
    );
    expect(injected).not.toContain(CONFIG_PLACEHOLDER);
  });

  test("does not inject Discord proxy hosts or HTML-breaking values", () => {
    expect(
      resolveInjectedApiHost({
        requestHost: "123456.discordsays.com",
      })
    ).toBe("");
    expect(sanitizeApiHost("</script>.example.com")).toBe("");
    expect(sanitizeClientId("</script><script>alert(1)")).toBe("");
    const injected = injectEmbeddedConfig(
      `<head><script>${CONFIG_PLACEHOLDER}</script></head>`,
      {
        clientId: "</script><script>alert(1)",
        apiHost: "123.discordsays.com",
      }
    );
    expect(injected).toContain(
      'window.__GAMEBOT_EMBEDDED_CONFIG__={"clientId":"","apiHost":""};'
    );
    expect(injected).not.toContain("</script><script>");
  });
});
