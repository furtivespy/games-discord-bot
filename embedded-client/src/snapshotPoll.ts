export const SNAPSHOT_POLL_INTERVAL_MS = 2500;
export const HISTORY_CHANGED_CLASS = "is-changed";

export type HistoryEntryLike = {
  id?: string;
  timestamp?: string;
  summary?: string;
};

export function etagFromVersion(version: string): string {
  const raw = String(version || "");
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function historyEntryKey(entry: HistoryEntryLike | null | undefined): string {
  if (!entry || typeof entry !== "object") return "";
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
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

/**
 * Skip applying a polled snapshot while the user is mid-gesture.
 * Deal/Draw uses <dialog>; a later card-zoom modal should too (or data-zoom-modal).
 */
export function isSnapshotPollBlocked(doc: Document | null | undefined): boolean {
  if (!doc?.querySelector) return false;
  if (doc.querySelector(".card-tile.dragging, .card-tile.snapping")) return true;
  if (doc.querySelector("dialog[open]")) return true;
  if (doc.querySelector("[data-zoom-modal]")) return true;
  const zoom = doc.querySelector(".card-zoom-modal");
  if (zoom && !(zoom as HTMLElement).hidden) return true;
  return false;
}

export type SnapshotPollerOptions = {
  intervalMs?: number;
  fetchVersion: () => Promise<string | null>;
  refresh: () => Promise<void>;
  isHidden: () => boolean;
  isBlocked: () => boolean;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
};

export function createSnapshotPoller(opts: SnapshotPollerOptions) {
  const interval = opts.intervalMs ?? SNAPSHOT_POLL_INTERVAL_MS;
  const schedule = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = opts.clearTimeoutFn ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let knownVersion = "";
  let inFlight = false;
  let stopped = true;
  let generation = 0;

  function clearTimer() {
    if (timer == null) return;
    cancel(timer);
    timer = null;
  }

  async function tick() {
    if (stopped || inFlight) return;
    if (opts.isHidden() || opts.isBlocked()) return;
    inFlight = true;
    const gen = generation;
    try {
      const version = await opts.fetchVersion();
      if (stopped || gen !== generation) return;
      if (!version || version === knownVersion) return;
      if (opts.isHidden() || opts.isBlocked()) return;
      await opts.refresh();
      if (stopped || gen !== generation) return;
      knownVersion = version;
    } catch {
      // Keep the last painted table; the next tick retries.
    } finally {
      inFlight = false;
    }
  }

  function arm() {
    clearTimer();
    if (stopped) return;
    timer = schedule(() => {
      void tick().finally(arm);
    }, interval);
  }

  return {
    start(version?: string) {
      if (typeof version === "string" && version) knownVersion = version;
      if (!stopped) return;
      stopped = false;
      generation += 1;
      arm();
    },
    stop() {
      stopped = true;
      generation += 1;
      inFlight = false;
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
    },
  };
}
