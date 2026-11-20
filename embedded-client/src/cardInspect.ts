import {
  applyInspectZoomStyle,
  INSPECT_PAN_SLOP_PX,
  INSPECT_ZOOM_IDENTITY,
  inspectPanBy,
  inspectVisiblePaintedRect,
  inspectWheelDeltaY,
  inspectZoomFromWheel,
  inspectZoomToward,
  isInspectZoomed,
  type InspectZoomState,
} from "./inspectZoom";
import {
  HAND_CARD_ACTIONS,
  handCardActionFromDataset,
  type HandActionKind,
} from "./visualActions";

export type InspectableCard = {
  id?: string;
  name?: string;
  description?: string;
};

export type InspectLayout = "card" | "photo";

export type InspectView = {
  title: string;
  caption: string;
  showTitle: boolean;
  showArt: boolean;
  artSrc: string | null;
  showProxy: boolean;
  layout: InspectLayout;
};

export type InspectNavDirection = "prev" | "next";

export type InspectNavState = {
  index: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type InspectSequenceItem = {
  card: InspectableCard;
  imageSrc: string | null;
  tile: HTMLElement;
  handActions?: boolean;
};

export type InspectSession = {
  items: InspectSequenceItem[];
  index: number;
  nav: InspectNavState;
};

export const HOST_IMAGE_ID_PREFIX = "host-image:";
export const INSPECT_PHOTO_CLASS = "is-photo";
export const INSPECT_PHOTO_LABEL = "Enlarged photo";
export const INSPECT_PREV_LABEL = "Previous card";
export const INSPECT_NEXT_LABEL = "Next card";

const DIALOG_ID = "card-inspect";
const ART_ID = "card-inspect-art";
const PROXY_ID = "card-inspect-proxy";
const TITLE_ID = "card-inspect-title";
const CAPTION_ID = "card-inspect-caption";
const META_ID = "card-inspect-meta";
const PREV_ID = "card-inspect-prev";
const NEXT_ID = "card-inspect-next";
const ACTIONS_ID = "card-inspect-actions";
const ERROR_ID = "card-inspect-error";

/** Keep the pan-ending click suppressed until the browser has dispatched it. */
const INSPECT_SUPPRESS_CLICK_MS = 50;

let inspectBoundDocument: Document | null = null;
let inspectItems: InspectSequenceItem[] = [];
let inspectIndex = 0;
let inspectZoom: InspectZoomState = { ...INSPECT_ZOOM_IDENTITY };
let inspectPanning = false;
let inspectPanListening = false;
let inspectPanPointerId: number | null = null;
let inspectPanOrigin: { x: number; y: number } | null = null;
let inspectPanLast: { x: number; y: number } | null = null;
let inspectSuppressClick = false;
let inspectSuppressClickTimer: ReturnType<typeof setTimeout> | null = null;
let inspectCardActionHandler:
  | ((action: HandActionKind, card: InspectableCard) => void)
  | null = null;

export function isHostThreadImage(card: InspectableCard | null | undefined): boolean {
  const id = typeof card?.id === "string" ? card.id.trim() : "";
  return id.startsWith(HOST_IMAGE_ID_PREFIX);
}

export function inspectCardTitle(card: InspectableCard | null | undefined): string {
  const name = typeof card?.name === "string" ? card.name.trim() : "";
  return name || "Card";
}

export function inspectCardCaption(card: InspectableCard | null | undefined): string {
  return typeof card?.description === "string" ? card.description.trim() : "";
}

export function inspectView(
  card: InspectableCard | null | undefined,
  imageSrc: string | null | undefined
): InspectView {
  const artSrc = typeof imageSrc === "string" && imageSrc.trim() ? imageSrc.trim() : "";
  const showArt = Boolean(artSrc);
  if (isHostThreadImage(card)) {
    return {
      title: "",
      caption: "",
      showTitle: false,
      showArt,
      artSrc: artSrc || null,
      showProxy: !showArt,
      layout: "photo",
    };
  }
  const title = inspectCardTitle(card);
  const caption = inspectCardCaption(card);
  return {
    title,
    caption,
    showTitle: true,
    showArt,
    artSrc: artSrc || null,
    showProxy: !showArt,
    layout: "card",
  };
}

export function inspectNavState(count: number, index: number): InspectNavState {
  const total = Number.isFinite(count) ? Math.trunc(count) : 0;
  if (total <= 0) return { index: 0, hasPrev: false, hasNext: false };
  const raw = Number.isFinite(index) ? Math.trunc(index) : 0;
  const clamped = Math.min(Math.max(0, raw), total - 1);
  return {
    index: clamped,
    hasPrev: clamped > 0,
    hasNext: clamped < total - 1,
  };
}

export function inspectNavIndex(
  count: number,
  index: number,
  direction: InspectNavDirection
): number | null {
  const nav = inspectNavState(count, index);
  if (direction === "prev") return nav.hasPrev ? nav.index - 1 : null;
  if (direction === "next") return nav.hasNext ? nav.index + 1 : null;
  return null;
}

export function inspectKeyDirection(event: {
  key?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): InspectNavDirection | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key === "ArrowLeft") return "prev";
  if (event.key === "ArrowRight") return "next";
  return null;
}

