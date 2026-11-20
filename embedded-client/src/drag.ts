export type CardOffset = { x: number; y: number; z?: number };

export type DropPoint = { x: number; y: number };

export type DropTarget = { id: string };

export type DropContext = {
  cardId: string;
  point: DropPoint;
  tile: HTMLElement;
};

/**
 * Drop-target hook.
 *
 * `findDropTarget` identifies a target under the pointer. `onDropTarget` runs
 * that target's action and returns `true` to consume the drop (the card stays
 * with the target). Any other result, or no target, snaps the card back to
 * the slot and visual state it had before this drag.
 *
 * `onDragMove` runs after the pointer has traveled past CLICK_SLOP_PX so the
 * table can paint drop-zone overlays. `onDragEnd` always runs when the drag
 * finishes (drop, cancel, or the tile disconnects).
 */
export type InspectContext = {
  cardId: string;
  tile: HTMLElement;
};

export type CardDropHooks = {
  findDropTarget?: (ctx: DropContext) => DropTarget | null | undefined;
  onDropTarget?: (ctx: DropContext & { target: DropTarget }) => boolean | void;
  /** Pointerup with travel below CLICK_SLOP_PX. Dragging past that skips this. */
  onInspect?: (ctx: InspectContext) => void;
  onDragMove?: (ctx: DropContext) => void;
  onDragEnd?: (ctx: DropContext) => void;
};

/** Pointer travel below this is a click (inspect), not a drag. */
export const CLICK_SLOP_PX = 8;

/** Above `.card-tile:hover { z-index: 30 }` so a dragged card stays grabbable. */
export const STACK_ABOVE_HOVER = 40;

/** Snap-back animation length. Applied as `.snapping` inline duration. */
export const SNAP_BACK_DURATION_MS = 220;

let stackSeq = STACK_ABOVE_HOVER;

export function nextCardStackOrder(): number {
  stackSeq += 1;
  return stackSeq;
}

export function translateCss(x: number, y: number): string {
  return `translate(${x}px, ${y}px)`;
}

/** Read translate(x, y) from a computed `transform` matrix. */
export function parseTranslate(transform: string | null | undefined): CardOffset | null {
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const text = transform.trim();
  if (text.startsWith("matrix3d(")) {
    const n = text
      .slice(9, -1)
      .split(",")
      .map((part) => Number.parseFloat(part));
    if (n.length < 14 || !Number.isFinite(n[12]) || !Number.isFinite(n[13])) return null;
    return { x: n[12], y: n[13] };
  }
  if (text.startsWith("matrix(")) {
    const n = text
      .slice(7, -1)
      .split(",")
      .map((part) => Number.parseFloat(part));
    if (n.length < 6 || !Number.isFinite(n[4]) || !Number.isFinite(n[5])) return null;
    return { x: n[4], y: n[5] };
  }
  return null;
}

/** Where the tile is on screen right now, including a mid-snap interpolated translate. */
export function visualOffset(tile: HTMLElement): CardOffset | null {
  const view = tile.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return null;
  try {
    return parseTranslate(view.getComputedStyle(tile).transform);
  } catch {
    return null;
  }
}

/** Freeze a mid-snap tile so aborting the CSS transition cannot jump it to rest. */
function pinVisualOffset(tile: HTMLElement, offset: CardOffset) {
  applyCardOffset(tile, offset);
  tile.style.transitionDuration = "0s";
}

export function nextOffset(
  origin: CardOffset,
  start: CardOffset,
  current: CardOffset
): CardOffset {
  const next: CardOffset = {
    x: origin.x + (current.x - start.x),
    y: origin.y + (current.y - start.y),
  };
  if (origin.z != null) next.z = origin.z;
  return next;
}

export function isMovedOffset(offset: CardOffset | undefined): boolean {
  return Boolean(offset && (offset.x !== 0 || offset.y !== 0));
}

