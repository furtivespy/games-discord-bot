export const MAX_VISIBLE_DECKS = 2;
export const DEFAULT_CARD_BACK = "/card-back.svg";
export const UNASSIGNED_TEAM_LABEL = "No team";

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
  teamName?: string;
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

export type StatusTeam = {
  id?: string;
  name?: string;
  color?: string | null;
};

export type GameStatus = {
  gameName?: string;
  reverseOrder?: boolean;
  isCustomGame?: boolean;
  players?: StatusPlayer[];
  teams?: StatusTeam[];
  tokens?: StatusToken[];
  globalPiles?: StatusPile[];
  history?: StatusHistory[];
};

export type PlayerTeamGroup = {
  label: string;
  unassigned: boolean;
  color: string | null;
  players: OtherPlayer[];
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

export function statusPlayerSeatName(
  player: StatusPlayer | null | undefined
): string {
  const seat = Number.isFinite(Number(player?.order))
    ? `(${Number(player?.order) + 1}) `
    : "";
  const name =
    typeof player?.name === "string" && player.name.trim()
      ? player.name.trim()
      : "Player";
  return `${seat}${name}`;
}

export function statusPlayerScoreLabel(
  player: StatusPlayer | null | undefined
): string {
  if (player?.score == null) return "—";
  const text = String(player.score).trim();
  return text || "—";
}

function trimmedTeamName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function groupPlayersByTeam(
  players: OtherPlayer[] | null | undefined,
  teams?: StatusTeam[] | null
): PlayerTeamGroup[] | null {
  const list = asRecordList<OtherPlayer>(players);
  if (!list.length) return null;
  const roster = asRecordList<StatusTeam>(teams)
    .map((team) => ({
      name: trimmedTeamName(team.name),
      color:
        typeof team.color === "string" && team.color.trim()
          ? team.color.trim()
          : null,
    }))
    .filter((team) => team.name);
  const hasNamedPlayer = list.some((player) => trimmedTeamName(player.teamName));
  if (!roster.length && !hasNamedPlayer) return null;

  const remaining = [...list];
  const takeMatching = (predicate: (player: OtherPlayer) => boolean) => {
    const matched: OtherPlayer[] = [];
    const leftover: OtherPlayer[] = [];
    for (const player of remaining) {
      (predicate(player) ? matched : leftover).push(player);
    }
    remaining.length = 0;
    remaining.push(...leftover);
    return matched;
  };

  const groups: PlayerTeamGroup[] = [];
  for (const team of roster) {
    const members = takeMatching(
      (player) => trimmedTeamName(player.teamName) === team.name
    );
    if (!members.length) continue;
    groups.push({
      label: team.name,
      unassigned: false,
      color: team.color,
      players: members,
    });
  }

  const extras = new Map<string, OtherPlayer[]>();
  const unassigned: OtherPlayer[] = [];
  for (const player of remaining) {
    const name = trimmedTeamName(player.teamName);
    if (!name) {
      unassigned.push(player);
      continue;
    }
    const bucket = extras.get(name) || [];
    bucket.push(player);
    extras.set(name, bucket);
  }
  for (const [label, members] of extras) {
    groups.push({
      label,
      unassigned: false,
      color: null,
      players: members,
    });
  }
  if (unassigned.length) {
    groups.push({
      label: UNASSIGNED_TEAM_LABEL,
      unassigned: true,
      color: null,
      players: unassigned,
    });
  }
  return groups;
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
