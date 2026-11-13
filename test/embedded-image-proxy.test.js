const { describe, expect, test } = require("bun:test");
const { createEmbeddedApp } = require("../modules/embeddedApp");
const {
  CARD_IMAGE_PATH,
  MAX_REDIRECTS,
  cardImagePath,
  deriveImageProxyKey,
  fetchCardImage,
  isBlockedAddress,
  normalizeSourceUrl,
  proxySnapshotImages,
  verifySourceSignature,
} = require("../modules/embeddedImageProxy");

const KEY = Buffer.alloc(32, 7);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const CARD_URL = "https://furtivespy.com/images/arcs/arcs_3_1.png";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function imageResponse(bytes = PNG_BYTES, headers = {}) {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "image/png", ...headers },
  });
}

function redirectResponse(location) {
  return new Response(null, { status: 302, headers: { location } });
}

function recordingFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return handler(String(url), calls.length);
  };
  return { calls, fetchImpl };
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
    server.on("error", reject);
  });
}

describe("card image signing", () => {
  test("signed path round-trips and rejects tampering", () => {
    const path = cardImagePath(CARD_URL, KEY);
    expect(path.startsWith(`${CARD_IMAGE_PATH}?`)).toBe(true);
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("u")).toBe(CARD_URL);
    expect(verifySourceSignature(CARD_URL, params.get("s"), KEY)).toBe(true);
    expect(
      verifySourceSignature(`${CARD_URL}?x=1`, params.get("s"), KEY)
    ).toBe(false);
    expect(
      verifySourceSignature(CARD_URL, params.get("s"), Buffer.alloc(32, 8))
    ).toBe(false);
    expect(verifySourceSignature(CARD_URL, "short", KEY)).toBe(false);
  });

  test("key is stable for a client secret and random without one", () => {
    expect(deriveImageProxyKey("secret").equals(deriveImageProxyKey("secret"))).toBe(
      true
    );
    expect(deriveImageProxyKey("").equals(deriveImageProxyKey(""))).toBe(false);
  });

  test("only http(s) URLs without credentials are signable", () => {
    expect(normalizeSourceUrl("http://www.furtivespy.com/a.png#x")).toBe(
      "http://www.furtivespy.com/a.png"
    );
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSourceUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeSourceUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(normalizeSourceUrl("https://user:pw@furtivespy.com/a.png")).toBeNull();
    expect(normalizeSourceUrl("/relative.png")).toBeNull();
    expect(normalizeSourceUrl(null)).toBeNull();
    expect(normalizeSourceUrl(`https://a.com/${"x".repeat(2100)}`)).toBeNull();
  });

  test("snapshot cards swap url for a signed imageUrl and keep other fields", () => {
    const snapshot = proxySnapshotImages(
      {
        gameName: "ARCS",
        hand: [
          { id: "a", name: "Mobilization 2", url: CARD_URL, suit: "Mobilization" },
          { id: "b", name: "No art", url: null },
          { id: "c", name: "Bad art", url: "ftp://x/y.png" },
        ],
        playArea: [],
        gameBoard: [],
      },
      KEY
    );
    expect(snapshot.hand).toEqual([
      {
        id: "a",
        name: "Mobilization 2",
        suit: "Mobilization",
        imageUrl: cardImagePath(CARD_URL, KEY),
      },
      { id: "b", name: "No art" },
      { id: "c", name: "Bad art" },
    ]);
    expect(snapshot.gameName).toBe("ARCS");
  });

  test("proxies other-player avatars and deck backs without leaking source URLs", () => {
    const avatar = "https://cdn.discordapp.com/avatars/riley/a.png?size=128";
    const back = "https://furtivespy.com/backs/main.png";
    const snapshot = proxySnapshotImages(
      {
        otherPlayers: [{ userId: "riley", name: "Riley", handCount: 2, avatarUrl: avatar }],
        decks: [{ name: "Main", remaining: 30, total: 42, backUrl: back }],
      },
      KEY
    );
    expect(snapshot.otherPlayers[0].avatarUrl).toBe(cardImagePath(avatar, KEY));
    expect(snapshot.decks[0]).toEqual({
      name: "Main",
      remaining: 30,
      total: 42,
      backImageUrl: cardImagePath(back, KEY),
    });
    expect(JSON.stringify(snapshot)).not.toContain(avatar);
    expect(JSON.stringify(snapshot)).not.toContain(back);
    expect(JSON.stringify(snapshot)).not.toContain("backUrl");
  });
});

