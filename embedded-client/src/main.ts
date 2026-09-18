import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import {
  firstNonEmptyName,
  tokenRequestUrl,
  urlMappingsForApiHost,
} from "./handshake";
import "./style.css";

type EmbeddedConfig = {
  clientId: string;
  apiHost: string;
};

function readConfig(): EmbeddedConfig {
  const injected = window.__GAMEBOT_EMBEDDED_CONFIG__;
  return {
    clientId: injected?.clientId || import.meta.env.VITE_CLIENT_ID || "",
    apiHost: injected?.apiHost || import.meta.env.VITE_API_HOST || "",
  };
}

function setGreeting(text: string) {
  const el = document.getElementById("greeting");
  if (el) {
    el.textContent = text;
  }
}

async function bootstrap() {
  const config = readConfig();
  if (!config.clientId) {
    setGreeting("Missing Discord client id.");
    return;
  }

  // 1. Construct the SDK before any authorize/token work.
  const discordSdk = new DiscordSDK(config.clientId);

  // 2. Wait for READY from the Discord client.
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
  const mappings = urlMappingsForApiHost(config.apiHost);
  if (mappings.length) {
    patchUrlMappings(mappings);
  }
  const response = await fetch(
    tokenRequestUrl(config.apiHost, window.location.protocol),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
  if (!response.ok) {
    setGreeting("Could not sign in to Discord.");
    return;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    display_name?: string | null;
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
  setGreeting(`Hello, ${displayName}`);
}

bootstrap().catch((error) => {
  const insideDiscord =
    typeof window !== "undefined" &&
    /\.discordsays\.com$/i.test(window.location.hostname);
  if (insideDiscord || error?.message === "discord_sdk_ready_timeout") {
    setGreeting("Could not sign in to Discord.");
    return;
  }
  setGreeting(
    "Open visual mode from Discord (App Launcher → Game Bot, or /visual)."
  );
});
