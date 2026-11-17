const { afterEach, describe, expect, test } = require("bun:test");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  closeCardInspect,
  inspectKeyCommand,
  isInspectTypingTarget,
  openCardInspect,
} = require("../embedded-client/src/cardInspect.ts");
const { isSnapshotPollBlocked } = require("../embedded-client/src/snapshotPoll.ts");

const STYLE_PATH = path.join(__dirname, "..", "embedded-client", "src", "style.css");
const HTML_PATH = path.join(__dirname, "..", "embedded-client", "index.html");

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
      if (part === "dialog[open]") {
        return this.tagName === "DIALOG" && (this.open || this.hasAttribute("open"));
      }
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
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

  return { document, dialog, prev, next, input, textarea, select, editable };
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

describe("inspect overlay vs snapshot poll", () => {
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

