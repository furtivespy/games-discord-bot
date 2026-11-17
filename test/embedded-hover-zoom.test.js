const { afterEach, describe, expect, test } = require("bun:test");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  CARD_HOVER_LIFT_PX,
  CARD_HOVER_SCALE,
  HOVER_SHIFT_X_VAR,
  HOVER_SHIFT_Y_VAR,
  applyHoverShift,
  clampHoverShift,
  clearHoverShift,
  clipBoxForTile,
  enableHoverZoomClamp,
  hoverShiftForRects,
  hoverShiftForTile,
  hoverZoomRect,
  pixelShift,
} = require("../embedded-client/src/hoverZoom.ts");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const HOVER_ZOOM_PATH = path.join(__dirname, "..", "embedded-client", "src", "hoverZoom.ts");

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

const REST = { width: 128, height: 179 };

function restBox({ left, top }) {
  return {
    left,
    top,
    right: left + REST.width,
    bottom: top + REST.height,
  };
}

function shiftedBox(box, shift) {
  return {
    left: box.left + shift.x,
    right: box.right + shift.x,
    top: box.top + shift.y,
    bottom: box.bottom + shift.y,
  };
}

function containsBox(outer, inner, epsilon = 0.51) {
  return (
    inner.left >= outer.left - epsilon &&
    inner.top >= outer.top - epsilon &&
    inner.right <= outer.right + epsilon &&
    inner.bottom <= outer.bottom + epsilon
  );
}

describe("hover zoom clamp math", () => {
  test("pixelShift rounds overflow away from zero and ignores noise", () => {
    expect(pixelShift(0)).toBe(0);
    expect(pixelShift(0.004)).toBe(0);
    expect(pixelShift(0.4)).toBe(1);
    expect(pixelShift(12.2)).toBe(13);
    expect(pixelShift(-0.4)).toBe(-1);
    expect(pixelShift(-12.2)).toBe(-13);
  });

  test("center cards keep a zero shift", () => {
    const rest = restBox({ left: 400, top: 220 });
    const clip = { left: 0, top: 0, right: 1200, bottom: 800 };
    const zoomed = hoverZoomRect(rest);
    expect(zoomed.right - zoomed.left).toBeCloseTo(REST.width * CARD_HOVER_SCALE, 5);
    expect(zoomed.bottom - zoomed.top).toBeCloseTo(REST.height * CARD_HOVER_SCALE, 5);
    expect(zoomed.bottom).toBeCloseTo(rest.bottom - CARD_HOVER_LIFT_PX, 5);
    expect(hoverShiftForRects(rest, clip)).toEqual({ x: 0, y: 0 });
    expect(containsBox(clip, zoomed)).toBe(true);
  });

  test("top-left board cards shift down and right into the clip", () => {
    const rest = restBox({ left: 8, top: 8 });
    const clip = { left: 0, top: 0, right: 800, bottom: 600 };
    const zoomed = hoverZoomRect(rest);
    expect(zoomed.left).toBeLessThan(clip.left);
    expect(zoomed.top).toBeLessThan(clip.top);
    const shift = hoverShiftForRects(rest, clip);
    expect(shift.x).toBeGreaterThan(0);
    expect(shift.y).toBeGreaterThan(0);
    expect(containsBox(clip, shiftedBox(zoomed, shift))).toBe(true);
  });

  test("right-edge cards shift left without moving a vertically centered tile", () => {
    const clip = { left: 0, top: 0, right: 400, bottom: 520 };
    const rightRest = restBox({ left: clip.right - REST.width - 4, top: 160 });
    const rightShift = hoverShiftForRects(rightRest, clip);
    expect(rightShift.x).toBeLessThan(0);
    expect(rightShift.y).toBe(0);
    expect(containsBox(clip, shiftedBox(hoverZoomRect(rightRest), rightShift))).toBe(
      true
    );
  });

  test("hover lift keeps a bottom-edge face inside the clip", () => {
    const clip = { left: 0, top: 0, right: 400, bottom: 360 };
    const bottomRest = restBox({
      left: 120,
      top: clip.bottom - REST.height - 2,
    });
    const bottomZoomed = hoverZoomRect(bottomRest);
    expect(bottomZoomed.bottom).toBeLessThanOrEqual(clip.bottom);
    expect(hoverShiftForRects(bottomRest, clip).y).toBeLessThanOrEqual(0);
    expect(containsBox(clip, shiftedBox(bottomZoomed, hoverShiftForRects(bottomRest, clip)))).toBe(
      true
    );
  });

  test("a zoomed card larger than the clip pins to the clip origin", () => {
    const rest = restBox({ left: 40, top: 40 });
    const clip = { left: 10, top: 20, right: 90, bottom: 100 };
    const shift = clampHoverShift(hoverZoomRect(rest), clip);
    const moved = shiftedBox(hoverZoomRect(rest), shift);
    expect(moved.left).toBeCloseTo(clip.left, 0);
    expect(moved.top).toBeCloseTo(clip.top, 0);
  });
});

