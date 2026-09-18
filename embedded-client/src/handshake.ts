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

export function tokenRequestUrl(apiHost: string, protocol: string): string {
  const host = String(apiHost || "").trim();
  if (!host || isDiscordProxyHost(host)) return "/api/token";
  const proto = protocol === "http:" ? "http:" : "https:";
  return `${proto}//${host}/api/token`;
}

export function firstNonEmptyName(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
