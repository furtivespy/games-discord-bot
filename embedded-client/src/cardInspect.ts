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

export const HOST_IMAGE_ID_PREFIX = "host-image:";
export const INSPECT_PHOTO_CLASS = "is-photo";
export const INSPECT_PHOTO_LABEL = "Enlarged photo";

const DIALOG_ID = "card-inspect";
const ART_ID = "card-inspect-art";
const PROXY_ID = "card-inspect-proxy";
const TITLE_ID = "card-inspect-title";
const CAPTION_ID = "card-inspect-caption";
const META_ID = "card-inspect-meta";

let inspectBound = false;

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

function dialogEl(): HTMLDialogElement | null {
  const node = document.getElementById(DIALOG_ID);
  return node instanceof HTMLDialogElement ? node : null;
}

export function closeCardInspect() {
  const dialog = dialogEl();
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

export function enableCardInspectDialog() {
  const dialog = dialogEl();
  if (!dialog || inspectBound) return;
  inspectBound = true;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeCardInspect();
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

export function openCardInspect(
  card: InspectableCard,
  imageSrc: string | null,
  tile: HTMLElement
) {
  enableCardInspectDialog();
  const dialog = dialogEl();
  if (!dialog) return;
  const face = tile.querySelector(".card-face");
  fillInspectDom(card, imageSrc, face instanceof HTMLElement ? face : null);
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}
