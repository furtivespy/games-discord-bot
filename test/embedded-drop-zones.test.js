const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const {
  DROP_LAYER_ID,
  collectDropZones,
  dropZoneAtPoint,
  hideDropLayer,
  paintDropZones,
  pointInRect,
} = require("../embedded-client/src/dropZones.ts");
const { enableCardDrag } = require("../embedded-client/src/drag.ts");
const { visualHandActionBody } = require("../embedded-client/src/visualActions.ts");
const { submitHandCardAction } = require("../embedded-client/src/submitHandCardAction.ts");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const HTML_PATH = path.join(__dirname, "..", "embedded-client", "index.html");

class FakeNode {
  constructor(tagName, id = "") {
    this.tagName = String(tagName || "DIV").toUpperCase();
    this.id = id;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.textContent = "";
    this.classSet = new Set();
    this.style = {};
    this.attributes = {};
    this.boundingRect = { left: 0, top: 0, width: 80, height: 80 };
    this.classList = {
      add: (name) => this.classSet.add(name),
      remove: (name) => this.classSet.delete(name),
      contains: (name) => this.classSet.has(name),
      toggle: (name, force) => {
        if (force === undefined) {
          if (this.classSet.has(name)) this.classSet.delete(name);
          else this.classSet.add(name);
        } else if (force) this.classSet.add(name);
        else this.classSet.delete(name);
        return this.classSet.has(name);
      },
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  matches(selector) {
    const parts = String(selector || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.some((part) => {
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      const data = part.match(/^\[data-zone="([^"]+)"\]$/);
      if (data) return this.dataset.zone === data[1];
      if (part === ".player-chip") return this.classList.contains("player-chip");
      if (part === ".player-name") return this.classList.contains("player-name");
      return part.toUpperCase() === this.tagName;
    });
  }

  querySelector(selector) {
    if (this.matches(selector)) return this;
    for (const child of this.children) {
      const hit = child.querySelector?.(selector);
      if (hit) return hit;
    }
    return null;
  }

  querySelectorAll(selector) {
    const hits = [];
    if (this.matches(selector)) hits.push(this);
    for (const child of this.children) {
      if (typeof child.querySelectorAll === "function") {
        hits.push(...child.querySelectorAll(selector));
      }
    }
    return hits;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = nodes;
    for (const child of nodes) child.parentNode = this;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  getBoundingClientRect() {
    const rect = this.boundingRect;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    };
  }

  createElement(tag) {
    const node = new FakeNode(tag);
    node.ownerDocument = this.ownerDocument;
    return node;
  }

  getElementById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const hit = child.getElementById?.(id);
      if (hit) return hit;
    }
    return null;
  }
}

function chip(userId, name, rect, isYou = false) {
  const article = new FakeNode("ARTICLE");
  article.classList.add("player-chip");
  if (isYou) article.classList.add("is-you");
  article.dataset.userId = userId;
  article.boundingRect = rect;
  const nameEl = new FakeNode("DIV");
  nameEl.classList.add("player-name");
  nameEl.textContent = name;
  article.append(nameEl);
  return article;
}

function zone(name, rect, extraClass = "") {
  const section = new FakeNode("SECTION");
  section.dataset.zone = name;
  if (extraClass) section.classList.add(extraClass);
  section.boundingRect = rect;
  return section;
}

function tableRoot() {
  const root = new FakeNode("DIV", "table");
  root.append(
    chip("p1", "Riley", { left: 10, top: 10, width: 40, height: 40 }),
    chip("me", "Will", { left: 60, top: 10, width: 40, height: 40 }, true),
    chip("p2", "Sam", { left: 110, top: 10, width: 40, height: 40 }),
    zone("board", { left: 10, top: 80, width: 120, height: 80 }),
    zone("play-area", { left: 10, top: 170, width: 120, height: 80 }),
    zone("play", { left: 140, top: 80, width: 160, height: 170 }),
    zone("decks", { left: 320, top: 80, width: 80, height: 80 }),
    zone("discards", { left: 320, top: 170, width: 80, height: 80 })
  );
  return root;
}

describe("hand-card drop zones", () => {
  test("collects 3 pass, 3 play, 1 return, and 1 discard from the table", () => {
    const zones = collectDropZones(tableRoot());
    expect(zones.map((zone) => [zone.id, zone.label, zone.action.kind])).toEqual([
      ["pass:p1", "Pass", "pass"],
      ["pass:p2", "Pass", "pass"],
      ["return", "Return", "return"],
      ["discard", "Discard", "discard"],
      ["play:default", "Play", "play"],
      ["play:gameboard", "Play", "play"],
      ["play:playarea", "Play", "play"],
    ]);
    expect(zones.find((zone) => zone.id === "pass:p1").detail).toBe("Riley");
    expect(zones.find((zone) => zone.id === "play:gameboard").detail).toBe("Game Board");
    expect(zones.find((zone) => zone.id === "play:playarea").detail).toBe("Play Area");
    expect(zones.find((zone) => zone.id === "play:gameboard").action).toEqual({
      kind: "play",
      destination: "gameboard",
    });
    expect(zones.find((zone) => zone.id === "play:playarea").action).toEqual({
      kind: "play",
      destination: "playarea",
    });
    expect(zones.find((zone) => zone.id === "play:default").action).toEqual({
      kind: "play",
    });
    expect(zones.some((zone) => zone.id === "pass:me")).toBe(false);
  });

  test("hit-testing prefers seats and piles over the default play area", () => {
    const zones = collectDropZones(tableRoot());
    expect(dropZoneAtPoint(zones, { x: 30, y: 30 }).id).toBe("pass:p1");
    expect(dropZoneAtPoint(zones, { x: 360, y: 120 }).id).toBe("return");
    expect(dropZoneAtPoint(zones, { x: 360, y: 210 }).id).toBe("discard");
    expect(dropZoneAtPoint(zones, { x: 40, y: 120 }).id).toBe("play:gameboard");
    expect(dropZoneAtPoint(zones, { x: 40, y: 210 }).id).toBe("play:playarea");
    expect(dropZoneAtPoint(zones, { x: 200, y: 150 }).id).toBe("play:default");
    expect(dropZoneAtPoint(zones, { x: 900, y: 900 })).toBeNull();
    expect(pointInRect({ x: 10, y: 10 }, { left: 10, top: 10, width: 10, height: 10 })).toBe(true);
  });

  test("paintDropZones labels overlays and highlights the active one", () => {
    const doc = new FakeNode("HTML");
    doc.ownerDocument = doc;
    const table = new FakeNode("DIV", "table");
    table.ownerDocument = doc;
    doc.append(table);
    doc.body = doc;
    const zones = collectDropZones(tableRoot());
    paintDropZones(doc, zones, "discard");
    const layer = doc.getElementById(DROP_LAYER_ID);
    expect(layer).toBeTruthy();
    expect(layer.children).toHaveLength(7);
    const discard = layer.children.find((child) => child.dataset.dropId === "discard");
    expect(discard.classList.contains("is-over")).toBe(true);
    expect(discard.dataset.dropAction).toBe("discard");
    const labels = discard.children.map((child) => child.textContent);
    expect(labels).toContain("Discard");
    const pass = layer.children.find((child) => child.dataset.dropId === "pass:p1");
    expect(pass.classList.contains("is-over")).toBe(false);
    expect(pass.children.map((child) => child.textContent)).toEqual(["Pass", "Riley"]);
    hideDropLayer(doc);
    expect(doc.getElementById(DROP_LAYER_ID)).toBeNull();
  });

  test("default Play takes half the play column with equal width to Game Board and Play Area", () => {
    const root = new FakeNode("DIV", "table");
    const row = new FakeNode("SECTION", "board-row");
    row.classList.add("board-row");
    row.boundingRect = { left: 320, top: 100, width: 940, height: 420 };
    const piles = new FakeNode("DIV", "pile-stack");
    piles.classList.add("pile-stack");
    piles.boundingRect = { left: 934, top: 100, width: 326, height: 420 };
    piles.append(
      zone("decks", { left: 934, top: 100, width: 326, height: 206 }),
      zone("discards", { left: 934, top: 314, width: 326, height: 206 })
    );
    row.append(
      zone("board", { left: 320, top: 100, width: 600, height: 206 }),
      zone("play", { left: 320, top: 100, width: 940, height: 420 }, "play-drop-zone"),
      piles,
      zone("play-area", { left: 320, top: 314, width: 600, height: 206 })
    );
    root.append(row);

    const zones = collectDropZones(root);
    const playDefault = zones.find((item) => item.id === "play:default");
    const gameboard = zones.find((item) => item.id === "play:gameboard");
    const playarea = zones.find((item) => item.id === "play:playarea");

    expect(playDefault.rect).toEqual({ left: 620, top: 100, width: 300, height: 420 });
    expect(gameboard.rect).toEqual({ left: 320, top: 100, width: 300, height: 206 });
    expect(playarea.rect).toEqual({ left: 320, top: 314, width: 300, height: 206 });
    expect(playDefault.rect.width).toBe(gameboard.rect.width);
    expect(playDefault.rect.width).toBe(playarea.rect.width);

    expect(dropZoneAtPoint(zones, { x: 450, y: 150 }).id).toBe("play:gameboard");
    expect(dropZoneAtPoint(zones, { x: 450, y: 400 }).id).toBe("play:playarea");
    expect(dropZoneAtPoint(zones, { x: 750, y: 150 }).id).toBe("play:default");
    expect(dropZoneAtPoint(zones, { x: 750, y: 400 }).id).toBe("play:default");
  });

  test("narrow layout still splits the play column equally left of the pile stack", () => {
    const root = new FakeNode("DIV", "table");
    const row = new FakeNode("SECTION", "board-row");
    row.classList.add("board-row");
    row.boundingRect = { left: 12, top: 100, width: 796, height: 608 };
    const piles = new FakeNode("DIV", "pile-stack");
    piles.classList.add("pile-stack");
    piles.boundingRect = { left: 476, top: 308, width: 332, height: 400 };
    row.append(
      zone("board", { left: 12, top: 100, width: 796, height: 200 }),
      zone("play-area", { left: 12, top: 308, width: 450, height: 200 }),
      piles
    );
    root.append(row);

    const zones = collectDropZones(root);
    const playDefault = zones.find((item) => item.id === "play:default");
    const gameboard = zones.find((item) => item.id === "play:gameboard");
    const playarea = zones.find((item) => item.id === "play:playarea");

    expect(playDefault.rect).toEqual({ left: 237, top: 100, width: 225, height: 608 });
    expect(gameboard.rect).toEqual({ left: 12, top: 100, width: 225, height: 200 });
    expect(playarea.rect).toEqual({ left: 12, top: 308, width: 225, height: 200 });
  });
});

function createFakeTile() {
  const classSet = new Set();
  const listeners = new Map();
  const docListeners = new Map();
  const ownerDocument = {
    addEventListener(type, fn) {
      const list = docListeners.get(type) || [];
      list.push(fn);
      docListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      const list = (docListeners.get(type) || []).filter((handler) => handler !== fn);
      docListeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of docListeners.get(event.type) || []) handler(event);
      return true;
    },
  };
  return {
    style: { transform: "", zIndex: "", transitionDuration: "" },
    isConnected: true,
    classList: {
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
      contains: (name) => classSet.has(name),
    },
    ownerDocument,
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
      return true;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
  };
}

