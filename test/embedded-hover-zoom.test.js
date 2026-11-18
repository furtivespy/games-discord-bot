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
const {
  CLICK_SLOP_PX,
  SNAP_BACK_DURATION_MS,
  enableCardDrag,
} = require("../embedded-client/src/drag.ts");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const MAIN_PATH = path.join(__dirname, "..", "embedded-client", "src", "main.ts");
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
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const BOARD_CLIP = { left: 0, top: 0, right: 800, bottom: 600 };
const HAND_CLIP = { left: 0, top: 0, right: 800, bottom: 720 };
const ZONE_CLIPS = [
  { zone: "board", clip: BOARD_CLIP },
  { zone: "play area", clip: BOARD_CLIP },
  { zone: "hand", clip: HAND_CLIP },
];

function restBox({ left, top }) {
  return {
    left,
    top,
    right: left + REST.width,
    bottom: top + REST.height,
  };
}

function cornerRest(clip, corner, pad = 6) {
  return restBox({
    left: corner.includes("right") ? clip.right - REST.width - pad : clip.left + pad,
    top: corner.includes("bottom") ? clip.bottom - REST.height - pad : clip.top + pad,
  });
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

function coversBox(outer, inner, epsilon = 0.51) {
  return (
    outer.left <= inner.left + epsilon &&
    outer.top <= inner.top + epsilon &&
    outer.right >= inner.right - epsilon &&
    outer.bottom >= inner.bottom - epsilon
  );
}

function shiftValue(tile, name) {
  return tile.style.getPropertyValue(name);
}

describe("hover zoom clamp math", () => {
  test("pixelShift rounds overflow away from zero and ignores noise", () => {
    expect(pixelShift(0)).toBe(0);
    expect(pixelShift(0.004)).toBe(0);
    expect(pixelShift(0.4)).toBe(1);
    expect(pixelShift(-0.4)).toBe(-1);
  });

  test("center cards keep a zero shift", () => {
    const rest = restBox({ left: 400, top: 220 });
    const zoomed = hoverZoomRect(rest);
    expect(zoomed.right - zoomed.left).toBeCloseTo(REST.width * CARD_HOVER_SCALE, 5);
    expect(zoomed.bottom).toBeCloseTo(rest.bottom - CARD_HOVER_LIFT_PX, 5);
    expect(hoverShiftForRects(rest, BOARD_CLIP)).toEqual({ x: 0, y: 0 });
    expect(containsBox(BOARD_CLIP, zoomed)).toBe(true);
  });

  test("four corners stay inside the clip in hand, board, and play area", () => {
    for (const { zone, clip } of ZONE_CLIPS) {
      for (const corner of CORNERS) {
        const rest = cornerRest(clip, corner);
        const zoomed = hoverZoomRect(rest);
        const shift = hoverShiftForRects(rest, clip);
        const moved = shiftedBox(zoomed, shift);
        expect({ zone, corner, inside: containsBox(clip, moved) }).toEqual({
          zone,
          corner,
          inside: true,
        });
        if (corner.includes("left")) expect(shift.x).toBeGreaterThan(0);
        if (corner.includes("right")) expect(shift.x).toBeLessThan(0);
        if (corner.includes("top")) expect(shift.y).toBeGreaterThan(0);
      }
    }
  });

  test("an oversized zoom covers the clip with the least shift", () => {
    const rest = restBox({ left: 40, top: 40 });
    const clip = { left: 10, top: 20, right: 90, bottom: 100 };
    const zoomed = hoverZoomRect(rest);
    const shift = clampHoverShift(zoomed, clip);
    expect(coversBox(shiftedBox(zoomed, shift), clip)).toBe(true);
    expect(Math.abs(shift.x) + Math.abs(shift.y)).toBeLessThan(
      Math.abs(clip.left - zoomed.left) + Math.abs(clip.top - zoomed.top)
    );
  });
});

function paint(view) {
  return new Promise((resolve) => {
    const raf =
      view?.requestAnimationFrame?.bind(view) ||
      ((cb) => setTimeout(cb, 0));
    raf(() => raf(resolve));
  });
}

function pointerEvent(type, { pointerId = 1, button = 0, clientX, clientY, bubbles = false } = {}) {
  return {
    type,
    pointerId,
    button,
    clientX,
    clientY,
    bubbles,
    preventDefault() {},
  };
}

function createHoverTile({ rest, clip, inTableMain = true, scale = String(CARD_HOVER_SCALE) }) {
  const properties = {};
  const pos = { ...rest };
  const clipRect = { ...clip };
  const listeners = new Map();
  const classSet = new Set();
  const parentListeners = new Map();
  const viewListeners = new Map();
  const docListeners = new Map();

  function dispatch(map, event) {
    for (const handler of map.get(event.type) || []) handler(event);
  }

  const parent = {
    parentElement: null,
    get clientWidth() {
      return clipRect.right - clipRect.left;
    },
    get clientHeight() {
      return clipRect.bottom - clipRect.top;
    },
    getBoundingClientRect: () => ({
      left: clipRect.left,
      top: clipRect.top,
      right: clipRect.right,
      bottom: clipRect.bottom,
      width: clipRect.right - clipRect.left,
      height: clipRect.bottom - clipRect.top,
    }),
    addEventListener(type, fn) {
      const list = parentListeners.get(type) || [];
      list.push(fn);
      parentListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      parentListeners.set(
        type,
        (parentListeners.get(type) || []).filter((handler) => handler !== fn)
      );
    },
    dispatchEvent(event) {
      dispatch(parentListeners, event);
      return true;
    },
    closest(selector) {
      if (selector === "#table") return parent;
      if (selector === "#table-main") return inTableMain ? parent : null;
      return null;
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
      viewListeners.set(
        type,
        (viewListeners.get(type) || []).filter((handler) => handler !== fn)
      );
    },
    dispatchEvent(event) {
      dispatch(viewListeners, event);
      return true;
    },
    requestAnimationFrame(cb) {
      return setTimeout(cb, 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
  };
  const ownerDocument = {
    defaultView: view,
    addEventListener(type, fn) {
      const list = docListeners.get(type) || [];
      list.push(fn);
      docListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      docListeners.set(
        type,
        (docListeners.get(type) || []).filter((handler) => handler !== fn)
      );
    },
    dispatchEvent(event) {
      dispatch(docListeners, event);
      return true;
    },
  };
  const tile = {
    style: {
      transform: "",
      zIndex: "",
      transitionDuration: "",
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
      add: (...names) => {
        for (const name of names) classSet.add(name);
      },
      remove: (...names) => {
        for (const name of names) classSet.delete(name);
      },
      toggle: (name, force) => {
        if (force === undefined) {
          if (classSet.has(name)) classSet.delete(name);
          else classSet.add(name);
        } else if (force) classSet.add(name);
        else classSet.delete(name);
        return classSet.has(name);
      },
    },
    ownerDocument,
    getBoundingClientRect: () => ({
      left: pos.left,
      top: pos.top,
      right: pos.right,
      bottom: pos.bottom,
      width: pos.right - pos.left,
      height: pos.bottom - pos.top,
    }),
    closest: (selector) => parent.closest(selector),
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((handler) => handler !== fn)
      );
    },
    dispatchEvent(event) {
      dispatch(listeners, event);
      if (event.bubbles) ownerDocument.dispatchEvent(event);
      return true;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    moveTo(next) {
      Object.assign(pos, next);
    },
    setClip(next) {
      Object.assign(clipRect, next);
    },
    fireScroll() {
      parent.dispatchEvent({ type: "scroll" });
    },
    fireResize() {
      view.dispatchEvent({ type: "resize" });
    },
    scrollHooked() {
      return (parentListeners.get("scroll") || []).length > 0;
    },
    resizeHooked() {
      return (viewListeners.get("resize") || []).length > 0;
    },
  };
  return tile;
}

describe("hover zoom clamp on a tile", () => {
  test("applyHoverShift writes CSS variables and clearHoverShift removes them", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 200, top: 200 }),
      clip: BOARD_CLIP,
    });
    applyHoverShift(tile, { x: 12, y: -4 });
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("12px");
    expect(shiftValue(tile, HOVER_SHIFT_Y_VAR)).toBe("-4px");
    applyHoverShift(tile, { x: 0, y: 0 });
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
    clearHoverShift(tile);
    expect(tile.properties[HOVER_SHIFT_X_VAR]).toBeUndefined();
  });

  test("clipBoxForTile intersects #table / #table-main with the viewport", () => {
    const clip = { left: 40, top: 30, right: 640, bottom: 430 };
    const tile = createHoverTile({
      rest: restBox({ left: 80, top: 80 }),
      clip,
    });
    expect(clipBoxForTile(tile)).toEqual(clip);
  });

  test("hand tiles clip to #table when they are outside #table-main", () => {
    const clip = { left: 10, top: 20, right: 500, bottom: 400 };
    const tile = createHoverTile({
      rest: restBox({ left: 80, top: 80 }),
      clip,
      inTableMain: false,
    });
    expect(clipBoxForTile(tile)).toEqual(clip);
  });

  test("pointerenter clamps an edge card and pointerleave clears the shift", () => {
    const rest = restBox({ left: 6, top: 4 });
    const tile = createHoverTile({ rest, clip: BOARD_CLIP });
    enableHoverZoomClamp(tile);
    expect(hoverShiftForTile(tile).x).toBeGreaterThan(0);

    tile.dispatchEvent({ type: "pointerenter" });
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_X_VAR))).toBeGreaterThan(0);
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_Y_VAR))).toBeGreaterThan(0);

    tile.dispatchEvent({ type: "pointerleave" });
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
    expect(shiftValue(tile, HOVER_SHIFT_Y_VAR)).toBe("");
  });

  test("a centered tile does not write shift variables on hover", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 500, top: 240 }),
      clip: { left: 0, top: 0, right: 1200, bottom: 800 },
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
    expect(shiftValue(tile, HOVER_SHIFT_Y_VAR)).toBe("");
  });

  test("after drag ends while hovered, the face is re-clamped", async () => {
    const tile = createHoverTile({
      rest: restBox({ left: 6, top: 4 }),
      clip: BOARD_CLIP,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    const hoveredX = shiftValue(tile, HOVER_SHIFT_X_VAR);
    expect(hoveredX).not.toBe("");

    tile.classList.add("dragging");
    tile.dispatchEvent({ type: "pointerup" });
    tile.classList.remove("dragging");
    await Promise.resolve();
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe(hoveredX);
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_Y_VAR))).toBeGreaterThan(0);
  });

  test("pointerup still dragging leaves the shift cleared", async () => {
    const tile = createHoverTile({
      rest: restBox({ left: 6, top: 4 }),
      clip: BOARD_CLIP,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    tile.classList.add("dragging");
    tile.dispatchEvent({ type: "pointerup" });
    await Promise.resolve();
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
  });

  test("after snap-back while hovered, transitionend reclamps at rest", async () => {
    const rest = restBox({ left: 6, top: 4 });
    const tile = createHoverTile({ rest, clip: BOARD_CLIP });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    const hoveredX = shiftValue(tile, HOVER_SHIFT_X_VAR);
    expect(hoveredX).not.toBe("");

    tile.moveTo(restBox({ left: 300, top: 200 }));
    tile.classList.add("dragging");
    tile.dispatchEvent({ type: "pointerup" });
    tile.classList.remove("dragging");
    tile.classList.add("snapping");
    await Promise.resolve();
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");

    tile.moveTo(rest);
    tile.classList.remove("snapping");
    tile.dispatchEvent({
      type: "transitionend",
      target: tile,
      propertyName: "transform",
    });
    await paint(tile.ownerDocument.defaultView);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe(hoveredX);
  });

  test("real drag.ts snap-back reclamps a still-hovered edge card", async () => {
    const rest = restBox({ left: 6, top: 4 });
    const tile = createHoverTile({ rest, clip: BOARD_CLIP });
    enableHoverZoomClamp(tile);
    enableCardDrag(tile, "edge-1", new Map());
    tile.dispatchEvent({ type: "pointerenter" });
    const hoveredX = shiftValue(tile, HOVER_SHIFT_X_VAR);
    expect(hoveredX).not.toBe("");

    const start = { x: 70, y: 90 };
    const end = { x: start.x + CLICK_SLOP_PX + 40, y: start.y };
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: start.x, clientY: start.y, bubbles: true }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: end.x, clientY: end.y })
    );
    // Mid-snap visual box is away from the clip edge, so a too-early apply
    // would compute a zero shift and leave the zoom unclamped.
    tile.moveTo(restBox({ left: rest.left + (end.x - start.x), top: rest.top }));
    tile.dispatchEvent(pointerEvent("pointerup", { clientX: end.x, clientY: end.y, bubbles: true }));

    await Promise.resolve();
    expect(tile.classList.contains("snapping")).toBe(true);
    expect(tile.classList.contains("dragging")).toBe(false);
    expect(hoverShiftForTile(tile).x).toBe(0);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");

    tile.moveTo(rest);
    tile.dispatchEvent({
      type: "transitionend",
      target: tile,
      propertyName: "transform",
    });
    expect(tile.classList.contains("snapping")).toBe(false);
    await paint(tile.ownerDocument.defaultView);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe(hoveredX);
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_Y_VAR))).toBeGreaterThan(0);
  });

  test("after snap-back while hovered, the snap timeout reclamps if transitionend is missed", async () => {
    const rest = restBox({ left: 6, top: 4 });
    const tile = createHoverTile({ rest, clip: BOARD_CLIP });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    const hoveredX = shiftValue(tile, HOVER_SHIFT_X_VAR);
    expect(hoveredX).not.toBe("");

    tile.moveTo(restBox({ left: 300, top: 200 }));
    tile.classList.add("dragging");
    tile.dispatchEvent({ type: "pointerup" });
    tile.classList.remove("dragging");
    tile.classList.add("snapping");
    await Promise.resolve();
    tile.moveTo(rest);
    tile.classList.remove("snapping");
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
    await new Promise((resolve) => setTimeout(resolve, SNAP_BACK_DURATION_MS + 120));
    await paint(tile.ownerDocument.defaultView);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe(hoveredX);
  });

  test("board and play-area tiles resync on #table-main scroll", () => {
    for (const zone of ["board", "play area"]) {
      const tile = createHoverTile({
        rest: restBox({ left: 6, top: 4 }),
        clip: BOARD_CLIP,
        inTableMain: true,
      });
      enableHoverZoomClamp(tile);
      tile.dispatchEvent({ type: "pointerenter" });
      expect({ zone, hooked: tile.scrollHooked() }).toEqual({ zone, hooked: true });
      expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_Y_VAR))).toBeGreaterThan(0);

      tile.moveTo(restBox({ left: 6, top: 200 }));
      tile.fireScroll();
      expect({ zone, y: Number.parseFloat(shiftValue(tile, HOVER_SHIFT_Y_VAR)) || 0 }).toEqual({
        zone,
        y: 0,
      });
    }
  });

  test("hand tiles clamp without a #table-main scroll hook and resync on resize", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 6, top: 4 }),
      clip: HAND_CLIP,
      inTableMain: false,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(tile.scrollHooked()).toBe(false);
    expect(tile.resizeHooked()).toBe(true);
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_X_VAR))).toBeGreaterThan(0);

    tile.moveTo(restBox({ left: 300, top: 200 }));
    tile.fireResize();
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
    expect(shiftValue(tile, HOVER_SHIFT_Y_VAR)).toBe("");
  });

  test("resize reclamps a hovered card when the clip shrinks", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 500, top: 240 }),
      clip: { left: 0, top: 0, right: 1200, bottom: 800 },
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");

    tile.setClip({ left: 0, top: 0, right: 540, bottom: 800 });
    tile.fireResize();
    expect(Number.parseFloat(shiftValue(tile, HOVER_SHIFT_X_VAR))).toBeLessThan(0);
  });

  test("a disconnected hovered tile drops layout listeners", () => {
    const tile = createHoverTile({
      rest: restBox({ left: 6, top: 4 }),
      clip: BOARD_CLIP,
    });
    enableHoverZoomClamp(tile);
    tile.dispatchEvent({ type: "pointerenter" });
    expect(tile.resizeHooked()).toBe(true);
    expect(tile.scrollHooked()).toBe(true);

    tile.isConnected = false;
    tile.fireResize();
    expect(tile.resizeHooked()).toBe(false);
    expect(tile.scrollHooked()).toBe(false);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");

    tile.isConnected = true;
    tile.fireResize();
    expect(tile.resizeHooked()).toBe(false);
    expect(shiftValue(tile, HOVER_SHIFT_X_VAR)).toBe("");
  });

  test("decks do not hover-zoom or install the clamp", () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const main = fs.readFileSync(MAIN_PATH, "utf8");
    expect(css).not.toContain(".deck-tile:hover .card-face");
    expect(css).not.toMatch(/\.deck-tile[^{]*\{[^}]*--hover-shift/);
    const decksFn = main.slice(
      main.indexOf("function renderDeckActions"),
      main.indexOf("function appendStatusLines")
    );
    expect(decksFn).toContain("function renderDecks");
    expect(decksFn).toContain("function renderPileTile");
    expect(decksFn).toContain("function renderDiscardTile");
    expect(decksFn).not.toContain("enableHoverZoomClamp");
    const pileFn = main.slice(
      main.indexOf("function renderPileTile"),
      main.indexOf("function renderDeckTile")
    );
    expect(pileFn).toContain('textContent = "Discard"');
    expect(pileFn).toContain("handCountLabel(deck.discard)");
    const titleAssign = pileFn.match(/tile\.title =[^\n]+/)?.[0] ?? "";
    expect(titleAssign).toContain("`${deckName} discard`");
    expect(titleAssign).not.toContain("deck.discard");
    expect(titleAssign).not.toContain("deck.remaining");
    expect(titleAssign).not.toContain("handCountLabel");
    expect(pileFn).toContain("tile.dataset.deckName = deckName");
    expect(pileFn).not.toContain("dataset.discard");
    const discardBranch = pileFn.slice(
      pileFn.indexOf("if (discard)"),
      pileFn.indexOf("} else {")
    );
    expect(discardBranch).toContain('textContent = "Discard"');
    expect(discardBranch).toContain("handCountLabel(deck.discard)");
    expect(discardBranch).not.toContain("renderDeckActions");
    expect(main).toContain("enableHoverZoomClamp(tile)");
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
  });
});