describe("private address blocking", () => {
  test.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "::ffff:7f00:1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
    "[::1]",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  test.each(["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"])(
    "allows %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});

describe("fetchCardImage", () => {
  test("returns image bytes from a public host", async () => {
    const { calls, fetchImpl } = recordingFetch(() => imageResponse());
    const image = await fetchCardImage(CARD_URL, {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(image.contentType).toBe("image/png");
    expect(image.body.equals(PNG_BYTES)).toBe(true);
    expect(calls[0].options.redirect).toBe("manual");
  });

  test("refuses hosts that resolve to private addresses", async () => {
    const { calls, fetchImpl } = recordingFetch(() => imageResponse());
    await expect(
      fetchCardImage("https://internal.example/a.png", {
        fetchImpl,
        lookup: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.5", family: 4 },
        ],
      })
    ).rejects.toMatchObject({ code: "blocked_host" });
    await expect(
      fetchCardImage("http://169.254.169.254/latest/meta-data", {
        fetchImpl,
        lookup: publicLookup,
      })
    ).rejects.toMatchObject({ code: "blocked_host" });
    expect(calls).toHaveLength(0);
  });

  test("re-checks every redirect hop", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      redirectResponse("http://127.0.0.1:8080/admin.png")
    );
    await expect(
      fetchCardImage(CARD_URL, { fetchImpl, lookup: publicLookup })
    ).rejects.toMatchObject({ code: "blocked_host" });
    expect(calls).toHaveLength(1);
  });

  test("follows a public redirect, but not forever", async () => {
    const followed = recordingFetch((url) =>
      url === CARD_URL
        ? redirectResponse("https://cdn.furtivespy.com/arcs_3_1.png")
        : imageResponse()
    );
    const image = await fetchCardImage(CARD_URL, {
      fetchImpl: followed.fetchImpl,
      lookup: publicLookup,
    });
    expect(image.body.equals(PNG_BYTES)).toBe(true);
    expect(followed.calls.map((call) => call.url)).toEqual([
      CARD_URL,
      "https://cdn.furtivespy.com/arcs_3_1.png",
    ]);

    const looping = recordingFetch((url, n) => redirectResponse(`${CARD_URL}?hop=${n}`));
    await expect(
      fetchCardImage(CARD_URL, {
        fetchImpl: looping.fetchImpl,
        lookup: publicLookup,
      })
    ).rejects.toMatchObject({ code: "too_many_redirects" });
    expect(looping.calls).toHaveLength(MAX_REDIRECTS + 1);
  });

  test("rejects non-images, upstream errors, and oversized bodies", async () => {
    const html = recordingFetch(
      () =>
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    await expect(
      fetchCardImage(CARD_URL, { fetchImpl: html.fetchImpl, lookup: publicLookup })
    ).rejects.toMatchObject({ code: "not_an_image" });

    const missing = recordingFetch(() => new Response("", { status: 404 }));
    await expect(
      fetchCardImage(CARD_URL, { fetchImpl: missing.fetchImpl, lookup: publicLookup })
    ).rejects.toMatchObject({ code: "upstream_404" });

    const declaredHuge = recordingFetch(() =>
      imageResponse(PNG_BYTES, { "content-length": "999999999" })
    );
    await expect(
      fetchCardImage(CARD_URL, {
        fetchImpl: declaredHuge.fetchImpl,
        lookup: publicLookup,
      })
    ).rejects.toMatchObject({ code: "too_large" });

    const streamedHuge = recordingFetch(() => imageResponse(Buffer.alloc(64)));
    await expect(
      fetchCardImage(CARD_URL, {
        fetchImpl: streamedHuge.fetchImpl,
        lookup: publicLookup,
        maxBytes: 16,
      })
    ).rejects.toMatchObject({ code: "too_large" });
  });
});

describe("GET /api/card-image", () => {
  function makeApp(fetchImpl) {
    return createEmbeddedApp({
      clientId: "client-123",
      clientSecret: "server-secret",
      staticDir: "/nonexistent-embedded-static",
      imageProxyKey: KEY,
      imageFetchImpl: fetchImpl,
      imageLookup: publicLookup,
    });
  }

  test("serves signed card images with safe headers on both route prefixes", async () => {
    const { calls, fetchImpl } = recordingFetch(() => imageResponse());
    const { server, url } = await listen(makeApp(fetchImpl));
    try {
      const signed = cardImagePath(CARD_URL, KEY);
      for (const prefix of ["", "/.proxy"]) {
        const response = await fetch(`${url}${prefix}${signed}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("content-security-policy")).toContain("sandbox");
        expect(Buffer.from(await response.arrayBuffer()).equals(PNG_BYTES)).toBe(true);
      }
      expect(calls.map((call) => call.url)).toEqual([CARD_URL, CARD_URL]);
    } finally {
      server.close();
    }
  });

  test("is not an open proxy", async () => {
    const { calls, fetchImpl } = recordingFetch(() => imageResponse());
    const { server, url } = await listen(makeApp(fetchImpl));
    try {
      const missing = await fetch(`${url}${CARD_IMAGE_PATH}`);
      expect(missing.status).toBe(400);

      const unsigned = await fetch(
        `${url}${CARD_IMAGE_PATH}?u=${encodeURIComponent(CARD_URL)}`
      );
      expect(unsigned.status).toBe(400);

      const signedOther = new URLSearchParams(
        cardImagePath(CARD_URL, KEY).split("?")[1]
      );
      signedOther.set("u", "https://evil.example/steal.png");
      const forged = await fetch(`${url}${CARD_IMAGE_PATH}?${signedOther}`);
      expect(forged.status).toBe(403);
      expect(await forged.json()).toEqual({ error: "invalid_signature" });

      expect(calls).toHaveLength(0);
    } finally {
      server.close();
    }
  });

  test("upstream failures return 502 without echoing the source URL", async () => {
    const logs = [];
    const app = createEmbeddedApp({
      clientSecret: "server-secret",
      staticDir: "/nonexistent-embedded-static",
      imageProxyKey: KEY,
      imageFetchImpl: async () => new Response("", { status: 500 }),
      imageLookup: publicLookup,
      logger: { log: (message, level) => logs.push({ message, level }) },
    });
    const { server, url } = await listen(app);
    try {
      const tokenUrl = "https://firebasestorage.googleapis.com/o/card?token=abc123";
      const response = await fetch(`${url}${cardImagePath(tokenUrl, KEY)}`);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "image_unavailable" });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe("warn");
      expect(logs[0].message).toContain("firebasestorage.googleapis.com");
      expect(logs[0].message).not.toContain("abc123");
    } finally {
      server.close();
    }
  });
});
