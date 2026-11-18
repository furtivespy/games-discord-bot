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

const ROOT_FONT_PX = 16;
const OLD_REST_HEIGHT_PX = 7.55 * ROOT_FONT_PX;
const REST_WIDTH_PX = 7.992 * ROOT_FONT_PX;
const REST_HEIGHT_PX = 11.174 * ROOT_FONT_PX;

function pairOverlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (x <= 0 || y <= 0) return { x: 0, y: 0 };
  return { x, y };
}

function maxIntersectingOverlapY(groupA = [], groupB = []) {
  let maxY = 0;
  for (const a of groupA) {
    for (const b of groupB) {
      const overlap = pairOverlap(a, b);
      if (overlap.x > 0 && overlap.y > 0) maxY = Math.max(maxY, overlap.y);
    }
  }
  return maxY;
}

function lowestBottom(boxes = []) {
  return boxes.reduce((max, box) => Math.max(max, box.bottom), Number.NEGATIVE_INFINITY);
}

function highestTop(boxes = []) {
  return boxes.reduce((min, box) => Math.min(min, box.top), Number.POSITIVE_INFINITY);
}

function clipRect(box, clip) {
  if (!box || !clip) return null;
  const left = Math.max(box.left, clip.left);
  const top = Math.max(box.top, clip.top);
  const right = Math.min(box.right, clip.right);
  const bottom = Math.min(box.bottom, clip.bottom);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function clipRects(boxes = [], clip) {
  return boxes.map((box) => clipRect(box, clip)).filter(Boolean);
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
        <div id="table-main">
          <section id="board-row" class="row board-row">
            <section class="zone" data-zone="board">
              <h2>Game Board</h2>
              <div class="cards board-spread" id="board-cards">
                ${namedTile("board-1", "Province")}
                ${namedTile("board-2", "Duchy")}
                ${namedTile("board-3", "Estate")}
              </div>
            </section>
            <div id="pile-stack" class="pile-stack is-single">
              <div class="pile-windows">
                <section class="zone decks-zone" data-zone="decks">
                  <h2>Decks</h2>
                  <div id="decks" class="decks"></div>
                </section>
                <section class="zone discards-zone" data-zone="discards">
                  <h2>Discard</h2>
                  <div id="discards" class="decks"></div>
                </section>
              </div>
            </div>
            <section class="zone" data-zone="play-area">
              <h2>Play Area</h2>
              <div class="cards board-spread" id="play-area-cards">
                ${namedTile("play-1", "Village")}
                ${namedTile("play-2", "Market")}
              </div>
            </section>
          </section>
        </div>
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

function populatedTableHarness(css, { boardCount = 3, handCount = 5 } = {}) {
  const deck = (name, count) =>
    `<article class="deck-tile" title="${name}"><div class="card-face deck-face"><span class="deck-name pile-label">${name}</span><span class="deck-count pile-label">${count}</span></div></article>`;
  const discard = (name, count) =>
    `<article class="deck-tile discard-tile" title="${name} discard"><div class="card-face deck-face discard-face"><div class="discard-overlay"><span class="discard-title pile-label">Discard</span><span class="discard-count pile-label">${count}</span></div></div></article>`;
  const player = (initials, name, count) =>
    `<div class="player-chip"><div class="player-initials">${initials}</div><span class="player-name">${name}</span><span class="player-count">${count}</span></div>`;
  const boardNames = [
    "Province",
    "Duchy",
    "Estate",
    "Gold",
    "Silver",
    "Copper",
    "Village",
    "Smithy",
    "Market",
    "Festival",
    "Laboratory",
  ];
  const boardTiles = boardNames
    .slice(0, boardCount)
    .map((name, index) => namedTile(`board-${index + 1}`, name))
    .join("");
  const defaultHands = [
    ["hand-1", "Copper"],
    ["hand-2", "Queen of Diamonds"],
    ["hand-3", "Jack of Clubs"],
    ["hand-4", "10 of Spades"],
    ["hand-5", "Ace of Hearts"],
  ];
  const handTiles = Array.from({ length: handCount }, (_, index) => {
    const preset = defaultHands[index];
    return preset
      ? namedTile(preset[0], preset[1])
      : namedTile(`hand-${index + 1}`, `Hand ${index + 1}`);
  }).join("");
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
        <div id="table-main">
          <section id="other-players" class="row players-row">
            <h2>Players</h2>
            <div id="other-players-list" class="players-rail">
              ${player("R", "Riley", "1 card")}
              ${player("S", "Sam", "4 cards")}
            </div>
          </section>
          <section id="board-row" class="row board-row">
            <section class="zone" data-zone="board">
              <h2>Game Board</h2>
              <div class="cards board-spread" id="board-cards">
                ${boardTiles}
              </div>
            </section>
            <div id="pile-stack" class="pile-stack is-pair">
              <button type="button" class="deck-nav" aria-label="Previous decks">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <div class="pile-windows">
                <section class="zone decks-zone" data-zone="decks">
                  <h2>Decks</h2>
                  <div id="decks" class="decks">${deck("Main", "30/42")}${deck("Events", "8/15")}</div>
                </section>
                <section class="zone discards-zone" data-zone="discards">
                  <h2>Discard</h2>
                  <div id="discards" class="decks">${discard("Main", "4 cards")}${discard("Events", "1 card")}</div>
                </section>
              </div>
              <button type="button" class="deck-nav" aria-label="Next decks">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </div>
            <section class="zone" data-zone="play-area">
              <h2>Play Area</h2>
              <div class="cards board-spread" id="play-area-cards">
                ${namedTile("play-1", "Village")}
                ${namedTile("play-2", "Market")}
              </div>
            </section>
          </section>
        </div>
        <section class="zone hand-zone" data-zone="hand">
          <h2>Hand</h2>
          <div class="cards hand-fan" id="hand-cards">
            ${handTiles}
          </div>
        </section>
      </div>
    </div>
    <script type="module" src="/harness.js"></script>
  </body>
</html>`;
}

const PIN_HARNESS_JS = `
async function report(body) {
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function frame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function rect(el) {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return {
    top: box.top,
    right: box.right,
    bottom: box.bottom,
    left: box.left,
    width: box.width,
    height: box.height,
  };
}

function rects(selector) {
  return [...document.querySelectorAll(selector)].map(rect);
}

try {
  await frame();
  const table = document.getElementById("table");
  const main = document.getElementById("table-main");
  const hand = document.querySelector(".hand-zone");
  const play = document.querySelector('[data-zone="play-area"]');
  const tile = document.querySelector(".card-tile");
  const face = tile && tile.querySelector(".card-face");
  const tableBox = table.getBoundingClientRect();
  const mainBox = main.getBoundingClientRect();
  const handBox = hand.getBoundingClientRect();
  const playBox = play.getBoundingClientRect();
  const rest = face.getBoundingClientRect();
  const pile = document.getElementById("pile-stack");
  const pileBox = pile.getBoundingClientRect();
  const root = getComputedStyle(document.documentElement);
  const mainOverflow = main.scrollHeight > main.clientHeight + 1;
  const boardCards = rects("#board-cards .card-tile");
  const playCards = rects("#play-area-cards .card-tile");
  const handCards = rects("#hand-cards .card-tile");
  const deckTiles = rects(".deck-tile");
  const handOverlaps =
    handCards.length < 2 || handCards[1].left < handCards[0].right - 8;
  const handLeft = handCards.length ? Math.min(...handCards.map((box) => box.left)) : tableBox.left;
  const handRight = handCards.length ? Math.max(...handCards.map((box) => box.right)) : tableBox.right;
  const sheet = document.styleSheets[0];
  sheet.insertRule(
    ".card-tile.measure-zoom .card-face { transform: translateY(-38px) scale(var(--card-hover-scale)); transition: none; }",
    sheet.cssRules.length
  );
  tile.classList.add("measure-zoom");
  await frame();
  await frame();
  const zoomed = face.getBoundingClientRect();
  await report({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    tableHeight: tableBox.height,
    tableBottom: tableBox.bottom,
    tableTop: tableBox.top,
    mainTop: mainBox.top,
    mainBottom: mainBox.bottom,
    mainScrollHeight: main.scrollHeight,
    mainClientHeight: main.clientHeight,
    mainOverflow,
    overflowY: getComputedStyle(main).overflowY,
    tableOverflowY: getComputedStyle(table).overflowY,
    handTop: handBox.top,
    handBottom: handBox.bottom,
    playBottom: playBox.bottom,
    playLeft: playBox.left,
    playRight: playBox.right,
    playTop: playBox.top,
    pileLeft: pileBox.left,
    pileRight: pileBox.right,
    pileTop: pileBox.top,
    pileWidth: pileBox.width,
    gapBelowHand: tableBox.bottom - handBox.bottom,
    spaceAboveHand: handBox.top - playBox.bottom,
    handOverlaps,
    handFitsTable: handLeft >= tableBox.left - 24 && handRight <= tableBox.right + 24,
    boardCards,
    playCards,
    handCards,
    deckTiles,
    cardWidth: rest.width,
    cardHeight: rest.height,
    zoomWidth: zoomed.width,
    zoomHeight: zoomed.height,
    hoverScale: Number.parseFloat(root.getPropertyValue("--card-hover-scale")),
    cssCardWidth: root.getPropertyValue("--card-width").trim(),
    cssCardHeight: root.getPropertyValue("--card-height").trim(),
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

describe("narrow pile layout CSS", () => {
  test("820px board-row keeps play area left of the pile stack", () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const start = css.indexOf("@media (max-width: 820px)");
    expect(start).toBeGreaterThan(-1);
    const narrow = css.slice(start, css.indexOf(".card-inspect-dialog", start));
    expect(narrow).toMatch(
      /\.board-row\s*>\s*\[data-zone="play-area"\]\s*\{[^}]*grid-column:\s*1/
    );
    expect(narrow).toMatch(
      /\.board-row\s*>\s*\.pile-stack\s*\{[^}]*grid-column:\s*2/
    );
    expect(narrow).not.toContain("grid-column: auto");
  });
});

describe("visual-mode tile overlap math", () => {
  test("detects board/play/hand tile collisions without Chrome", () => {
    const board = [{ top: 100, right: 200, bottom: 280, left: 40 }];
    const play = [{ top: 227, right: 180, bottom: 400, left: 50 }];
    const clearPlay = [{ top: 280, right: 180, bottom: 400, left: 50 }];
    const hand = [{ top: 410, right: 300, bottom: 590, left: 80 }];

    expect(maxIntersectingOverlapY(board, play)).toBeCloseTo(53, 0);
    expect(maxIntersectingOverlapY(board, clearPlay)).toBe(0);
    expect(maxIntersectingOverlapY(play, hand)).toBe(0);
    expect(lowestBottom(board)).toBe(280);
    expect(highestTop(clearPlay)).toBe(280);
    expect(lowestBottom(board)).toBeLessThanOrEqual(highestTop(clearPlay));
  });
});

describe("hand zone stays at the bottom of the table", () => {
  const chrome = workingChromeBin();
  let server;
  let chromeProc;
  let userDataDir;

  function cleanupLayoutRun() {
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
  }

  afterEach(() => {
    cleanupLayoutRun();
  });

  async function measureLayout(html, { width, height }) {
    cleanupLayoutRun();
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
        return new Response(html, {
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
        `--window-size=${width},${height}`,
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    return Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for Chrome hand-pin result")), 20000)
      ),
    ]);
  }

  function expectRestSize(result, label) {
    expect({ label, cssCardWidth: result.cssCardWidth }).toEqual({
      label,
      cssCardWidth: "7.992rem",
    });
    expect(result.cssCardHeight).toBe("11.174rem");
    expect(result.hoverScale).toBeCloseTo(1.48, 2);
    expect(result.cardWidth).toBeGreaterThan(REST_WIDTH_PX - 4);
    expect(result.cardWidth).toBeLessThan(REST_WIDTH_PX + 4);
    expect(result.cardHeight).toBeGreaterThan(REST_HEIGHT_PX - 4);
    expect(result.cardHeight).toBeLessThan(REST_HEIGHT_PX + 4);
    expect(result.cardHeight).toBeGreaterThan(OLD_REST_HEIGHT_PX);
    expect(result.zoomWidth / result.cardWidth).toBeCloseTo(1.48, 1);
    expect(result.zoomHeight / result.cardHeight).toBeCloseTo(1.48, 1);
  }

  function expectNoTileOverlap(result, label) {
    const mainClip = {
      left: Number.NEGATIVE_INFINITY,
      right: Number.POSITIVE_INFINITY,
      top: result.mainTop,
      bottom: result.mainBottom,
    };
    const visibleBoard = clipRects(result.boardCards, mainClip);
    const visiblePlay = clipRects(result.playCards, mainClip);
    const visibleDecks = clipRects(result.deckTiles, mainClip);
    const boardPlay = maxIntersectingOverlapY(result.boardCards, result.playCards);
    const playHand = maxIntersectingOverlapY(visiblePlay, result.handCards);
    const boardHand = maxIntersectingOverlapY(visibleBoard, result.handCards);
    const deckPlay = maxIntersectingOverlapY(result.deckTiles, result.playCards);
    const deckHand = maxIntersectingOverlapY(visibleDecks, result.handCards);
    expect({
      label,
      boardPlayClear: boardPlay <= 1,
      playHandClear: playHand <= 1,
      boardHandClear: boardHand <= 1,
      deckPlayClear: deckPlay <= 1,
      deckHandClear: deckHand <= 1,
      boardPlay,
      playHand,
      boardHand,
      deckPlay,
      deckHand,
    }).toEqual({
      label,
      boardPlayClear: true,
      playHandClear: true,
      boardHandClear: true,
      deckPlayClear: true,
      deckHandClear: true,
      boardPlay,
      playHand,
      boardHand,
      deckPlay,
      deckHand,
    });
    expect(lowestBottom(result.boardCards)).toBeLessThanOrEqual(
      highestTop(result.playCards) + 1
    );
    if (visiblePlay.length && result.handCards.length) {
      expect(lowestBottom(visiblePlay)).toBeLessThanOrEqual(
        highestTop(result.handCards) + 1
      );
    }
  }

  function expectHandPinned(result, label) {
    expect({
      label,
      error: result.error,
      tableOverflowY: result.tableOverflowY,
      mainOverflowY: result.overflowY,
      handOnScreen: result.handTop >= 0 && result.handBottom <= result.viewportHeight + 1,
      handAtTableBottom: result.handBottom <= result.tableBottom + 1,
      gapOk: result.gapBelowHand >= 0 && result.gapBelowHand < 24,
    }).toEqual({
      label,
      error: undefined,
      tableOverflowY: "hidden",
      mainOverflowY: "auto",
      handOnScreen: true,
      handAtTableBottom: true,
      gapOk: true,
    });
    expect(result.handBottom).toBeGreaterThan(result.viewportHeight - 32);
    expect(result.handTop).toBeGreaterThan(result.tableTop);
    expect(result.handTop).toBeGreaterThanOrEqual(result.mainBottom - 1);
  }

  test.skipIf(!chrome)("QA: hand sits on the table bottom with slack above it", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    // Headless Chrome's innerHeight is ~143px below --window-size. 1000
    // outer is a true ~800px desktop viewport; 800 outer yields ~657 inner,
    // which cannot fit two card rows plus the pinned hand.
    const result = await measureLayout(stackingHarness(css), {
      width: 1280,
      height: 1000,
    });

    expect(result.error).toBeUndefined();
    expect(result.viewportHeight).toBeGreaterThanOrEqual(800);
    expect(result.tableHeight).toBeGreaterThan(result.viewportHeight - 2);
    expect(result.tableBottom).toBeLessThanOrEqual(result.viewportHeight + 1);
    expect(result.handBottom).toBeGreaterThan(result.playBottom);
    expect(result.handBottom).toBeLessThanOrEqual(result.viewportHeight);
    expect(result.handBottom).toBeGreaterThan(result.viewportHeight - 32);
    expect(result.gapBelowHand).toBeGreaterThanOrEqual(0);
    expect(result.gapBelowHand).toBeLessThan(24);
    expect(result.spaceAboveHand).toBeGreaterThan(result.gapBelowHand);
    expect(result.spaceAboveHand).toBeGreaterThan(8);
    expect(result.mainOverflow).toBe(false);
    expectHandPinned(result, "1280x800-pin");
  }, 30000);

  test.skipIf(!chrome)("QA: at 820px play area stays left of the discard stack", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const result = await measureLayout(populatedTableHarness(css), {
      width: 820,
      height: 800,
    });

    expect(result.error).toBeUndefined();
    expect(result.playLeft).toBeLessThan(result.pileLeft);
    expect(result.playRight).toBeLessThanOrEqual(result.pileLeft + 8);
    expect(result.playTop).toBeLessThan(result.pileTop + 48);
    expect(result.playTop).toBeGreaterThan(result.pileTop - 48);
  }, 30000);

  const overflowViewports = [
    { width: 1280, height: 800 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ];

  test.skipIf(!chrome)("QA: resting tiles keep hover-zoom size without overlapping", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const html = populatedTableHarness(css);

    for (const viewport of overflowViewports) {
      const result = await measureLayout(html, viewport);
      const label = `${viewport.width}x${viewport.height}`;
      expect({ label, error: result.error }).toEqual({ label, error: undefined });
      expectRestSize(result, label);
      expectNoTileOverlap(result, label);
      expectHandPinned(result, label);
      expect(result.handOverlaps).toBe(true);
      expect(result.handFitsTable).toBe(true);
      if (result.mainOverflow) {
        expect(result.mainScrollHeight).toBeGreaterThan(result.mainClientHeight + 1);
      } else {
        expect(result.spaceAboveHand).toBeGreaterThan(8);
      }
    }
  }, 120000);

  test.skipIf(!chrome)("QA: eleven board cards at 1024x768 do not collide with play or hand", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const result = await measureLayout(populatedTableHarness(css, { boardCount: 11 }), {
      width: 1024,
      height: 768,
    });

    expect(result.error).toBeUndefined();
    expect(result.boardCards).toHaveLength(11);
    expectRestSize(result, "1024x768x11");
    expectNoTileOverlap(result, "1024x768x11");
    expectHandPinned(result, "1024x768x11");
    expect(result.mainOverflow).toBe(true);
  }, 30000);

  test.skipIf(!chrome)("QA: ten hand cards at 1024x768 keep rest width", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const result = await measureLayout(populatedTableHarness(css, { handCount: 10 }), {
      width: 1024,
      height: 768,
    });

    expect(result.error).toBeUndefined();
    expect(result.handCards).toHaveLength(10);
    expectRestSize(result, "1024x768x10hand");
    expectHandPinned(result, "1024x768x10hand");
    for (const card of result.handCards) {
      expect(card.width).toBeGreaterThan(REST_WIDTH_PX - 4);
      expect(card.width).toBeLessThan(REST_WIDTH_PX + 4);
      expect(card.height).toBeGreaterThan(REST_HEIGHT_PX - 4);
      expect(card.height).toBeLessThan(REST_HEIGHT_PX + 4);
    }
  }, 30000);

  test.skipIf(!chrome)("QA: 6 board and 7 hand at 1280x800 keep the hand on screen", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const result = await measureLayout(
      populatedTableHarness(css, { boardCount: 6, handCount: 7 }),
      { width: 1280, height: 800 }
    );

    expect(result.error).toBeUndefined();
    expect(result.boardCards).toHaveLength(6);
    expect(result.handCards).toHaveLength(7);
    expectRestSize(result, "1280x800-dune");
    expectNoTileOverlap(result, "1280x800-dune");
    expectHandPinned(result, "1280x800-dune");
    expect(result.handFitsTable).toBe(true);
    const visibleHandHeight = Math.min(result.handBottom, result.viewportHeight) - Math.max(result.handTop, 0);
    expect(visibleHandHeight / (result.handBottom - result.handTop)).toBeGreaterThan(0.9);
  }, 30000);
});
