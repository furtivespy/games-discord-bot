export const MAX_VISIBLE_DECKS = 2;
export const DEFAULT_CARD_BACK = "/card-back.svg";
export const UNASSIGNED_TEAM_LABEL = "No team";

/**
 * Paint a pile face with a custom back, or DEFAULT_CARD_BACK when unset.
 * A mapped URL is applied only after Image() loads it; 404s and non-images
 * keep the default. Does not fetch at save time.
 */
export function applyPileBackImage(
  el: { style: { backgroundImage: string } },
  mappedSrc: string | null | undefined
): void {
  const fallback = `url("${DEFAULT_CARD_BACK}")`;
  el.style.backgroundImage = fallback;
  const src = mappedSrc || DEFAULT_CARD_BACK;
  if (src === DEFAULT_CARD_BACK) return;
  const ImageCtor = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (!ImageCtor) return;
  const probe = new ImageCtor();
  probe.onload = () => {
    el.style.backgroundImage = `url("${src}")`;
  };
  probe.onerror = () => {
    el.style.backgroundImage = fallback;
  };
  probe.src = src;
}

export type SnapshotDeck = {
  name?: string;
  remaining?: number | string;
  total?: number | string;
  discard?: number | string;
  backUrl?: string;
  backImageUrl?: string;
};

export type DeckNavDirection = "prev" | "next";

export type DeckAction = {
  id: string;
  label: string;
};

/** Hover actions. Specialize per deck later by branching on `deck`. */
export const DEFAULT_DECK_ACTIONS: DeckAction[] = [
  { id: "deal", label: "Deal" },
  { id: "draw", label: "Draw" },
];

export function deckActionsFor(_deck: SnapshotDeck | undefined | null): DeckAction[] {
  return DEFAULT_DECK_ACTIONS;
}

export type OtherPlayer = {
  userId?: string;
  name?: string;
  handCount?: number | string;
  avatarUrl?: string | null;
  teamId?: string;
  teamName?: string;
  order?: number;
  isYou?: boolean;
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
  id?: string;
  timestamp?: string;
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

export function deckWindowStart(start: unknown, total: number): number {
  const n = Number.isFinite(Number(total)) ? Math.max(0, Math.trunc(Number(total))) : 0;
  if (n <= MAX_VISIBLE_DECKS) return 0;
  const raw = Number.isFinite(Number(start)) ? Math.trunc(Number(start)) : 0;
  return ((raw % n) + n) % n;
}

export function visibleDecks<T>(
  decks: T[] | undefined | null,
  start: unknown = 0
): T[] {
  if (!Array.isArray(decks)) return [];
  const list = decks.filter((deck) => deck != null);
  if (list.length <= MAX_VISIBLE_DECKS) return list;
  const origin = deckWindowStart(start, list.length);
  const shown: T[] = [];
  for (let i = 0; i < MAX_VISIBLE_DECKS; i++) {
    shown.push(list[(origin + i) % list.length]);
  }
  return shown;
}

export function deckNavNeeded(total: unknown): boolean {
  const n = Number.isFinite(Number(total)) ? Math.trunc(Number(total)) : 0;
  return n > MAX_VISIBLE_DECKS;
}

export function rotateDeckWindow(
  start: unknown,
  total: number,
  direction: DeckNavDirection
): number {
  const delta = direction === "next" ? 1 : direction === "prev" ? -1 : 0;
  return deckWindowStart(Number(start) + delta, total);
}

export function deckNavDirectionFromDataset(
  value: string | null | undefined
): DeckNavDirection | null {
  return value === "prev" || value === "next" ? value : null;
}

export function pileColumnWidthClass(total: unknown): "is-single" | "is-pair" {
  const n = Number.isFinite(Number(total)) ? Math.trunc(Number(total)) : 0;
  return n >= 2 ? "is-pair" : "is-single";
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

function teamIdOf(value: unknown): string {
  if (value == null) return "";
  const id = String(value).trim();
  return id;
}

function playerHasTeam(player: OtherPlayer): boolean {
  return Boolean(teamIdOf(player.teamId) || trimmedTeamName(player.teamName));
}

export function groupPlayersByTeam(
  players: OtherPlayer[] | null | undefined,
  teams?: StatusTeam[] | null
): PlayerTeamGroup[] | null {
  const list = asRecordList<OtherPlayer>(players);
  if (!list.length) return null;
  const roster = asRecordList<StatusTeam>(teams)
    .map((team) => ({
      id: teamIdOf(team.id),
      name: trimmedTeamName(team.name),
      color:
        typeof team.color === "string" && team.color.trim()
          ? team.color.trim()
          : null,
    }))
    .filter((team) => team.id || team.name);
  if (!list.some(playerHasTeam)) return null;

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
    const members = takeMatching((player) => {
      const id = teamIdOf(player.teamId);
      if (team.id && id) return id === team.id;
      if (!team.id && team.name) {
        return !id && trimmedTeamName(player.teamName) === team.name;
      }
      return false;
    });
    if (!members.length) continue;
    groups.push({
      label: team.name || "Team",
      unassigned: false,
      color: team.color,
      players: members,
    });
  }

  const extras = new Map<string, PlayerTeamGroup>();
  const unassigned: OtherPlayer[] = [];
  for (const player of remaining) {
    const id = teamIdOf(player.teamId);
    const name = trimmedTeamName(player.teamName);
    if (!id && !name) {
      unassigned.push(player);
      continue;
    }
    const key = id ? `id:${id}` : `name:${name}`;
    const existing = extras.get(key);
    if (existing) {
      existing.players.push(player);
      continue;
    }
    extras.set(key, {
      label: name || "Team",
      unassigned: false,
      color: null,
      players: [player],
    });
  }
  groups.push(...extras.values());
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

export function playerSeatOrder(
  player: { order?: unknown } | null | undefined
): number {
  const order = Number(player?.order);
  return Number.isFinite(order) ? order : 0;
}

export function tablePlayersInSeatOrder(
  players: OtherPlayer[] | null | undefined
): OtherPlayer[] {
  return [...asRecordList<OtherPlayer>(players)].sort(
    (a, b) => playerSeatOrder(a) - playerSeatOrder(b)
  );
}

export function autoSelectGameId(search: string, mock: boolean): string {
  if (!mock) return "";
  try {
    return new URLSearchParams(search).get("game")?.trim() || "";
  } catch {
    return "";
  }
}
