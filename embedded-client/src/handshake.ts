export const OUTSIDE_DISCORD_FALLBACK =
  "Open visual mode from Discord (App Launcher → Game Bot, or /visual).";

export function isDiscordProxyHost(host: string): boolean {
  const hostname = String(host || "")
    .split(":")[0]
    .toLowerCase();
  return hostname === "discordsays.com" || hostname.endsWith(".discordsays.com");
}

export function urlMappingsForApiHost(apiHost: string) {
  const host = String(apiHost || "").trim();
  if (!host || isDiscordProxyHost(host)) return [];
  return [{ prefix: "/api", target: `${host}/api` }];
}

function apiUrl(apiHost: string, protocol: string, path: string): string {
  const host = String(apiHost || "").trim();
  if (!host || isDiscordProxyHost(host)) return path;
  const proto = protocol === "http:" ? "http:" : "https:";
  return `${proto}//${host}${path}`;
}

export function tokenRequestUrl(apiHost: string, protocol: string): string {
  return apiUrl(apiHost, protocol, "/api/token");
}

export function snapshotRequestUrl(
  apiHost: string,
  protocol: string,
  query: {
    fixture?: string | null;
    channelId?: string | null;
    guildId?: string | null;
  } = {}
): string {
  const params = new URLSearchParams();
  const fixture = String(query.fixture || "").trim();
  const channelId = String(query.channelId || "").trim();
  const guildId = String(query.guildId || "").trim();
  if (fixture) params.set("fixture", fixture);
  if (channelId) params.set("channelId", channelId);
  if (guildId) params.set("guildId", guildId);
  const qs = params.toString();
  return apiUrl(
    apiHost,
    protocol,
    `/api/game/snapshot${qs ? `?${qs}` : ""}`
  );
}

export const CARD_IMAGE_PATH = "/api/card-image";

/** Only bot-signed proxy paths; raw external URLs are blocked by Discord's CSP. */
export function cardImageRequestUrl(
  apiHost: string,
  protocol: string,
  imageUrl: unknown
): string | null {
  if (typeof imageUrl !== "string") return null;
  if (!imageUrl.startsWith(`${CARD_IMAGE_PATH}?`)) return null;
  return apiUrl(apiHost, protocol, imageUrl);
}

export function gamesRequestUrl(
  apiHost: string,
  protocol: string,
  query: {
    fixture?: string | null;
    guildId?: string | null;
  } = {}
): string {
  const params = new URLSearchParams();
  const fixture = String(query.fixture || "").trim();
  const guildId = String(query.guildId || "").trim();
  if (fixture) params.set("fixture", fixture);
  if (guildId) params.set("guildId", guildId);
  const qs = params.toString();
  return apiUrl(apiHost, protocol, `/api/games${qs ? `?${qs}` : ""}`);
}

export const GAMES_EMPTY_MESSAGE =
  "You're not in any active games on this server.";
export const GAMES_ERROR_MESSAGE = "Could not load your games.";
export const GAMES_LOADING_MESSAGE = "Loading your games…";
export const GAMES_SELECT_PLACEHOLDER = "Select a game";
export const SNAPSHOT_LOADING_MESSAGE = "Loading the table…";

export function firstNonEmptyName(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function helloGreeting(displayName: string): string {
  return `Hello, ${displayName}`;
}

export function originLine(
  originChannelName: string | null | undefined
): string | null {
  const name = firstNonEmptyName(originChannelName);
  return name ? `from ${name}` : null;
}
