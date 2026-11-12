export function createRequestSeq() {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(id: number) {
      return id === current;
    },
    invalidate() {
      current += 1;
    },
  };
}

export function asCardList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (card) => card && typeof card === "object" && !Array.isArray(card)
  ) as Array<Record<string, unknown>>;
}

/** Visible table must match the current picker value, not a slower earlier pick. */
export function shouldApplySnapshot(opts: {
  isCurrent: boolean;
  selectedChannelId: string;
  requestedChannelId: string;
  payloadChannelId?: string | null;
}): boolean {
  if (!opts.isCurrent) return false;
  const selected = String(opts.selectedChannelId || "").trim();
  const requested = String(opts.requestedChannelId || "").trim();
  if (!selected || selected !== requested) return false;
  const payload = String(opts.payloadChannelId || "").trim();
  if (payload && payload !== selected) return false;
  return true;
}

export function isAbortError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError"
  );
}

export type SnapshotFetchResult = {
  ok: boolean;
  status: number;
  payload: { channelId?: string; error?: string; gameName?: string };
};

export type SnapshotLoadOutcome =
  | { status: "applied"; result: SnapshotFetchResult }
  | { status: "error"; result: SnapshotFetchResult }
  | { status: "failed" }
  | { status: "aborted" }
  | { status: "stale" }
  | { status: "cleared" };

/**
 * One in-flight snapshot GET. A later pick (including "Select a game") aborts
 * the previous fetch. Stale and aborted responses must not render or error.
 */
export function createSnapshotLoader() {
  const seq = createRequestSeq();
  let controller: AbortController | null = null;
  let selectedChannelId = "";

  function abortInFlight() {
    if (!controller) return;
    controller.abort();
    controller = null;
  }

  function clear() {
    abortInFlight();
    selectedChannelId = "";
    seq.invalidate();
  }

  async function load(
    channelId: string,
    fetchSnapshot: (signal: AbortSignal) => Promise<SnapshotFetchResult>,
    getSelectedChannelId?: () => string
  ): Promise<SnapshotLoadOutcome> {
    abortInFlight();
    selectedChannelId = channelId;
    if (!channelId) {
      seq.invalidate();
      return { status: "cleared" };
    }
    const requestId = seq.next();
    const ac = new AbortController();
    controller = ac;
    const liveSelected = () =>
      getSelectedChannelId ? getSelectedChannelId() : selectedChannelId;
    try {
      const result = await fetchSnapshot(ac.signal);
      if (
        !shouldApplySnapshot({
          isCurrent: seq.isCurrent(requestId),
          selectedChannelId: liveSelected(),
          requestedChannelId: channelId,
          payloadChannelId: result.payload?.channelId,
        })
      ) {
        return { status: "stale" };
      }
      if (!result.ok) return { status: "error", result };
      return { status: "applied", result };
    } catch (err) {
      if (isAbortError(err)) return { status: "aborted" };
      if (
        !shouldApplySnapshot({
          isCurrent: seq.isCurrent(requestId),
          selectedChannelId: liveSelected(),
          requestedChannelId: channelId,
        })
      ) {
        return { status: "stale" };
      }
      return { status: "failed" };
    }
  }

  return { load, clear, abortInFlight };
}
