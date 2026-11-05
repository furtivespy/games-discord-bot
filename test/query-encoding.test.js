const { describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function googleImageQuery(searchTerm, isGif, start = 1, safeSearch = true) {
  const query = new URLSearchParams();
  query.set("q", searchTerm);
  query.set("safe", safeSearch ? "high" : "off");
  query.set("cx", "cx-id");
  query.set("key", "api-key");
  query.set("searchType", "image");
  query.set("start", start);
  if (isGif) query.set("fileType", "gif");
  return query.toString();
}

function urbanQuery(searchTerm) {
  const query = new URLSearchParams();
  query.set("term", searchTerm);
  return query.toString();
}

describe("URLSearchParams query encoding (FUR-155)", () => {
  test("Urban Dictionary {term} encodes spaces, reserved chars, and unicode", () => {
    expect(urbanQuery("cat")).toBe("term=cat");
    expect(urbanQuery("hello world")).toBe("term=hello+world");
    expect(urbanQuery("this & that")).toBe("term=this+%26+that");
    expect(urbanQuery("a=b")).toBe("term=a%3Db");
    expect(urbanQuery("c++")).toBe("term=c%2B%2B");
    expect(urbanQuery("foo/bar?baz")).toBe("term=foo%2Fbar%3Fbaz");
    expect(urbanQuery("café")).toBe("term=caf%C3%A9");
    expect(urbanQuery("")).toBe("term=");
  });

  test("Google image-search params encode q and stringify numeric start", () => {
    expect(googleImageQuery("ticket to ride", false, 1, true)).toBe(
      "q=ticket+to+ride&safe=high&cx=cx-id&key=api-key&searchType=image&start=1"
    );
    expect(googleImageQuery("dice gif", true, 11, false)).toBe(
      "q=dice+gif&safe=off&cx=cx-id&key=api-key&searchType=image&start=11&fileType=gif"
    );
    expect(googleImageQuery("Catan: Cities & Knights", false, 1, true)).toBe(
      "q=Catan%3A+Cities+%26+Knights&safe=high&cx=cx-id&key=api-key&searchType=image&start=1"
    );
  });

  test("encoded queries round-trip the real param shapes", () => {
    const terms = [
      "cat",
      "hello world",
      "this & that",
      "a=b",
      "c++",
      "it's",
      "Catan: Cities & Knights!",
      "café 日本語",
      "foo/bar?baz",
    ];
    for (const term of terms) {
      expect(new URLSearchParams(urbanQuery(term)).get("term")).toBe(term);
    }

    const encoded = googleImageQuery("ticket to ride", true, 21, true);
    const parsed = new URLSearchParams(encoded);
    expect(parsed.get("q")).toBe("ticket to ride");
    expect(parsed.get("safe")).toBe("high");
    expect(parsed.get("start")).toBe("21");
    expect(parsed.get("fileType")).toBe("gif");
  });

  test("Command, Event, and UrbanDictionary use URLSearchParams and drop querystring", () => {
    const files = ["base/Command.js", "base/Event.js", "modules/UrbanDictionary.js"];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/require\(\s*['"]querystring['"]\s*\)/);
      expect(src).toContain("new URLSearchParams()");
      expect(src).toContain(".toString()");
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies.querystring).toBeUndefined();
    expect(pkg.devDependencies?.querystring).toBeUndefined();

    const lock = fs.readFileSync(path.join(ROOT, "bun.lock"), "utf8");
    expect(lock).not.toMatch(/"querystring":\s*"\^0\.2\.0"/);
    expect(lock).not.toContain('"querystring": ["querystring@');
  });
});
