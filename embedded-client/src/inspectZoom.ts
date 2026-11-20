/** Base (fitted) size. Wheel never goes below this, and never zooms out. */
export const INSPECT_ZOOM_MIN = 1;

/** Cap so a helper chart stays readable without turning into noise. */
export const INSPECT_ZOOM_MAX = 4;

/** Scale multiplier per 100px of wheel delta. */
export const INSPECT_ZOOM_FACTOR = 1.12;

/** Pointer travel before a photo drag counts as a pan, not a click. */
export const INSPECT_PAN_SLOP_PX = 8;

/** Ignore leftover outside-clicks from a pan for this long. */
export const INSPECT_PAN_CLICK_GUARD_MS = 80;

export const INSPECT_ZOOM_VAR = "--inspect-zoom";
export const INSPECT_PAN_X_VAR = "--inspect-pan-x";
export const INSPECT_PAN_Y_VAR = "--inspect-pan-y";
export const INSPECT_ZOOMED_CLASS = "is-zoomed";
export const INSPECT_PANNING_CLASS = "is-panning";

export type InspectZoomBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type InspectZoomPoint = { x: number; y: number };

export type InspectZoomState = {
  scale: number;
  panX: number;
  panY: number;
};

export const INSPECT_ZOOM_IDENTITY: InspectZoomState = {
  scale: INSPECT_ZOOM_MIN,
  panX: 0,
  panY: 0,
};

export function clampInspectZoom(scale: number): number {
  if (!Number.isFinite(scale)) return INSPECT_ZOOM_MIN;
  return Math.min(INSPECT_ZOOM_MAX, Math.max(INSPECT_ZOOM_MIN, scale));
}

export function isInspectZoomed(state: InspectZoomState | null | undefined): boolean {
  return clampInspectZoom(Number(state?.scale)) > INSPECT_ZOOM_MIN + 1e-6;
}

