export type CardOffset = { x: number; y: number; z?: number };

export type DropPoint = { x: number; y: number };

export type DropTarget = { id: string };

export type DropContext = {
  cardId: string;
  point: DropPoint;
  tile: HTMLElement;
};

/**
 * Drop-target hook for later tickets.
 *
 * `findDropTarget` identifies a target under the pointer. `onDropTarget` runs
 * that target's action and returns `true` to consume the drop (the card stays
 * with the target). Any other result, or no target, snaps the card back to
 * the slot and visual state it had before this drag.
 *
 * This ticket wires no targets, so every drop snaps back and game state is
 * unchanged.
 */
export type CardDropHooks = {
  findDropTarget?: (ctx: DropContext) => DropTarget | null | undefined;
  onDropTarget?: (ctx: DropContext & { target: DropTarget }) => boolean | void;
};

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

/**
 * Client-only drag. Positions live in the provided map and reset whenever the
 * caller replaces it (snapshot reload or a full page refresh).
 *
 * Dropping outside a drop target snaps the card back to its rest slot. Pass
 * `findDropTarget` / `onDropTarget` when a later ticket adds targets; a
 * consumed drop keeps the card where the target put it. No PATCH or game-state
 * changes happen here.
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
    abortPendingSnap(tile);
    const pointerId = event.pointerId;
    activePointer = pointerId;
    const rest = copyOffset(positions.get(cardId));
    const origin = raiseTile(tile, rest);
    positions.set(cardId, origin);
    const start = { x: event.clientX, y: event.clientY };
    tile.classList.add("dragging");
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
    function move(ev: Event) {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      if (tile.isConnected === false) {
        detachDragListeners();
        return;
      }
      const next = nextOffset(origin, start, {
        x: pointer.clientX,
        y: pointer.clientY,
      });
      positions.set(cardId, next);
      applyCardOffset(tile, next);
    }
    function up(ev: Event) {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      detachDragListeners();
      if (tile.isConnected === false) return;

      const ctx: DropContext = {
        cardId,
        point: { x: pointer.clientX, y: pointer.clientY },
        tile,
      };
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
