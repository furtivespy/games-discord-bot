export type CardOffset = { x: number; y: number; z?: number };

/** Above `.card-tile:hover { z-index: 30 }` so a dropped card stays grabbable. */
export const STACK_ABOVE_HOVER = 40;

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

function syncMovedClass(tile: HTMLElement, offset: CardOffset | undefined) {
  tile.classList.toggle("moved", isMovedOffset(offset));
}

export function applyCardOffset(tile: HTMLElement, offset: CardOffset | undefined) {
  if (!offset) return;
  tile.style.transform = translateCss(offset.x, offset.y);
  if (offset.z != null) tile.style.zIndex = String(offset.z);
  syncMovedClass(tile, offset);
}

function raiseTile(tile: HTMLElement, origin: CardOffset): CardOffset {
  const raised = { ...origin, z: nextCardStackOrder() };
  applyCardOffset(tile, raised);
  return raised;
}

/**
 * Client-only drag: store translate(x, y) per card id. No drop targets, no PATCH.
 * Positions live in the provided map and reset whenever the caller replaces it
 * (snapshot reload or a full page refresh). Each pointerdown bumps the tile's
 * z-index so the last-touched card stays above other rows' cards.
 */
export function enableCardDrag(
  tile: HTMLElement,
  cardId: string,
  positions: Map<string, CardOffset>
) {
  applyCardOffset(tile, positions.get(cardId));

  let activePointer: number | null = null;

  tile.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (activePointer != null) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    activePointer = pointerId;
    const origin = raiseTile(tile, positions.get(cardId) || { x: 0, y: 0 });
    positions.set(cardId, origin);
    const start = { x: event.clientX, y: event.clientY };
    tile.classList.add("dragging");
    try {
      tile.setPointerCapture(pointerId);
    } catch {
      // jsdom / older browsers: document listeners still end the drag
    }

    const target: EventTarget = tile.ownerDocument ?? tile;
    const move = (ev: Event) => {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      const next = nextOffset(origin, start, {
        x: pointer.clientX,
        y: pointer.clientY,
      });
      positions.set(cardId, next);
      applyCardOffset(tile, next);
    };
    const up = (ev: Event) => {
      const pointer = ev as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      activePointer = null;
      try {
        tile.releasePointerCapture(pointerId);
      } catch {
        // already released or never captured
      }
      tile.classList.remove("dragging");
      syncMovedClass(tile, positions.get(cardId));
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
}
