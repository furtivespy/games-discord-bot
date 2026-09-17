const { describe, expect, test } = require("bun:test");
const { parseReminderTime } = require("../modules/parseReminderTime");

const EASTERN = "America/New_York";
// Wednesday Sep 16, 2026 4:48 PM EDT (UTC-4)
const SEPTEMBER_AFTERNOON = new Date("2026-09-16T20:48:00.000Z");

describe("parseReminderTime", () => {
  test("treats New Year midnight as EST, not the current EDT offset", () => {
    const parsed = parseReminderTime("12am on January 1, 2027", {
      timezone: EASTERN,
      now: SEPTEMBER_AFTERNOON,
    });

    expect(parsed.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  test("keeps relative durations on the instant, not a wall-clock rebuild", () => {
    const parsed = parseReminderTime("in 10 minutes", {
      timezone: EASTERN,
      now: SEPTEMBER_AFTERNOON,
    });

    expect(parsed.toISOString()).toBe("2026-09-16T20:58:00.000Z");
  });

  test("interprets tomorrow afternoon in the current DST offset", () => {
    const parsed = parseReminderTime("tomorrow at 5pm", {
      timezone: EASTERN,
      now: SEPTEMBER_AFTERNOON,
    });

    expect(parsed.toISOString()).toBe("2026-09-17T21:00:00.000Z");
  });

  test("honors an explicit zone in the text", () => {
    const parsed = parseReminderTime("January 1, 2027 at 12am EST", {
      timezone: EASTERN,
      now: SEPTEMBER_AFTERNOON,
    });

    expect(parsed.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  test("uses EDT for a summer wall-clock time set in winter", () => {
    const parsed = parseReminderTime("July 4, 2027 at 5pm", {
      timezone: EASTERN,
      now: new Date("2027-01-15T20:00:00.000Z"),
    });

    expect(parsed.toISOString()).toBe("2027-07-04T21:00:00.000Z");
  });

  test("returns null when the time cannot be parsed", () => {
    expect(
      parseReminderTime("whenever", {
        timezone: EASTERN,
        now: SEPTEMBER_AFTERNOON,
      })
    ).toBeNull();
  });
});
