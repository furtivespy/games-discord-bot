export const SNAPSHOT_POLL_INTERVAL_MS = 2500;
export const SNAPSHOT_POLL_MAX_BACKOFF_MS = 30_000;
export const SNAPSHOT_POLL_MAX_RETRY_AFTER_MS = 60_000;
export const HISTORY_CHANGED_CLASS = "is-changed";
export const HISTORY_FLASH_MS = 1400;

export type HistoryEntryLike = {
  id?: string | number;
  timestamp?: string;
  summary?: string;
};

export type VersionPollResult =
  | { kind: "unchanged" }
  | { kind: "changed"; version: string }
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "error" };

export function etagFromVersion(version: string): string {
  const raw = String(version || "");
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function retryAfterMsFromHeader(
  header: string | null | undefined,
  fallbackMs: number = SNAPSHOT_POLL_INTERVAL_MS
): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return fallbackMs;
  return Math.min(Math.ceil(seconds * 1000), SNAPSHOT_POLL_MAX_RETRY_AFTER_MS);
}

export function pollBackoffMs(
  errors: number,
  intervalMs: number = SNAPSHOT_POLL_INTERVAL_MS,
  maxMs: number = SNAPSHOT_POLL_MAX_BACKOFF_MS
): number {
  const steps = Math.max(1, Number(errors) || 1);
  const delay = intervalMs * 2 ** steps;
  return Math.min(maxMs, Math.max(intervalMs, delay));
}

export function historyEntryKey(entry: HistoryEntryLike | null | undefined): string {
  if (!entry || typeof entry !== "object") return "";
  const id = entry.id == null ? "" : String(entry.id).trim();
  if (id) return `id:${id}`;
  const ts = typeof entry.timestamp === "string" ? entry.timestamp.trim() : "";
  const summary = typeof entry.summary === "string" ? entry.summary.trim() : "";
  if (!ts && !summary) return "";
  return `row:${ts}|${summary}`;
}

/** First paint does not flash. Later entries whose keys were not shown yet do. */
export function newHistoryKeys(
  previous: Iterable<string> | null | undefined,
  nextEntries: HistoryEntryLike[] | null | undefined
): Set<string> {
  const prev = new Set(previous ? [...previous] : []);
  const fresh = new Set<string>();
  if (!prev.size) return fresh;
  const list = Array.isArray(nextEntries) ? nextEntries : [];
  for (const entry of list) {
    const key = historyEntryKey(entry);
    if (key && !prev.has(key)) fresh.add(key);
  }
  return fresh;
}

export function captureScrollTop(el: { scrollTop?: number } | null | undefined): number {
  const top = el?.scrollTop;
  return typeof top === "number" && Number.isFinite(top) ? top : 0;
}

export function restoreScrollTop(
  el: { scrollTop?: number } | null | undefined,
  top: number
): void {
  if (!el || typeof top !== "number" || !Number.isFinite(top)) return;
  el.scrollTop = top;
}

export function clearHistoryFlash(root: ParentNode | null | undefined): void {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(`.${HISTORY_CHANGED_CLASS}`).forEach((item) => {
    item.classList.remove(HISTORY_CHANGED_CLASS);
  });
}

/** Skip applying a polled snapshot while the user is mid-gesture or in a dialog. */
export function isSnapshotPollBlocked(doc: Document | null | undefined): boolean {
  if (!doc?.querySelector) return false;
  if (doc.querySelector(".card-tile.dragging, .card-tile.snapping")) return true;
  if (doc.querySelector("dialog[open]")) return true;
  return false;
}

/**
 * Poller refresh outcome. `true` means the table painted; `"deferred"` means
 * apply parked a pending snapshot (drag/dialog) and must not stamp knownVersion.
 * `false` is a failed refresh that should retry with backoff.
 */
export type SnapshotRefreshResult = boolean | "deferred";

/** Silent poll refresh succeeded only if the table actually painted. */
export function snapshotRefreshResult(didPaint: boolean): SnapshotRefreshResult {
  return didPaint ? true : "deferred";
}

export function shouldStampKnownVersion(result: SnapshotRefreshResult): boolean {
  return result === true;
}

export type SnapshotPollerOptions = {
  intervalMs?: number;
  maxBackoffMs?: number;
  fetchVersion: () => Promise<VersionPollResult>;
  refresh: () => Promise<SnapshotRefreshResult>;
  isHidden: () => boolean;
  isBlocked: () => boolean;
  onUnauthorized?: () => void;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
};

export function createSnapshotPoller(opts: SnapshotPollerOptions) {
  const interval = opts.intervalMs ?? SNAPSHOT_POLL_INTERVAL_MS;
  const maxBackoff = opts.maxBackoffMs ?? SNAPSHOT_POLL_MAX_BACKOFF_MS;
  const schedule = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = opts.clearTimeoutFn ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let knownVersion = "";
  let inFlight = false;
  let stopped = true;
  let generation = 0;
  let errorCount = 0;
  let delay = interval;

  function clearTimer() {
    if (timer == null) return;
    cancel(timer);
    timer = null;
  }

  function resetDelay() {
    errorCount = 0;
    delay = interval;
  }

  function noteError(nextDelay = pollBackoffMs(errorCount + 1, interval, maxBackoff)) {
    errorCount += 1;
    delay = nextDelay;
  }

  async function tick() {
    if (stopped || inFlight) return;
    if (opts.isHidden() || opts.isBlocked()) return;
    inFlight = true;
    const gen = generation;
    try {
      const result = await opts.fetchVersion();
      if (stopped || gen !== generation) return;
      if (result.kind === "unauthorized") {
        opts.onUnauthorized?.();
        stopped = true;
        generation += 1;
        inFlight = false;
        clearTimer();
        return;
      }
      if (result.kind === "rate_limited") {
        noteError(Math.max(interval, result.retryAfterMs || interval));
        return;
      }
      if (result.kind === "error") {
        noteError();
        return;
      }
      resetDelay();
      if (result.kind === "unchanged") return;
      if (!result.version || result.version === knownVersion) return;
      if (opts.isHidden() || opts.isBlocked()) return;
      const applied = await opts.refresh();
      if (stopped || gen !== generation) return;
      // Parked pendingSnapshot is not painted yet. Keep knownVersion on the
      // last painted snapshot so dropping pending (hide table) can still
      // refresh this version later.
      if (shouldStampKnownVersion(applied)) {
        knownVersion = result.version;
      } else if (applied !== "deferred") {
        noteError();
      }
    } catch {
      if (stopped || gen !== generation) return;
      noteError();
    } finally {
      if (gen === generation) inFlight = false;
    }
  }

  function arm() {
    clearTimer();
    if (stopped) return;
    timer = schedule(() => {
      void tick().finally(arm);
    }, delay);
  }

  return {
    start(version?: string) {
      if (typeof version === "string" && version) knownVersion = version;
      resetDelay();
      if (!stopped) return;
      stopped = false;
      generation += 1;
      inFlight = false;
      arm();
    },
    stop() {
      stopped = true;
      generation += 1;
      clearTimer();
    },
    setVersion(version: string) {
      knownVersion = String(version || "");
    },
    peekVersion() {
      return knownVersion;
    },
    async pollNow() {
      await tick();
      if (!stopped) arm();
    },
  };
}
