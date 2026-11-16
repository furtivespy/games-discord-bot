export const ACTION_COUNT_MIN = 1;
export const ACTION_COUNT_MAX = 99;
export const DEFAULT_ACTION_COUNT = 1;
export const GAME_CHANNEL_LINK_LABEL = "Open Discord channel";

export type DeckActionKind = "deal" | "draw";

export function gameChannelUrl(
  guildId: unknown,
  channelId: unknown
): string | null {
  const guild = String(guildId || "").trim();
  const channel = String(channelId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(guild)) return null;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(channel)) return null;
  return `https://discord.com/channels/${guild}/${channel}`;
}

export function parseActionCount(value: unknown): number | null {
  const raw =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(raw)) return null;
  if (raw < ACTION_COUNT_MIN || raw > ACTION_COUNT_MAX) return null;
  return raw;
}

export function actionDialogCopy(kind: DeckActionKind): {
  title: string;
  label: string;
  confirm: string;
} {
  if (kind === "deal") {
    return {
      title: "Deal cards",
      label: "Cards to deal each player",
      confirm: "Deal",
    };
  }
  return {
    title: "Draw cards",
    label: "Cards to draw",
    confirm: "Draw",
  };
}

export function deckActionFromDataset(
  dataset: { deckAction?: string; deckName?: string } | null | undefined
): { action: DeckActionKind; deckName: string } | null {
  const action = String(dataset?.deckAction || "").trim();
  const deckName = String(dataset?.deckName || "").trim();
  if ((action !== "deal" && action !== "draw") || !deckName) return null;
  return { action, deckName };
}

export function visualActionBody(opts: {
  action: DeckActionKind;
  deck: string;
  count: number;
  channelId: string;
  guildId: string;
  fixture?: string | null;
}): Record<string, string | number> {
  const body: Record<string, string | number> = {
    action: opts.action,
    deck: opts.deck,
    count: opts.count,
    channelId: opts.channelId,
    guildId: opts.guildId,
  };
  const fixture = String(opts.fixture || "").trim();
  if (fixture) body.fixture = fixture;
  return body;
}
