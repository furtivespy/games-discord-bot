import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import {
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
import {
  asCardList,
  createRequestSeq,
  shouldApplySnapshot,
} from "./requestSeq";
import "./style.css";

const snapshotRequests = createRequestSeq();
let snapshotAbort: AbortController | null = null;

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
  url?: string | null;
};

type GameSnapshot = {
  gameName?: string;
  channelId?: string;
  guildId?: string;
  hand?: SnapshotCard[];
  playArea?: SnapshotCard[];
  gameBoard?: SnapshotCard[];
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
  const main = document.querySelector("main");
  if (table) table.hidden = !visible;
  main?.classList.toggle("has-table", visible);
}

function setPickerVisible(visible: boolean) {
  const picker = document.getElementById("game-picker");
  const main = document.querySelector("main");
  if (picker) picker.hidden = !visible;
  main?.classList.toggle("has-picker", visible);
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
  snapshotAbort?.abort();
  snapshotAbort = null;
  snapshotRequests.invalidate();
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

function renderCards(
  containerId: string,
  cards: SnapshotCard[] | undefined,
  positions: Map<string, CardOffset>
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  for (const card of asCardList(cards)) {
    const tile = document.createElement("article");
    tile.className = "card-tile";
    const idValue = card.id;
    const cardId =
      typeof idValue === "string" && idValue.trim() ? idValue.trim() : "";
    if (cardId) tile.dataset.cardId = cardId;
    const nameValue = card.name;
    const name =
      typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : "Card";
    if (typeof card.url === "string" && card.url) {
      const img = document.createElement("img");
      img.src = card.url;
      img.alt = name;
      img.draggable = false;
      tile.append(img);
      const label = document.createElement("span");
      label.textContent = name;
      tile.append(label);
    } else {
      tile.textContent = name;
    }
    if (cardId) {
      enableCardDrag(tile, cardId, positions);
    }
    container.append(tile);
  }
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
  snapshotAbort?.abort();
  const controller = new AbortController();
  snapshotAbort = controller;
  const requestId = snapshotRequests.next();
  try {
    const response = await fetch(
      snapshotRequestUrl(config.apiHost, window.location.protocol, {
        fixture: config.mock ? readFixture() : undefined,
        channelId: ids.channelId,
        guildId: ids.guildId,
      }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      }
    );
    let payload: GameSnapshot = {};
    try {
      payload = (await response.json()) as GameSnapshot;
    } catch {
      payload = {};
    }

    const selectedChannelId = liveSelectedChannelId(ids.channelId);
    if (
      !shouldApplySnapshot({
        isCurrent: snapshotRequests.isCurrent(requestId),
        selectedChannelId,
        requestedChannelId: ids.channelId,
        payloadChannelId: payload.channelId,
      })
    ) {
      return;
    }

    if (!response.ok) {
      setTableVisible(false);
      setSnapshotStatus(snapshotErrorMessage(payload.error, response.status));
      return;
    }

    setSnapshotStatus(payload.gameName ? payload.gameName : null);
    const positions = new Map<string, CardOffset>();
    renderCards("hand-cards", payload.hand, positions);
    renderCards("play-area-cards", payload.playArea, positions);
    renderCards("board-cards", payload.gameBoard, positions);
    setTableVisible(true);
  } catch (err) {
    if (!snapshotRequests.isCurrent(requestId)) return;
    if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
      return;
    }
    setTableVisible(false);
    setSnapshotStatus(snapshotErrorMessage(undefined, 0));
  }
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