function createHoverTile({ rest, clip, scale = String(CARD_HOVER_SCALE) }) {
  const properties = {};
  const listeners = new Map();
  const classSet = new Set();
  const parentListeners = new Map();
  const viewListeners = new Map();
  const parent = {
    parentElement: null,
    clientWidth: clip.right - clip.left,
    clientHeight: clip.bottom - clip.top,
    getBoundingClientRect: () => ({
      left: clip.left,
      top: clip.top,
      right: clip.right,
      bottom: clip.bottom,
      width: clip.right - clip.left,
      height: clip.bottom - clip.top,
    }),
    addEventListener(type, fn) {
      const list = parentListeners.get(type) || [];
      list.push(fn);
      parentListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = (parentListeners.get(type) || []).filter((handler) => handler !== fn);
      parentListeners.set(type, list);
    },
    closest(selector) {
      return selector === "#table-main" ? parent : null;
    },
  };
  const view = {
    innerWidth: 2000,
    innerHeight: 1200,
    getComputedStyle(el) {
      if (el === parent) {
        return {
          overflowX: "hidden",
          overflowY: "auto",
          borderLeftWidth: "0px",
          borderTopWidth: "0px",
          getPropertyValue: () => "",
        };
      }
      return {
        overflowX: "visible",
        overflowY: "visible",
        borderLeftWidth: "0px",
        borderTopWidth: "0px",
        getPropertyValue: (name) => (name === "--card-hover-scale" ? scale : ""),
      };
    },
    addEventListener(type, fn) {
      const list = viewListeners.get(type) || [];
      list.push(fn);
      viewListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = (viewListeners.get(type) || []).filter((handler) => handler !== fn);
      viewListeners.set(type, list);
    },
  };
  const tile = {
    style: {
      setProperty(name, value) {
        properties[name] = value;
      },
      removeProperty(name) {
        delete properties[name];
      },
      getPropertyValue(name) {
        return properties[name] || "";
      },
    },
    properties,
    parentElement: parent,
    isConnected: true,
    classList: {
      contains: (name) => classSet.has(name),
      add: (name) => classSet.add(name),
      remove: (name) => classSet.delete(name),
    },
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({
      left: rest.left,
      top: rest.top,
      right: rest.right,
      bottom: rest.bottom,
      width: rest.right - rest.left,
      height: rest.bottom - rest.top,
    }),
    closest: (selector) => parent.closest(selector),
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
      return true;
    },
  };
  return tile;
}

describe("hover zoom clamp on a tile", () => {
  test("applyHoverShift writes CSS variables and clearHoverShift removes them", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 200, top: 200 }),
      clip: { left: 0, top: 0, right: 800, bottom: 600 },
    });
    applyHoverShift(tile, { x: 12, y: -4 });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).toBe("12px");
    expect(tile.style.getPropertyValue(HOVER_SHIFT_Y_VAR)).toBe("-4px");
    applyHoverShift(tile, { x: 0, y: 0 });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).toBe("");
    expect(tile.style.getPropertyValue(HOVER_SHIFT_Y_VAR)).toBe("");
    applyHoverShift(tile, { x: 3, y: 1 });
    clearHoverShift(tile);
    expect(tile.properties[HOVER_SHIFT_X_VAR]).toBeUndefined();
  });

  test("clipBoxForTile intersects overflow ancestors with the viewport", () => {
    const clip = { left: 40, top: 30, right: 640, bottom: 430 };
    const tile = createHoverTile({
      rest: restBox({ left: 80, top: 80 }),
      clip,
    });
    expect(clipBoxForTile(tile)).toEqual(clip);
  });

  test("pointerenter clamps an edge card and pointerleave clears the shift", () => {
    const clip = { left: 0, top: 0, right: 800, bottom: 600 };
    const rest = restBox({ left: 6, top: 4 });
    const tile = createHoverTile({ rest, clip });
    enableHoverZoomClamp(tile);
    expect(hoverShiftForTile(tile).x).toBeGreaterThan(0);
    expect(hoverShiftForTile(tile).y).toBeGreaterThan(0);

    tile.dispatchEvent({ type: "pointerenter" });
    expect(Number.parseFloat(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR))).toBeGreaterThan(
      0
    );
    expect(Number.parseFloat(tile.style.getPropertyValue(HOVER_SHIFT_Y_VAR))).toBeGreaterThan(
      0
    );

    tile.dispatchEvent({ type: "pointerleave" });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).toBe("");
    expect(tile.style.getPropertyValue(HOVER_SHIFT_Y_VAR)).toBe("");
  });

  test("a centered tile does not write shift variables on hover", () => {
    const clip = { left: 0, top: 0, right: 1200, bottom: 800 };
    const tile = createHoverTile({
      rest: restBox({ left: 500, top: 240 }),
      clip,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).toBe("");
    expect(tile.style.getPropertyValue(HOVER_SHIFT_Y_VAR)).toBe("");
  });

  test("dragging clears a pending shift so the face stays on the tile", () => {
    const clip = { left: 0, top: 0, right: 800, bottom: 600 };
    const tile = createHoverTile({
      rest: restBox({ left: 6, top: 4 }),
      clip,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).not.toBe("");
    tile.classList.add("dragging");
    tile.dispatchEvent({ type: "pointerup" });
    expect(tile.style.getPropertyValue(HOVER_SHIFT_X_VAR)).toBe("");
  });
});

