const { afterEach, describe, expect, test } = require("bun:test");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { workingChromeBin } = require("./helpers/chrome.js");
const {
  closeCardInspect,
  closeInspectAfterFailedAction,
  inspectKeyCommand,
  isInspectTypingTarget,
  openCardInspect,
  setInspectCardActionHandler,
} = require("../embedded-client/src/cardInspect.ts");
const { submitHandCardAction } = require("../embedded-client/src/submitHandCardAction.ts");
const { isSnapshotPollBlocked } = require("../embedded-client/src/snapshotPoll.ts");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const HTML_PATH = path.join(__dirname, "..", "embedded-client", "index.html");

class FakeElement {
  constructor(tagName, id = "") {
    this.tagName = String(tagName || "DIV").toUpperCase();
    this.id = id;
    this.hidden = false;
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.open = false;
    this.isContentEditable = false;
    this.parentNode = null;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.classSet = new Set();
    this.listeners = new Map();
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

  getAttribute(name) {
    return this.attributes[name];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "open") this.open = true;
    if (name === "contenteditable") this.isContentEditable = value !== "false";
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "open") this.open = false;
    if (name === "contenteditable") this.isContentEditable = false;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  matches(selector) {
    const parts = String(selector || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.some((part) => {
      if (part === "input") return this.tagName === "INPUT";
      if (part === "textarea") return this.tagName === "TEXTAREA";
      if (part === "select") return this.tagName === "SELECT";
      if (part.startsWith("[contenteditable]")) {
        return this.isContentEditable === true;
      }
      if (part === "[data-inspect-nav]") return Boolean(this.dataset.inspectNav);
      if (part === "[data-card-action]") return Boolean(this.dataset.cardAction);
      if (part === "dialog[open]") {
        return this.tagName === "DIALOG" && (this.open || this.hasAttribute("open"));
      }
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      const attr = part.match(/^\[data-card-action(?:=\"([^\"]*)\")?\]$/);
      if (attr) {
        if (attr[1] == null) return Boolean(this.dataset.cardAction);
        return this.dataset.cardAction === attr[1];
      }
      if (part === "button.card-inspect-action") {
        return this.tagName === "BUTTON" && this.classList.contains("card-inspect-action");
      }
      return part.toUpperCase() === this.tagName;
    });
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (typeof node.matches === "function" && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
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

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = nodes;
    for (const child of nodes) child.parentNode = this;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  cloneNode() {
    const copy = new this.constructor(this.tagName, this.id);
    copy.textContent = this.textContent;
    return copy;
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) || []) handler(event);
    return true;
  }

  showModal() {
    this.open = true;
    this.setAttribute("open", "");
  }

  close() {
    this.open = false;
    this.removeAttribute("open");
    this.dispatchEvent({ type: "close" });
  }
}

class FakeHTMLElement extends FakeElement {}
class FakeHTMLImageElement extends FakeHTMLElement {
  constructor(id) {
    super("IMG", id);
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.complete = false;
    this.boundingRect = { left: 0, top: 0, width: 0, height: 0 };
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
}
class FakeHTMLDialogElement extends FakeHTMLElement {
  constructor(id) {
    super("DIALOG", id);
  }
}

function put(nodes, el) {
  if (el.id) nodes[el.id] = el;
  return el;
}

function installInspectDocument({ showModalThrows = false } = {}) {
  const nodes = {};
  const docListeners = new Map();
  const dialog = put(nodes, new FakeHTMLDialogElement("card-inspect"));
  if (showModalThrows) {
    dialog.showModal = () => {
      throw new Error("showModal unavailable");
    };
  }
  put(nodes, new FakeHTMLImageElement("card-inspect-art"));
  put(nodes, new FakeHTMLElement("DIV", "card-inspect-proxy"));
  put(nodes, new FakeHTMLElement("P", "card-inspect-title"));
  put(nodes, new FakeHTMLElement("P", "card-inspect-caption"));
  put(nodes, new FakeHTMLElement("DIV", "card-inspect-meta"));
  const actions = put(nodes, new FakeHTMLElement("DIV", "card-inspect-actions"));
  actions.hidden = true;
  for (const action of ["play", "discard", "show"]) {
    const button = new FakeHTMLElement("BUTTON");
    button.dataset.cardAction = action;
    button.classList.add("card-inspect-action");
    button.textContent = action.toUpperCase();
    actions.append(button);
  }
  const inspectError = put(nodes, new FakeHTMLElement("P", "card-inspect-error"));
  inspectError.hidden = true;
  const prev = put(nodes, new FakeHTMLElement("BUTTON", "card-inspect-prev"));
  prev.hidden = true;
  prev.dataset.inspectNav = "prev";
  const next = put(nodes, new FakeHTMLElement("BUTTON", "card-inspect-next"));
  next.hidden = true;
  next.dataset.inspectNav = "next";
  const input = put(nodes, new FakeHTMLElement("INPUT", "action-count"));
  const textarea = put(nodes, new FakeHTMLElement("TEXTAREA", "notes"));
  const select = put(nodes, new FakeHTMLElement("SELECT", "game-select"));
  const editable = put(nodes, new FakeHTMLElement("DIV", "score-edit"));
  editable.setAttribute("contenteditable", "true");

  const document = {
    nodes,
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
    getElementById(id) {
      return nodes[id] || null;
    },
    querySelector(selector) {
      if (selector === "dialog[open]") {
        return dialog.open || dialog.hasAttribute("open") ? dialog : null;
      }
      return Object.values(nodes).find((node) => node.matches(selector)) || null;
    },
  };

  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.HTMLImageElement = FakeHTMLImageElement;
  globalThis.HTMLDialogElement = FakeHTMLDialogElement;
  globalThis.document = document;

  return { document, dialog, prev, next, actions, input, textarea, select, editable };
}

function makeTile(label) {
  const face = new FakeHTMLElement("DIV");
  face.classList.add("card-face");
  face.textContent = label;
  const tile = new FakeHTMLElement("ARTICLE");
  tile.append(face);
  return tile;
}

function keyEvent(key, target) {
  let prevented = false;
  return {
    type: "keydown",
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target,
    preventDefault() {
      prevented = true;
    },
    wasPrevented() {
      return prevented;
    },
  };
}

function dispatchKey(document, key, target) {
  const event = keyEvent(key, target ?? document);
  document.dispatchEvent(event);
  return event;
}

function clickEvent(target, clientX = 0, clientY = 0) {
  return {
    type: "click",
    target,
    clientX,
    clientY,
    preventDefault() {},
    stopPropagation() {},
  };
}

function sizePhotoArt(art, { naturalWidth, naturalHeight, box }) {
  art.naturalWidth = naturalWidth;
  art.naturalHeight = naturalHeight;
  art.complete = true;
  art.boundingRect = box;
}

function handSequence() {
  const copper = { id: "hand-1", name: "Copper" };
  const silver = { id: "hand-2", name: "Silver" };
  const gold = { id: "hand-3", name: "Gold" };
  const tiles = [makeTile("Copper"), makeTile("Silver"), makeTile("Gold")];
  return {
    copper,
    silver,
    gold,
    tiles,
    sequence: [
      { card: copper, imageSrc: "/copper.png", tile: tiles[0] },
      { card: silver, imageSrc: "/silver.png", tile: tiles[1] },
      { card: gold, imageSrc: "/gold.png", tile: tiles[2] },
    ],
  };
}

const previousGlobals = {
  document: globalThis.document,
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  HTMLImageElement: globalThis.HTMLImageElement,
  HTMLDialogElement: globalThis.HTMLDialogElement,
};

afterEach(() => {
  try {
    setInspectCardActionHandler(null);
    closeCardInspect();
  } catch {
    // document may already have been restored
  }
  globalThis.document = previousGlobals.document;
  globalThis.Element = previousGlobals.Element;
  globalThis.HTMLElement = previousGlobals.HTMLElement;
  globalThis.HTMLImageElement = previousGlobals.HTMLImageElement;
  globalThis.HTMLDialogElement = previousGlobals.HTMLDialogElement;
});

describe("inspect overlay keyboard navigation", () => {
  test("document ArrowRight and ArrowLeft step cards without wrapping", () => {
    const { document, prev, next } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    const title = document.getElementById("card-inspect-title");
    openCardInspect(copper, "/copper.png", tiles[0], sequence);

    expect(title.textContent).toBe("Copper");
    expect(prev.hidden).toBe(true);
    expect(next.hidden).toBe(false);

    expect(dispatchKey(document, "ArrowRight").wasPrevented()).toBe(true);
    expect(title.textContent).toBe("Silver");
    expect(prev.hidden).toBe(false);
    expect(next.hidden).toBe(false);

    expect(dispatchKey(document, "ArrowRight").wasPrevented()).toBe(true);
    expect(title.textContent).toBe("Gold");
    expect(prev.hidden).toBe(false);
    expect(next.hidden).toBe(true);

    expect(dispatchKey(document, "ArrowRight").wasPrevented()).toBe(true);
    expect(title.textContent).toBe("Gold");

    expect(dispatchKey(document, "ArrowLeft").wasPrevented()).toBe(true);
    expect(title.textContent).toBe("Silver");
  });

  test("keydown on an input does not navigate or call preventDefault", () => {
    const { document, input } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    const title = document.getElementById("card-inspect-title");
    openCardInspect(copper, "/copper.png", tiles[0], sequence);

    const event = dispatchKey(document, "ArrowRight", input);
    expect(event.wasPrevented()).toBe(false);
    expect(title.textContent).toBe("Copper");
    expect(isInspectTypingTarget(input)).toBe(true);
    expect(inspectKeyCommand({ key: "ArrowRight", target: input }, true)).toBeNull();
  });

  test("textarea, select, and contenteditable are ignored the same way", () => {
    const { document, textarea, select, editable } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    const title = document.getElementById("card-inspect-title");
    openCardInspect(copper, "/copper.png", tiles[0], sequence);

    for (const target of [textarea, select, editable]) {
      const event = dispatchKey(document, "ArrowRight", target);
      expect(event.wasPrevented()).toBe(false);
      expect(title.textContent).toBe("Copper");
    }
  });

  test("arrow keys do nothing when the overlay is closed", () => {
    const { document } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    openCardInspect(copper, "/copper.png", tiles[0], sequence);
    closeCardInspect();
    const title = document.getElementById("card-inspect-title");
    const event = dispatchKey(document, "ArrowRight");
    expect(event.wasPrevented()).toBe(false);
    expect(title.textContent).toBe("Copper");
  });

  test("showModal fallback still steps, and still ignores focused inputs", () => {
    const { document, dialog, input } = installInspectDocument({ showModalThrows: true });
    const { copper, sequence, tiles } = handSequence();
    const title = document.getElementById("card-inspect-title");
    openCardInspect(copper, "/copper.png", tiles[0], sequence);

    expect(dialog.open).toBe(true);
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dispatchKey(document, "ArrowRight").wasPrevented()).toBe(true);
    expect(title.textContent).toBe("Silver");

    const ignored = dispatchKey(document, "ArrowRight", input);
    expect(ignored.wasPrevented()).toBe(false);
    expect(title.textContent).toBe("Silver");
  });
});

describe("inspect overlay click-outside", () => {
  const photoBox = { left: 50, top: 40, width: 200, height: 200 };

  test("a click on the dialog margin closes the overlay", () => {
    const { document, dialog } = installInspectDocument();
    const photo = { id: "host-image:m1:a1", name: "Image" };
    openCardInspect(photo, "/photo.png", makeTile("Image"));
    expect(dialog.open).toBe(true);

    dialog.dispatchEvent(clickEvent(dialog, 10, 10));
    expect(dialog.open).toBe(false);
  });

  test("letterbox pixels on the photo close; painted pixels do not", () => {
    const { document, dialog } = installInspectDocument();
    const art = document.getElementById("card-inspect-art");
    const photo = { id: "host-image:m1:a1", name: "Image" };
    openCardInspect(photo, "/photo.png", makeTile("Image"));
    sizePhotoArt(art, { naturalWidth: 400, naturalHeight: 100, box: photoBox });
    expect(dialog.classList.contains("is-photo")).toBe(true);
    expect(dialog.open).toBe(true);

    dialog.dispatchEvent(clickEvent(art, 150, 140));
    expect(dialog.open).toBe(true);

    dialog.dispatchEvent(clickEvent(art, 150, 50));
    expect(dialog.open).toBe(false);
  });

  test("an unloaded photo click does not close, and X/nav are not treated as outside", () => {
    const { document, dialog, next } = installInspectDocument();
    const art = document.getElementById("card-inspect-art");
    const photos = [
      { card: { id: "host-image:m1:a1", name: "One" }, imageSrc: "/one.png", tile: makeTile("One") },
      { card: { id: "host-image:m1:a2", name: "Two" }, imageSrc: "/two.png", tile: makeTile("Two") },
    ];
    openCardInspect(photos[0].card, photos[0].imageSrc, photos[0].tile, photos);
    sizePhotoArt(art, { naturalWidth: 0, naturalHeight: 0, box: photoBox });
    expect(dialog.open).toBe(true);
    expect(next.hidden).toBe(false);

    dialog.dispatchEvent(clickEvent(art, 150, 50));
    expect(dialog.open).toBe(true);

    const closeBtn = new FakeHTMLElement("BUTTON");
    closeBtn.classList.add("card-inspect-close");
    dialog.dispatchEvent(clickEvent(closeBtn, 190, 20));
    expect(dialog.open).toBe(true);

    dialog.dispatchEvent(clickEvent(next, 230, 140));
    expect(dialog.open).toBe(true);
    expect(art.src).toBe("/two.png");
  });

  test("card inspect art clicks do not close even with letterboxed math", () => {
    const { document, dialog } = installInspectDocument();
    const art = document.getElementById("card-inspect-art");
    const { copper, tiles } = handSequence();
    openCardInspect(copper, "/copper.png", tiles[0]);
    sizePhotoArt(art, { naturalWidth: 400, naturalHeight: 100, box: photoBox });
    expect(dialog.classList.contains("is-photo")).toBe(false);

    dialog.dispatchEvent(clickEvent(art, 150, 50));
    expect(dialog.open).toBe(true);
  });
});

describe("inspect overlay hand actions", () => {
  test("PLAY DISCARD SHOW appear for hand cards and invoke the matching action", () => {
    const { dialog, actions } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    const calls = [];
    setInspectCardActionHandler((action, card) => {
      calls.push({ action, card });
    });
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    expect(actions.hidden).toBe(false);
    expect(actions.children.map((button) => button.dataset.cardAction)).toEqual([
      "play",
      "discard",
      "show",
    ]);
    expect(actions.children[0].title).toBe("Play a card from your hand.");
    expect(actions.children[1].title).toBe("discard a card (not shown to everyone)");
    expect(actions.children[2].title).toBe(
      "Show a card from your hand to other players. The card stays in your hand."
    );

    dialog.dispatchEvent(clickEvent(actions.children[0]));
    dialog.dispatchEvent(clickEvent(actions.children[1]));
    dialog.dispatchEvent(clickEvent(actions.children[2]));
    expect(calls).toEqual([
      { action: "play", card: copper },
      { action: "discard", card: copper },
      { action: "show", card: copper },
    ]);
  });

  test("actions stay hidden for play-area cards and host photos", () => {
    const { actions } = installInspectDocument();
    const { copper, tiles } = handSequence();
    openCardInspect(copper, "/copper.png", tiles[0]);
    expect(actions.hidden).toBe(true);

    const photo = { id: "host-image:m1:a1", name: "Image" };
    openCardInspect(photo, "/photo.png", makeTile("Image"), null, { handActions: true });
    expect(actions.hidden).toBe(true);
  });
});

describe("inspect overlay vs snapshot poll", () => {
  function handActionHooks(overrides = {}) {
    const applied = [];
    const notices = [];
    let flushed = 0;
    const session = {
      config: { apiHost: "", mock: true, channelId: "thread-1", guildId: "guild-1" },
      accessToken: "tok",
      guildId: "guild-1",
    };
    return {
      applied,
      notices,
      flushed: () => flushed,
      session,
      hooks: {
        getSession: () => session,
        isActionInFlight: () => false,
        selectedChannelId: (id) => id,
        setDeckActionsLocked: () => {},
        setInspectActionError: () => {},
        setActionNotice: (text) => {
          notices.push(text);
        },
        closeInspectAfterFailedAction,
        closeCardInspect,
        flushDeferredSnapshot: () => {
          flushed += 1;
        },
        applySnapshot: (_config, payload) => {
          applied.push(payload);
        },
        readFixture: () => "several-games",
        fetchImpl: async () => ({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ error: "card_not_in_hand" }),
        }),
        ...overrides,
      },
    };
  }

  test("submitHandCardAction closes inspect on a failed PLAY so snapshot polls resume", async () => {
    const { document, dialog, actions } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    expect(dialog.open).toBe(true);
    expect(actions.hidden).toBe(false);
    expect(isSnapshotPollBlocked(document)).toBe(true);

    const { applied, hooks } = handActionHooks();
    await submitHandCardAction("play", copper, hooks);

    expect(dialog.open).toBe(false);
    expect(isSnapshotPollBlocked(document)).toBe(false);
    expect(applied).toEqual([]);
  });

  test("submitHandCardAction does not apply an empty HTTP 200 body", async () => {
    const { document, dialog } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    expect(isSnapshotPollBlocked(document)).toBe(true);

    const { applied, hooks } = handActionHooks({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => "",
      }),
    });
    await submitHandCardAction("play", copper, hooks);

    expect(dialog.open).toBe(false);
    expect(applied).toEqual([]);
    expect(isSnapshotPollBlocked(document)).toBe(false);
  });

  test("submitHandCardAction does not apply a non-JSON HTTP 200 body", async () => {
    const { dialog } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });

    const { applied, hooks } = handActionHooks({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => "{}",
      }),
    });
    await submitHandCardAction("discard", copper, hooks);

    expect(dialog.open).toBe(false);
    expect(applied).toEqual([]);
  });

  test("submitHandCardAction closes inspect when session or cardId is missing", async () => {
    const { document, dialog } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    expect(isSnapshotPollBlocked(document)).toBe(true);

    const missingSession = handActionHooks({ getSession: () => null });
    await submitHandCardAction("play", copper, missingSession.hooks);
    expect(dialog.open).toBe(false);
    expect(missingSession.applied).toEqual([]);
    expect(isSnapshotPollBlocked(document)).toBe(false);

    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    const missingCard = handActionHooks();
    await submitHandCardAction("show", { id: 123 }, missingCard.hooks);
    expect(dialog.open).toBe(false);
    expect(missingCard.applied).toEqual([]);
  });

  test("submitHandCardAction applies a valid snapshot and closes inspect", async () => {
    const { dialog } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    for (const item of sequence) item.handActions = true;
    openCardInspect(copper, "/copper.png", tiles[0], sequence, { handActions: true });
    const snapshot = { version: "v1", channelId: "thread-1", hand: [] };
    const { applied, hooks } = handActionHooks({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(snapshot),
      }),
    });
    await submitHandCardAction("play", copper, hooks);
    expect(dialog.open).toBe(false);
    expect(applied).toEqual([snapshot]);
  });

  test("a poll while inspect is open is deferred and leaves no stale index after close", () => {
    const { document } = installInspectDocument();
    const { copper, sequence, tiles } = handSequence();
    const title = document.getElementById("card-inspect-title");
    const prev = document.getElementById("card-inspect-prev");
    const next = document.getElementById("card-inspect-next");
    openCardInspect(copper, "/copper.png", tiles[0], sequence);

    expect(isSnapshotPollBlocked(document)).toBe(true);
    const parked = [];
    function applySnapshotLike(payload) {
      if (isSnapshotPollBlocked(document)) {
        parked.push(payload);
        return false;
      }
      closeCardInspect();
      parked.length = 0;
      return true;
    }

    expect(applySnapshotLike({ version: "v2" })).toBe(false);
    expect(parked).toEqual([{ version: "v2" }]);
    expect(title.textContent).toBe("Copper");

    dispatchKey(document, "ArrowRight");
    expect(title.textContent).toBe("Silver");
    expect(isSnapshotPollBlocked(document)).toBe(true);

    closeCardInspect();
    expect(isSnapshotPollBlocked(document)).toBe(false);
    expect(applySnapshotLike(parked[0])).toBe(true);
    expect(parked).toEqual([]);

    const leftover = dispatchKey(document, "ArrowLeft");
    expect(leftover.wasPrevented()).toBe(false);
    expect(prev.hidden).toBe(true);
    expect(next.hidden).toBe(true);
  });
});

