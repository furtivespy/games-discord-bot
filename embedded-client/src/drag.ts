export type CardOffset = { x: number; y: number };

export function translateCss(x: number, y: number): string {
  return `translate(${x}px, ${y}px)`;
}

export function nextOffset(
  origin: CardOffset,
  start: CardOffset,
  current: CardOffset
): CardOffset {
  return {
    x: origin.x + (current.x - start.x),
    y: origin.y + (current.y - start.y),
  };
}

/**
 * Client-only drag: store translate(x, y) per card id. No drop targets, no PATCH.
 * Positions live in the provided map and reset whenever the caller replaces it
 * (snapshot reload or a full page refresh).
 */
export function enableCardDrag(
  tile: HTMLElement,
  cardId: string,
  positions: Map<string, CardOffset>
) {
  const existing = positions.get(cardId);
  if (existing) {
    tile.style.transform = translateCss(existing.x, existing.y);
  }

  let activePointer: number | null = null;

  tile.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (activePointer != null) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    activePointer = pointerId;
    const origin = positions.get(cardId) || { x: 0, y: 0 };
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
      tile.style.transform = translateCss(next.x, next.y);
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
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
}
