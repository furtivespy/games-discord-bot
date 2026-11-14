import {
  attemptRemap,
  DiscordSDK,
  patchUrlMappings,
} from "@discord/embedded-app-sdk";
import {
  cardImageRequestUrl,
  firstNonEmptyName,
  GAMES_EMPTY_MESSAGE,
  GAMES_ERROR_MESSAGE,
  GAMES_LOADING_MESSAGE,
  GAMES_SELECT_PLACEHOLDER,
  SNAPSHOT_LOADING_MESSAGE,
  gamesRequestUrl,
  helloGreeting,
  originLine,
  OUTSIDE_DISCORD_FALLBACK,
  snapshotRequestUrl,
  tokenRequestUrl,
  urlMappingsForApiHost,
} from "./handshake";
import { enableCardDrag, type CardOffset } from "./drag";
import { isPickerFixture, isSnapshotFixture } from "./mockFixtures";
import { MockDiscordSDK } from "./mockSdk";
import { asCardList, createSnapshotLoader } from "./requestSeq";
import {
  asRecordList,
  autoSelectGameId,
  DEFAULT_CARD_BACK,
  deckCountLabel,
  handCountLabel,
  initialsFromName,
  statusGameTitle,
  suitColorClass,
  suitGlyph,
  visibleDecks,
  type GameStatus,
  type OtherPlayer,
  type SnapshotDeck,
  type StatusHistory,
  type StatusPile,
  type StatusPlayer,
  type StatusToken,
} from "./tableLayout";
import "./style.css";

const snapshotLoader = createSnapshotLoader();
// patchUrlMappings only rewrites fetch/XHR/WebSocket, not <img src>.
let activeUrlMappings: ReturnType<typeof urlMappingsForApiHost> = [];

type EmbeddedConfig = {
  clientId: string;
  apiHost: string;
  mock: boolean;
  channelId: string;
  guildId: string;
};

type SnapshotCard = {
  id?: string;
  name?: string;
  imageUrl?: string;
  suit?: string;
  value?: string;
};

type GameSnapshot = {
  gameName?: string;
  channelId?: string;
  guildId?: string;
  hand?: SnapshotCard[];
  playArea?: SnapshotCard[];
  gameBoard?: SnapshotCard[];
  otherPlayers?: OtherPlayer[];
  decks?: SnapshotDeck[];
  status?: GameStatus;
  error?: string;
};

type PickerGame = {
  channelId?: string;
  channelName?: string;
};

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function readConfig(): EmbeddedConfig {
  const injected = window.__GAMEBOT_EMBEDDED_CONFIG__;
  const query = readSearchParams();
  const mock = injected?.mock === true;
  return {
    clientId:
      injected?.clientId ||
      import.meta.env.VITE_CLIENT_ID ||
      (mock ? "mock-client-id" : ""),
    apiHost: injected?.apiHost || import.meta.env.VITE_API_HOST || "",
    mock,
    channelId: query.get("channelId") || injected?.channelId || "",
    guildId: query.get("guildId") || injected?.guildId || "",
  };
}

function readFixture(): string {
  const raw = readSearchParams().get("fixture");
  if (raw == null || !String(raw).trim()) return "several-games";
  return String(raw).trim();
}

function setGreeting(text: string) {
  const el = document.getElementById("greeting");
  if (el) {
    el.textContent = text;
  }
}

function setConnected(connected: boolean) {
  document.getElementById("app")?.classList.toggle("connected", connected);
}

function setOrigin(text: string | null) {
  const el = document.getElementById("origin");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
    return;
  }
  el.textContent = "";
  el.hidden = true;
}

function setSnapshotStatus(text: string | null) {
  const el = document.getElementById("snapshot-status");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
    return;
  }
  el.textContent = "";
  el.hidden = true;
}

