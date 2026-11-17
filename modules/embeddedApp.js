const path = require("path");
const fs = require("fs");
const express = require("express");
const {
  DEFAULT_MOCK_CHANNEL_ID,
  DEFAULT_MOCK_CHANNEL_NAME,
  DEFAULT_MOCK_CLIENT_ID,
  DEFAULT_MOCK_GUILD_ID,
  MOCK_ACCESS_TOKEN,
  allowEmbeddedAppMock,
  getMockGames,
  handleMockTokenExchange,
  isEmbeddedAppMockEnabled,
  isEmbeddedAppMockRequested,
  resolveMockRuntimeConfig,
  createMockGameSession,
} = require("./embeddedAppMock");
const {
  createActionIdempotencyCache,
  parseVisualActionBody,
  runVisualCardAction,
  visualActionErrorMessage,
} = require("./embeddedActions");
const {
  channelNameFromDiscordClient,
  createDiscordLookupCache,
  listActiveGamesForUser,
  etagMatches,
  formatEtag,
  optionalDiscordAccessGuard,
  requiredDiscordAccessGuard,
  snapshotGameForUser,
  versionGameForUser,
} = require("./embeddedGames");
const {
  CARD_IMAGE_PATH,
  createCardImageHandler,
  deriveImageProxyKey,
  proxySnapshotImages,
} = require("./embeddedImageProxy");

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/v10/users/@me";
const DISCORD_USER_CACHE_TTL_MS = 45_000;
const DEFAULT_PORT = 3000;
const CONFIG_PLACEHOLDER = "/*__GAMEBOT_EMBEDDED_CONFIG__*/";
const DEFAULT_STATIC_DIR = path.join(__dirname, "..", "embedded-client", "dist");

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function hostFromPublicBaseUrl(publicBaseUrl) {
  const raw = stripTrailingSlash(publicBaseUrl);
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).host;
  } catch {
    return raw.replace(/^https?:\/\//i, "");
  }
}

function resolveEmbeddedAppConfig(env = process.env, botConfig = {}) {
  const clientId = String(env.CLIENT_ID || botConfig.clientId || "").trim();
  const clientSecret = String(
    env.CLIENT_SECRET || botConfig.clientSecret || ""
  ).trim();
  const publicBaseUrl = stripTrailingSlash(
    env.PUBLIC_BASE_URL || botConfig.publicBaseUrl || ""
  );
  const parsedPort = Number(env.PORT || botConfig.embeddedPort || DEFAULT_PORT);
  return {
    clientId,
    clientSecret,
    publicBaseUrl,
    apiHost: hostFromPublicBaseUrl(publicBaseUrl),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
  };
}

