import {
  attemptRemap,
  DiscordSDK,
  patchUrlMappings,
} from "@discord/embedded-app-sdk";
import {
  actionRequestUrl,
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
import {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  DEFAULT_ACTION_COUNT,
  GAME_CHANNEL_LINK_LABEL,
  actionDialogCopy,
  deckActionFromDataset,
  gameChannelUrl,
  parseActionCount,
  tryOpenExternalLink,
  visualActionBody,
  visualActionErrorMessage,
  type DeckActionKind,
} from "./visualActions";
import { enableCardDrag, type CardOffset } from "./drag";
import { isPickerFixture, isSnapshotFixture } from "./mockFixtures";
import { MockDiscordSDK } from "./mockSdk";
import { asCardList, createSnapshotLoader } from "./requestSeq";
import {
  asRecordList,
  autoSelectGameId,
  DEFAULT_CARD_BACK,
  deckActionsFor,
  deckCountLabel,
  groupPlayersByTeam,
  handCountLabel,
  initialsFromName,
  statusPlayerScoreLabel,
  statusPlayerSeatName,
  suitColorClass,
  suitGlyph,
  visibleDecks,
  type GameStatus,
  type OtherPlayer,
  type SnapshotDeck,
  type StatusHistory,
  type StatusPile,
  type StatusPlayer,
  type StatusTeam,
  type StatusToken,
} from "./tableLayout";
import "./style.css";

const snapshotLoader = createSnapshotLoader();
// patchUrlMappings only rewrites fetch/XHR/WebSocket, not <img src>.
let activeUrlMappings: ReturnType<typeof urlMappingsForApiHost> = [];
let activeSession: {
  config: EmbeddedConfig;
  accessToken: string;
  guildId: string;
  discordSdk?: {
    commands?: {
      openExternalLink?: (args: { url: string }) => Promise<unknown>;
    };
  };
} | null = null;
let actionDialogBound = false;
let actionInFlight = false;

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
    renderGameChannelLink(null, null);
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

function renderGameChannelLink(guildId: unknown, channelId: unknown) {
  const el = document.getElementById("game-channel-link");
  if (!el) return;
  const href = gameChannelUrl(guildId, channelId);
  if (!href) {
    el.replaceChildren();
    el.hidden = true;
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = GAME_CHANNEL_LINK_LABEL;
  anchor.addEventListener("click", (event) => {
    const openExternal = activeSession?.discordSdk?.commands?.openExternalLink;
    if (typeof openExternal !== "function") return;
    event.preventDefault();
    void tryOpenExternalLink(href, openExternal).then((status) => {
      if (status === "failed") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    });
  });
  el.replaceChildren(anchor);
  el.hidden = false;
}

function actionDialogElements() {
  return {
    dialog: document.getElementById("action-dialog") as HTMLDialogElement | null,
    title: document.getElementById("action-dialog-title"),
    label: document.getElementById("action-count-label"),
    input: document.getElementById("action-count") as HTMLInputElement | null,
    confirm: document.getElementById("action-confirm") as HTMLButtonElement | null,
    cancel: document.getElementById("action-cancel") as HTMLButtonElement | null,
    error: document.getElementById("action-dialog-error"),
    form: document.getElementById("action-form") as HTMLFormElement | null,
  };
}

function setActionDialogError(message: string | null) {
  const { error } = actionDialogElements();
  if (!error) return;
  const text = typeof message === "string" ? message.trim() : "";
  error.textContent = text;
  error.hidden = !text;
}

function closeActionDialog() {
  const { dialog, confirm } = actionDialogElements();
  if (confirm && !actionInFlight) confirm.disabled = false;
  setActionDialogError(null);
  dialog?.close?.();
}

function openActionDialog(kind: DeckActionKind, deckName: string) {
  if (actionInFlight) return;
  const els = actionDialogElements();
  if (!els.dialog || !els.input || !els.form) return;
  const copy = actionDialogCopy(kind);
  if (els.title) els.title.textContent = copy.title;
  if (els.label) els.label.textContent = copy.label;
  if (els.confirm) {
    els.confirm.textContent = copy.confirm;
    els.confirm.disabled = false;
  }
  els.dialog.dataset.action = kind;
  els.dialog.dataset.deckName = deckName;
  els.input.min = String(ACTION_COUNT_MIN);
  els.input.max = String(ACTION_COUNT_MAX);
  els.input.value = String(DEFAULT_ACTION_COUNT);
  setActionDialogError(null);
  if (typeof els.dialog.showModal === "function") {
    if (!els.dialog.open) els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
  els.input.focus();
  els.input.select?.();
}

async function submitDeckAction(kind: DeckActionKind, deckName: string, count: number) {
  const session = activeSession;
  if (!session) {
    setActionDialogError("Could not reach the game.");
    return;
  }
  if (actionInFlight) return;
  actionInFlight = true;
  const channelId = liveSelectedChannelId(session.config.channelId);
  const guildId = session.guildId || session.config.guildId;
  const { confirm } = actionDialogElements();
  if (confirm) confirm.disabled = true;
  setActionDialogError(null);
  try {
    const response = await fetch(
      actionRequestUrl(session.config.apiHost, window.location.protocol),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          visualActionBody({
            action: kind,
            deck: deckName,
            count,
            channelId,
            guildId,
            fixture: session.config.mock ? readFixture() : undefined,
          })
        ),
      }
    );
    let payload: GameSnapshot & { message?: string; error?: string } = {};
    try {
      payload = (await response.json()) as GameSnapshot & {
        message?: string;
        error?: string;
      };
    } catch {
      payload = {};
    }
    if (!response.ok) {
      setActionDialogError(
        visualActionErrorMessage(payload.error, payload.message)
      );
      return;
    }
    closeActionDialog();
    applySnapshot(session.config, payload);
  } catch {
    setActionDialogError("Could not run that action.");
  } finally {
    actionInFlight = false;
    const els = actionDialogElements();
    if (els.confirm && els.dialog?.open) els.confirm.disabled = false;
  }
}

function bindActionDialog() {
  if (actionDialogBound) return;
  const els = actionDialogElements();
  if (!els.form || !els.dialog) return;
  actionDialogBound = true;
  els.cancel?.addEventListener("click", () => {
    closeActionDialog();
  });
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (actionInFlight) return;
    const kind = String(els.dialog?.dataset.action || "") as DeckActionKind;
    const deckName = String(els.dialog?.dataset.deckName || "").trim();
    const count = parseActionCount(els.input?.value);
    if ((kind !== "deal" && kind !== "draw") || !deckName) {
      setActionDialogError("Could not run that action.");
      return;
    }
    if (count == null) {
      setActionDialogError(
        `Enter a number from ${ACTION_COUNT_MIN} to ${ACTION_COUNT_MAX}.`
      );
      return;
    }
    void submitDeckAction(kind, deckName, count);
  });
}

