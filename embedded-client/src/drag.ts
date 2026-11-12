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

  tile.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    const origin = positions.get(cardId) || { x: 0, y: 0 };
    const start = { x: event.clientX, y: event.clientY };
    tile.classList.add("dragging");
    try {
      tile.setPointerCapture(event.pointerId);
    } catch {
      // jsdom / older browsers
    }

    const move = (ev: PointerEvent) => {
      const next = nextOffset(origin, start, { x: ev.clientX, y: ev.clientY });
      positions.set(cardId, next);
      tile.style.transform = translateCss(next.x, next.y);
    };
    const up = (ev: PointerEvent) => {
      try {
        tile.releasePointerCapture(ev.pointerId);
      } catch {
        // already released
      }
      tile.classList.remove("dragging");
      tile.removeEventListener("pointermove", move);
      tile.removeEventListener("pointerup", up);
      tile.removeEventListener("pointercancel", up);
    };
    tile.addEventListener("pointermove", move);
    tile.addEventListener("pointerup", up);
    tile.addEventListener("pointercancel", up);
  });
}