function setTableVisible(visible: boolean) {
  const table = document.getElementById("table");
  if (table) table.hidden = !visible;
  if (!visible) {
    const status = document.getElementById("game-status");
    if (status) {
      status.hidden = true;
      status.replaceChildren();
    }
    const others = document.getElementById("other-players");
    if (others) others.hidden = true;
  }
}

function setPickerVisible(visible: boolean) {
  const picker = document.getElementById("game-picker");
  if (picker) picker.hidden = !visible;
}

function setHidden(id: string, hidden: boolean) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

function setGamesStatus(text: string | null) {
  const el = document.getElementById("games-status");
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
    return;
  }
  el.textContent = "";
  el.hidden = true;
}

function liveSelectedChannelId(requestedChannelId: string): string {
  const select = document.getElementById("game-select") as HTMLSelectElement | null;
  if (!select || select.hidden) return requestedChannelId;
  return String(select.value || "").trim();
}

function cancelSnapshotLoad() {
  snapshotLoader.clear();
}

function showSelectedChannel(name: string | null) {
  const el = document.getElementById("selected-channel");
  if (!el) return;
  const text = typeof name === "string" ? name.trim() : "";
  if (!text) {
    el.textContent = "";
    el.hidden = true;
    return;
  }
  el.textContent = text;
  el.hidden = false;
}

function bindGameSelect(
  config: EmbeddedConfig,
  accessToken: string,
  guildId: string
) {
  const select = document.getElementById("game-select") as HTMLSelectElement | null;
  if (!select) return;
  select.onchange = () => {
    const selected = select.selectedOptions[0];
    const channelId = selected && selected.value ? selected.value : "";
    showSelectedChannel(channelId ? selected.textContent : null);
    if (!channelId) {
      cancelSnapshotLoad();
      setTableVisible(false);
      setSnapshotStatus(null);
      return;
    }
    // Picker option value is the game document key (thread id for thread games).
    // discordSdk.channelId is the Activity launch channel and is not this key.
    setTableVisible(false);
    setSnapshotStatus(SNAPSHOT_LOADING_MESSAGE);
    void loadSnapshot(config, accessToken, { channelId, guildId });
  };
}

function renderGameOptions(games: PickerGame[]) {
  const select = document.getElementById("game-select") as HTMLSelectElement | null;
  if (!select) return;
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = GAMES_SELECT_PLACEHOLDER;
  select.append(placeholder);
  for (const game of games) {
    const channelId = typeof game.channelId === "string" ? game.channelId.trim() : "";
    const channelName =
      typeof game.channelName === "string" && game.channelName.trim()
        ? game.channelName.trim()
        : channelId;
    if (!channelId) continue;
    const option = document.createElement("option");
    option.value = channelId;
    option.textContent = channelName;
    select.append(option);
  }
  select.value = "";
}

function showGamesEmpty() {
  const empty = document.getElementById("games-empty");
  if (empty) empty.textContent = GAMES_EMPTY_MESSAGE;
  setGamesStatus(null);
  setHidden("game-select-label", true);
  setHidden("game-select", true);
  setHidden("games-empty", false);
  showSelectedChannel(null);
  cancelSnapshotLoad();
  setTableVisible(false);
  setSnapshotStatus(null);
}

function showGamesList(
  games: PickerGame[],
  config: EmbeddedConfig,
  accessToken: string,
  guildId: string
) {
  setGamesStatus(null);
  setHidden("games-empty", true);
  setHidden("game-select-label", false);
  setHidden("game-select", false);
  renderGameOptions(games);
  bindGameSelect(config, accessToken, guildId);
  showSelectedChannel(null);
  const autoId = autoSelectGameId(window.location.search, config.mock);
  const select = document.getElementById("game-select") as HTMLSelectElement | null;
  if (!autoId || !select) return;
  const match = [...select.options].some((option) => option.value === autoId);
  if (!match) return;
  select.value = autoId;
  select.dispatchEvent(new Event("change"));
}