export function inspectBoxCenter(box: InspectZoomBox): InspectZoomPoint {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function normalizeInspectZoom(
  state: InspectZoomState | null | undefined
): InspectZoomState {
  return {
    scale: clampInspectZoom(Number(state?.scale)),
    panX: finiteOrZero(Number(state?.panX)),
    panY: finiteOrZero(Number(state?.panY)),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keep the zoomed photo covering its unzoomed painted rect so pan cannot
 * expose empty letterbox inside the original image.
 */
export function clampInspectPan(
  state: InspectZoomState,
  painted: InspectZoomBox | null | undefined
): InspectZoomState {
  const scale = clampInspectZoom(state.scale);
  if (scale <= INSPECT_ZOOM_MIN || !painted) {
    return { ...INSPECT_ZOOM_IDENTITY };
  }
  const width = Number(painted.width);
  const height = Number(painted.height);
  if (!(width > 0 && height > 0)) return { ...INSPECT_ZOOM_IDENTITY };
  const maxX = (width * (scale - 1)) / 2;
  const maxY = (height * (scale - 1)) / 2;
  return {
    scale,
    panX: clampNumber(finiteOrZero(state.panX), -maxX, maxX),
    panY: clampNumber(finiteOrZero(state.panY), -maxY, maxY),
  };
}

/** Convert wheel deltaY to CSS pixels. LINE/PAGE modes are not pixels. */
export function inspectWheelDeltaY(event: {
  deltaY?: number;
  deltaMode?: number;
} | null | undefined): number {
  const dy = Number(event?.deltaY);
  if (!Number.isFinite(dy) || dy === 0) return 0;
  const mode = Number(event?.deltaMode);
  if (mode === 1) return dy * 16;
  if (mode === 2) return dy * 100;
  return dy;
}

/**
 * Wheel up / pinch-out zooms in. FUR-284 does not allow zoom out: positive
 * delta is a no-op, and scale never drops. Close / next photo resets to 1×.
 */
export function inspectZoomFromWheel(scale: number, deltaY: number): number {
  const current = clampInspectZoom(scale);
  if (!Number.isFinite(deltaY) || deltaY >= 0) return current;
  const steps = Math.min(12, -deltaY / 100);
  return clampInspectZoom(current * INSPECT_ZOOM_FACTOR ** steps);
}

export function inspectPanBy(
  state: InspectZoomState,
  dx: number,
  dy: number,
  painted: InspectZoomBox | null | undefined
): InspectZoomState {
  const current = normalizeInspectZoom(state);
  if (!isInspectZoomed(current)) return { ...INSPECT_ZOOM_IDENTITY };
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return clampInspectPan(current, painted);
  }
  return clampInspectPan(
    { scale: current.scale, panX: current.panX + dx, panY: current.panY + dy },
    painted
  );
}

/**
 * Zoom toward `pointer` (client coordinates) so that point stays under the
 * cursor. `layout` is the untransformed object-fit box; `painted` is the
 * contained image inside it.
 */
export function inspectZoomToward(
  state: InspectZoomState,
  nextScale: number,
  pointer: InspectZoomPoint | null | undefined,
  layout: InspectZoomBox | null | undefined,
  painted: InspectZoomBox | null | undefined
): InspectZoomState {
  const current = normalizeInspectZoom(state);
  const scale = clampInspectZoom(nextScale);
  if (!layout || !painted) return clampInspectPan({ ...current, scale }, painted);
  const origin = inspectBoxCenter(layout);
  const px = pointer && Number.isFinite(pointer.x) ? pointer.x : origin.x;
  const py = pointer && Number.isFinite(pointer.y) ? pointer.y : origin.y;
  const factor = scale / current.scale;
  const panX = px - origin.x - factor * (px - origin.x - current.panX);
  const panY = py - origin.y - factor * (py - origin.y - current.panY);
  return clampInspectPan({ scale, panX, panY }, painted);
}

/** Map the unzoomed painted rect through translate(pan) scale(s) at layout center. */
export function inspectZoomedPaintedRect(
  painted: InspectZoomBox | null | undefined,
  layout: InspectZoomBox | null | undefined,
  zoom: InspectZoomState | null | undefined
): InspectZoomBox | null {
  if (!painted || !layout) return painted ?? null;
  const state = normalizeInspectZoom(zoom);
  const origin = inspectBoxCenter(layout);
  const width = painted.width * state.scale;
  const height = painted.height * state.scale;
  const left = origin.x + state.panX + (painted.left - origin.x) * state.scale;
  const top = origin.y + state.panY + (painted.top - origin.y) * state.scale;
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return { left, top, width, height };
}

export function intersectInspectBox(
  a: InspectZoomBox | null | undefined,
  b: InspectZoomBox | null | undefined
): InspectZoomBox | null {
  if (!a || !b) return null;
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** Zoomed painted pixels that are still inside the layout clip (overflow:hidden). */
export function inspectVisiblePaintedRect(
  painted: InspectZoomBox | null | undefined,
  layout: InspectZoomBox | null | undefined,
  zoom: InspectZoomState | null | undefined
): InspectZoomBox | null {
  return intersectInspectBox(inspectZoomedPaintedRect(painted, layout, zoom), layout);
}

type ZoomStyleTarget = {
  classList?: {
    toggle?: (name: string, force?: boolean) => unknown;
    remove?: (name: string) => unknown;
  };
  style?: {
    setProperty?: (name: string, value: string) => void;
    removeProperty?: (name: string) => void;
  };
};

export function applyInspectZoomStyle(
  target: ZoomStyleTarget | null | undefined,
  state: InspectZoomState,
  panning = false
) {
  if (!target) return;
  const live = normalizeInspectZoom(state);
  const zoomed = isInspectZoomed(live);
  target.classList?.toggle?.(INSPECT_ZOOMED_CLASS, zoomed);
  target.classList?.toggle?.(INSPECT_PANNING_CLASS, Boolean(panning) && zoomed);
  const style = target.style;
  if (!style) return;
  if (!zoomed) {
    style.removeProperty?.(INSPECT_ZOOM_VAR);
    style.removeProperty?.(INSPECT_PAN_X_VAR);
    style.removeProperty?.(INSPECT_PAN_Y_VAR);
    return;
  }
  style.setProperty?.(INSPECT_ZOOM_VAR, String(live.scale));
  style.setProperty?.(INSPECT_PAN_X_VAR, `${live.panX}px`);
  style.setProperty?.(INSPECT_PAN_Y_VAR, `${live.panY}px`);
}