const HOVER_HARNESS_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/style.css" />
    <style>
      html, body { height: 100%; margin: 0; }
      #app.connected { height: 100%; }
      .card-tile.measure-hover .card-face {
        transform: translateY(-38px) translate(var(--hover-shift-x, 0px), var(--hover-shift-y, 0px)) scale(var(--card-hover-scale));
        transition: none;
      }
    </style>
  </head>
  <body>
    <div id="app" class="connected">
      <aside id="side-panel"><p>status</p></aside>
      <div id="table">
        <div id="table-main">
          <section class="zone" data-zone="board">
            <h2>Game Board</h2>
            <div class="cards board-spread" id="board-cards">
              <article class="card-tile" data-card-id="edge-1" title="image">
                <div class="card-face named-card"><span class="card-name card-name-full">image</span></div>
              </article>
            </div>
          </section>
        </div>
        <section class="zone hand-zone" data-zone="hand">
          <h2>Hand</h2>
          <div class="cards hand-fan" id="hand-cards">
            <article class="card-tile" data-card-id="hand-1" title="Copper">
              <div class="card-face named-card"><span class="card-name card-name-full">Copper</span></div>
            </article>
          </div>
        </section>
      </div>
    </div>
    <script type="module" src="/harness.js"></script>
  </body>
</html>`;

const HOVER_HARNESS_JS = `
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

function box(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

try {
  const { enableHoverZoomClamp } = await import("/hover-zoom.js");
  const tile = document.querySelector('[data-card-id="edge-1"]');
  const face = tile.querySelector(".card-face");
  const table = document.getElementById("table");
  const main = document.getElementById("table-main");
  await frame();
  const rest = box(face);
  tile.classList.add("measure-hover");
  await frame();
  const unclamped = box(face);
  enableHoverZoomClamp(tile);
  tile.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
  await frame();
  await frame();
  const clamped = box(face);
  const tableBox = box(table);
  const mainBox = box(main);
  const clip = {
    left: Math.max(tableBox.left, mainBox.left),
    top: Math.max(tableBox.top, mainBox.top),
    right: Math.min(tableBox.right, mainBox.right),
    bottom: Math.min(tableBox.bottom, mainBox.bottom),
  };
  await report({
    rest,
    unclamped,
    clamped,
    clip,
    shiftX: getComputedStyle(tile).getPropertyValue("--hover-shift-x").trim(),
    shiftY: getComputedStyle(tile).getPropertyValue("--hover-shift-y").trim(),
  });
} catch (error) {
  await report({ error: String(error && error.stack ? error.stack : error) });
}
`;

describe("hover zoom stays inside the board window", () => {
  const chrome = workingChromeBin();
  let server;
  let chromeProc;
  let userDataDir;

  function cleanup() {
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
    cleanup();
  });

  test.skipIf(!chrome)("QA: top-left hover zoom is clamped inside #table-main", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const built = await Bun.build({
      entrypoints: [HOVER_ZOOM_PATH],
      target: "browser",
      format: "esm",
    });
    expect(built.success).toBe(true);
    const hoverJs = await built.outputs[0].text();

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
        if (url.pathname === "/hover-zoom.js") {
          return new Response(hoverJs, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        if (url.pathname === "/harness.js") {
          return new Response(HOVER_HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        if (url.pathname === "/style.css") {
          return new Response(css, {
            headers: { "Content-Type": "text/css; charset=utf-8" },
          });
        }
        return new Response(HOVER_HARNESS_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hover-zoom-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-first-run",
        "--window-size=1024,640",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for Chrome hover-zoom result")), 20000)
      ),
    ]);

    expect(result.error).toBeUndefined();
    expect(result.unclamped.left).toBeLessThan(result.clip.left - 1);
    expect(result.unclamped.top).toBeLessThan(result.clip.top - 1);
    expect(Number.parseFloat(result.shiftX)).toBeGreaterThan(0);
    expect(Number.parseFloat(result.shiftY)).toBeGreaterThan(0);
    expect(result.clamped.left).toBeGreaterThanOrEqual(result.clip.left - 0.5);
    expect(result.clamped.top).toBeGreaterThanOrEqual(result.clip.top - 0.5);
    expect(result.clamped.right).toBeLessThanOrEqual(result.clip.right + 0.5);
    expect(result.clamped.bottom).toBeLessThanOrEqual(result.clip.bottom + 0.5);
    expect(result.clamped.left).toBeGreaterThan(result.unclamped.left + 1);
    expect(result.clamped.top).toBeGreaterThan(result.unclamped.top + 1);
  });
});
