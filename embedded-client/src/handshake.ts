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
