const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const {
  HISTORY_CHANGED_CLASS,
  HISTORY_FLASH_MS,
  SNAPSHOT_POLL_INTERVAL_MS,
  captureScrollTop,
  clearHistoryFlash,
  createSnapshotPoller,
  etagFromVersion,
  historyEntryKey,
  isSnapshotPollBlocked,
  newHistoryKeys,
  pollBackoffMs,
  restoreScrollTop,
  retryAfterMsFromHeader,
} = require("../embedded-client/src/snapshotPoll.ts");
const { createSnapshotLoader } = require("../embedded-client/src/requestSeq.ts");

function fakeDoc(hits) {
  return {
    querySelector(selector) {
      return hits.includes(selector) ? { hidden: false } : null;
    },
  };
}

describe("history change keys", () => {
  test("prefers stable ids over summary text", () => {
    expect(historyEntryKey({ id: "abc", summary: "Drew 1" })).toBe("id:abc");
    expect(historyEntryKey({ id: 42, summary: "Drew 1" })).toBe("id:42");
    expect(
      historyEntryKey({ timestamp: "2026-11-16T21:00:00.000Z", summary: "Drew 1" })
    ).toBe("row:2026-11-16T21:00:00.000Z|Drew 1");
  });

  test("first paint does not flash; a newly arrived id does", () => {
    const previous = [
      historyEntryKey({ id: "a", summary: "Riley played Village" }),
    ];
    const next = [
      { id: "a", summary: "Riley played Village" },
      { id: "b", summary: "Will dealt 1 cards from Main" },
    ];
    expect([...newHistoryKeys([], next)]).toEqual([]);
    expect([...newHistoryKeys(previous, next)]).toEqual(["id:b"]);
    expect(HISTORY_CHANGED_CLASS).toBe("is-changed");
  });
});

describe("isSnapshotPollBlocked", () => {
  test("blocks while a card is dragging or a dialog is open", () => {
    expect(isSnapshotPollBlocked(fakeDoc([]))).toBe(false);
    expect(
      isSnapshotPollBlocked(fakeDoc([".card-tile.dragging, .card-tile.snapping"]))
    ).toBe(true);
    expect(isSnapshotPollBlocked(fakeDoc(["dialog[open]"]))).toBe(true);
    expect(isSnapshotPollBlocked(fakeDoc([".status-scores-editing"]))).toBe(true);
    expect(isSnapshotPollBlocked(fakeDoc(["[data-zoom-modal]"]))).toBe(false);
    expect(isSnapshotPollBlocked(fakeDoc([".card-zoom-modal"]))).toBe(false);
  });
});

function idleTimers() {
  return {
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  };
}