export function copyOffset(offset: CardOffset | undefined): CardOffset {
  const copy: CardOffset = { x: offset?.x ?? 0, y: offset?.y ?? 0 };
  if (offset?.z != null) copy.z = offset.z;
  return copy;
}

function syncMovedClass(tile: HTMLElement, offset: CardOffset | undefined) {
  tile.classList.toggle("moved", isMovedOffset(offset));
}

export function applyCardOffset(tile: HTMLElement, offset: CardOffset | undefined) {
  if (!offset) return;
  tile.style.transform =
    offset.x === 0 && offset.y === 0 ? "" : translateCss(offset.x, offset.y);
  tile.style.zIndex = offset.z != null ? String(offset.z) : "";
  syncMovedClass(tile, offset);
}

function raiseTile(tile: HTMLElement, origin: CardOffset): CardOffset {
  const raised = { ...origin, z: nextCardStackOrder() };
  applyCardOffset(tile, raised);
  return raised;
}

function forceReflow(tile: HTMLElement) {
  if (typeof tile.getBoundingClientRect === "function") {
    tile.getBoundingClientRect();
  }
}

function canAnimateSnap(tile: HTMLElement): boolean {
  // Fake tiles in unit tests have no layout engine; skip the CSS transition
  // there so existing assertions can stay synchronous. Real documents always
  // animate using SNAP_BACK_DURATION_MS.
  return Boolean(tile.ownerDocument?.defaultView?.getComputedStyle);
}

function clearDragClasses(tile: HTMLElement) {
  tile.classList.remove("dragging");
  tile.classList.remove("snapping");
  tile.classList.remove("moved");
  tile.style.transitionDuration = "";
}

type PendingSnap = { abort: () => void };

const pendingSnaps = new WeakMap<HTMLElement, PendingSnap>();

/** Cancel an in-flight snap without restoring rest (a new drag may be live). */
export function abortPendingSnap(tile: HTMLElement) {
  const pending = pendingSnaps.get(tile);
  if (!pending) return;
  pendingSnaps.delete(tile);
  pending.abort();
}

/**
 * Restore the tile's pre-drag slot (order is unchanged in the DOM) and visual
 * state: transform, z-index, and drag classes. Face, rotation, size, and
 * selection live on the tile's contents / other classes and are not modified
 * during drag.
 */
export function snapCardBack(
  tile: HTMLElement,
  cardId: string,
  positions: Map<string, CardOffset>,
  rest: CardOffset
) {
  abortPendingSnap(tile);
  tile.classList.remove("dragging");
  const finish = () => {
    clearDragClasses(tile);
    applyCardOffset(tile, rest);
  };
  positions.set(cardId, copyOffset(rest));
  if (!canAnimateSnap(tile)) {
    finish();
    return;
  }

  tile.classList.add("snapping");
  tile.style.transitionDuration = `${SNAP_BACK_DURATION_MS}ms`;
  forceReflow(tile);
  applyCardOffset(tile, rest);

  let settled = false;
  function onEnd(event: Event) {
    if (event.target !== tile) return;
    const property = (event as TransitionEvent).propertyName;
    if (property && property !== "transform") return;
    settle();
  }
  function settle() {
    if (settled) return;
    settled = true;
    pendingSnaps.delete(tile);
    tile.removeEventListener("transitionend", onEnd);
    if (tile.isConnected === false) return;
    if (tile.classList.contains("dragging")) return;
    finish();
  }
  const timer = setTimeout(settle, SNAP_BACK_DURATION_MS + 50);
  pendingSnaps.set(tile, {
    abort: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tile.removeEventListener("transitionend", onEnd);
      tile.classList.remove("snapping");
      tile.style.transitionDuration = "";
    },
  });
  tile.addEventListener("transitionend", onEnd);
}

function dropWasConsumed(
  hooks: CardDropHooks | undefined,
  ctx: DropContext
): boolean {
  const target = hooks?.findDropTarget?.(ctx) ?? null;
  if (!target) return false;
  return Boolean(hooks?.onDropTarget?.({ ...ctx, target }));
}

