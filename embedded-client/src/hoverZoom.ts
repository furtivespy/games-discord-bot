import { SNAP_BACK_DURATION_MS } from "./drag";

/** Matches `--card-hover-scale` on `:root`. */
export const CARD_HOVER_SCALE = 1.48;

/** Matches `translateY(-38px)` on `.card-tile:hover .card-face`. */
export const CARD_HOVER_LIFT_PX = 38;

export const HOVER_SHIFT_X_VAR = "--hover-shift-x";
export const HOVER_SHIFT_Y_VAR = "--hover-shift-y";

export type HoverBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type HoverShift = { x: number; y: number };

const boundTiles = new WeakSet<HTMLElement>();

function boxWidth(box: HoverBox): number {
  return box.right - box.left;
}

function boxHeight(box: HoverBox): number {
  return box.bottom - box.top;
}

/** Round away from zero so a fractional overflow still stays inside the clip. */
export function pixelShift(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) < 0.01) return 0;
  return value > 0 ? Math.ceil(value) : Math.floor(value);
}

export function intersectBoxes(a: HoverBox, b: HoverBox): HoverBox | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (!(right > left) || !(bottom > top)) return null;
  return { left, top, right, bottom };
}

/**
 * Hover zoom uses `transform-origin: center bottom`, then `translateY(-lift)`.
 * The tile (not the face) is the rest box because the face is the one that scales.
 */
export function hoverZoomRect(
  rest: HoverBox,
  options?: { scale?: number; liftPx?: number }
): HoverBox {
  const scale = options?.scale ?? CARD_HOVER_SCALE;
  const liftPx = options?.liftPx ?? CARD_HOVER_LIFT_PX;
  const width = boxWidth(rest);
  const height = boxHeight(rest);
  const scaledW = width * scale;
  const scaledH = height * scale;
  const originX = rest.left + width / 2;
  const originY = rest.bottom;
  return {
    left: originX - scaledW / 2,
    right: originX + scaledW / 2,
    top: originY - scaledH - liftPx,
    bottom: originY - liftPx,
  };
}

function clampAxis(start: number, size: number, min: number, max: number): number {
  const view = max - min;
  if (!(view > 0) || !Number.isFinite(start) || !Number.isFinite(size) || !(size > 0)) {
    return 0;
  }
  if (size >= view) {
    // Cover the clip with the least shift. Overflow on the far edge is inevitable.
    const lo = max - start - size;
    const hi = min - start;
    if (0 < lo) return lo;
    if (0 > hi) return hi;
    return 0;
  }
  if (start < min) return min - start;
  const end = start + size;
  if (end > max) return max - end;
  return 0;
}

/** Translate a zoomed box so it stays inside `clip`. Oversized boxes cover the clip with the least shift. */
export function clampHoverShift(zoomed: HoverBox, clip: HoverBox): HoverShift {
  return {
    x: pixelShift(clampAxis(zoomed.left, boxWidth(zoomed), clip.left, clip.right)),
    y: pixelShift(clampAxis(zoomed.top, boxHeight(zoomed), clip.top, clip.bottom)),
  };
}

export function hoverShiftForRects(
  rest: HoverBox,
  clip: HoverBox,
  options?: { scale?: number; liftPx?: number }
): HoverShift {
  return clampHoverShift(hoverZoomRect(rest, options), clip);
}

export function clientClipRect(el: HTMLElement): HoverBox {
  const rect = el.getBoundingClientRect();
  const view = el.ownerDocument?.defaultView;
  let borderLeft = 0;
  let borderTop = 0;
  if (view?.getComputedStyle) {
    try {
      const style = view.getComputedStyle(el);
      borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
      borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    } catch {
      borderLeft = 0;
      borderTop = 0;
    }
  }
  const width = Number.isFinite(el.clientWidth) ? el.clientWidth : rect.width;
  const height = Number.isFinite(el.clientHeight) ? el.clientHeight : rect.height;
  const left = rect.left + borderLeft;
  const top = rect.top + borderTop;
  return { left, top, right: left + width, bottom: top + height };
}

