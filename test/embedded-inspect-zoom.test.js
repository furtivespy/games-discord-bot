const { describe, expect, test } = require("bun:test");
const {
  INSPECT_PAN_SLOP_PX,
  INSPECT_PAN_X_VAR,
  INSPECT_PAN_Y_VAR,
  INSPECT_PANNING_CLASS,
  INSPECT_ZOOM_FACTOR,
  INSPECT_ZOOM_IDENTITY,
  INSPECT_ZOOM_MAX,
  INSPECT_ZOOM_MIN,
  INSPECT_ZOOM_VAR,
  INSPECT_ZOOMED_CLASS,
  applyInspectZoom,
  applyInspectZoomStyle,
  clampInspectPan,
  clampInspectZoom,
  inspectBoxCenter,
  inspectPanBy,
  inspectZoomFromWheel,
  inspectZoomedPaintedRect,
  isInspectZoomed,
  normalizeInspectZoom,
} = require("../embedded-client/src/inspectZoom.ts");
const { inspectContainedImageRect } = require("../embedded-client/src/cardInspect.ts");

const LAYOUT = { left: 50, top: 40, width: 200, height: 200 };
const PAINTED = inspectContainedImageRect(LAYOUT, 400, 100);

function localPoint(state, pointer, origin) {
  return {
    x: (pointer.x - origin.x - state.panX) / state.scale,
    y: (pointer.y - origin.y - state.panY) / state.scale,
  };
}

describe("inspect photo zoom math", () => {
  test("scale stays between the fitted size and the cap", () => {
    expect(INSPECT_ZOOM_MIN).toBe(1);
    expect(INSPECT_ZOOM_MAX).toBe(4);
    expect(clampInspectZoom(0.2)).toBe(1);
    expect(clampInspectZoom(9)).toBe(4);
    expect(clampInspectZoom(Number.NaN)).toBe(1);
    expect(inspectZoomFromWheel(1, 120)).toBe(1);
    expect(inspectZoomFromWheel(1, 0)).toBe(1);
    expect(inspectZoomFromWheel(1, -100)).toBeCloseTo(INSPECT_ZOOM_FACTOR, 8);
    let scale = 1;
    for (let i = 0; i < 40; i += 1) scale = inspectZoomFromWheel(scale, -100);
    expect(scale).toBe(INSPECT_ZOOM_MAX);
  });

  test("zoom toward a cursor point keeps that point stable", () => {
    expect(PAINTED).toEqual({ left: 50, top: 115, width: 200, height: 50 });
    const origin = inspectBoxCenter(LAYOUT);
    const pointer = { x: 120, y: 140 };
    const zoomed = applyInspectZoom(
      INSPECT_ZOOM_IDENTITY,
      2,
      pointer,
      LAYOUT,
      PAINTED
    );
    expect(zoomed.scale).toBe(2);
    const before = localPoint(INSPECT_ZOOM_IDENTITY, pointer, origin);
    const after = localPoint(zoomed, pointer, origin);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  test("pan is a no-op at 1× and is clamped so the fitted rect stays covered", () => {
    expect(inspectPanBy(INSPECT_ZOOM_IDENTITY, 40, -20, PAINTED)).toEqual(INSPECT_ZOOM_IDENTITY);
    const zoomed = { scale: 2, panX: 0, panY: 0 };
    expect(clampInspectPan(zoomed, PAINTED)).toEqual(zoomed);
    const panned = inspectPanBy(zoomed, 40, -10, PAINTED);
    expect(panned.scale).toBe(2);
    expect(panned.panX).toBe(40);
    expect(panned.panY).toBe(-10);
    const spilled = inspectPanBy(zoomed, 400, 400, PAINTED);
    expect(spilled.panX).toBe(100);
    expect(spilled.panY).toBe(25);
    expect(isInspectZoomed(spilled)).toBe(true);
    expect(isInspectZoomed(INSPECT_ZOOM_IDENTITY)).toBe(false);
  });

  test("zoomed painted rect matches translate then scale at the layout center", () => {
    const identity = inspectZoomedPaintedRect(PAINTED, LAYOUT, INSPECT_ZOOM_IDENTITY);
    expect(identity).toEqual(PAINTED);
    const zoomed = inspectZoomedPaintedRect(PAINTED, LAYOUT, { scale: 2, panX: 0, panY: 0 });
    expect(zoomed).toEqual({ left: -50, top: 90, width: 400, height: 100 });
    const panned = inspectZoomedPaintedRect(PAINTED, LAYOUT, { scale: 2, panX: 20, panY: -10 });
    expect(panned).toEqual({ left: -30, top: 80, width: 400, height: 100 });
  });

  test("style writes CSS vars only while zoomed", () => {
    expect(INSPECT_PAN_SLOP_PX).toBe(8);
    const props = {};
    const classes = new Set();
    const target = {
      classList: {
        toggle(name, force) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
      style: {
        setProperty(name, value) {
          props[name] = value;
        },
        removeProperty(name) {
          delete props[name];
        },
      },
    };
    applyInspectZoomStyle(target, { scale: 2, panX: 12, panY: -8 }, true);
    expect(props[INSPECT_ZOOM_VAR]).toBe("2");
    expect(props[INSPECT_PAN_X_VAR]).toBe("12px");
    expect(props[INSPECT_PAN_Y_VAR]).toBe("-8px");
    expect(classes.has(INSPECT_ZOOMED_CLASS)).toBe(true);
    expect(classes.has(INSPECT_PANNING_CLASS)).toBe(true);
    applyInspectZoomStyle(target, INSPECT_ZOOM_IDENTITY, false);
    expect(props[INSPECT_ZOOM_VAR]).toBeUndefined();
    expect(classes.has(INSPECT_ZOOMED_CLASS)).toBe(false);
    expect(classes.has(INSPECT_PANNING_CLASS)).toBe(false);
    expect(normalizeInspectZoom({ scale: "2", panX: Number.NaN, panY: 4 })).toEqual({
      scale: 2,
      panX: 0,
      panY: 4,
    });
  });
});
