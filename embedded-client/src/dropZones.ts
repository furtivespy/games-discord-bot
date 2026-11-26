import type { DropPoint, DropTarget } from "./drag";
import type { PlayDestination } from "./visualActions";

export const DROP_LAYER_ID = "card-drop-layer";

export type { PlayDestination };

export type DropAction =
  | { kind: "pass"; targetUserId: string }
  | { kind: "play"; destination?: PlayDestination }
  | { kind: "return" }
  | { kind: "discard" };

export type ClientRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DropZone = DropTarget & {
  label: string;
  detail?: string;
  action: DropAction;
  rect: ClientRect;
};

type RectSource = {
  getBoundingClientRect?: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type ZoneRoot = {
  querySelector?: (selector: string) => unknown;
  querySelectorAll?: (selector: string) => Iterable<unknown> | ArrayLike<unknown>;
};

function asElement(value: unknown): (RectSource & Record<string, unknown>) | null {
  return value && typeof value === "object" ? (value as RectSource & Record<string, unknown>) : null;
}

export function clientRectOf(el: RectSource | null | undefined): ClientRect | null {
  if (typeof el?.getBoundingClientRect !== "function") return null;
  try {
    const rect = el.getBoundingClientRect();
    if (!rect) return null;
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![left, top, width, height].every(Number.isFinite)) return null;
    if (width <= 0 || height <= 0) return null;
    return { left, top, width, height };
  } catch {
    return null;
  }
}