function displayNameFromDiscordUser(user) {
  if (!user || typeof user !== "object") return null;
  for (const value of [user.global_name, user.username]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isDiscordProxyHost(host) {
  const hostname = String(host || "")
    .split(":")[0]
    .toLowerCase();
  return hostname === "discordsays.com" || hostname.endsWith(".discordsays.com");
}

function sanitizeClientId(value) {
  const s = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(s) ? s : "";
}

function sanitizeApiHost(value) {
  const s = String(value || "").trim();
  if (!s || isDiscordProxyHost(s)) return "";
  return /^[A-Za-z0-9][A-Za-z0-9.-]*(:\d{1,5})?$/.test(s) ? s : "";
}

function resolveInjectedApiHost({ apiHost, publicBaseUrl, requestHost } = {}) {
  return (
    sanitizeApiHost(apiHost) ||
    sanitizeApiHost(hostFromPublicBaseUrl(publicBaseUrl)) ||
    (isDiscordProxyHost(requestHost) ? "" : sanitizeApiHost(requestHost))
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeHostChannelId(value) {
  const s = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(s) ? s : "";
}

function firstQueryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function bearerTokenFromHeader(value) {
  const s = String(value || "").trim();
  const match = /^Bearer\s+(\S+)/i.exec(s);
  return match ? match[1] : "";
}

async function exchangeCodeForAccessToken({
  code,
  clientId,
  clientSecret,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const accessToken =
    payload && typeof payload.access_token === "string"
      ? payload.access_token
      : "";

  return {
    ok: response.ok && Boolean(accessToken),
    status: response.status,
    accessToken,
  };
}

async function fetchDiscordUser(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(DISCORD_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveDiscordUser({
  accessToken,
  fetchImpl = fetch,
  cache,
  logger,
} = {}) {
  const token = String(accessToken || "");
  if (!token) return null;
  const key = `me:${token}`;
  const cached = cache?.get?.(key);
  if (cached) return cached;
  if (cache?.inflight?.has?.(key)) return cache.inflight.get(key);

  const load = (async () => {
    try {
      const user = await fetchDiscordUser(token, fetchImpl);
      if (user?.id) cache?.set?.(key, user);
      return user;
    } catch (err) {
      logger?.log?.(
        `Discord users/@me lookup failed: ${err.message || err}`,
        "warn"
      );
      return null;
    }
  })();

  if (cache?.inflight) {
    cache.inflight.set(key, load);
    try {
      return await load;
    } finally {
      cache.inflight.delete(key);
    }
  }
  return load;
}

async function handleTokenExchange({
  code,
  clientId,
  clientSecret,
  fetchImpl = fetch,
  logger,
  consumeOrigin,
  hostChannelId,
}) {
  if (!isNonEmptyString(code)) {
    return { status: 400, body: { error: "missing_code" } };
  }
  if (!isNonEmptyString(clientId) || !isNonEmptyString(clientSecret)) {
    logger?.log(
      "Embedded app token exchange is missing CLIENT_ID or CLIENT_SECRET",
      "error"
    );
    return { status: 503, body: { error: "oauth_not_configured" } };
  }

  let exchange;
  try {
    exchange = await exchangeCodeForAccessToken({
      code: String(code).trim(),
      clientId,
      clientSecret,
      fetchImpl,
    });
  } catch (err) {
    logger?.log(
      `Discord token exchange request failed: ${err.message || err}`,
      "error"
    );
    return { status: 502, body: { error: "token_exchange_failed" } };
  }

  if (!exchange.ok) {
    logger?.log(`Discord token exchange failed (${exchange.status})`, "error");
    return { status: 502, body: { error: "token_exchange_failed" } };
  }

  let displayName = null;
  let originChannelName = null;
  try {
    const user = await fetchDiscordUser(exchange.accessToken, fetchImpl);
    displayName = displayNameFromDiscordUser(user);
    if (user?.id && typeof consumeOrigin === "function") {
      const origin = consumeOrigin(user.id, {
        hostChannelId: sanitizeHostChannelId(hostChannelId),
      });
      if (origin?.channelName) {
        originChannelName = origin.channelName;
      }
    }
  } catch (err) {
    logger?.log(
      `Discord users/@me lookup failed: ${err.message || err}`,
      "warn"
    );
  }

  const body = {
    access_token: exchange.accessToken,
    display_name: displayName,
  };
  if (originChannelName) {
    body.origin_channel_name = originChannelName;
  }
  return {
    status: 200,
    body,
  };
}

function injectEmbeddedConfig(html, config) {
  const mock = Boolean(config.mock);
  const payload = {
    clientId:
      sanitizeClientId(config.clientId) || (mock ? DEFAULT_MOCK_CLIENT_ID : ""),
    apiHost: sanitizeApiHost(config.apiHost),
  };
  if (mock) {
    payload.mock = true;
    payload.channelId =
      sanitizeHostChannelId(config.channelId) || DEFAULT_MOCK_CHANNEL_ID;
    payload.guildId =
      sanitizeHostChannelId(config.guildId) || DEFAULT_MOCK_GUILD_ID;
  }
  const snippet = `window.__GAMEBOT_EMBEDDED_CONFIG__=${JSON.stringify(payload)};`;
  if (html.includes(CONFIG_PLACEHOLDER)) {
    return html.replace(CONFIG_PLACEHOLDER, snippet);
  }
  return html.replace("</head>", `<script>${snippet}</script></head>`);
}

// The Docker build writes the commit it was built from to this file. A file
// (not an env var or label) because container updaters such as freshdock
// recreate a container by copying the old container's config, which includes
// the previous image's baked-in ENV and would pin /health to a stale SHA.
const DEFAULT_GIT_SHA_FILE = path.resolve(__dirname, "..", "GIT_SHA");

// The file wins over env so a stale GIT_SHA copied into a recreated container
// cannot shadow the image's own value. Env covers local runs without the file.
function readBuildSha({ gitShaFile = DEFAULT_GIT_SHA_FILE, env = process.env } = {}) {
  try {
    const fromFile = fs.readFileSync(gitShaFile, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    // No file: running outside a Docker image build.
  }
  return env.GIT_SHA || "unknown";
}

function createEmbeddedApp({
  clientId,
  clientSecret,
  publicBaseUrl,
  apiHost,
  staticDir,
  logger,
  fetchImpl = fetch,
  consumeOrigin,
  mock = false,
  mockChannelId,
  mockGuildId,
  mockChannelName,
  gameStore,
  discordClient,
  fetchChannelName,
  getGameData,
  botToken,
  env = process.env,
  imageProxyKey,
  imageFetchImpl = fetch,
  imageLookup,
  gitShaFile = DEFAULT_GIT_SHA_FILE,
} = {}) {
  const mockEnabled = allowEmbeddedAppMock(mock, env);
  const cardImageKey = imageProxyKey || deriveImageProxyKey(clientSecret);
  const resolvedMockChannelId =
    sanitizeHostChannelId(mockChannelId) || DEFAULT_MOCK_CHANNEL_ID;
  const resolvedMockGuildId =
    sanitizeHostChannelId(mockGuildId) || DEFAULT_MOCK_GUILD_ID;
  const resolvedMockChannelName =
    typeof mockChannelName === "string"
      ? mockChannelName.trim()
      : DEFAULT_MOCK_CHANNEL_NAME;
  const resolvedClientId =
    sanitizeClientId(clientId) || (mockEnabled ? DEFAULT_MOCK_CLIENT_ID : clientId);
  const mockSession = mockEnabled ? createMockGameSession() : null;
  const actionIdempotency = createActionIdempotencyCache();
  const discordLookupCache = createDiscordLookupCache();
  const discordUserCache = createDiscordLookupCache({
    ttlMs: DISCORD_USER_CACHE_TTL_MS,
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));

  // Deploy check: the release workflow polls this until `sha` matches the
  // commit it just built (baked into the image). Registered before the SPA
  // fallback below, which would otherwise answer /health with index.html.
  const buildSha = readBuildSha({ gitShaFile, env });
  app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ status: "ok", sha: buildSha });
  });

  async function exchangeToken(req, res) {
    if (mockEnabled) {
      const result = handleMockTokenExchange({
        originChannelName: resolvedMockChannelName,
      });
      res.status(result.status).json(result.body);
      return;
    }
    const result = await handleTokenExchange({
      code: req.body?.code,
      clientId,
      clientSecret,
      fetchImpl,
      logger,
      consumeOrigin,
      hostChannelId: req.body?.channel_id,
    });
    res.status(result.status).json(result.body);
  }

  app.post(["/api/token", "/.proxy/api/token"], exchangeToken);

  const resolveChannelName =
    typeof fetchChannelName === "function"
      ? fetchChannelName
      : (channelId) => channelNameFromDiscordClient(discordClient, channelId);

  async function sendActiveGames(req, res) {
    const accessToken = bearerTokenFromHeader(req.get("authorization"));
    if (mockEnabled) {
      if (accessToken !== MOCK_ACCESS_TOKEN) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      const result = getMockGames({
        fixture: firstQueryValue(req.query?.fixture),
      });
      res.status(result.status).json(result.body);
      return;
    }
    if (!accessToken) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const user = await resolveDiscordUser({
      accessToken,
      fetchImpl,
      cache: discordUserCache,
      logger,
    });
    if (!user?.id) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const guildId = sanitizeHostChannelId(firstQueryValue(req.query?.guildId));
    if (!guildId) {
      res.status(400).json({ error: "missing_guild" });
      return;
    }
    const result = await listActiveGamesForUser({
      gameStore,
      guildId,
      userId: user.id,
      fetchChannelName: resolveChannelName,
      logger,
    });
    res.status(result.status).json(result.body);
  }

  app.get(["/api/games", "/.proxy/api/games"], sendActiveGames);

  function sendVersionedResult(
    res,
    result,
    { proxyImages = false, ifNoneMatch } = {}
  ) {
    const version = result.version || result.body?.version;
    if (result.status === 200 && etagMatches(ifNoneMatch, version)) {
      result = { status: 304, version };
    }
    res.set("Cache-Control", "no-store");
    if (version) res.set("ETag", formatEtag(version));
    if (result.status === 304) {
      res.status(304).end();
      return;
    }
    const body =
      proxyImages && result.status === 200
        ? proxySnapshotImages(result.body, cardImageKey)
        : result.body;
    res.status(result.status).json(body);
  }

  function sendSnapshotResult(res, result, req) {
    sendVersionedResult(res, result, {
      proxyImages: true,
      ifNoneMatch: req?.get?.("if-none-match"),
    });
  }

  async function authenticateEmbeddedGameRead(req) {
    const accessToken = bearerTokenFromHeader(req.get("authorization"));
    const requestedChannelId = sanitizeHostChannelId(
      firstQueryValue(req.query?.channelId)
    );
    const requestedGuildId = sanitizeHostChannelId(
      firstQueryValue(req.query?.guildId)
    );
    const fixture = firstQueryValue(req.query?.fixture);
    const ifNoneMatch = req.get("if-none-match");

    if (mockEnabled) {
      if (accessToken !== MOCK_ACCESS_TOKEN) {
        return { ok: false, status: 401, body: { error: "unauthorized" } };
      }
      return {
        ok: true,
        mock: true,
        fixture,
        requestedChannelId: requestedChannelId || resolvedMockChannelId,
        requestedGuildId: requestedGuildId || resolvedMockGuildId,
        ifNoneMatch,
      };
    }
    if (!accessToken) {
      return { ok: false, status: 401, body: { error: "unauthorized" } };
    }
    const user = await resolveDiscordUser({
      accessToken,
      fetchImpl,
      cache: discordUserCache,
      logger,
    });
    if (!user?.id) {
      return { ok: false, status: 401, body: { error: "unauthorized" } };
    }
    if (!requestedGuildId) {
      return { ok: false, status: 400, body: { error: "missing_guild" } };
    }
    if (!requestedChannelId) {
      return { ok: false, status: 400, body: { error: "missing_channel" } };
    }
    const guard = await optionalDiscordAccessGuard({
      fetchImpl,
      botToken,
      discordClient,
      guildId: requestedGuildId,
      channelId: requestedChannelId,
      userId: user.id,
    });
    if (!guard.ok) {
      return { ok: false, status: guard.status, body: guard.body };
    }
    return {
      ok: true,
      mock: false,
      user,
      requestedChannelId,
      requestedGuildId,
      ifNoneMatch,
    };
  }

  async function sendGameSnapshot(req, res) {
    const auth = await authenticateEmbeddedGameRead(req);
    if (!auth.ok) {
      res.status(auth.status).json(auth.body);
      return;
    }
    if (auth.mock) {
      const result = mockSession.getSnapshot({
        fixture: auth.fixture,
        channelId: auth.requestedChannelId,
        guildId: auth.requestedGuildId,
      });
      sendSnapshotResult(res, result, req);
      return;
    }
    const result = await snapshotGameForUser({
      getGameData,
      discordClient,
      gameStore,
      guildId: auth.requestedGuildId,
      channelId: auth.requestedChannelId,
      userId: auth.user.id,
      logger,
      ifNoneMatch: auth.ifNoneMatch,
    });
    sendSnapshotResult(res, result, req);
  }

  app.get(["/api/game/snapshot", "/.proxy/api/game/snapshot"], sendGameSnapshot);

  async function sendGameVersion(req, res) {
    const auth = await authenticateEmbeddedGameRead(req);
    if (!auth.ok) {
      res.status(auth.status).json(auth.body);
      return;
    }
    if (auth.mock) {
      const result = mockSession.getVersion({
        fixture: auth.fixture,
        channelId: auth.requestedChannelId,
        guildId: auth.requestedGuildId,
      });
      sendVersionedResult(res, result, { ifNoneMatch: auth.ifNoneMatch });
      return;
    }
    const result = await versionGameForUser({
      getGameData,
      discordClient,
      gameStore,
      guildId: auth.requestedGuildId,
      channelId: auth.requestedChannelId,
      userId: auth.user.id,
      logger,
      ifNoneMatch: auth.ifNoneMatch,
    });
    sendVersionedResult(res, result, { ifNoneMatch: auth.ifNoneMatch });
  }

  app.get(["/api/game/version", "/.proxy/api/game/version"], sendGameVersion);

  async function sendGameAction(req, res) {
    const accessToken = bearerTokenFromHeader(req.get("authorization"));
    const parsed = parseVisualActionBody(req.body || {});
    if (parsed.error) {
      res.status(parsed.status).json({
        error: parsed.error,
        message: parsed.message || visualActionErrorMessage(parsed.error),
      });
      return;
    }
    const requestedChannelId = sanitizeHostChannelId(req.body?.channelId);
    const requestedGuildId = sanitizeHostChannelId(req.body?.guildId);
    if (mockEnabled) {
      if (accessToken !== MOCK_ACCESS_TOKEN) {
        res.status(401).json({
          error: "unauthorized",
          message: visualActionErrorMessage("unauthorized"),
        });
        return;
      }
      const result = await mockSession.applyAction({
        fixture: req.body?.fixture || firstQueryValue(req.query?.fixture),
        channelId: requestedChannelId || resolvedMockChannelId,
        guildId: requestedGuildId || resolvedMockGuildId,
        action: parsed.action,
        deckName: parsed.deckName,
        count: parsed.count,
        requestId: parsed.requestId,
      });
      sendSnapshotResult(res, result, req);
      return;
    }
    if (!accessToken) {
      res.status(401).json({
        error: "unauthorized",
        message: visualActionErrorMessage("unauthorized"),
      });
      return;
    }
    const user = await resolveDiscordUser({
      accessToken,
      fetchImpl,
      cache: discordUserCache,
      logger,
    });
    if (!user?.id) {
      res.status(401).json({
        error: "unauthorized",
        message: visualActionErrorMessage("unauthorized"),
      });
      return;
    }
    if (!requestedGuildId) {
      res.status(400).json({
        error: "missing_guild",
        message: visualActionErrorMessage("missing_guild"),
      });
      return;
    }
    if (!requestedChannelId) {
      res.status(400).json({
        error: "missing_channel",
        message: visualActionErrorMessage("missing_channel"),
      });
      return;
    }
    const guard = await requiredDiscordAccessGuard({
      fetchImpl,
      botToken,
      discordClient,
      guildId: requestedGuildId,
      channelId: requestedChannelId,
      userId: user.id,
      lookupCache: discordLookupCache,
    });
    if (!guard.ok) {
      res.status(guard.status).json({
        ...guard.body,
        message: visualActionErrorMessage(guard.body?.error),
      });
      return;
    }
    const result = await runVisualCardAction({
      action: parsed.action,
      deckName: parsed.deckName,
      count: parsed.count,
      user,
      member: guard.member,
      guildId: requestedGuildId,
      channelId: requestedChannelId,
      getGameData,
      discordClient,
      gameStore,
      logger,
      requestId: parsed.requestId,
      idempotency: actionIdempotency,
    });
    sendSnapshotResult(res, result, req);
  }

  app.post(["/api/game/action", "/.proxy/api/game/action"], sendGameAction);

  app.get(
    [CARD_IMAGE_PATH, `/.proxy${CARD_IMAGE_PATH}`],
    createCardImageHandler({
      key: cardImageKey,
      fetchImpl: imageFetchImpl,
      lookup: imageLookup,
      logger,
    })
  );

  const resolvedStaticDir = staticDir
    ? path.resolve(staticDir)
    : DEFAULT_STATIC_DIR;

  function sendIndex(req, res) {
    const indexPath = path.join(resolvedStaticDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.status(503).type("text/plain").send("Embedded client is not built.");
      return;
    }
    const html = fs.readFileSync(indexPath, "utf8");
    const host = resolveInjectedApiHost({
      apiHost,
      publicBaseUrl,
      requestHost: req.get("host"),
    });
    res
      .type("html")
      .send(
        injectEmbeddedConfig(html, {
          clientId: resolvedClientId,
          apiHost: host,
          mock: mockEnabled,
          channelId: resolvedMockChannelId,
          guildId: resolvedMockGuildId,
        })
      );
  }

  app.get(["/", "/index.html"], sendIndex);

  if (fs.existsSync(resolvedStaticDir)) {
    app.use(
      express.static(resolvedStaticDir, { index: false, fallthrough: true })
    );
  }

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api")) {
      return next();
    }
    sendIndex(req, res);
  });

  return app;
}

function startEmbeddedAppServer({
  config = {},
  logger,
  env = process.env,
  listen = true,
  consumeOrigin,
  gameStore,
  discordClient,
  fetchChannelName,
  getGameData,
  botToken,
} = {}) {
  const resolved = resolveEmbeddedAppConfig(env, config);
  const mockRuntime = resolveMockRuntimeConfig(env);
  if (mockRuntime.requested && !mockRuntime.enabled) {
    logger?.log(
      "EMBEDDED_APP_MOCK is set but ignored because NODE_ENV=production",
      "warn"
    );
  }
  const originLookup =
    consumeOrigin || require("./visualLaunch").consumeOrigin;
  const app = createEmbeddedApp({
    ...resolved,
    logger,
    consumeOrigin: originLookup,
    mock: mockRuntime.enabled,
    mockChannelId: mockRuntime.channelId,
    mockGuildId: mockRuntime.guildId,
    mockChannelName: mockRuntime.channelName,
    gameStore,
    discordClient,
    fetchChannelName,
    getGameData,
    botToken,
    env,
  });
  if (!listen) {
    return { app, config: resolved, server: null };
  }

  const server = app.listen(resolved.port, "0.0.0.0", () => {
    const mockNote = mockRuntime.enabled
      ? "; MOCK MODE — not for production"
      : "";
    logger?.log(
      `Embedded app listening on 0.0.0.0:${resolved.port} (client id ${
        resolved.clientId ? "set" : "missing"
      }; secret ${resolved.clientSecret ? "set" : "missing"}${mockNote})`,
      "ready"
    );
  });
  server.on("error", (err) => {
    logger?.log(
      `Embedded app HTTP server failed: ${err.message || err}`,
      "error"
    );
  });
  return { app, config: resolved, server };
}

module.exports = {
  CONFIG_PLACEHOLDER,
  DEFAULT_PORT,
  DISCORD_ME_URL,
  DISCORD_TOKEN_URL,
  DISCORD_USER_CACHE_TTL_MS,
  bearerTokenFromHeader,
  createEmbeddedApp,
  displayNameFromDiscordUser,
  handleTokenExchange,
  hostFromPublicBaseUrl,
  injectEmbeddedConfig,
  isDiscordProxyHost,
  isEmbeddedAppMockEnabled,
  isEmbeddedAppMockRequested,
  resolveEmbeddedAppConfig,
  resolveInjectedApiHost,
  sanitizeApiHost,
  sanitizeClientId,
  sanitizeHostChannelId,
  startEmbeddedAppServer,
};
