# Embedded visual-mode client

Vite app served by `modules/embeddedApp.js` as the Discord Activity. In Discord it uses `@discord/embedded-app-sdk`. Outside Discord, a **gated mock mode** renders the same UI for QA screenshots.

# Visual mode mock (screenshots outside Discord)

QA and coding agents can render the embedded game UI in a normal or headless browser. This does **not** fake Discord’s Activity iframe or postMessage protocol. It swaps in a thin SDK shim (`ready` / `authorize` / `authenticate`, plus `channelId` / `guildId`) and fixture HTTP responses.

Leave `EMBEDDED_APP_MOCK` unset in production. The Docker image sets `NODE_ENV=production`, and mock mode is ignored whenever that is set — even if the env var is `1`.

## Start mock mode

Build the client once, then serve it from the bot’s embedded-app origin:

```bash
cd embedded-client
bun install
bun run build
cd ..

EMBEDDED_APP_MOCK=1 bun scripts/embedded-app-mock.js
```

Or the npm script:

```bash
bun run build:client
bun run embedded:mock
```

The bot serves the last build in `embedded-client/dist`, which is gitignored and is not rebuilt by `npm start`. After pulling or switching branches that change `embedded-client/src`, use `npm run build-start` to rebuild the client and start the bot.

Open:

| State | URL |
| -- | -- |
| Several games (newest first; default) | http://127.0.0.1:3000/ or `?fixture=several-games` or `?fixture=populated` |
| Single game | http://127.0.0.1:3000/?fixture=one-game |
| No games (empty picker) | http://127.0.0.1:3000/?fixture=no-games |
| Snapshot: no game in this channel | http://127.0.0.1:3000/?fixture=no-game |
| Snapshot: not a player | http://127.0.0.1:3000/?fixture=not-a-player |

The default mock URL and `?fixture=populated` are picker-only until you choose a game. Selecting a game loads that game’s hand, play area, and board (`GET /api/game/snapshot?channelId=<selected>&guildId=<sdk guild id>`). Snapshot URLs `no-game` and `not-a-player` skip the picker and show those errors. `/api/games?fixture=no-game` and `?fixture=not-a-player` return `{ games: [] }` so they stay consistent with `no-games`.

With mock **disabled**, the existing outside-Discord fallback still tells you to open visual mode from Discord.

You can also set `EMBEDDED_APP_MOCK=1` on the full bot process (`bun DiscordBot.js`). The standalone script is enough for screenshots and does not need a Discord token.

## Point the shim at a locally seeded game

Channel and guild IDs on the shim are configurable so they can match a game you seeded locally. The snapshot still uses the **picker-selected** channel/thread id as the game document key (`getGameDataV2(guildId, 'game', channelId)`), not the Activity launch channel:

```bash
EMBEDDED_APP_MOCK=1 \
EMBEDDED_APP_MOCK_CHANNEL_ID=123456789012345678 \
EMBEDDED_APP_MOCK_GUILD_ID=545109131330191371 \
bun scripts/embedded-app-mock.js
```

Override per request with query params:

`http://127.0.0.1:3000/?fixture=populated&channelId=123&guildId=456`

Optional: `EMBEDDED_APP_MOCK_CHANNEL_NAME` changes the `from …` origin line (default `Mock Table`). Set it empty to hide that line.

`PORT` (default `3000`) selects the listen port.

## Capture screenshots

### Headless Chrome

After the mock server is running:

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --virtual-time-budget=8000 \
  --screenshot=mock-populated.png \
  "http://127.0.0.1:3000/?fixture=populated"
```

Or capture the three fixture states (starts the mock server if `EMBEDDED_MOCK_URL` is unset):

```bash
bun scripts/screenshot-embedded-mock.js tmp/embedded-mock-screenshots
```

### Playwright

Same pattern as other QA harnesses. From a checkout with the mock server already listening:

```bash
npx --yes playwright@1.49.0 install chromium
npx --yes playwright@1.49.0 screenshot \
  --wait-for-timeout=3000 \
  --viewport-size=1280,800 \
  "http://127.0.0.1:3000/?fixture=populated" mock-populated.png
```

Or a small script:

```js
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:3000/?fixture=populated", {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: "mock-populated.png", fullPage: true });
  await browser.close();
})();
```

Attach the PNG to the PR. Visual-mode tickets should include mock-mode screenshots of the states they changed.

A public host or tunnel is optional and not required for QA screenshots.