async function loadGames(
  config: EmbeddedConfig,
  accessToken: string,
  guildId: string
) {
  setPickerVisible(true);
  setHidden("game-select-label", true);
  setHidden("game-select", true);
  setHidden("games-empty", true);
  showSelectedChannel(null);
  setGamesStatus(GAMES_LOADING_MESSAGE);

  if (!guildId && !config.mock) {
    setGamesStatus(GAMES_ERROR_MESSAGE);
    return;
  }

  try {
    const response = await fetch(
      gamesRequestUrl(config.apiHost, window.location.protocol, {
        fixture: config.mock ? readFixture() : undefined,
        guildId,
      }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    let payload: { games?: PickerGame[]; error?: string } = {};
    try {
      payload = (await response.json()) as {
        games?: PickerGame[];
        error?: string;
      };
    } catch {
      payload = {};
    }

    if (!response.ok || !Array.isArray(payload.games)) {
      setGamesStatus(GAMES_ERROR_MESSAGE);
      return;
    }

    if (payload.games.length === 0) {
      showGamesEmpty();
      return;
    }
    showGamesList(payload.games, config, accessToken, guildId);
  } catch {
    setGamesStatus(GAMES_ERROR_MESSAGE);
  }
}

function cardImageSrc(config: EmbeddedConfig, imageUrl: unknown): string | null {
  const src = cardImageRequestUrl(config.apiHost, window.location.protocol, imageUrl);
  if (!src || !activeUrlMappings.length) return src;
  return attemptRemap({
    url: new URL(src, window.location.href),
    mappings: activeUrlMappings,
  }).toString();
}

function mappedImageSrc(config: EmbeddedConfig, imageUrl: unknown): string | null {
  const src = cardImageSrc(config, imageUrl);
  return src;
}

function renderCardFace(config: EmbeddedConfig, card: SnapshotCard): HTMLElement {
  const face = document.createElement("div");
  const nameValue = card.name;
  const name =
    typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : "Card";
  const imageSrc = mappedImageSrc(config, card.imageUrl);
  const glyph = suitGlyph(card.suit);
  const value =
    typeof card.value === "string" && card.value.trim() ? card.value.trim() : "";
  if (imageSrc) {
    face.className = "card-face has-art";
    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = name;
    img.draggable = false;
    face.append(img);
    const label = document.createElement("span");
    label.className = "card-name card-caption";
    label.textContent = name;
    face.append(label);
    return face;
  }
  if (glyph || value) {
    face.className = `card-face ${suitColorClass(glyph)}`.trim();
    const index = document.createElement("span");
    index.className = "card-index";
    index.textContent = value || "";
    const pip = document.createElement("span");
    pip.className = "card-pip";
    pip.textContent = glyph || "◆";
    const label = document.createElement("span");
    label.className = "card-name";
    label.textContent = name;
    face.append(index, pip, label);
    return face;
  }
  face.className = "card-face named-card";
  const label = document.createElement("span");
  label.className = "card-name card-name-full";
  label.textContent = name;
  face.append(label);
  return face;
}

function renderCards(
  config: EmbeddedConfig,
  containerId: string,
  cards: SnapshotCard[] | undefined,
  positions: Map<string, CardOffset>
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  for (const card of asCardList(cards) as SnapshotCard[]) {
    const tile = document.createElement("article");
    tile.className = "card-tile";
    const idValue = card.id;
    const cardId =
      typeof idValue === "string" && idValue.trim() ? idValue.trim() : "";
    if (cardId) tile.dataset.cardId = cardId;
    const nameValue = card.name;
    const name =
      typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : "Card";
    tile.title = name;
    tile.append(renderCardFace(config, card));
    if (cardId) {
      enableCardDrag(tile, cardId, positions);
    }
    container.append(tile);
  }
}

function renderOtherPlayers(config: EmbeddedConfig, players: OtherPlayer[] | undefined) {
  const row = document.getElementById("other-players");
  const list = document.getElementById("other-players-list");
  if (!row || !list) return;
  list.replaceChildren();
  const others = asRecordList<OtherPlayer>(players);
  if (!others.length) {
    row.hidden = true;
    return;
  }
  for (const player of others) {
    const chip = document.createElement("article");
    chip.className = "player-chip";
    const name =
      typeof player.name === "string" && player.name.trim()
        ? player.name.trim()
        : "Player";
    const avatarSrc = mappedImageSrc(config, player.avatarUrl);
    if (avatarSrc) {
      const img = document.createElement("img");
      img.className = "player-avatar";
      img.src = avatarSrc;
      img.alt = name;
      chip.append(img);
    } else {
      const initials = document.createElement("div");
      initials.className = "player-initials";
      initials.textContent = initialsFromName(name);
      chip.append(initials);
    }
    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.textContent = name;
    const countEl = document.createElement("div");
    countEl.className = "player-count";
    countEl.textContent = handCountLabel(player.handCount);
    chip.append(nameEl, countEl);
    list.append(chip);
  }
  row.hidden = false;
}

function renderDecks(config: EmbeddedConfig, decks: SnapshotDeck[] | undefined) {
  const container = document.getElementById("decks");
  if (!container) return;
  container.replaceChildren();
  for (const deck of visibleDecks(asRecordList<SnapshotDeck>(decks))) {
    const tile = document.createElement("article");
    tile.className = "deck-tile";
    const face = document.createElement("div");
    face.className = "card-face deck-face";
    const backSrc = mappedImageSrc(config, deck.backImageUrl) || DEFAULT_CARD_BACK;
    face.style.backgroundImage = `url("${backSrc}")`;
    const name = document.createElement("span");
    name.className = "deck-name";
    name.textContent =
      typeof deck.name === "string" && deck.name.trim() ? deck.name.trim() : "Deck";
    const count = document.createElement("span");
    count.className = "deck-count";
    count.textContent = deckCountLabel(deck.remaining, deck.total);
    face.append(name, count);
    tile.append(face);
    container.append(tile);
  }
}

function appendStatusLines(parent: HTMLElement, lines: string[]) {
  for (const line of lines) {
    if (!line) continue;
    const p = document.createElement("p");
    p.className = "status-line";
    p.textContent = line;
    parent.append(p);
  }
}

function renderGameStatus(status: GameStatus | undefined, fallbackName: string) {
  const root = document.getElementById("game-status");
  if (!root) return;
  root.replaceChildren();
  const data: GameStatus = status && typeof status === "object" ? status : {};
  if (!data.gameName && fallbackName) data.gameName = fallbackName;
  const title = document.createElement("h2");
  title.className = "status-title";
  title.textContent = statusGameTitle(data);
  root.append(title);
  if (data.reverseOrder) {
    const flag = document.createElement("p");
    flag.className = "status-flag";
    flag.textContent = "Turn order reversed";
    root.append(flag);
  }

  const players = asRecordList<StatusPlayer>(data.players);
  if (players.length) {
    const block = document.createElement("section");
    block.className = "status-block";
    const heading = document.createElement("h3");
    heading.textContent = "Players";
    block.append(heading);
    const tokenDefs = asRecordList<StatusToken>(data.tokens);
    for (const player of players) {
      const row = document.createElement("div");
      row.className = `status-player${player.isYou ? " is-you" : ""}`;
      if (player.color) {
        row.style.borderLeft = `4px solid ${player.color}`;
        row.style.paddingLeft = "0.45rem";
      }
      const name = document.createElement("div");
      name.className = "status-player-name";
      const seat = Number.isFinite(Number(player.order))
        ? `(${Number(player.order) + 1}) `
        : "";
      name.textContent = `${seat}${player.name || "Player"}`;
      const meta = document.createElement("p");
      meta.className = "status-player-meta";
      const bits = [`Score ${player.score || "—"}`];
      if (player.teamName) bits.push(player.teamName);
      bits.push(`Hand ${handCountLabel(player.handCount)}`);
      bits.push(`Play area ${player.playAreaCount ?? 0}`);
      const tokenBits = tokenDefs
        .map((token) => {
          const id = String(token.id || "");
          const value = player.tokens?.[id];
          if (value == null) return "";
          return `${token.name || id} ${value}`;
        })
        .filter(Boolean);
      if (tokenBits.length) bits.push(tokenBits.join(" · "));
      meta.textContent = bits.join(" · ");
      row.append(name, meta);
      block.append(row);
    }
    root.append(block);
  }

  const tokens = asRecordList<StatusToken>(data.tokens);
  if (tokens.length) {
    const block = document.createElement("section");
    block.className = "status-block";
    const heading = document.createElement("h3");
    heading.textContent = "Token supply";
    block.append(heading);
    appendStatusLines(
      block,
      tokens.map((token) => {
        const cap = token.cap == null ? "N/A" : String(token.cap);
        const available = token.available == null ? "∞" : token.available;
        return `${token.name}: Circulation ${token.circulation} · Cap ${cap} · Available ${available}`;
      })
    );
    root.append(block);
  }

  const piles = asRecordList<StatusPile>(data.globalPiles);
  if (piles.length) {
    const block = document.createElement("section");
    block.className = "status-block";
    const heading = document.createElement("h3");
    heading.textContent = "Card piles";
    block.append(heading);
    appendStatusLines(
      block,
      piles.map((pile) => {
        const secret = pile.isSecret ? "🔒 " : "";
        const top = pile.topCardName ? ` · Top: ${pile.topCardName}` : "";
        return `${secret}${pile.name}: ${pile.count ?? 0} cards${top}`;
      })
    );
    root.append(block);
  }

  const history = asRecordList<StatusHistory>(data.history);
  if (history.length) {
    const block = document.createElement("section");
    block.className = "status-block";
    const heading = document.createElement("h3");
    heading.textContent = "Recent actions";
    block.append(heading);
    const list = document.createElement("ul");
    list.className = "status-history";
    for (const entry of history) {
      const item = document.createElement("li");
      item.textContent = entry.summary || "";
      list.append(item);
    }
    block.append(list);
    root.append(block);
  }
  root.hidden = false;
}

function snapshotErrorMessage(error: string | undefined, status: number): string {
  if (error === "no_game" || status === 404) {
    return "No game for that channel.";
  }
  if (error === "not_a_player" || status === 403) {
    return "You're not a player in this game.";
  }
  return "Could not load the game snapshot.";
}

async function loadSnapshot(
  config: EmbeddedConfig,
  accessToken: string,
  ids: { channelId: string; guildId: string }
) {
  const outcome = await snapshotLoader.load(
    ids.channelId,
    async (signal) => {
      const response = await fetch(
        snapshotRequestUrl(config.apiHost, window.location.protocol, {
          fixture: config.mock ? readFixture() : undefined,
          channelId: ids.channelId,
          guildId: ids.guildId,
        }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        }
      );
      let payload: GameSnapshot = {};
      try {
        payload = (await response.json()) as GameSnapshot;
      } catch {
        payload = {};
      }
      return { ok: response.ok, status: response.status, payload };
    },
    () => liveSelectedChannelId(ids.channelId)
  );

  // Aborted or superseded requests must not render and must not show errors.
  if (
    outcome.status === "aborted" ||
    outcome.status === "stale" ||
    outcome.status === "cleared"
  ) {
    return;
  }

  if (outcome.status === "failed") {
    setTableVisible(false);
    setSnapshotStatus(snapshotErrorMessage(undefined, 0));
    return;
  }

  const payload = outcome.result.payload as GameSnapshot;
  if (liveSelectedChannelId(ids.channelId) !== ids.channelId) {
    return;
  }
  if (
    typeof payload.channelId === "string" &&
    payload.channelId.trim() &&
    payload.channelId !== ids.channelId
  ) {
    return;
  }

  if (outcome.status === "error") {
    setTableVisible(false);
    setSnapshotStatus(snapshotErrorMessage(payload.error, outcome.result.status));
    return;
  }

  setSnapshotStatus(null);
  const positions = new Map<string, CardOffset>();
  renderGameStatus(payload.status, payload.gameName || "");
  renderOtherPlayers(config, payload.otherPlayers);
  renderDecks(config, payload.decks);
  renderCards(config, "board-cards", payload.gameBoard, positions);
  renderCards(config, "play-area-cards", payload.playArea, positions);
  renderCards(config, "hand-cards", payload.hand, positions);
  setTableVisible(true);
}

function createSdk(config: EmbeddedConfig) {
  if (config.mock) {
    return new MockDiscordSDK(config.clientId, {
      channelId: config.channelId,
      guildId: config.guildId,
    });
  }
  return new DiscordSDK(config.clientId);
}

async function bootstrap() {
  const config = readConfig();
  if (!config.clientId) {
    setGreeting("Missing Discord client id.");
    return;
  }

  // 1. Construct the SDK before any authorize/token work.
  const discordSdk = createSdk(config);

  // 2. Wait for READY from the Discord client (or the mock shim).
  await Promise.race([
    discordSdk.ready(),
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("discord_sdk_ready_timeout")),
        10_000
      );
    }),
  ]);

  // 3. Authorize with identify only.
  const { code } = await discordSdk.commands.authorize({
    client_id: config.clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  // 4. POST /api/token through patchUrlMappings (not a raw cross-origin fetch).
  if (!config.mock) {
    const mappings = urlMappingsForApiHost(config.apiHost);
    if (mappings.length) {
      patchUrlMappings(mappings);
      activeUrlMappings = mappings;
    }
  }
  const response = await fetch(
    tokenRequestUrl(config.apiHost, window.location.protocol),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        channel_id: discordSdk.channelId || undefined,
      }),
    }
  );
  if (!response.ok) {
    setGreeting("Could not sign in to Discord.");
    return;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    display_name?: string | null;
    origin_channel_name?: string | null;
  };
  const accessToken = payload.access_token;
  if (!accessToken) {
    setGreeting("Could not sign in to Discord.");
    return;
  }

  // 5. Authenticate, then resolve the display name (SDK user, then server @me).
  const auth = await discordSdk.commands.authenticate({
    access_token: accessToken,
  });

  const displayName = firstNonEmptyName(
    auth?.user?.global_name,
    auth?.user?.username,
    payload.display_name
  );
  if (!displayName) {
    setGreeting("Could not read your Discord name.");
    return;
  }
  setGreeting(helloGreeting(displayName));
  setOrigin(originLine(payload.origin_channel_name));
  setConnected(true);

  // discordSdk.guildId is the SDK field (query param guild_id). The game
  // channel/thread id comes from the picker, not discordSdk.channelId.
  const guildId = String(discordSdk.guildId || config.guildId || "").trim();
  const fixture = readFixture();
  if (config.mock && isSnapshotFixture(fixture) && !isPickerFixture(fixture)) {
    await loadSnapshot(config, accessToken, {
      channelId: config.channelId,
      guildId: guildId || config.guildId,
    });
    return;
  }
  await loadGames(config, accessToken, guildId);
}

bootstrap().catch((error) => {
  const config = readConfig();
  setConnected(false);
  if (config.mock) {
    setGreeting("Could not start mock visual mode.");
    return;
  }
  const insideDiscord =
    typeof window !== "undefined" &&
    /\.discordsays\.com$/i.test(window.location.hostname);
  if (insideDiscord || error?.message === "discord_sdk_ready_timeout") {
    setGreeting("Could not sign in to Discord.");
    return;
  }
  setGreeting(OUTSIDE_DISCORD_FALLBACK);
});
