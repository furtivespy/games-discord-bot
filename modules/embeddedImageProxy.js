"use strict";

const crypto = require("crypto");
const dns = require("dns");
const net = require("net");

/**
 * Discord Activities can only load resources through the Discord proxy, so
 * card art hosted elsewhere is blocked by CSP. Snapshots hand the client a
 * signed same-origin path instead of the raw URL; this module fetches the
 * image server-side. Card URLs are player-supplied, so only signed URLs are
 * served and private/internal addresses are refused on every redirect hop.
 */

const CARD_IMAGE_PATH = "/api/card-image";
const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const UPSTREAM_TIMEOUT_MS = 10_000;
const CACHE_CONTROL = "public, max-age=86400";
// Served from the bot origin, so an SVG opened directly must not run script.
const IMAGE_RESPONSE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
const USER_AGENT = "GameBot-CardImageProxy/1.0";
const KEY_LABEL = "gamebot-card-image-proxy-v1";

class ImageProxyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * Derived from the OAuth client secret so signed paths survive restarts.
 * Without a secret (mock mode), a per-process key still keeps the proxy closed.
 */
function deriveImageProxyKey(clientSecret) {
  const secret = String(clientSecret || "").trim();
  if (!secret) return crypto.randomBytes(32);
  return crypto.createHmac("sha256", secret).update(KEY_LABEL).digest();
}

function normalizeSourceUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > MAX_SOURCE_URL_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;
  parsed.hash = "";
  return parsed.href;
}

function signSourceUrl(sourceUrl, key) {
  return crypto.createHmac("sha256", key).update(sourceUrl).digest("base64url");
}

function verifySourceSignature(sourceUrl, signature, key) {
  const expected = Buffer.from(signSourceUrl(sourceUrl, key));
  const given = Buffer.from(String(signature || ""));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function cardImagePath(sourceUrl, key) {
  const normalized = normalizeSourceUrl(sourceUrl);
  if (!normalized) return null;
  const params = new URLSearchParams({
    u: normalized,
    s: signSourceUrl(normalized, key),
  });
  return `${CARD_IMAGE_PATH}?${params}`;
}

function withProxiedImages(cards, key) {
  if (!Array.isArray(cards)) return cards;
  return cards.map((card) => {
    if (!card || typeof card !== "object") return card;
    const { url, ...rest } = card;
    const imageUrl = cardImagePath(url, key);
    return imageUrl ? { ...rest, imageUrl } : rest;
  });
}

function withProxiedUrlField(items, sourceKey, destKey, key) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const source = item[sourceKey];
    const imageUrl = cardImagePath(source, key);
    if (sourceKey === destKey) {
      return { ...item, [destKey]: imageUrl || null };
    }
    const { [sourceKey]: _raw, ...rest } = item;
    return imageUrl ? { ...rest, [destKey]: imageUrl } : rest;
  });
}

/** Replaces each card's raw `url` with a signed `imageUrl` proxy path. */
function proxySnapshotImages(snapshot, key) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  return {
    ...snapshot,
    hand: withProxiedImages(snapshot.hand, key),
    playArea: withProxiedImages(snapshot.playArea, key),
    gameBoard: withProxiedImages(snapshot.gameBoard, key),
    otherPlayers: withProxiedUrlField(
      snapshot.otherPlayers,
      "avatarUrl",
      "avatarUrl",
      key
    ),
    decks: withProxiedUrlField(snapshot.decks, "backUrl", "backImageUrl", key),
  };
}

function isBlockedIPv4(address) {
  const [a, b, c] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIPv6(address) {
  const lower = address.toLowerCase();
  // Unspecified, loopback, IPv4-compatible and IPv4-mapped all start with "::".
  if (lower.startsWith("::")) return true;
  if (lower.startsWith("64:ff9b:")) return true;
  const first = parseInt(lower.split(":")[0], 16);
  if (!Number.isFinite(first)) return true;
  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
  );
}

