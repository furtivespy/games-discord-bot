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

function workingChromeBin() {
  // GitHub's ubuntu runner may resolve a chromium stub that never paints, so
  // skip in CI. Locally, require `chrome --version` to succeed quickly.
  if (process.env.CI) return "";
  const bin = chromeBin();
  if (!bin) return "";
  try {
    const version = spawnSync(bin, ["--version"], {
      encoding: "utf8",
      timeout: 2500,
    });
    if (version.status !== 0) return "";
    const text = `${version.stdout || ""}${version.stderr || ""}`;
    if (!/Chrom(e|ium)/i.test(text)) return "";
    return bin;
  } catch {
    return "";
  }
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

function waitSnap(tile) {
  return new Promise((resolve) => {
    const done = () => resolve();
    tile.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 400);
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

  const provinceHome = center(province);
  const villageCenter = center(village);
  drag(province, villageCenter.x, villageCenter.y);
  await waitSnap(province);

  const marketFrom = center(market);
  const marketHome = { ...marketFrom };
  const handBox = hand.getBoundingClientRect();
  drag(market, marketFrom.x, handBox.top + Math.min(40, handBox.height / 2));
  await waitSnap(market);

  const provinceNow = center(province);
  const marketNow = center(market);
  const hitNode = document.elementFromPoint(provinceHome.x, provinceHome.y);
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
    provinceDx: Math.abs(provinceNow.x - provinceHome.x),
    provinceDy: Math.abs(provinceNow.y - provinceHome.y),
    marketDx: Math.abs(marketNow.x - marketHome.x),
    marketDy: Math.abs(marketNow.y - marketHome.y),
    provinceDragging: province.classList.contains("dragging"),
    provinceMoved: province.classList.contains("moved"),
    provinceSnapping: province.classList.contains("snapping"),
    provinceTransform: province.style.transform,
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

const REGRAB_HARNESS_JS = `
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
  const king = document.querySelector('[data-card-id="hand-2"]');
  if (!king) throw new Error("missing hand card");
  const from = center(king);
  drag(king, from.x, from.y - 200);
  await new Promise((resolve) => setTimeout(resolve, 90));
  const mid = king.getBoundingClientRect();
  const grab = { x: mid.left + mid.width / 2, y: mid.top + mid.height / 2 };
  king.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId: 2,
    button: 0,
    clientX: grab.x,
    clientY: grab.y,
  }));
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const after = king.getBoundingClientRect();
  await report({
    jumpX: Math.abs(after.left - mid.left),
    jumpY: Math.abs(after.top - mid.top),
    midTop: mid.top,
    afterTop: after.top,
    dragging: king.classList.contains("dragging"),
    snapping: king.classList.contains("snapping"),
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

describe("dropped cards snap back to their rest slot", () => {
  const chrome = workingChromeBin();
  let server;
  let chromeProc;
  let userDataDir;

  test("table isolates cards; zones do not set z-index", () => {
    const css = fs
      .readFileSync(STYLE_PATH, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const table = css.match(/#table\s*\{([^}]+)\}/);
    const zone = css.match(/\.zone\s*\{([^}]+)\}/);
    expect(table).toBeTruthy();
    expect(zone).toBeTruthy();
    expect(table[1]).toMatch(/isolation:\s*isolate/);
    expect(zone[1]).not.toMatch(/z-index\s*:/);
    expect(zone[1]).not.toMatch(/transform\s*:/);
  });

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

  test.skipIf(!chrome)("QA: dropping Province and Market snaps each card home without leftover drag styling", async () => {
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
        "--no-first-run",
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
    expect(result.provinceDx).toBeLessThan(2);
    expect(result.provinceDy).toBeLessThan(2);
    expect(result.marketDx).toBeLessThan(2);
    expect(result.marketDy).toBeLessThan(2);
    expect(result.provinceDragging).toBe(false);
    expect(result.provinceMoved).toBe(false);
    expect(result.provinceSnapping).toBe(false);
    expect(result.provinceTransform === "" || result.provinceTransform === "none").toBe(true);
    expect(result.boardZoneZ).toBe("auto");
    expect(result.playZoneZ).toBe("auto");
  }, 30000);

  test.skipIf(!chrome)("QA: re-grabbing mid-snap keeps the card under the pointer", async () => {
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
          return new Response(REGRAB_HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response(stackingHarness(css), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "card-regrab-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-first-run",
        "--window-size=1280,800",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for Chrome re-grab result")), 20000)
      ),
    ]);

    expect(result.error).toBeUndefined();
    expect(result.dragging).toBe(true);
    expect(result.snapping).toBe(false);
    expect(result.jumpX).toBeLessThan(8);
    expect(result.jumpY).toBeLessThan(8);
  }, 30000);
});

const PIN_HARNESS_JS = `
async function report(body) {
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

try {
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const table = document.getElementById("table");
  const hand = document.querySelector(".hand-zone");
  const play = document.querySelector('[data-zone="play-area"]');
  const tableBox = table.getBoundingClientRect();
  const handBox = hand.getBoundingClientRect();
  const playBox = play.getBoundingClientRect();
  await report({
    viewportHeight: window.innerHeight,
    tableHeight: tableBox.height,
    tableBottom: tableBox.bottom,
    handTop: handBox.top,
    handBottom: handBox.bottom,
    playBottom: playBox.bottom,
    gapBelowHand: tableBox.bottom - handBox.bottom,
    spaceAboveHand: handBox.top - playBox.bottom,
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

describe("hand zone stays at the bottom of the table", () => {
  const chrome = workingChromeBin();
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

  test.skipIf(!chrome)("QA: hand sits on the table bottom with slack above it", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");

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
        if (url.pathname === "/harness.js") {
          return new Response(PIN_HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response(stackingHarness(css), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hand-pin-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-first-run",
        "--window-size=1280,800",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for Chrome hand-pin result")), 20000)
      ),
    ]);

    expect(result.error).toBeUndefined();
    expect(result.tableHeight).toBeGreaterThan(result.viewportHeight - 2);
    expect(result.tableBottom).toBeLessThanOrEqual(result.viewportHeight + 1);
    expect(result.handBottom).toBeGreaterThan(result.playBottom);
    expect(result.handBottom).toBeLessThanOrEqual(result.viewportHeight);
    expect(result.handBottom).toBeGreaterThan(result.viewportHeight - 32);
    expect(result.gapBelowHand).toBeGreaterThanOrEqual(0);
    expect(result.gapBelowHand).toBeLessThan(24);
    expect(result.spaceAboveHand).toBeGreaterThan(80);
  }, 30000);
});
