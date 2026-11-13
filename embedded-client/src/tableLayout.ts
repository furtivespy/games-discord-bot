export const MAX_VISIBLE_DECKS = 2;
export const DEFAULT_CARD_BACK = "/card-back.svg";
export const CUSTOM_GAME_LABEL = "Custom game";

export type SnapshotDeck = {
  name?: string;
  remaining?: number | string;
  total?: number | string;
  backUrl?: string;
  backImageUrl?: string;
};

export type OtherPlayer = {
  userId?: string;
  name?: string;
  handCount?: number | string;
  avatarUrl?: string | null;
};

export type StatusPlayer = {
  userId?: string;
  name?: string;
  order?: number;
  score?: string;
  handCount?: number | string;
  playAreaCount?: number | string;
  teamName?: string;
  color?: string | null;
  isYou?: boolean;
  tokens?: Record<string, number | string>;
};

export type StatusToken = {
  id?: string;
  name?: string;
  isSecret?: boolean;
  cap?: number | null;
  circulation?: number | string;
  available?: string | null;
};

export type StatusPile = {
  name?: string;
  count?: number;
  isSecret?: boolean;
  topCardName?: string;
};

export type StatusHistory = {
  summary?: string;
  category?: string;
};

export type GameStatus = {
  gameName?: string;
  reverseOrder?: boolean;
  isCustomGame?: boolean;
  players?: StatusPlayer[];
  tokens?: StatusToken[];
  globalPiles?: StatusPile[];
  history?: StatusHistory[];
};

export function visibleDecks<T>(decks: T[] | undefined | null): T[] {
  if (!Array.isArray(decks)) return [];
  return decks.filter((deck) => deck != null).slice(0, MAX_VISIBLE_DECKS);
}

export function deckCountLabel(
  remaining: unknown,
  total: unknown
): string {
  const rem = remaining === "?" ? "?" : Number.isFinite(Number(remaining))
    ? String(Number(remaining))
    : "0";
  const tot = Number.isFinite(Number(total)) ? String(Number(total)) : "?";
  return `${rem}/${tot}`;
}

export function handCountLabel(count: unknown): string {
  if (count === "?") return "? cards";
  const n = Number(count);
  if (!Number.isFinite(n)) return "0 cards";
  return n === 1 ? "1 card" : `${n} cards`;
}

export function initialsFromName(name: unknown): string {
  const text = typeof name === "string" ? name.trim() : "";
  if (!text) return "?";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  const compact = parts[0].replace(/[^\p{L}\p{N}]+/gu, "");
  return (compact.slice(0, 2) || parts[0].slice(0, 2)).toUpperCase();
}

export function suitGlyph(suit: unknown): string | null {
  const raw = String(suit || "").trim().toLowerCase();
  if (!raw) return null;
  if (["spades", "spade", "s", "♠"].includes(raw)) return "♠";
  if (["hearts", "heart", "h", "♥"].includes(raw)) return "♥";
  if (["diamonds", "diamond", "d", "♦"].includes(raw)) return "♦";
  if (["clubs", "club", "c", "♣"].includes(raw)) return "♣";
  return null;
}

export function suitColorClass(glyph: string | null): string {
  if (glyph === "♥" || glyph === "♦") return "suit-red";
  if (glyph === "♠" || glyph === "♣") return "suit-black";
  return "";
}

export function statusGameTitle(status: GameStatus | null | undefined): string {
  const name =
    typeof status?.gameName === "string" && status.gameName.trim()
      ? status.gameName.trim()
      : "Game";
  const label = status?.isCustomGame ? `${name} (${CUSTOM_GAME_LABEL})` : name;
  return `${label} Status`;
}

export function asRecordList<T extends object>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => item && typeof item === "object" && !Array.isArray(item)
  ) as T[];
}

export function autoSelectGameId(search: string, mock: boolean): string {
  if (!mock) return "";
  try {
    return new URLSearchParams(search).get("game")?.trim() || "";
  } catch {
    return "";
  }
}
