export type InspectableCard = {
  name?: string;
  description?: string;
};

export type InspectView = {
  title: string;
  caption: string;
  showArt: boolean;
  artSrc: string | null;
  showProxy: boolean;
};

const DIALOG_ID = "card-inspect";
const ART_ID = "card-inspect-art";
const PROXY_ID = "card-inspect-proxy";
const TITLE_ID = "card-inspect-title";
const CAPTION_ID = "card-inspect-caption";

let inspectBound = false;

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
  const title = inspectCardTitle(card);
  const caption = inspectCardCaption(card);
  const artSrc = typeof imageSrc === "string" && imageSrc.trim() ? imageSrc.trim() : "";
  return {
    title,
    caption,
    showArt: Boolean(artSrc),
    artSrc: artSrc || null,
    showProxy: !artSrc,
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

function fillInspectDom(
  card: InspectableCard,
  imageSrc: string | null,
  face: HTMLElement | null
) {
  const art = document.getElementById(ART_ID);
  const proxy = document.getElementById(PROXY_ID);
  const title = document.getElementById(TITLE_ID);
  const caption = document.getElementById(CAPTION_ID);
  const view = inspectView(card, imageSrc);
  if (title) title.textContent = view.title;
  if (caption) {
    caption.hidden = !view.caption;
    caption.textContent = view.caption;
  }
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
