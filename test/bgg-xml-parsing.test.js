const { afterEach, describe, expect, test } = require("bun:test");
const fs = require("fs");
const path = require("path");
const BoardGameGeek = require("../modules/BoardGameGeek");

const FIXTURES = path.join(__dirname, "fixtures");
const BOARDGAME_XML = fs.readFileSync(
  path.join(FIXTURES, "bgg-boardgame.xml"),
  "utf8"
);
const SEARCH_XML = fs.readFileSync(path.join(FIXTURES, "bgg-search.xml"), "utf8");
const SINGLE_NAME_XML = `<?xml version="1.0" encoding="utf-8"?>
<boardgames>
  <boardgame objectid="13">
    <name primary="true">Dungeons &amp;amp; Dragons</name>
    <description>Roll &amp;amp; write.&amp;#10;It&amp;rsquo;s fun.</description>
    <statistics>
      <ratings>
        <average>7.1</average>
        <averageweight>2.3</averageweight>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="400"/>
        </ranks>
      </ratings>
    </statistics>
  </boardgame>
</boardgames>`;

const originalFetch = globalThis.fetch;

function stubBggFetch({ gameXml, searchXml } = {}) {
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    expect(init?.headers?.Authorization).toBe("Bearer test-bgg-token");
    if (href.includes("/xmlapi/boardgame/")) {
      return new Response(gameXml ?? BOARDGAME_XML, {
        status: 200,
        headers: { "content-type": "text/xml" },
      });
    }
    if (href.includes("/xmlapi2/search")) {
      return new Response(searchXml ?? SEARCH_XML, {
        status: 200,
        headers: { "content-type": "text/xml" },
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  };
}

function fakeClient() {
  return { config: { BGGToken: "test-bgg-token" } };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("he 2.0.0 under Bun", () => {
  test("require() loads the ESM package and decode() works", () => {
    const he = require("he");
    expect(require("he/package.json").version).toMatch(/^2\./);
    expect(require("he/package.json").type).toBe("module");
    expect(typeof he.decode).toBe("function");
    expect(he.decode("A &amp; B&#10;It&rsquo;s C")).toBe("A & B\nIt\u2019s C");
  });
});

describe("BGG XML parsing and HTML-entity decoding", () => {
  test("fast-xml-parser 5.x is installed", () => {
    expect(require("fast-xml-parser/package.json").version).toMatch(/^5\./);
  });

  test("LoadBggData parses thing XML and decodes entities in the primary name", async () => {
    stubBggFetch();
    const bgg = await BoardGameGeek.CreateAndLoad("102794", fakeClient(), {});
    expect(bgg.gameName).toBe("Sid Meier's Caverna");
    expect(bgg.gameName).not.toContain("&apos;");
    expect(bgg.gameName).not.toContain("&amp;");
  });

  test("LoadBggData decodes a single primary name that is not an array", async () => {
    stubBggFetch({ gameXml: SINGLE_NAME_XML });
    const bgg = await BoardGameGeek.CreateAndLoad("13", fakeClient(), {});
    expect(bgg.gameName).toBe("Dungeons & Dragons");
  });

  test("description embed decodes HTML entities then turns HTML into markdown", async () => {
    stubBggFetch();
    const bgg = await BoardGameGeek.CreateAndLoad("102794", fakeClient(), {});
    bgg.GetGameDescriptionEmbed();
    const description = bgg.embeds.at(-1).data.description;
    expect(description).toContain("2 dwarves & a cave");
    expect(description).toContain("It\u2019s a sequel to Agricola");
    expect(description).toMatch(/[*_]rooms[*_]/);
    expect(description).not.toContain("&amp;");
    expect(description).not.toContain("&#10;");
    expect(description).not.toContain("&rsquo;");
    expect(description).not.toContain("&lt;em&gt;");
  });

  test("awards embed decodes HTML entities in honor text", async () => {
    stubBggFetch();
    const bgg = await BoardGameGeek.CreateAndLoad("102794", fakeClient(), {});
    bgg.GetGameAwardsEmbed();
    const honors = bgg.embeds.at(-1).data.description;
    expect(honors).toContain("2013 Golden Geek Best Strategy Game Nominee");
    expect(honors).toContain("Players' Choice Award");
    expect(honors).not.toContain("&apos;");
  });

  test("details embed decodes HTML entities in rank names", async () => {
    stubBggFetch();
    const bgg = await BoardGameGeek.CreateAndLoad("102794", fakeClient(), {});
    bgg.GetGameDetailsEmbed();
    const ranksField = bgg.embeds.at(-1).data.fields.find(
      (field) => field.name === "Ranks & Ratings"
    );
    expect(ranksField.value).toContain("**Board Game Rank:** 25");
    expect(ranksField.value).toContain("**It\u2019s Strategy Rank:** 20");
    expect(ranksField.value).not.toContain("&rsquo;");
  });

  test("Search parses search XML and decodes entities in result names", async () => {
    stubBggFetch();
    const results = await BoardGameGeek.Search("wonderful", "test-bgg-token");
    const wonderful = results.find((item) => item.value === "266192");
    expect(wonderful).toEqual({
      name: "It\u2019s a Wonderful World (2019)",
      value: "266192",
    });
    expect(results.map((item) => item.value).sort()).toEqual([
      "13",
      "266192",
      "9209",
    ]);
  });
});