function inspectNavHarness(css, dialogHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      :root { --ink: #f4efe6; --panel-edge: #5a4c3a; --muted: #c8bba8; }
      html, body { margin: 0; height: 100%; background: #0c0a08; }
      ${css}
    </style>
  </head>
  <body>
    ${dialogHtml}
    <script type="module" src="/harness.js"></script>
  </body>
</html>`;
}

const NAV_HARNESS_JS = `
function box(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}
function inside(inner, outer, slack = 1) {
  return (
    inner.left >= outer.left - slack &&
    inner.right <= outer.right + slack &&
    inner.top >= outer.top - slack &&
    inner.bottom <= outer.bottom + slack
  );
}
try {
  const dialog = document.getElementById("card-inspect");
  const sheet = document.querySelector(".card-inspect-sheet");
  const prev = document.getElementById("card-inspect-prev");
  const next = document.getElementById("card-inspect-next");
  const title = document.getElementById("card-inspect-title");
  prev.hidden = false;
  next.hidden = false;
  title.textContent = "Queen of Diamonds";
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sheetBox = box(sheet);
  const prevBox = box(prev);
  const nextBox = box(next);
  const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      viewportWidth: window.innerWidth,
      sheet: sheetBox,
      prev: prevBox,
      next: nextBox,
      prevInsideSheet: inside(prevBox, sheetBox),
      nextInsideSheet: inside(nextBox, sheetBox),
      prevInsideViewport: inside(prevBox, viewport),
      nextInsideViewport: inside(nextBox, viewport),
    }),
  });
} catch (error) {
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: String(error && error.stack ? error.stack : error) }),
  });
}
`;

describe("inspect nav arrows stay inside the sheet", () => {
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

  test.skipIf(!chrome)("QA: prev/next stay inside the sheet at a 420px Activity width", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const html = fs.readFileSync(HTML_PATH, "utf8");
    const dialogHtml = html.slice(
      html.indexOf('<dialog id="card-inspect"'),
      html.indexOf("</dialog>", html.indexOf('<dialog id="card-inspect"')) + "</dialog>".length
    );

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
          return new Response(NAV_HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        if (url.pathname === "/overlay") {
          return new Response(inspectNavHarness(css, dialogHtml), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response(
          `<!doctype html><title>Activity frame</title><iframe src="/overlay" width="420" height="720" style="border:0;background:#0c0a08"></iframe>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      },
    });

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "inspect-nav-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-first-run",
        "--window-size=800,800",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("chrome harness timed out")), 12_000)
      ),
    ]);
    expect(result.error).toBeUndefined();
    expect(result.viewportWidth).toBe(420);
    expect(result.prevInsideSheet).toBe(true);
    expect(result.nextInsideSheet).toBe(true);
    expect(result.prevInsideViewport).toBe(true);
    expect(result.nextInsideViewport).toBe(true);
    expect(result.prev.left).toBeGreaterThanOrEqual(result.sheet.left);
    expect(result.next.right).toBeLessThanOrEqual(result.sheet.right);
  });
});