function onDeckActionButtonClick(event: Event) {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement | null;
  const parsed = deckActionFromDataset(target?.dataset);
  target?.blur?.();
  if (!parsed) return;
  openActionDialog(parsed.action, parsed.deckName);
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
      // No drop targets yet: enableCardDrag snaps back unless a later hook consumes the drop.
      enableCardDrag(tile, cardId, positions);
    }
    container.append(tile);
  }
}

function appendPlayerChip(
  config: EmbeddedConfig,
  parent: HTMLElement,
  player: OtherPlayer
) {
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
  parent.append(chip);
}

function renderOtherPlayers(
  config: EmbeddedConfig,
  players: OtherPlayer[] | undefined,
  teams?: StatusTeam[]
) {
  const row = document.getElementById("other-players");
  const list = document.getElementById("other-players-list");
  if (!row || !list) return;
  list.replaceChildren();
  const others = asRecordList<OtherPlayer>(players);
  if (!others.length) {
    list.classList.remove("has-teams");
    row.hidden = true;
    return;
  }
  const groups = groupPlayersByTeam(others, teams);
  if (!groups) {
    list.classList.remove("has-teams");
    for (const player of others) {
      appendPlayerChip(config, list, player);
    }
  } else {
    list.classList.add("has-teams");
    for (const group of groups) {
      const block = document.createElement("section");
      block.className = `player-team-group${group.unassigned ? " is-unassigned" : ""}`;
      if (group.color) {
        block.style.borderColor = group.color;
      }
      const label = document.createElement("h3");
      label.className = "player-team-label";
      label.textContent = group.label;
      const members = document.createElement("div");
      members.className = "player-team-members";
      for (const player of group.players) {
        appendPlayerChip(config, members, player);
      }
      block.append(label, members);
      list.append(block);
    }
  }
  row.hidden = false;
}

function renderDeckActions(deck: SnapshotDeck): HTMLDivElement {
  const actions = document.createElement("div");
  actions.className = "deck-actions";
  const deckName =
    typeof deck.name === "string" && deck.name.trim() ? deck.name.trim() : "Deck";
  for (const action of deckActionsFor(deck)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "deck-action";
    button.dataset.deckAction = action.id;
    button.dataset.deckName = deckName;
    button.textContent = action.label;
    button.addEventListener("click", onDeckActionButtonClick);
    actions.append(button);
  }
  return actions;
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
    tile.append(face, renderDeckActions(deck));
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
    for (const player of players) {
      const row = document.createElement("div");
      row.className = `status-player${player.isYou ? " is-you" : ""}`;
      if (player.color) {
        row.style.borderLeft = `4px solid ${player.color}`;
        row.style.paddingLeft = "0.45rem";
      }
      const name = document.createElement("div");
      name.className = "status-player-name";
      name.textContent = statusPlayerSeatName(player);
      const score = document.createElement("p");
      score.className = "status-player-score";
      score.textContent = statusPlayerScoreLabel(player);
      row.append(name, score);
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

  applySnapshot(config, payload);
}

function applySnapshot(config: EmbeddedConfig, payload: GameSnapshot) {
  setSnapshotStatus(null);
  const positions = new Map<string, CardOffset>();
  renderGameChannelLink(payload.guildId || config.guildId, payload.channelId);
  renderGameStatus(payload.status, payload.gameName || "");
  renderOtherPlayers(config, payload.otherPlayers, payload.status?.teams);
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
  bindActionDialog();

  // discordSdk.guildId is the SDK field (query param guild_id). The game
  // channel/thread id comes from the picker, not discordSdk.channelId.
  const guildId = String(discordSdk.guildId || config.guildId || "").trim();
  activeSession = { config, accessToken, guildId, discordSdk };
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
