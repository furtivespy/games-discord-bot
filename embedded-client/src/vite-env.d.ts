/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID?: string;
  readonly VITE_API_HOST?: string;
}

interface GameBotEmbeddedConfig {
  clientId?: string;
  apiHost?: string;
}

interface Window {
  __GAMEBOT_EMBEDDED_CONFIG__?: GameBotEmbeddedConfig;
}