const ART_OVERFLOW_HARNESS_JS = `
function box(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}
try {
  const dialog = document.getElementById("card-inspect");
  const sheet = document.querySelector(".card-inspect-sheet");
  const art = document.getElementById("card-inspect-art");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">' +
    '<rect width="900" height="700" fill="#c9a066"/>' +
    "</svg>";
  art.hidden = false;
  art.alt = "Charisma";
  art.src = "data:image/svg+xml," + encodeURIComponent(svg);
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
  if (typeof art.decode === "function") await art.decode();
  else await new Promise((resolve) => { art.onload = resolve; if (art.complete) resolve(); });
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sheetBox = box(sheet);
  const artBox = box(art);
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      viewportWidth: window.innerWidth,
      overflowX: getComputedStyle(sheet).overflowX,
      sheetWidth: sheetBox.width,
      sheetClientWidth: sheet.clientWidth,
      sheetScrollWidth: sheet.scrollWidth,
      artWidth: artBox.width,
      artCenter: (artBox.left + artBox.right) / 2,
      sheetCenter: (sheetBox.left + sheetBox.right) / 2,
    }),
  });
} catch (error) {
  await fetch("/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: String(error && error.stack ? error.stack : error) }),
  });
}
`;

describe("inspect art fits a wide card image", () => {
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

  test.skipIf(!chrome)("QA: wide card art is centered with no horizontal scroll", async () => {
    const css = fs.readFileSync(STYLE_PATH, "utf8");
    const html = fs.readFileSync(HTML_PATH, "utf8");
    const dialogHtml = html.slice(
      html.indexOf('<dialog id="card-inspect"'),
      html.indexOf("</dialog>", html.indexOf('<dialog id="card-inspect"')) + "</dialog>".length
    );

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
          return new Response(ART_OVERFLOW_HARNESS_JS, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response(inspectNavHarness(css, dialogHtml), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "inspect-art-"));
    chromeProc = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-first-run",
        "--window-size=1100,900",
        `--user-data-dir=${userDataDir}`,
        String(server.url),
      ],
      { stdio: "ignore" }
    );

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("chrome harness timed out")), 12_000)
      ),
    ]);
    expect(result.error).toBeUndefined();
    expect(result.overflowX).toBe("auto");
    expect(result.sheetWidth).toBeGreaterThan(32 * 16);
    expect(result.sheetScrollWidth).toBeLessThanOrEqual(result.sheetClientWidth + 1);
    expect(result.artWidth).toBeGreaterThan(200);
    expect(result.artWidth).toBeLessThanOrEqual(result.sheetClientWidth + 1);
    expect(Math.abs(result.artCenter - result.sheetCenter)).toBeLessThanOrEqual(8);
  });
});

