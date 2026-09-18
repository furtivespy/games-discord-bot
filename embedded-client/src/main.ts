import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import "./style.css";

type EmbeddedConfig = {
  clientId: string;
  apiHost: string;
};

function readConfig(): EmbeddedConfig {
  const injected = window.__GAMEBOT_EMBEDDED_CONFIG__;
  return {
    clientId: injected?.clientId || import.meta.env.VITE_CLIENT_ID || "",
    apiHost:
      injected?.apiHost ||
      import.meta.env.VITE_API_HOST ||
      window.location.host,
  };
}

function setGreeting(text: string) {
  const el = document.getElementById("greeting");
  if (el) {
    el.textContent = text;
  }
}

function tokenUrl(apiHost: string): string {
  const protocol = window.location.protocol === "http:" ? "http:" : "https:";
  return `${protocol}//${apiHost}/api/token`;
}

async function bootstrap() {
  const config = readConfig();
  if (!config.clientId) {
    setGreeting("Missing Discord client id.");
    return;
  }
  if (!config.apiHost) {
    setGreeting("Missing public API host.");
    return;
  }

  // Discord sandboxes iframe fetch. Rewrite our public API host onto the
  // /.proxy/api prefix configured in the Developer Portal.
  patchUrlMappings([
    { prefix: "/.proxy/api", target: `${config.apiHost}/api` },
  ]);

  const discordSdk = new DiscordSDK(config.clientId);
  await Promise.race([
    discordSdk.ready(),
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("discord_sdk_ready_timeout")),
        10_000
      );
    }),
  ]);

  const { code } = await discordSdk.commands.authorize({
    client_id: config.clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  const response = await fetch(tokenUrl(config.apiHost), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
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

  const auth = await discordSdk.commands.authenticate({
    access_token: accessToken,
  });

  const displayName =
    payload.display_name ||
    auth?.user?.global_name ||
    auth?.user?.username;
  if (!displayName) {
    setGreeting("Hello");
    return;
  }
  setGreeting(`Hello, ${displayName}`);
}

bootstrap().catch(() => {
  setGreeting(
    "Open visual mode from Discord (App Launcher → Game Bot, or /visual)."
  );
});
