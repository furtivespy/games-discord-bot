const { describe, expect, test } = require("bun:test");
const {
  ACTION_COUNT_MAX,
  ACTION_COUNT_MIN,
  DEFAULT_ACTION_COUNT,
  parseActionCount,
} = require("../modules/actionCount");
const visualActions = require("../embedded-client/src/visualActions.ts");

describe("shared action count parser", () => {
  test("accepts integers from min to max and matches the visual-mode client", () => {
    expect(ACTION_COUNT_MIN).toBe(1);
    expect(ACTION_COUNT_MAX).toBe(1000);
    expect(DEFAULT_ACTION_COUNT).toBe(1);
    expect(parseActionCount(1)).toBe(1);
    expect(parseActionCount("99")).toBe(99);
    expect(parseActionCount(1000)).toBe(1000);
    expect(parseActionCount(0)).toBeNull();
    expect(parseActionCount(1001)).toBeNull();
    expect(parseActionCount("nope")).toBeNull();
    expect(visualActions.ACTION_COUNT_MIN).toBe(ACTION_COUNT_MIN);
    expect(visualActions.ACTION_COUNT_MAX).toBe(ACTION_COUNT_MAX);
    expect(visualActions.parseActionCount(3)).toBe(parseActionCount(3));
    expect(visualActions.parseActionCount(1001)).toBeNull();
  });
});
