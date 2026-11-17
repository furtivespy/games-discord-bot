import type { StatusPlayer } from "./tableLayout";
import { statusPlayerScoreLabel, statusPlayerSeatName } from "./tableLayout";

export const EDIT_SCORES_LABEL = "Edit Scores";
export const SAVE_SCORES_LABEL = "Save";
export const SCORE_EDITING_CLASS = "status-scores-editing";
export const SCORE_EDIT_BUTTON_CLASS = "status-edit-scores";
export const SCORE_INPUT_CLASS = "status-player-score-input";
export const SCORE_ERROR_CLASS = "status-scores-error";

export type ScoreMap = Record<string, string>;

export type PlayerScoreBlock = HTMLElement & {
  setSaving: (saving: boolean) => void;
  setError: (message: string | null) => void;
  exitEdit: () => void;
};

export function visualScoreBody(opts: {
  scores: ScoreMap;
  channelId: string;
  guildId: string;
  requestId?: string | null;
  fixture?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: "scores",
    scores: opts.scores,
    channelId: opts.channelId,
    guildId: opts.guildId,
  };
  const requestId = String(opts.requestId || "").trim();
  if (requestId) body.requestId = requestId;
  const fixture = String(opts.fixture || "").trim();
  if (fixture) body.fixture = fixture;
  return body;
}

export function collectScoreInputs(
  root: ParentNode | null | undefined
): ScoreMap {
  const scores: ScoreMap = {};
  if (!root?.querySelectorAll) return scores;
  for (const input of root.querySelectorAll<HTMLInputElement>(
    `input.${SCORE_INPUT_CLASS}`
  )) {
    const userId = String(input.dataset.userId || "").trim();
    if (!userId) continue;
    scores[userId] = input.value;
  }
  return scores;
}

export function isScoreEditOpen(doc: Document | null | undefined): boolean {
  return Boolean(doc?.querySelector?.(`.${SCORE_EDITING_CLASS}`));
}

export function clearScoreEditLock(doc: Document | null | undefined): void {
  doc
    ?.querySelector?.(`.${SCORE_EDITING_CLASS}`)
    ?.classList.remove(SCORE_EDITING_CLASS);
}

function scoreInputValue(player: StatusPlayer): string {
  if (player?.score == null) return "";
  return String(player.score);
}

function setScoreError(block: HTMLElement, message: string | null): void {
  let error = block.querySelector<HTMLParagraphElement>(`.${SCORE_ERROR_CLASS}`);
  if (!message) {
    error?.remove();
    return;
  }
  if (!error) {
    error = document.createElement("p");
    error.className = SCORE_ERROR_CLASS;
    block.append(error);
  }
  error.textContent = message;
}

function playerRow(block: HTMLElement, userId: string): HTMLElement | null {
  for (const row of block.querySelectorAll<HTMLElement>(".status-player")) {
    if (row.dataset.userId === userId) return row;
  }
  return null;
}

function fillScoreInputs(block: HTMLElement, players: StatusPlayer[]): void {
  for (const player of players) {
    const userId = String(player.userId || "").trim();
    if (!userId) continue;
    const row = playerRow(block, userId);
    const scoreSlot = row?.querySelector(".status-player-score");
    if (!row || !scoreSlot) continue;
    const input = document.createElement("input");
    input.type = "text";
    input.className = SCORE_INPUT_CLASS;
    input.dataset.userId = userId;
    input.value = scoreInputValue(player);
    input.setAttribute("aria-label", `${statusPlayerSeatName(player)} score`);
    input.autocomplete = "off";
    scoreSlot.replaceChildren(input);
  }
}

function restoreScoreLabels(block: HTMLElement, players: StatusPlayer[]): void {
  for (const player of players) {
    const userId = String(player.userId || "").trim();
    if (!userId) continue;
    const row = playerRow(block, userId);
    const scoreSlot = row?.querySelector(".status-player-score");
    if (!scoreSlot) continue;
    scoreSlot.textContent = statusPlayerScoreLabel(player);
  }
}

export function renderPlayerScoreBlock(
  players: StatusPlayer[],
  options: {
    onSave: (scores: ScoreMap) => void | Promise<void>;
  }
): PlayerScoreBlock {
  const block = document.createElement("section");
  block.className = "status-block";
  const heading = document.createElement("h3");
  heading.textContent = "Players";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = SCORE_EDIT_BUTTON_CLASS;
  edit.textContent = EDIT_SCORES_LABEL;
  block.append(heading, edit);

  for (const player of players) {
    const row = document.createElement("div");
    row.className = `status-player${player.isYou ? " is-you" : ""}`;
    const userId = String(player.userId || "").trim();
    if (userId) row.dataset.userId = userId;
    if (player.color) {
      row.style.borderLeft = `4px solid ${player.color}`;
      row.style.paddingLeft = "0.45rem";
    }
    const name = document.createElement("div");
    name.className = "status-player-name";
    name.textContent = statusPlayerSeatName(player);
    const score = document.createElement("p");
    score.className = "status-player-score";
    score.textContent = statusPlayerScoreLabel(player);
    row.append(name, score);
    block.append(row);
  }

  const enterEdit = () => {
    block.classList.add(SCORE_EDITING_CLASS);
    edit.textContent = SAVE_SCORES_LABEL;
    fillScoreInputs(block, players);
    setScoreError(block, null);
    const first = block.querySelector<HTMLInputElement>(`.${SCORE_INPUT_CLASS}`);
    first?.focus();
    first?.select();
  };

  const leaveEdit = () => {
    block.classList.remove(SCORE_EDITING_CLASS);
    edit.textContent = EDIT_SCORES_LABEL;
    edit.disabled = false;
    restoreScoreLabels(block, players);
    setScoreError(block, null);
  };

  edit.addEventListener("click", () => {
    if (edit.disabled) return;
    if (!block.classList.contains(SCORE_EDITING_CLASS)) {
      enterEdit();
      return;
    }
    void options.onSave(collectScoreInputs(block));
  });

  block.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!block.classList.contains(SCORE_EDITING_CLASS)) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (edit.disabled) return;
    void options.onSave(collectScoreInputs(block));
  });

  block.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  Object.assign(block, {
    setSaving(saving: boolean) {
      edit.disabled = saving;
    },
    setError(message: string | null) {
      setScoreError(block, message);
    },
    exitEdit: leaveEdit,
  });

  return block as PlayerScoreBlock;
}
