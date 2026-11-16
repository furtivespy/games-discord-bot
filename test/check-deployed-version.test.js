const { describe, expect, test } = require("bun:test");
const {
  decide,
  readDeployedSha,
  waitForDeploy,
} = require("../scripts/check-deployed-version");

const EXPECTED = "a".repeat(40);
const NEWER = "b".repeat(40);

function json(body, ok = true) {
  return { ok, json: async () => body };
}

describe("decide", () => {
  test("matches the exact expected sha", () => {
    expect(decide({ deployed: EXPECTED, expected: EXPECTED })).toBe("match");
  });

  test("accepts a newer deploy that contains the expected commit", () => {
    expect(
      decide({ deployed: NEWER, expected: EXPECTED, contains: () => true })
    ).toBe("newer");
  });

  test("waits for an unrelated or older deploy", () => {
    expect(
      decide({ deployed: NEWER, expected: EXPECTED, contains: () => false })
    ).toBe("wait");
  });

  test("waits while the build reports no sha", () => {
    expect(decide({ deployed: null, expected: EXPECTED })).toBe("wait");
    expect(decide({ deployed: "unknown", expected: EXPECTED })).toBe("wait");
  });
});

describe("readDeployedSha", () => {
  test("reads sha from the /health JSON", async () => {
    const fetchImpl = async () => json({ status: "ok", sha: EXPECTED });
    expect(await readDeployedSha("http://x/health", fetchImpl)).toBe(EXPECTED);
  });

  test("returns null for the SPA index.html an older build serves", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    expect(await readDeployedSha("http://x/health", fetchImpl)).toBeNull();
  });

  test("returns null on a non-2xx response or a network error", async () => {
    expect(
      await readDeployedSha("http://x/health", async () => json({}, false))
    ).toBeNull();
    expect(
      await readDeployedSha("http://x/health", async () => {
        throw new Error("ECONNREFUSED");
      })
    ).toBeNull();
  });
});

describe("waitForDeploy", () => {
  test("polls until the new version is served", async () => {
    const replies = [
      { ok: true, json: async () => { throw new SyntaxError("html"); } },
      json({ status: "ok", sha: "c".repeat(40) }),
      json({ status: "ok", sha: EXPECTED }),
    ];
    let calls = 0;
    const ok = await waitForDeploy({
      expected: EXPECTED,
      fetchImpl: async () => replies[calls++],
      contains: () => false,
      sleep: async () => {},
      log: () => {},
    });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
  });

  test("gives up after the timeout", async () => {
    const ok = await waitForDeploy({
      expected: EXPECTED,
      timeoutMs: 20,
      intervalMs: 5,
      fetchImpl: async () => json({ status: "ok", sha: "c".repeat(40) }),
      contains: () => false,
      log: () => {},
    });
    expect(ok).toBe(false);
  });
});