export function pointInRect(point: DropPoint, rect: ClientRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

export function dropZoneAtPoint(zones: DropZone[], point: DropPoint): DropZone | null {
  for (const zone of zones) {
    if (pointInRect(point, zone.rect)) return zone;
  }
  return null;
}

function datasetOf(el: Record<string, unknown> | null): { userId?: string } {
  const dataset = el?.dataset;
  if (dataset && typeof dataset === "object") return dataset as { userId?: string };
  return {};
}

function classListContains(el: Record<string, unknown> | null, name: string): boolean {
  const classList = el?.classList as { contains?: (value: string) => boolean } | undefined;
  return Boolean(classList?.contains?.(name));
}

function childText(el: Record<string, unknown> | null, selector: string): string {
  const query = el?.querySelector as ((sel: string) => unknown) | undefined;
  if (typeof query !== "function") return "";
  const child = asElement(query.call(el, selector));
  const text = child && typeof child.textContent === "string" ? child.textContent : "";
  return text.trim();
}

function queryAll(root: ZoneRoot, selector: string): unknown[] {
  if (typeof root.querySelectorAll !== "function") return [];
  const found = root.querySelectorAll(selector);
  return found ? Array.from(found as ArrayLike<unknown>) : [];
}

function queryOne(root: ZoneRoot, selector: string): unknown {
  if (typeof root.querySelector !== "function") return null;
  return root.querySelector(selector);
}

function pushZone(
  zones: DropZone[],
  el: unknown,
  target: Omit<DropZone, "rect">
) {
  const rect = clientRectOf(asElement(el));
  if (!rect) return;
  zones.push({ ...target, rect });
}

function playColumnRightEdge(root: ZoneRoot, pileLeft: number): number {
  let right = 0;
  for (const selector of ['[data-zone="play-area"]', '[data-zone="board"]']) {
    const rect = clientRectOf(asElement(queryOne(root, selector)));
    if (!rect) continue;
    const edge = rect.left + rect.width;
    if (edge <= pileLeft + 1) right = Math.max(right, edge);
  }
  return right > 0 ? right : pileLeft;
}

function trimLeftOf(rect: ClientRect | null, limitLeft: number | null): ClientRect | null {
  if (!rect) return null;
  if (limitLeft == null) return rect;
  if (rect.left < limitLeft && rect.left + rect.width > limitLeft) {
    const width = limitLeft - rect.left;
    return width > 0 ? { ...rect, width } : null;
  }
  return rect;
}

/**
 * Right half of the play column (left of the piles), giving default Play the
 * same width as Game Board and Play Area while dragging.
 * Falls back to `[data-zone="play"]` when the table has no pile stack.
 */
export function centralPlayRect(root: ZoneRoot): ClientRect | null {
  const row = asElement(queryOne(root, ".board-row") || queryOne(root, "#board-row"));
  const piles = asElement(queryOne(root, ".pile-stack"));
  const rowRect = clientRectOf(row);
  const pileRect = clientRectOf(piles);
  if (rowRect && pileRect) {
    const spanRight = playColumnRightEdge(root, pileRect.left);
    const available = spanRight - rowRect.left;
    if (available > 8) {
      const width = available / 2;
      const left = rowRect.left + width;
      return { left, top: rowRect.top, width, height: rowRect.height };
    }
  }
  return clientRectOf(asElement(queryOne(root, '[data-zone="play"]')));
}

/**
 * Specific seats and piles first, then the default-play half-column, then
 * Game Board and Play Area (trimmed to the left half so all three play zones
 * share equal width without overlapping).
 */
export function collectDropZones(root: ZoneRoot): DropZone[] {
  const zones: DropZone[] = [];
  for (const chip of queryAll(root, ".player-chip")) {
    const el = asElement(chip);
    if (!el || classListContains(el, "is-you")) continue;
    const userId = String(datasetOf(el).userId || "").trim();
    if (!userId) continue;
    const name = childText(el, ".player-name") || "Player";
    pushZone(zones, chip, {
      id: `pass:${userId}`,
      label: "Pass",
      detail: name,
      action: { kind: "pass", targetUserId: userId },
    });
  }
  pushZone(zones, queryOne(root, '[data-zone="decks"]'), {
    id: "return",
    label: "Return",
    action: { kind: "return" },
  });
  pushZone(zones, queryOne(root, '[data-zone="discards"]'), {
    id: "discard",
    label: "Discard",
    action: { kind: "discard" },
  });
  const defaultRect = centralPlayRect(root);
  if (defaultRect) {
    zones.push({
      id: "play:default",
      label: "Play",
      rect: defaultRect,
      action: { kind: "play" },
    });
  }
  const boardRect = trimLeftOf(
    clientRectOf(asElement(queryOne(root, '[data-zone="board"]'))),
    defaultRect?.left ?? null
  );
  if (boardRect) {
    zones.push({
      id: "play:gameboard",
      label: "Play",
      detail: "Game Board",
      rect: boardRect,
      action: { kind: "play", destination: "gameboard" },
    });
  }
  const playAreaRect = trimLeftOf(
    clientRectOf(asElement(queryOne(root, '[data-zone="play-area"]'))),
    defaultRect?.left ?? null
  );
  if (playAreaRect) {
    zones.push({
      id: "play:playarea",
      label: "Play",
      detail: "Play Area",
      rect: playAreaRect,
      action: { kind: "play", destination: "playarea" },
    });
  }
  return zones;
}

type LayerDocument = {
  getElementById?: (id: string) => HTMLElement | null;
  createElement?: (tag: string) => HTMLElement;
  body?: { append?: (...nodes: HTMLElement[]) => void };
};

function layerParent(doc: LayerDocument): HTMLElement | null {
  const table = doc.getElementById?.("table");
  if (table) return table;
  return (doc.body as HTMLElement | undefined) || null;
}

export function hideDropLayer(doc: LayerDocument): void {
  const layer = doc.getElementById?.(DROP_LAYER_ID);
  layer?.remove?.();
}

function fillOverlay(overlay: HTMLElement, zone: DropZone, active: boolean) {
  overlay.classList.add("card-drop-zone");
  overlay.classList.toggle("is-over", active);
  overlay.dataset.dropId = zone.id;
  overlay.dataset.dropAction = zone.action.kind;
  overlay.style.position = "fixed";
  overlay.style.left = `${zone.rect.left}px`;
  overlay.style.top = `${zone.rect.top}px`;
  overlay.style.width = `${zone.rect.width}px`;
  overlay.style.height = `${zone.rect.height}px`;
  overlay.setAttribute("aria-hidden", "true");
  overlay.replaceChildren();
  const doc = overlay.ownerDocument;
  if (!doc?.createElement) return;
  const title = doc.createElement("span");
  title.className = "card-drop-label";
  title.textContent = zone.label;
  overlay.append(title);
  if (!zone.detail) return;
  const detail = doc.createElement("span");
  detail.className = "card-drop-detail";
  detail.textContent = zone.detail;
  overlay.append(detail);
}

export function paintDropZones(
  doc: LayerDocument,
  zones: DropZone[],
  activeId: string | null
): void {
  if (typeof doc.createElement !== "function") return;
  const parent = layerParent(doc);
  if (!parent) return;
  let layer = doc.getElementById?.(DROP_LAYER_ID);
  if (!layer) {
    layer = doc.createElement("div");
    layer.id = DROP_LAYER_ID;
    layer.setAttribute("aria-hidden", "true");
    parent.append(layer);
  }
  layer.replaceChildren();
  // Least-specific zones first so a large default Play sits under Pass /
  // Return / Discard / play-to-board overlays.
  for (const zone of [...zones].reverse()) {
    const overlay = doc.createElement("div");
    fillOverlay(overlay, zone, zone.id === activeId);
    layer.append(overlay);
  }
}