describe("createSnapshotPoller", () => {
  test("refreshes only when the version changes and the tab is free", async () => {
    const versions = ["v1", "v2"];
    let hidden = false;
    let blocked = false;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: versions[0] }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: "painted" };
      },
      isHidden: () => hidden,
      isBlocked: () => blocked,
      ...idleTimers(),
    });
    poller.start("v1");

    await poller.pollNow();
    expect(refreshes).toEqual([]);

    versions[0] = "v2";
    hidden = true;
    await poller.pollNow();
    expect(refreshes).toEqual([]);
    hidden = false;

    blocked = true;
    await poller.pollNow();
    expect(refreshes).toEqual([]);
    blocked = false;

    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    poller.stop();
  });

  test("does not refresh a changed version while a drag is in progress", async () => {
    let blocked = true;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: "v2" }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: "painted" };
      },
      isHidden: () => false,
      isBlocked: () => blocked,
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(refreshes).toEqual([]);
    blocked = false;
    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    poller.stop();
  });

  test("stop prevents a later tick from refreshing", async () => {
    let resolveVersion;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: () =>
        new Promise((resolve) => {
          resolveVersion = resolve;
        }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: "painted" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    const pending = poller.pollNow();
    poller.stop();
    resolveVersion({ kind: "changed", version: "v2" });
    await pending;
    expect(refreshes).toEqual([]);
  });

  test("deferred apply does not stamp knownVersion, so a later identical version still refreshes", async () => {
    let paint = false;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: "v2" }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: paint ? "painted" : "deferred" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    expect(poller.peekVersion()).toBe("v1");
    await poller.pollNow();
    expect(refreshes).toEqual(["go", "go"]);
    expect(poller.peekVersion()).toBe("v1");
    paint = true;
    await poller.pollNow();
    expect(refreshes).toEqual(["go", "go", "go"]);
    expect(poller.peekVersion()).toBe("v2");
    poller.stop();
  });

  test("deferred apply does not back off", async () => {
    const delays = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: "v2" }),
      refresh: async () => ({ kind: "deferred" }),
      isHidden: () => false,
      isBlocked: () => false,
      setTimeoutFn: (_fn, ms) => {
        delays.push(ms);
        return 0;
      },
      clearTimeoutFn: () => {},
    });
    poller.start("v1");
    expect(delays[0]).toBe(SNAPSHOT_POLL_INTERVAL_MS);
    await poller.pollNow();
    poller.stop();
    expect(delays.at(-1)).toBe(SNAPSHOT_POLL_INTERVAL_MS);
    expect(poller.peekVersion()).toBe("v1");
  });

  test("a 304 refresh does not stamp knownVersion, so a later identical version still refreshes", async () => {
    let paint = false;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: "v2" }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: paint ? "painted" : "unchanged" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    expect(poller.peekVersion()).toBe("v1");
    paint = true;
    await poller.pollNow();
    expect(refreshes).toEqual(["go", "go"]);
    expect(poller.peekVersion()).toBe("v2");
    poller.stop();
  });

  test("a failed silent refresh does not mark the version current and retries", async () => {
    let refreshOk = false;
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "changed", version: "v2" }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: refreshOk ? "painted" : "failed" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    expect(poller.peekVersion()).toBe("v1");
    refreshOk = true;
    await poller.pollNow();
    expect(refreshes).toEqual(["go", "go"]);
    expect(poller.peekVersion()).toBe("v2");
    poller.stop();
  });

  test("HTTP errors are not treated as unchanged, so the next tick retries", async () => {
    const results = [{ kind: "error" }, { kind: "changed", version: "v2" }];
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => results.shift(),
      refresh: async () => {
        refreshes.push("go");
        return { kind: "painted" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(refreshes).toEqual([]);
    expect(poller.peekVersion()).toBe("v1");
    await poller.pollNow();
    expect(refreshes).toEqual(["go"]);
    expect(poller.peekVersion()).toBe("v2");
    poller.stop();
  });

  test("401 stops polling and reports unauthorized", async () => {
    const unauthorized = [];
    const refreshes = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "unauthorized" }),
      refresh: async () => {
        refreshes.push("go");
        return { kind: "painted" };
      },
      isHidden: () => false,
      isBlocked: () => false,
      onUnauthorized: () => unauthorized.push("stop"),
      ...idleTimers(),
    });
    poller.start("v1");
    await poller.pollNow();
    expect(unauthorized).toEqual(["stop"]);
    expect(refreshes).toEqual([]);
    await poller.pollNow();
    expect(refreshes).toEqual([]);
    poller.stop();
  });

  test("429 backs off using Retry-After", async () => {
    const delays = [];
    const poller = createSnapshotPoller({
      fetchVersion: async () => ({ kind: "rate_limited", retryAfterMs: 8000 }),
      refresh: async () => ({ kind: "painted" }),
      isHidden: () => false,
      isBlocked: () => false,
      setTimeoutFn: (fn, ms) => {
        delays.push(ms);
        return 0;
      },
      clearTimeoutFn: () => {},
    });
    poller.start("v1");
    expect(delays[0]).toBe(SNAPSHOT_POLL_INTERVAL_MS);
    await poller.pollNow();
    poller.stop();
    expect(delays.at(-1)).toBe(8000);
  });

  test("interval default is a cheap poll, not realtime", () => {
    expect(SNAPSHOT_POLL_INTERVAL_MS).toBe(2500);
    expect(etagFromVersion("a|b")).toBe('"a|b"');
    expect(pollBackoffMs(1, 2500, 30_000)).toBe(5000);
    expect(retryAfterMsFromHeader("3")).toBe(3000);
    expect(retryAfterMsFromHeader("not-a-number")).toBe(2500);
  });
});

describe("snapshot loader in-flight flag", () => {
  test("isInFlight is true only while a fetch is pending", async () => {
    const loader = createSnapshotLoader();
    expect(loader.isInFlight()).toBe(false);
    let resolveFetch;
    const pending = loader.load("thread-1", () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    expect(loader.isInFlight()).toBe(true);
    resolveFetch({
      ok: true,
      status: 200,
      payload: { channelId: "thread-1", gameName: "Inis" },
    });
    expect(await pending).toMatchObject({ status: "applied" });
    expect(loader.isInFlight()).toBe(false);
  });
});

describe("history flash CSS", () => {
  test("new history rows use a highlight flash animation", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "embedded-client", "src", "style.css"),
      "utf8"
    );
    expect(css).toContain(".status-history li.is-changed");
    expect(css).toContain("history-changed-flash");
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.status-history li\.is-changed \{([^}]+)\}/
    );
    expect(reduced?.[1]).toContain("animation: none");
    expect(reduced?.[1]).not.toContain("background-color");
    expect(HISTORY_FLASH_MS).toBe(1400);
  });

  test("clearing the flash class removes the reduced-motion highlight", () => {
    const item = { classList: { removed: [], remove(name) { this.removed.push(name); } } };
    const root = { querySelectorAll: () => [item] };
    clearHistoryFlash(root);
    expect(item.classList.removed).toEqual([HISTORY_CHANGED_CLASS]);
  });
});

describe("status scroll restore", () => {
  test("captures and restores scrollTop", () => {
    const el = { scrollTop: 48 };
    expect(captureScrollTop(el)).toBe(48);
    restoreScrollTop(el, 12);
    expect(el.scrollTop).toBe(12);
    expect(captureScrollTop(null)).toBe(0);
  });
});