function viewportBox(view: Window): HoverBox | null {
  const width = view.innerWidth;
  const height = view.innerHeight;
  if (!(width > 0) || !(height > 0)) return null;
  return { left: 0, top: 0, right: width, bottom: height };
}

function queryClip(tile: HTMLElement, selector: string): HTMLElement | null {
  const found = tile.closest?.(selector) as HTMLElement | null | undefined;
  if (found && typeof found.getBoundingClientRect === "function") return found;
  return null;
}

/**
 * Board/play-area cards clip to `#table-main` inside `#table`. Hand cards sit
 * outside `#table-main`, so they clip to `#table` only.
 */
export function clipBoxForTile(tile: HTMLElement): HoverBox | null {
  const view = tile.ownerDocument?.defaultView;
  if (!view) return null;
  let clip = viewportBox(view);
  const table = queryClip(tile, "#table");
  const main = queryClip(tile, "#table-main");
  for (const node of [table, main]) {
    if (!node) continue;
    const next = clip ? intersectBoxes(clip, clientClipRect(node)) : clientClipRect(node);
    if (!next) return null;
    clip = next;
  }
  return clip;
}

function hoverScaleOf(tile: HTMLElement): number {
  const view = tile.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return CARD_HOVER_SCALE;
  try {
    const raw = view.getComputedStyle(tile).getPropertyValue("--card-hover-scale");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : CARD_HOVER_SCALE;
  } catch {
    return CARD_HOVER_SCALE;
  }
}

export function applyHoverShift(tile: HTMLElement, shift: HoverShift) {
  if (!tile.style?.setProperty) return;
  if (!shift.x && !shift.y) {
    clearHoverShift(tile);
    return;
  }
  tile.style.setProperty(HOVER_SHIFT_X_VAR, `${shift.x}px`);
  tile.style.setProperty(HOVER_SHIFT_Y_VAR, `${shift.y}px`);
}

export function clearHoverShift(tile: HTMLElement) {
  if (!tile.style?.removeProperty) return;
  tile.style.removeProperty(HOVER_SHIFT_X_VAR);
  tile.style.removeProperty(HOVER_SHIFT_Y_VAR);
}

export function hoverShiftForTile(tile: HTMLElement): HoverShift {
  if (typeof tile.getBoundingClientRect !== "function") return { x: 0, y: 0 };
  const clip = clipBoxForTile(tile);
  if (!clip) return { x: 0, y: 0 };
  const rest = tile.getBoundingClientRect();
  return hoverShiftForRects(
    { left: rest.left, top: rest.top, right: rest.right, bottom: rest.bottom },
    clip,
    { scale: hoverScaleOf(tile), liftPx: CARD_HOVER_LIFT_PX }
  );
}

function isHeldOff(tile: HTMLElement): boolean {
  return Boolean(
    tile.classList?.contains("dragging") || tile.classList?.contains("snapping")
  );
}

function syncHoverShift(tile: HTMLElement) {
  if (isHeldOff(tile)) {
    clearHoverShift(tile);
    return;
  }
  applyHoverShift(tile, hoverShiftForTile(tile));
}

function afterPaint(view: Window | null | undefined, cb: () => void) {
  const raf = view?.requestAnimationFrame?.bind(view);
  if (typeof raf === "function") {
    raf(cb);
    return;
  }
  if (typeof globalThis.requestAnimationFrame === "function") {
    globalThis.requestAnimationFrame(cb);
    return;
  }
  setTimeout(cb, 0);
}

/**
 * On hover, shift the zoomed face so it stays inside the board window
 * (`#table` / `#table-main`). Center cards get a zero shift.
 */
