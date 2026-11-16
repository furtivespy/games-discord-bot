const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const {
  HISTORY_CHANGED_CLASS,
  SNAPSHOT_POLL_INTERVAL_MS,
  createSnapshotPoller,
  etagFromVersion,
  historyEntryKey,
  isSnapshotPollBlocked,
  newHistoryKeys,
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
    expect(isSnapshotPollBlocked(fakeDoc(["[data-zoom-modal]"]))).toBe(true);
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
      fetchVersion: async () => versions[0],
      refresh: async () => {
        refreshes.push("go");
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
      fetchVersion: async () => "v2",
      refresh: async () => {
        refreshes.push("go");
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
      },
      isHidden: () => false,
      isBlocked: () => false,
      ...idleTimers(),
    });
    poller.start("v1");
    const pending = poller.pollNow();
    poller.stop();
    resolveVersion("v2");
    await pending;
    expect(refreshes).toEqual([]);
  });

  test("interval default is a cheap poll, not realtime", () => {
    expect(SNAPSHOT_POLL_INTERVAL_MS).toBe(2500);
    expect(etagFromVersion("a|b")).toBe('"a|b"');
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
    expect(css).toContain("prefers-reduced-motion");
  });
});