function isBlockedAddress(address) {
  const value = String(address || "").replace(/^\[|\]$/g, "");
  const family = net.isIP(value);
  if (family === 4) return isBlockedIPv4(value);
  if (family === 6) return isBlockedIPv6(value);
  return true;
}

function defaultLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

async function assertPublicHost(hostname, lookup) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (!host) throw new ImageProxyError("blocked_host");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new ImageProxyError("blocked_host");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host);
  } catch {
    throw new ImageProxyError("dns_failed");
  }
  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (!list.length || list.some((entry) => isBlockedAddress(entry?.address))) {
    throw new ImageProxyError("blocked_host");
  }
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {}
}

async function readCappedBody(response, maxBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {}
      throw new ImageProxyError("too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function redirectTarget(response, currentUrl) {
  const location = response.headers.get("location");
  if (!location) return null;
  try {
    return normalizeSourceUrl(new URL(location, currentUrl).href);
  } catch {
    return null;
  }
}

async function fetchCardImage(
  sourceUrl,
  {
    fetchImpl = fetch,
    lookup = defaultLookup,
    timeoutMs = UPSTREAM_TIMEOUT_MS,
    maxBytes = MAX_IMAGE_BYTES,
  } = {}
) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = sourceUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = new URL(current);
    await assertPublicHost(url.hostname, lookup);
    const response = await fetchImpl(url.href, {
      redirect: "manual",
      signal,
      headers: { Accept: "image/*", "User-Agent": USER_AGENT },
    });
    if (response.status >= 300 && response.status < 400) {
      await discardBody(response);
      const next = redirectTarget(response, url);
      if (!next) throw new ImageProxyError("bad_redirect");
      current = next;
      continue;
    }
    if (!response.ok) {
      await discardBody(response);
      throw new ImageProxyError(`upstream_${response.status}`);
    }
    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) {
      await discardBody(response);
      throw new ImageProxyError("not_an_image");
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await discardBody(response);
      throw new ImageProxyError("too_large");
    }
    return { contentType, body: await readCappedBody(response, maxBytes) };
  }
  throw new ImageProxyError("too_many_redirects");
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function createCardImageHandler({
  key,
  fetchImpl = fetch,
  lookup = defaultLookup,
  timeoutMs,
  maxBytes,
  logger,
} = {}) {
  return async function sendCardImage(req, res) {
    const sourceUrl = normalizeSourceUrl(firstQueryValue(req.query?.u));
    const signature = firstQueryValue(req.query?.s);
    if (!sourceUrl || typeof signature !== "string" || !signature) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    if (!verifySourceSignature(sourceUrl, signature, key)) {
      res.status(403).json({ error: "invalid_signature" });
      return;
    }
    let image;
    try {
      image = await fetchCardImage(sourceUrl, {
        fetchImpl,
        lookup,
        timeoutMs,
        maxBytes,
      });
    } catch (err) {
      // Host only: some card URLs carry access tokens in the query string.
      logger?.log?.(
        `Card image proxy failed for ${new URL(sourceUrl).host}: ${
          err?.code || err?.name || err?.message || err
        }`,
        "warn"
      );
      res.status(502).json({ error: "image_unavailable" });
      return;
    }
    res.set({
      "Content-Type": image.contentType,
      "Cache-Control": CACHE_CONTROL,
      "Content-Security-Policy": IMAGE_RESPONSE_CSP,
      "X-Content-Type-Options": "nosniff",
    });
    res.status(200).send(image.body);
  };
}

module.exports = {
  CARD_IMAGE_PATH,
  MAX_IMAGE_BYTES,
  MAX_REDIRECTS,
  ImageProxyError,
  cardImagePath,
  createCardImageHandler,
  deriveImageProxyKey,
  fetchCardImage,
  isBlockedAddress,
  normalizeSourceUrl,
  proxySnapshotImages,
  signSourceUrl,
  verifySourceSignature,
};