export function enableHoverZoomClamp(tile: HTMLElement) {
  if (boundTiles.has(tile)) return;
  boundTiles.add(tile);

  const view = tile.ownerDocument?.defaultView;
  let listening = false;
  let scrollParent: HTMLElement | null = null;
  let disconnectObserver: MutationObserver | null = null;
  let snapTimer: ReturnType<typeof setTimeout> | null = null;
  let applyEpoch = 0;

  function apply() {
    if (tile.isConnected === false) {
      stopLayoutListeners();
      clearHoverShift(tile);
      return;
    }
    syncHoverShift(tile);
  }

  function clearSnapTimer() {
    if (snapTimer == null) return;
    clearTimeout(snapTimer);
    snapTimer = null;
  }

  /**
   * drag.ts's transitionend handler (registered later) clears `.snapping` in
   * the same event. Wait a frame so rest-slot layout and class cleanup land
   * before measuring. Retry once if the tile is still mid-snap.
   */
  function applyAfterSnap() {
    const epoch = applyEpoch;
    const attempt = (retries: number) => {
      if (applyEpoch !== epoch || !listening) return;
      if (isHeldOff(tile) && retries > 0) {
        afterPaint(view, () => attempt(retries - 1));
        return;
      }
      apply();
    };
    afterPaint(view, () => attempt(1));
  }

  function onTileSnapEnd(event: Event) {
    if (event.target && event.target !== tile) return;
    if (event.type === "transitionend") {
      const property = (event as TransitionEvent).propertyName;
      if (property && property !== "transform") return;
    }
    applyAfterSnap();
  }

  function stopLayoutListeners() {
    if (!listening) return;
    listening = false;
    applyEpoch += 1;
    view?.removeEventListener("resize", apply);
    scrollParent?.removeEventListener("scroll", apply);
    scrollParent = null;
    disconnectObserver?.disconnect();
    disconnectObserver = null;
    tile.removeEventListener?.("transitionend", onTileSnapEnd);
    tile.removeEventListener?.("animationend", onTileSnapEnd);
    clearSnapTimer();
  }

  function watchDisconnect() {
    const parent = tile.parentElement;
    if (!parent || typeof MutationObserver !== "function") return;
    try {
      disconnectObserver = new MutationObserver(() => {
        if (tile.isConnected === false) {
          stopLayoutListeners();
          clearHoverShift(tile);
        }
      });
      disconnectObserver.observe(parent, { childList: true });
    } catch {
      disconnectObserver = null;
    }
  }

  function startLayoutListeners() {
    if (listening) return;
    listening = true;
    view?.addEventListener("resize", apply);
    scrollParent = queryClip(tile, "#table-main");
    scrollParent?.addEventListener("scroll", apply, { passive: true });
    tile.addEventListener("transitionend", onTileSnapEnd);
    tile.addEventListener("animationend", onTileSnapEnd);
    watchDisconnect();
  }

  function afterPointerRelease() {
    if (!listening) return;
    // Tile pointerup runs before drag.ts removes `.dragging` (document listener).
    // The microtask covers click-to-inspect. Snap-back still has the tile away
    // from its rest slot then, so reclamp on transform transitionend/animationend
    // (after a frame, once drag.ts has cleared `.snapping`) and after the snap
    // duration as a fallback.
    queueMicrotask(() => {
      if (!listening) return;
      apply();
    });
    clearSnapTimer();
    // drag.ts settles at SNAP_BACK_DURATION_MS + 50; wait past that.
    snapTimer = setTimeout(() => {
      snapTimer = null;
      if (!listening) return;
      applyAfterSnap();
    }, SNAP_BACK_DURATION_MS + 80);
  }

  tile.addEventListener("pointerenter", () => {
    apply();
    startLayoutListeners();
  });
  tile.addEventListener("pointerleave", () => {
    stopLayoutListeners();
    clearHoverShift(tile);
  });
  tile.addEventListener("pointerup", afterPointerRelease);
  tile.addEventListener("pointercancel", afterPointerRelease);
}