function pointerTravel(start: DropPoint, current: DropPoint): number {
  return Math.hypot(current.x - start.x, current.y - start.y);
}

/**
 * Client-only drag. Positions live in the provided map and reset whenever the
 * caller replaces it (snapshot reload or a full page refresh).
 *
 * Dropping outside a drop target snaps the card back to its rest slot. A
 * consumed drop (`onDropTarget` returns true) keeps the card where it landed.
 */
export function enableCardDrag(
  tile: HTMLElement,
  cardId: string,
  positions: Map<string, CardOffset>,
  hooks?: CardDropHooks
) {
  applyCardOffset(tile, positions.get(cardId));

  let activePointer: number | null = null;

  tile.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (activePointer != null) return;
    event.preventDefault();
    const rest = copyOffset(positions.get(cardId));
    // Freeze the interpolated snap position before removing `.snapping`, or
    // the tile jumps to the rest slot (inline transform is already rest).
    const visual = tile.classList.contains("snapping") ? visualOffset(tile) : null;
    if (visual) pinVisualOffset(tile, visual);
    abortPendingSnap(tile);
    const pointerId = event.pointerId;
    activePointer = pointerId;
    const origin = raiseTile(tile, visual ?? rest);
    positions.set(cardId, origin);
    const start = { x: event.clientX, y: event.clientY };
    tile.classList.add("dragging");
    let pastClickSlop = false;
    try {
      tile.setPointerCapture(pointerId);
    } catch {
      // jsdom / older browsers: document listeners still end the drag
    }

    const eventTarget: EventTarget = tile.ownerDocument ?? tile;
    let detached = false;
    function detachDragListeners() {
      if (detached) return;
      detached = true;
      activePointer = null;
      try {
        tile.releasePointerCapture(pointerId);
      } catch {
        // already released or never captured
      }
      eventTarget.removeEventListener("pointermove", move);
      eventTarget.removeEventListener("pointerup", up);
      eventTarget.removeEventListener("pointercancel", up);
    }
    function crossedClickSlop(point: DropPoint): boolean {
      if (!pastClickSlop && pointerTravel(start, point) >= CLICK_SLOP_PX) {
        pastClickSlop = true;
      }
      return pastClickSlop;
    }
    function move(ev: Event) {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      if (tile.isConnected === false) {
        detachDragListeners();
        hooks?.onDragEnd?.({
          cardId,
          point: { x: pointer.clientX, y: pointer.clientY },
          tile,
        });
        return;
      }
      const point = { x: pointer.clientX, y: pointer.clientY };
      if (!crossedClickSlop(point)) return;
      const next = nextOffset(origin, start, point);
      positions.set(cardId, next);
      applyCardOffset(tile, next);
      hooks?.onDragMove?.({ cardId, point, tile });
    }
    function up(ev: Event) {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      detachDragListeners();
      const ctx: DropContext = {
        cardId,
        point: { x: pointer.clientX, y: pointer.clientY },
        tile,
      };
      hooks?.onDragEnd?.(ctx);
      if (tile.isConnected === false) return;

      // pointerup can jump without a move event (OS coalescing). Measure
      // travel here too so a far-away up is a drag, not inspect.
      if (!crossedClickSlop(ctx.point)) {
        tile.classList.remove("dragging");
        positions.set(cardId, copyOffset(rest));
        applyCardOffset(tile, rest);
        if (ev.type !== "pointercancel") {
          hooks?.onInspect?.({ cardId, tile });
        }
        return;
      }

      if (dropWasConsumed(hooks, ctx)) {
        tile.classList.remove("dragging");
        const current = positions.get(cardId) || origin;
        positions.set(cardId, raiseTile(tile, current));
        return;
      }
      snapCardBack(tile, cardId, positions, rest);
    }
    eventTarget.addEventListener("pointermove", move);
    eventTarget.addEventListener("pointerup", up);
    eventTarget.addEventListener("pointercancel", up);
  });
}
