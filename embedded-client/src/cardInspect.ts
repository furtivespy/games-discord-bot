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
};

export type InspectSession = {
  items: InspectSequenceItem[];
  index: number;
  nav: InspectNavState;
};

export const HOST_IMAGE_ID_PREFIX = "host-image:";
export const INSPECT_PHOTO_CLASS = "is-photo";
export const INSPECT_PHOTO_LABEL = "Enlarged photo";

const DIALOG_ID = "card-inspect";
const ART_ID = "card-inspect-art";
const PROXY_ID = "card-inspect-proxy";
const TITLE_ID = "card-inspect-title";
const CAPTION_ID = "card-inspect-caption";
const META_ID = "card-inspect-meta";
const PREV_ID = "card-inspect-prev";
const NEXT_ID = "card-inspect-next";

let inspectBound = false;
let inspectItems: InspectSequenceItem[] = [];
let inspectIndex = 0;

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

export function inspectNavDirectionFromDataset(
  value: string | null | undefined
): InspectNavDirection | null {
  return value === "prev" || value === "next" ? value : null;
}

export function inspectKeyShouldIgnoreTarget(target: {
  tagName?: string;
  isContentEditable?: boolean;
} | null | undefined): boolean {
  if (!target) return false;
  const tag = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.isContentEditable);
}

export function inspectSequenceIndex(
  sequence: InspectSequenceItem[] | null | undefined,
  tile: HTMLElement
): number {
  const list = Array.isArray(sequence) ? sequence : [];
  return list.findIndex((item) => item?.tile === tile);
}

export function resolveInspectSession(
  card: InspectableCard,
  imageSrc: string | null,
  tile: HTMLElement,
  sequence?: InspectSequenceItem[] | null
): InspectSession {
  const list = Array.isArray(sequence) ? sequence.filter(Boolean) : [];
  const index = inspectSequenceIndex(list, tile);
  const items = index >= 0 ? list : [{ card, imageSrc, tile }];
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

function resetInspectSession() {
  inspectItems = [];
  inspectIndex = 0;
  syncInspectNav();
}

export function closeCardInspect() {
  resetInspectSession();
  const dialog = dialogEl();
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

function stepInspect(direction: InspectNavDirection) {
  const next = inspectNavIndex(inspectItems.length, inspectIndex, direction);
  if (next == null) return;
  showInspectItem(next);
}

function syncInspectNav() {
  const nav = inspectNavState(inspectItems.length, inspectIndex);
  const prev = document.getElementById(PREV_ID);
  const next = document.getElementById(NEXT_ID);
  if (prev) prev.hidden = !nav.hasPrev;
  if (next) next.hidden = !nav.hasNext;
}

export function enableCardInspectDialog() {
  const dialog = dialogEl();
  if (!dialog || inspectBound) return;
  inspectBound = true;
  dialog.addEventListener("click", (event) => {
    const target = event.target;
    if (target === dialog) {
      closeCardInspect();
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
  });
  dialog.addEventListener("close", () => {
    resetInspectSession();
  });
  document.addEventListener("keydown", (event) => {
    if (!isInspectOpen(dialogEl())) return;
    if (inspectKeyShouldIgnoreTarget(event.target as HTMLElement | null)) return;
    const direction = inspectKeyDirection(event);
    if (!direction) return;
    event.preventDefault();
    stepInspect(direction);
  });
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
  const face = item.tile?.querySelector?.(".card-face");
  fillInspectDom(item.card, item.imageSrc, face instanceof HTMLElement ? face : null);
  syncInspectNav();
}

export function openCardInspect(
  card: InspectableCard,
  imageSrc: string | null,
  tile: HTMLElement,
  sequence?: InspectSequenceItem[] | null
) {
  enableCardInspectDialog();
  const dialog = dialogEl();
  if (!dialog) return;
  const session = resolveInspectSession(card, imageSrc, tile, sequence);
  inspectItems = session.items;
  inspectIndex = session.index;
  showInspectItem(inspectIndex);
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}