function pointerEvent(type, { pointerId = 1, button = 0, clientX, clientY } = {}) {
  return {
    type,
    pointerId,
    button,
    clientX,
    clientY,
    preventDefault() {},
  };
}

describe("drag hooks for drop-zone overlays", () => {
  test("onDragMove runs after click slop and onDragEnd runs on pointerup", () => {
    const tile = createFakeTile();
    const moves = [];
    const ends = [];
    enableCardDrag(tile, "hand-1", new Map(), {
      onDragMove: (ctx) => moves.push(ctx.point),
      onDragEnd: (ctx) => ends.push(ctx.point),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 4, clientY: 0 })
    );
    expect(moves).toEqual([]);
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 20, clientY: 12 })
    );
    expect(moves).toEqual([{ x: 20, y: 12 }]);
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 40, clientY: 80 })
    );
    expect(ends).toEqual([{ x: 40, y: 80 }]);
  });

  test("dropping on a zone fires onDropTarget even after onDragEnd hid overlays", () => {
    const tile = createFakeTile();
    const hits = [];
    enableCardDrag(tile, "hand-2", new Map(), {
      findDropTarget: (ctx) => (ctx.point.x >= 30 ? { id: "discard" } : null),
      onDropTarget: ({ target }) => {
        hits.push(target.id);
        return false;
      },
      onDragEnd: () => hits.push("end"),
    });
    tile.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointermove", { clientX: 40, clientY: 40 })
    );
    tile.ownerDocument.dispatchEvent(
      pointerEvent("pointerup", { clientX: 40, clientY: 40 })
    );
    expect(hits).toEqual(["end", "discard"]);
  });
});