const TYPING_TARGET_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

export function isInspectTypingTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof target !== "object") return false;
  const node = target as Partial<HTMLElement> & {
    closest?: (selector: string) => Element | null;
  };
  if (typeof node.closest === "function") {
    return Boolean(node.closest(TYPING_TARGET_SELECTOR));
  }
  const tag = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return node.isContentEditable === true;
}

export function inspectKeyCommand(
  event: {
    key?: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    target?: EventTarget | null;
  },
  overlayOpen: boolean
): InspectNavDirection | null {
  if (!overlayOpen) return null;
  if (isInspectTypingTarget(event.target)) return null;
  return inspectKeyDirection(event);
}

export function inspectNavDirectionFromDataset(
  value: string | null | undefined
): InspectNavDirection | null {
  return value === "prev" || value === "next" ? value : null;
}

export function inspectHandActionsVisible(
  item: InspectSequenceItem | null | undefined,
  layout: InspectLayout | null | undefined
): boolean {
  return Boolean(item?.handActions) && layout !== "photo";
}

export function setInspectCardActionHandler(
  handler: ((action: HandActionKind, card: InspectableCard) => void) | null
) {
  inspectCardActionHandler = handler;
}

export function setInspectActionError(message: string | null | undefined) {
  const error = document.getElementById(ERROR_ID);
  if (!error) return;
  const text = typeof message === "string" ? message.trim() : "";
  error.textContent = text;
  error.hidden = !text;
}

export function setInspectActionButtonsLocked(locked: boolean) {
  const root = document.getElementById(ACTIONS_ID);
  if (!root) return;
  root.querySelectorAll<HTMLButtonElement>("button.card-inspect-action").forEach((button) => {
    button.disabled = locked;
  });
}

export function inspectSequenceIndex(
  sequence: InspectSequenceItem[] | null | undefined,
  tile: HTMLElement
): number {
  const list = Array.isArray(sequence) ? sequence : [];
  if (!list.length) return -1;
  return list.findIndex((item) => item?.tile === tile);
}

export function resolveInspectSession(
  card: InspectableCard,
  imageSrc: string | null,
  tile: HTMLElement,
  sequence?: InspectSequenceItem[] | null,
  options?: { handActions?: boolean } | null
): InspectSession {
  const list = Array.isArray(sequence) ? sequence.filter(Boolean) : [];
  const index = inspectSequenceIndex(list, tile);
  const handActions = Boolean(options?.handActions);
  const fallback: InspectSequenceItem = { card, imageSrc, tile, handActions };
  const items = index >= 0 ? list : [fallback];
  const resolvedIndex = index >= 0 ? index : 0;
  return {
    items,
    index: resolvedIndex,
    nav: inspectNavState(items.length, resolvedIndex),
  };
}

function dialogEl(): HTMLDialogElement | null {
  const node = document.getElementById(DIALOG_ID);
  return node instanceof HTMLDialogElement ? node : null;
}

function isInspectOpen(dialog: HTMLDialogElement | null): boolean {
  if (!dialog) return false;
  return Boolean(dialog.open) || dialog.hasAttribute("open");
}

function inspectArtEl(): HTMLImageElement | null {
  const art = document.getElementById(ART_ID);
  return art instanceof HTMLImageElement ? art : null;
}

export function inspectZoomState(): InspectZoomState {
  return { ...inspectZoom };
}

function clearInspectSuppressClick() {
  inspectSuppressClick = false;
  if (inspectSuppressClickTimer != null) {
    clearTimeout(inspectSuppressClickTimer);
    inspectSuppressClickTimer = null;
  }
}

