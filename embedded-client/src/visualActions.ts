import shared from "../../modules/visualActionShared.json";

export const ACTION_COUNT_MIN = shared.ACTION_COUNT_MIN;
export const ACTION_COUNT_MAX = shared.ACTION_COUNT_MAX;
export const DEFAULT_ACTION_COUNT = shared.DEFAULT_ACTION_COUNT;
export const GAME_CHANNEL_LINK_LABEL = "Open Discord channel";
export const CHANNEL_POST_FAILED_NOTICE =
  "The table updated, but Discord didn't get the channel message.";

export type DeckActionKind = "deal" | "draw";
export type HandActionKind = "play" | "discard" | "show";

// Tooltips copy the slash command descriptions, not the destination option.
// Visual PLAY/DISCARD use that command's default destination (no picker).
export const HAND_CARD_ACTIONS: ReadonlyArray<{
  id: HandActionKind;
  label: string;
  tooltip: string;
}> = [
  {
    id: "play",
    label: "PLAY",
    tooltip: "Play a card from your hand.",
  },
  {
    id: "discard",
    label: "DISCARD",
    tooltip: "discard a card (not shown to everyone)",
  },
  {
    id: "show",
    label: "SHOW",
    tooltip: "Show a card from your hand to other players. The card stays in your hand.",
  },
];

export const ACTION_ERROR_MESSAGES: Record<string, string> =
  shared.ACTION_ERROR_MESSAGES;

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

export function shouldUseOpenExternalLink(
  isMock: boolean,
  openExternalLink: unknown
): boolean {
  return !isMock && typeof openExternalLink === "function";
}

export type OpenExternalLink = (args: { url: string }) => Promise<unknown>;

export async function tryOpenExternalLink(
  href: string,
  openExternal: OpenExternalLink
): Promise<"opened" | "cancelled" | "failed"> {
  try {
    const result = await openExternal({ url: href });
    if (
      result &&
      typeof result === "object" &&
      Object.prototype.hasOwnProperty.call(result, "opened") &&
      (result as { opened?: unknown }).opened === false
    ) {
      return "cancelled";
    }
    return "opened";
  } catch {
    return "failed";
  }
}

export function parseActionCount(value: unknown): number | null {
  const raw =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(raw)) return null;
  if (raw < ACTION_COUNT_MIN || raw > ACTION_COUNT_MAX) return null;
  return raw;
}

export function newActionRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function visualActionErrorMessage(
  error: unknown,
  fallback?: string | null
): string {
  const text = typeof fallback === "string" ? fallback.trim() : "";
  if (text) return text;
  const key = String(error || "").trim();
  if (key && ACTION_ERROR_MESSAGES[key]) return ACTION_ERROR_MESSAGES[key];
  return ACTION_ERROR_MESSAGES.action_failed;
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
  requestId?: string | null;
  fixture?: string | null;
}): Record<string, string | number> {
  const body: Record<string, string | number> = {
    action: opts.action,
    deck: opts.deck,
    count: opts.count,
    channelId: opts.channelId,
    guildId: opts.guildId,
  };
  const requestId = String(opts.requestId || "").trim();
  if (requestId) body.requestId = requestId;
  const fixture = String(opts.fixture || "").trim();
  if (fixture) body.fixture = fixture;
  return body;
}

export function handCardActionFromDataset(
  value: string | null | undefined
): HandActionKind | null {
  return value === "play" || value === "discard" || value === "show" ? value : null;
}

export function visualHandActionBody(opts: {
  action: HandActionKind;
  cardId: string;
  channelId: string;
  guildId: string;
  requestId?: string | null;
  fixture?: string | null;
}): Record<string, string> {
  const body: Record<string, string> = {
    action: opts.action,
    cardId: opts.cardId,
    channelId: opts.channelId,
    guildId: opts.guildId,
  };
  const requestId = String(opts.requestId || "").trim();
  if (requestId) body.requestId = requestId;
  const fixture = String(opts.fixture || "").trim();
  if (fixture) body.fixture = fixture;
  return body;
}

/**
 * HTTP 200 with `{}` or a non-object body is not a table snapshot. Applying it
 * would wipe the hand/board via `asCardList(undefined) === []`.
 */
export function isVisualActionSnapshot(
  payload: unknown
): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const obj = payload as Record<string, unknown>;
  if (typeof obj.version === "string" && obj.version.trim()) return true;
  if (typeof obj.channelId === "string" && obj.channelId.trim()) return true;
  if (Array.isArray(obj.hand)) return true;
  if (Array.isArray(obj.playArea)) return true;
  if (Array.isArray(obj.gameBoard)) return true;
  if (Array.isArray(obj.decks)) return true;
  if (obj.status && typeof obj.status === "object" && !Array.isArray(obj.status)) {
    return true;
  }
  return false;
}

export type VisualActionResponseResult =
  | { kind: "http_error"; payload: Record<string, unknown> }
  | { kind: "invalid_body"; payload: Record<string, unknown> }
  | { kind: "snapshot"; payload: Record<string, unknown> };

function asPayloadObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function readVisualActionResponse(response: {
  ok: boolean;
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}): Promise<VisualActionResponseResult> {
  let parsed: unknown = null;
  try {
    if (typeof response.text === "function") {
      const raw = await response.text();
      const trimmed = String(raw ?? "").trim();
      if (trimmed) parsed = JSON.parse(trimmed);
    } else if (typeof response.json === "function") {
      parsed = await response.json();
    }
  } catch {
    parsed = null;
  }
  const payload = asPayloadObject(parsed);
  if (!response.ok) return { kind: "http_error", payload };
  if (!isVisualActionSnapshot(parsed)) return { kind: "invalid_body", payload };
  return { kind: "snapshot", payload };
}