describe("drag action request bodies", () => {
  test("play destination, pass target, and return are included in the POST body", () => {
    expect(
      visualHandActionBody({
        action: "play",
        cardId: "hand-1",
        channelId: "thread-1",
        guildId: "guild-1",
        destination: "gameboard",
      })
    ).toMatchObject({ action: "play", destination: "gameboard" });
    expect(
      visualHandActionBody({
        action: "pass",
        cardId: "hand-1",
        channelId: "thread-1",
        guildId: "guild-1",
        targetUserId: "p2",
      })
    ).toMatchObject({ action: "pass", targetUserId: "p2" });
    expect(
      visualHandActionBody({
        action: "return",
        cardId: "hand-1",
        channelId: "thread-1",
        guildId: "guild-1",
      })
    ).toMatchObject({ action: "return", cardId: "hand-1" });
    expect(
      visualHandActionBody({
        action: "play",
        cardId: "hand-1",
        channelId: "thread-1",
        guildId: "guild-1",
      })
    ).not.toHaveProperty("destination");
  });

  test("submitHandCardAction posts destination and targetUserId", async () => {
    const bodies = [];
    await submitHandCardAction(
      "play",
      { id: "hand-1" },
      {
        getSession: () => ({
          config: { apiHost: "", mock: true, channelId: "t", guildId: "g" },
          accessToken: "tok",
          guildId: "g",
        }),
        isActionInFlight: () => false,
        selectedChannelId: (id) => id,
        setDeckActionsLocked: () => {},
        setInspectActionError: () => {},
        setActionNotice: () => {},
        closeInspectAfterFailedAction: () => {},
        closeCardInspect: () => {},
        flushDeferredSnapshot: () => {},
        applySnapshot: () => {},
        readFixture: () => "several-games",
        fetchImpl: async (_url, init) => {
          bodies.push(JSON.parse(init.body));
          return {
            ok: true,
            text: async () => JSON.stringify({ version: "v1", channelId: "t", hand: [] }),
          };
        },
      },
      { destination: "playarea" }
    );
    await submitHandCardAction(
      "pass",
      { id: "hand-1" },
      {
        getSession: () => ({
          config: { apiHost: "", mock: true, channelId: "t", guildId: "g" },
          accessToken: "tok",
          guildId: "g",
        }),
        isActionInFlight: () => false,
        selectedChannelId: (id) => id,
        setDeckActionsLocked: () => {},
        setInspectActionError: () => {},
        setActionNotice: () => {},
        closeInspectAfterFailedAction: () => {},
        closeCardInspect: () => {},
        flushDeferredSnapshot: () => {},
        applySnapshot: () => {},
        readFixture: () => "several-games",
        fetchImpl: async (_url, init) => {
          bodies.push(JSON.parse(init.body));
          return {
            ok: true,
            text: async () => JSON.stringify({ version: "v1", channelId: "t", hand: [] }),
          };
        },
      },
      { targetUserId: "p2" }
    );
    expect(bodies[0]).toMatchObject({
      action: "play",
      cardId: "hand-1",
      destination: "playarea",
    });
    expect(bodies[1]).toMatchObject({
      action: "pass",
      cardId: "hand-1",
      targetUserId: "p2",
    });
  });

  test("submitHandCardAction tells the player when an action is already in flight", async () => {
    const notices = [];
    let posted = false;
    await submitHandCardAction(
      "discard",
      { id: "hand-1" },
      {
        getSession: () => ({
          config: { apiHost: "", mock: true, channelId: "t", guildId: "g" },
          accessToken: "tok",
          guildId: "g",
        }),
        isActionInFlight: () => true,
        selectedChannelId: (id) => id,
        setDeckActionsLocked: () => {},
        setInspectActionError: () => {},
        setActionNotice: (message) => notices.push(message),
        closeInspectAfterFailedAction: () => {},
        closeCardInspect: () => {},
        flushDeferredSnapshot: () => {},
        applySnapshot: () => {},
        fetchImpl: async () => {
          posted = true;
          return { ok: true, text: async () => "{}" };
        },
      }
    );
    expect(posted).toBe(false);
    expect(notices).toEqual(["Wait for that action to finish."]);
  });
});

describe("drop-zone markup and styles", () => {
  test("the table has a default play zone and overlay styles", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    expect(html).toContain('data-zone="play"');
    expect(html).toContain("play-drop-zone");
    expect(css).toContain("#card-drop-layer");
    expect(css).toContain(".card-drop-zone.is-over");
    expect(css).toContain(".card-drop-label");
    expect(css).toContain(".zone.play-drop-zone");
    expect(css).toMatch(
      /\.zone\.play-drop-zone\s*\{[^}]*background:\s*transparent/
    );
    expect(css).toMatch(
      /\.board-row\s*>\s*\[data-zone="play"\]\s*\{[^}]*position:\s*absolute/
    );
    expect(css).toMatch(
      /\.board-row\s*>\s*\.pile-stack\s*\{[^}]*grid-column:\s*2/
    );
    expect(css).not.toMatch(/#card-drop-layer[^{]*\{[^}]*pointer-events:\s*auto/);
  });
});