function armInspectSuppressClick() {
  inspectSuppressClick = true;
  if (inspectSuppressClickTimer != null) clearTimeout(inspectSuppressClickTimer);
  inspectSuppressClickTimer = setTimeout(() => {
    inspectSuppressClickTimer = null;
    inspectSuppressClick = false;
  }, INSPECT_SUPPRESS_CLICK_MS);
}

function inspectPanCaptureEl(): HTMLElement | null {
  return inspectArtEl() ?? dialogEl();
}

function releaseInspectPanCapture(pointerId: number | null) {
  const target = inspectPanCaptureEl();
  if (!target || typeof target.releasePointerCapture !== "function" || pointerId == null) {
    return;
  }
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // already released or never captured
  }
}

function stopInspectPanListeners() {
  if (!inspectPanListening) return;
  inspectPanListening = false;
  document.removeEventListener("pointermove", onInspectPointerMove);
  document.removeEventListener("pointerup", onInspectPointerUp);
  document.removeEventListener("pointercancel", onInspectPointerUp);
  inspectArtEl()?.removeEventListener("lostpointercapture", onInspectPointerUp);
  dialogEl()?.removeEventListener("lostpointercapture", onInspectPointerUp);
}

function startInspectPanListeners() {
  if (inspectPanListening) return;
  inspectPanListening = true;
  document.addEventListener("pointermove", onInspectPointerMove);
  document.addEventListener("pointerup", onInspectPointerUp);
  document.addEventListener("pointercancel", onInspectPointerUp);
  inspectArtEl()?.addEventListener("lostpointercapture", onInspectPointerUp);
  dialogEl()?.addEventListener("lostpointercapture", onInspectPointerUp);
}

function resetInspectZoom() {
  const pointerId = inspectPanPointerId;
  stopInspectPanListeners();
  inspectPanning = false;
  inspectPanPointerId = null;
  inspectPanOrigin = null;
  inspectPanLast = null;
  clearInspectSuppressClick();
  inspectZoom = { ...INSPECT_ZOOM_IDENTITY };
  releaseInspectPanCapture(pointerId);
  applyInspectZoomStyle(dialogEl(), inspectZoom, false);
}

function resetInspectSession() {
  inspectItems = [];
  inspectIndex = 0;
  resetInspectZoom();
  syncInspectNav();
}

