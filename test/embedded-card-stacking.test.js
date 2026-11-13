const { afterEach, describe, expect, test } = require("bun:test");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const DRAG_PATH = path.join(__dirname, "..", "embedded-client", "src", "drag.ts");

function chromeBin() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const bin of candidates) {
    const result = spawnSync("which", [bin], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  return "";
}

function namedTile(id, title) {
  return `<article class="card-tile" data-card-id="${id}" title="${title}"><div class="card-face named-card"><span class="card-name card-name-full">${title}</span></div></article>`;
}

function stackingHarness(css) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>${css}</style>
  </head>
  <body>
    <div id="app" class="connected">
      <aside id="side-panel"><p>status</p></aside>
      <div id="table">
        <section id="board-row" class="row board-row">
          <section class="zone" data-zone="board">
            <h2>Game Board</h2>
            <div class="cards board-spread" id="board-cards">
              ${namedTile("board-1", "Province")}
              ${namedTile("board-2", "Duchy")}
              ${namedTile("board-3", "Estate")}
            </div>
          </section>
          <section class="zone decks-zone" data-zone="decks">
            <h2>Decks</h2>
            <div id="decks" class="decks"></div>
          </section>
        </section>
        <section class="zone" data-zone="play-area">
          <h2>Play Area</h2>
          <div class="cards board-spread" id="play-area-cards">
            ${namedTile("play-1", "Village")}
            ${namedTile("play-2", "Market")}
          </div>
        </section>
        <section class="zone hand-zone" data-zone="hand">
          <h2>Hand</h2>
          <div class="cards hand-fan" id="hand-cards">
            ${namedTile("hand-1", "Copper")}
            ${namedTile("hand-2", "Queen of Diamonds")}
          </div>
        </section>
      </div>
    </div>
    <script type="module" src="/harness.js"></script>
  </body>
</html>`;
}

const HARNESS_JS = `
function center(el) {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function drag(tile, toX, toY) {
  const from = center(tile);
  const pointerId = 1;
  tile.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId,
    button: 0,
    clientX: from.x,
    clientY: from.y,
  }));
  document.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true,
    pointerId,
    clientX: toX,
    clientY: toY,
  }));
  document.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true,
    pointerId,
    clientX: toX,
    clientY: toY,
  }));
}

function frame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function report(body) {
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

try {
  const { enableCardDrag } = await import("/drag.js");
  const positions = new Map();
  for (const tile of document.querySelectorAll(".card-tile[data-card-id]")) {
    enableCardDrag(tile, tile.dataset.cardId, positions);
  }
  await frame();
  await frame();

  const province = document.querySelector('[data-card-id="board-1"]');
  const village = document.querySelector('[data-card-id="play-1"]');
  const market = document.querySelector('[data-card-id="play-2"]');
  const hand = document.getElementById("hand-cards");
  if (!province || !village || !market || !hand) {
    throw new Error("missing cards");
  }

  const villageCenter = center(village);
  drag(province, villageCenter.x, villageCenter.y);
  await frame();

  const marketFrom = center(market);
  const handBox = hand.getBoundingClientRect();
  drag(market, marketFrom.x, handBox.top + Math.min(40, handBox.height / 2));
  await frame();

  const provinceNow = center(province);
  const hitNode = document.elementFromPoint(provinceNow.x, provinceNow.y);
  const hit = hitNode?.closest?.(".card-tile") || hitNode;
  await report({
    hitTitle: hit?.title || hit?.textContent || null,
    hitId: hit?.dataset?.cardId || null,
    tag: hitNode?.tagName || null,
    provinceZ: province.style.zIndex,
    villageZ: village.style.zIndex,
    marketZ: market.style.zIndex,
    boardZoneZ: getComputedStyle(province.closest(".zone")).zIndex,
    playZoneZ: getComputedStyle(village.closest(".zone")).zIndex,
    x: provinceNow.x,
    y: provinceNow.y,
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

describe("dropped cards stay pickable across zones", () => {
  const chrome = chromeBin();
  let server;
  let chromeProc;
  let userDataDir;

  afterEach(() => {
    try {
      chromeProc?.kill("SIGKILL");
    } catch {}
    chromeProc = null;
    try {
      server?.stop(true);
    } catch {}
    server = null;
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      userDataDir = null;
    }
  });

  test.skipIf(!chrome)("QA 3-step: elementFromPoint at Province's center is Province after Market moves", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const built = await Bun.build({
      entrypoints: [DRAG_PATH],
      target: "browser",
      format: "esm",
    });
    expect(built.success).toBe(true);
    const dragJs = await built.outputs[0].text();

    let resolveResult;
    const resultPromise = new Promise((resolve) => {
      resolveResult = resolve;
    });

    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (req.method === "POST" && url.pathname === "/result") {
          resolveResult(await req.json());
          return new Response("ok");
        }
        if (url.pathname === "/drag.js") {
          return new Response(dragJs, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        if (url.pathname === "/harness.js") {
          return new Response(HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response(stackingHarness(css), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "card-stack-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--window-size=1280,800",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for Chrome stacking result")), 20000)
      ),
    ]);

    expect(result.error).toBeUndefined();
    expect(result.hitId).toBe("board-1");
    expect(result.hitTitle).toBe("Province");
    expect(Number(result.provinceZ)).toBeGreaterThan(Number(result.villageZ || 0));
    expect(result.boardZoneZ).toBe("auto");
    expect(result.playZoneZ).toBe("auto");
  }, 30000);
});