export function closeCardInspect() {
  resetInspectSession();
  setInspectActionError(null);
  const dialog = dialogEl();
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

/** Close inspect so snapshot polls can resume after a failed PLAY/DISCARD/SHOW. */
export function closeInspectAfterFailedAction() {
  closeCardInspect();
}

function stepInspect(direction: InspectNavDirection) {
  const next = inspectNavIndex(inspectItems.length, inspectIndex, direction);
  if (next == null) return;
  showInspectItem(next);
}

function inspectOverlayOpen(): boolean {
  return isInspectOpen(dialogEl()) && inspectItems.length > 0;
}

export type InspectBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function inspectContainedImageRect(
  box: InspectBox | null | undefined,
  naturalWidth: number,
  naturalHeight: number
): InspectBox | null {
  const boxW = Number(box?.width);
  const boxH = Number(box?.height);
  const natW = Number(naturalWidth);
  const natH = Number(naturalHeight);
  const left = Number(box?.left);
  const top = Number(box?.top);
  if (
    !(boxW > 0 && boxH > 0 && natW > 0 && natH > 0 && Number.isFinite(left) && Number.isFinite(top))
  ) {
    return null;
  }
  const scale = Math.min(boxW / natW, boxH / natH);
  const width = natW * scale;
  const height = natH * scale;
  const paintedLeft = left + (boxW - width) / 2;
  const paintedTop = top + (boxH - height) / 2;
  if (![paintedLeft, paintedTop, width, height].every(Number.isFinite)) return null;
  return { left: paintedLeft, top: paintedTop, width, height };
}

type InspectLayoutNode = {
  querySelector?: (selector: string) => { getBoundingClientRect?: () => InspectBox } | null;
  getBoundingClientRect?: () => InspectBox;
};

function readInspectLayoutBox(
  node: { getBoundingClientRect?: () => InspectBox } | null | undefined
): InspectBox | null {
  if (!node || typeof node.getBoundingClientRect !== "function") return null;
  try {
    const box = node.getBoundingClientRect();
    const width = Number(box?.width);
    const height = Number(box?.height);
    const left = Number(box?.left);
    const top = Number(box?.top);
    if (!(width > 0 && height > 0 && Number.isFinite(left) && Number.isFinite(top))) {
      return null;
    }
    return { left, top, width, height };
  } catch {
    return null;
  }
}

function inspectPhotoLayoutBox(
  dialog: InspectLayoutNode | null | undefined,
  art: { getBoundingClientRect?: () => InspectBox } | null | undefined
): InspectBox | null {
  const sheet =
    dialog && typeof dialog.querySelector === "function"
      ? dialog.querySelector(".card-inspect-sheet")
      : null;
  return readInspectLayoutBox(sheet) ?? readInspectLayoutBox(art);
}

function inspectArtPaintedRect(
  dialog: InspectLayoutNode | null | undefined,
  art: {
    naturalWidth?: number;
    naturalHeight?: number;
    getBoundingClientRect?: () => InspectBox;
  } | null | undefined,
  zoom: InspectZoomState | null | undefined = inspectZoom
): InspectBox | null {
  const layout = inspectPhotoLayoutBox(dialog, art);
  if (!layout || !art) return null;
  const painted = inspectContainedImageRect(
    layout,
    Number(art.naturalWidth),
    Number(art.naturalHeight)
  );
  if (!painted) return null;
  return inspectVisiblePaintedRect(painted, layout, zoom ?? INSPECT_ZOOM_IDENTITY);
}

function pointInInspectRect(x: number, y: number, rect: InspectBox | null | undefined): boolean {
  if (!rect) return false;
  if (![x, y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return false;
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

export function isInspectOutsideClick(
  event: {
    target?: EventTarget | null;
    clientX?: number;
    clientY?: number;
  } | null | undefined,
  dialog: {
    classList?: { contains?: (name: string) => boolean };
    querySelector?: (selector: string) => { getBoundingClientRect?: () => InspectBox } | null;
  } | null | undefined,
  art?: {
    naturalWidth?: number;
    naturalHeight?: number;
    getBoundingClientRect?: () => InspectBox;
  } | null,
  zoom?: InspectZoomState | null
): boolean {
  if (!event || !dialog) return false;
  if (event.target === dialog) return true;
  if (!dialog.classList?.contains?.(INSPECT_PHOTO_CLASS)) return false;
  if (!art || event.target !== art) return false;
  const painted = inspectArtPaintedRect(dialog, art, zoom ?? INSPECT_ZOOM_IDENTITY);
  if (!painted) return false;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return !pointInInspectRect(x, y, painted);
}

function inspectPhotoOpen(): boolean {
  const dialog = dialogEl();
  return inspectOverlayOpen() && Boolean(dialog?.classList.contains(INSPECT_PHOTO_CLASS));
}

function inspectUnzoomedPainted(art: HTMLImageElement | null): InspectBox | null {
  const layout = inspectPhotoLayoutBox(dialogEl(), art);
  if (!layout || !art) return null;
  return inspectContainedImageRect(layout, Number(art.naturalWidth), Number(art.naturalHeight));
}

function commitInspectZoom(next: InspectZoomState, panning = inspectPanning) {
  inspectZoom = next;
  applyInspectZoomStyle(dialogEl(), inspectZoom, panning);
}

function sameInspectPointer(event: PointerEvent | undefined): boolean {
  if (!event || inspectPanPointerId == null || event.pointerId == null) return true;
  return event.pointerId === inspectPanPointerId;
}

function endInspectPan(options?: { suppressClick?: boolean }) {
  const allowSuppress = options?.suppressClick !== false;
  const moved =
    allowSuppress && inspectPanning && inspectPanOrigin && inspectPanLast
      ? Math.hypot(
          inspectPanLast.x - inspectPanOrigin.x,
          inspectPanLast.y - inspectPanOrigin.y
        ) >= INSPECT_PAN_SLOP_PX
      : false;
  const pointerId = inspectPanPointerId;
  const dialog = dialogEl();
  stopInspectPanListeners();
  inspectPanning = false;
  inspectPanPointerId = null;
  inspectPanOrigin = null;
  inspectPanLast = null;
  if (moved) armInspectSuppressClick();
  releaseInspectPanCapture(pointerId);
  applyInspectZoomStyle(dialog, inspectZoom, false);
}

function onInspectWheel(event: WheelEvent) {
  if (!inspectPhotoOpen()) return;
  const dialog = dialogEl();
  const art = inspectArtEl();
  if (!dialog || !art || art.hidden) return;
  const layout = inspectPhotoLayoutBox(dialog, art);
  const painted = inspectUnzoomedPainted(art);
  if (!layout || !painted) return;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  const visible = inspectVisiblePaintedRect(painted, layout, inspectZoom);
  if (!pointInInspectRect(x, y, visible)) return;
  const nextScale = inspectZoomFromWheel(inspectZoom.scale, inspectWheelDeltaY(event));
  if (nextScale === inspectZoom.scale) return;
  event.preventDefault();
  event.stopPropagation();
  commitInspectZoom(
    inspectZoomToward(inspectZoom, nextScale, { x, y }, layout, painted)
  );
}

function onInspectPointerDown(event: PointerEvent) {
  clearInspectSuppressClick();
  if (!inspectPhotoOpen()) return;
  if (event.button !== 0) return;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const dialog = dialogEl();
  const art = inspectArtEl();
  if (!dialog || !art || event.target !== art) return;
  if (!isInspectZoomed(inspectZoom)) return;
  if (isInspectOutsideClick(event, dialog, art, inspectZoom)) return;
  inspectPanning = true;
  inspectPanPointerId = event.pointerId ?? null;
  inspectPanOrigin = { x, y };
  inspectPanLast = { x, y };
  applyInspectZoomStyle(dialog, inspectZoom, true);
  event.preventDefault();
  startInspectPanListeners();
  if (typeof art.setPointerCapture === "function" && event.pointerId != null) {
    try {
      art.setPointerCapture(event.pointerId);
    } catch {
      // Document pointerup / lostpointercapture still end the pan.
    }
  }
}

function onInspectPointerMove(event: PointerEvent) {
  if (!inspectPanning || !inspectPanLast) return;
  if (!sameInspectPointer(event)) return;
  if (!inspectPhotoOpen()) {
    endInspectPan({ suppressClick: false });
    return;
  }
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const art = inspectArtEl();
  const painted = inspectUnzoomedPainted(art);
  const dx = x - inspectPanLast.x;
  const dy = y - inspectPanLast.y;
  inspectPanLast = { x, y };
  commitInspectZoom(inspectPanBy(inspectZoom, dx, dy, painted), true);
  event.preventDefault();
}

function onInspectPointerUp(event?: PointerEvent) {
  if (!sameInspectPointer(event)) return;
  if (!inspectPanning) {
    stopInspectPanListeners();
    return;
  }
  // Only pointerup is followed by a click. pointercancel / lostpointercapture
  // must not swallow the next genuine outside click.
  endInspectPan({ suppressClick: !event || event.type === "pointerup" });
}

function onInspectClick(event: MouseEvent) {
  const dialog = dialogEl();
  if (!dialog) return;
  const inspectArt = inspectArtEl();
  const suppress = inspectSuppressClick;
  if (suppress) clearInspectSuppressClick();
  // The click that ends a pan is ignored even when pointer capture retargets
  // it at the dialog or the pointer is released over the backdrop. X, nav,
  // and a later click-outside still run on the next gesture.
  if (!suppress && isInspectOutsideClick(event, dialog, inspectArt, inspectZoom)) {
    closeCardInspect();
    return;
  }
  const target = event.target;
  const actionButton =
    target instanceof Element ? target.closest("[data-card-action]") : null;
  if (actionButton instanceof HTMLElement) {
    const action = handCardActionFromDataset(actionButton.dataset.cardAction);
    const item = inspectItems[inspectIndex];
    if (
      action &&
      item &&
      inspectHandActionsVisible(item, inspectView(item.card, item.imageSrc).layout)
    ) {
      event.preventDefault();
      event.stopPropagation();
      inspectCardActionHandler?.(action, item.card);
    }
    return;
  }
  const button =
    target instanceof Element ? target.closest("[data-inspect-nav]") : null;
  if (!(button instanceof HTMLElement)) return;
  const direction = inspectNavDirectionFromDataset(button.dataset.inspectNav);
  if (!direction) return;
  event.preventDefault();
  event.stopPropagation();
  stepInspect(direction);
}

function onInspectDialogClose() {
  resetInspectSession();
  setInspectActionError(null);
}

function onInspectKeydown(event: KeyboardEvent) {
  const direction = inspectKeyCommand(event, inspectOverlayOpen());
  if (!direction) return;
  event.preventDefault();
  stepInspect(direction);
}

function syncInspectNav() {
  const nav = inspectNavState(inspectItems.length, inspectIndex);
  const prev = document.getElementById(PREV_ID);
  const next = document.getElementById(NEXT_ID);
  if (prev) {
    prev.hidden = !nav.hasPrev;
    prev.setAttribute("aria-label", INSPECT_PREV_LABEL);
  }
  if (next) {
    next.hidden = !nav.hasNext;
    next.setAttribute("aria-label", INSPECT_NEXT_LABEL);
  }
}

function stampInspectActionButtons() {
  const root = document.getElementById(ACTIONS_ID);
  if (!root) return;
  for (const action of HAND_CARD_ACTIONS) {
    const button =
      root.querySelector<HTMLButtonElement>(`[data-card-action="${action.id}"]`);
    if (!button) continue;
    button.textContent = action.label;
    button.title = action.tooltip;
    button.setAttribute("aria-label", action.tooltip);
  }
}

function syncInspectActions(view: InspectView) {
  const root = document.getElementById(ACTIONS_ID);
  if (!root) return;
  const item = inspectItems[inspectIndex];
  root.hidden = !inspectHandActionsVisible(item, view.layout);
}

export function enableCardInspectDialog() {
  const dialog = dialogEl();
  if (!dialog) return;
  if (inspectBoundDocument === document) return;
  inspectBoundDocument = document;
  stampInspectActionButtons();
  inspectArtEl()?.addEventListener("wheel", onInspectWheel, { passive: false });
  dialog.addEventListener("pointerdown", onInspectPointerDown);
  dialog.addEventListener("click", onInspectClick);
  dialog.addEventListener("close", onInspectDialogClose);
  document.addEventListener("keydown", onInspectKeydown);
}

function applyInspectLayout(dialog: HTMLElement, view: InspectView) {
  dialog.classList.toggle(INSPECT_PHOTO_CLASS, view.layout === "photo");
  if (view.layout === "photo") {
    dialog.removeAttribute("aria-labelledby");
    dialog.setAttribute("aria-label", INSPECT_PHOTO_LABEL);
    return;
  }
  dialog.removeAttribute("aria-label");
  dialog.setAttribute("aria-labelledby", TITLE_ID);
}

function fillInspectDom(
  card: InspectableCard,
  imageSrc: string | null,
  face: HTMLElement | null
) {
  const dialog = dialogEl();
  const art = document.getElementById(ART_ID);
  const proxy = document.getElementById(PROXY_ID);
  const title = document.getElementById(TITLE_ID);
  const caption = document.getElementById(CAPTION_ID);
  const meta = document.getElementById(META_ID);
  const view = inspectView(card, imageSrc);
  if (dialog) applyInspectLayout(dialog, view);
  if (title) {
    title.hidden = !view.showTitle;
    title.textContent = view.title;
  }
  if (caption) {
    caption.hidden = !view.caption;
    caption.textContent = view.caption;
  }
  if (meta) meta.hidden = !view.showTitle && !view.caption;
  syncInspectActions(view);
  if (art instanceof HTMLImageElement) {
    art.hidden = !view.showArt;
    if (view.artSrc) {
      art.src = view.artSrc;
      art.alt = view.title;
    } else {
      art.removeAttribute("src");
      art.alt = "";
    }
  }
  if (proxy) {
    proxy.hidden = !view.showProxy;
    proxy.replaceChildren();
    if (view.showProxy && face) {
      proxy.append(face.cloneNode(true));
    }
  }
}

function showInspectItem(index: number) {
  const item = inspectItems[index];
  if (!item) return;
  inspectIndex = index;
  resetInspectZoom();
  const face = item.tile?.querySelector?.(".card-face");
  fillInspectDom(item.card, item.imageSrc, face instanceof HTMLElement ? face : null);
  syncInspectNav();
}

export function openCardInspect(
  card: InspectableCard,
  imageSrc: string | null,
  tile: HTMLElement,
  sequence?: InspectSequenceItem[] | null,
  options?: { handActions?: boolean } | null
) {
  enableCardInspectDialog();
  const dialog = dialogEl();
  if (!dialog) return;
  const session = resolveInspectSession(card, imageSrc, tile, sequence, options);
  inspectItems = session.items;
  inspectIndex = session.index;
  setInspectActionError(null);
  showInspectItem(inspectIndex);
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}
