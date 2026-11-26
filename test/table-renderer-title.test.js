const { describe, expect, test } = require("bun:test");
const TableRenderer = require("../modules/TableRenderer");

function createFontAwareContext(charWidthFactor = 0.55) {
  const fillTextCalls = [];
  const fillRectCalls = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    font: "16px Open Sans",
    textAlign: "left",
    textBaseline: "alphabetic",
    lineWidth: 1,
    fillRect(x, y, width, height) {
      fillRectCalls.push({ x, y, width, height, fillStyle: ctx.fillStyle });
    },
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(text, x, y) {
      fillTextCalls.push({
        text,
        x,
        y,
        font: ctx.font,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
        width: ctx.measureText(text).width,
      });
    },
    measureText(text) {
      const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const fontSize = match ? Number(match[1]) : 16;
      return { width: String(text || "").length * fontSize * charWidthFactor };
    },
  };

  return {
    ctx,
    fillTextCalls,
    fillRectCalls,
    canvas: {
      width: 400,
      height: 300,
      getContext: () => ctx,
      toBuffer: () => Buffer.from(""),
    },
  };
}

describe("TableRenderer.resolveTitleLayout", () => {
  test("keeps default 24px single-line layout for short titles", () => {
    const { ctx } = createFontAwareContext();
    const layout = TableRenderer.resolveTitleLayout(
      ctx,
      { text: "Inis Status", fontSize: 24, fontFamily: "Open Sans" },
      300,
      10
    );

    expect(layout.lines).toEqual(["Inis Status"]);
    expect(layout.fontSize).toBe(24);
    expect(layout.titleHeight).toBe(44);
  });

  test("shrinks font size on long titles so they fit on one line without clipping", () => {
    const { ctx } = createFontAwareContext();
    const title = "FUR-206 legacy-only (Custom game) Status";
    const maxWidth = 300;
    const layout = TableRenderer.resolveTitleLayout(
      ctx,
      { text: title, fontSize: 24, fontFamily: "Open Sans" },
      maxWidth,
      10
    );

    expect(layout.lines).toEqual([title]);
    expect(layout.fontSize).toBeLessThan(24);
    expect(layout.fontSize).toBeGreaterThanOrEqual(12);

    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    expect(ctx.measureText(layout.lines[0]).width).toBeLessThanOrEqual(maxWidth);

    // Next integer size up would overflow, confirming largest fitting size was chosen
    ctx.font = `${layout.fontSize + 1}px ${layout.fontFamily}`;
    expect(ctx.measureText(title).width).toBeGreaterThan(maxWidth);
  });

  test("wraps onto multiple lines at minFontSize when title still exceeds maxWidth", () => {
    const { ctx } = createFontAwareContext();
    const title =
      "Super Extremely Long Custom Board Game Title Name (Custom game) Status (Turn Order Reversed)";
    const maxWidth = 300;
    const layout = TableRenderer.resolveTitleLayout(
      ctx,
      { text: title, fontSize: 24, minFontSize: 12, fontFamily: "Open Sans" },
      maxWidth,
      10
    );

    expect(layout.fontSize).toBe(12);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(" ")).toBe(title);

    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    for (const line of layout.lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(maxWidth);
    }
    expect(layout.titleHeight).toBe(layout.lines.length * layout.lineHeight + 20);
  });

  test("splits an unbreakable long word so it never clips outside maxWidth", () => {
    const { ctx } = createFontAwareContext();
    const title = "A".repeat(70);
    const maxWidth = 300;
    const layout = TableRenderer.resolveTitleLayout(
      ctx,
      { text: title, fontSize: 24, minFontSize: 12, fontFamily: "Open Sans" },
      maxWidth,
      10
    );

    expect(layout.fontSize).toBe(12);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join("")).toBe(title);

    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    for (const line of layout.lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(maxWidth);
    }
  });

  test("returns empty layout when title text is blank or omitted", () => {
    const { ctx } = createFontAwareContext();
    expect(TableRenderer.resolveTitleLayout(ctx, null, 300, 10)).toEqual({
      lines: [],
      fontSize: 0,
      fontFamily: "",
      lineHeight: 0,
      titleHeight: 0,
    });
    expect(
      TableRenderer.resolveTitleLayout(ctx, { text: "   " }, 300, 10).titleHeight
    ).toBe(0);
  });
});

describe("TableRenderer.generateTable title rendering", () => {
  test("draws shrunk title centered within the table width and above the header row", async () => {
    const { canvas, fillTextCalls, fillRectCalls } = createFontAwareContext();
    const title = "FUR-206 legacy-only (Custom game) Status";
    const columns = [
      { title: "Player" },
      { title: "Score", options: { textAlign: "right" } },
    ];
    const data = [
      [{ value: "(1) Alice" }, { value: "10" }],
      [{ value: "Totals", fontWeight: "bold" }, { value: "" }],
    ];
    const options = {
      header: { fontSize: 18, fontWeight: "bold", background: "#f0f0f0" },
      title: { text: title, fontSize: 24, fontFamily: "Open Sans" },
      cell: { fontSize: 18, fontFamily: "Open Sans", padding: 10 },
      fontFamily: "Open Sans",
    };

    const renderer = new TableRenderer(canvas, { columns, data, options });
    await renderer.generateTable();

    const titleCall = fillTextCalls.find((call) => call.text === title);
    expect(titleCall).toBeDefined();

    // Table width is 200 (Player min) + 100 (Score min) = 300, margin = 15
    const tableX = 15;
    const tableWidth = 300;
    expect(titleCall.x).toBe(tableX + tableWidth / 2);
    expect(titleCall.textAlign).toBe("center");
    expect(titleCall.width).toBeLessThanOrEqual(tableWidth);

    // Left and right edges of rendered title remain inside [tableX, tableX + tableWidth]
    expect(titleCall.x - titleCall.width / 2).toBeGreaterThanOrEqual(tableX);
    expect(titleCall.x + titleCall.width / 2).toBeLessThanOrEqual(
      tableX + tableWidth
    );

    // Header rect starts below the title block
    const headerRect = fillRectCalls.find((rect) => rect.fillStyle === "#f0f0f0");
    expect(headerRect).toBeDefined();
    expect(titleCall.y).toBeLessThan(headerRect.y);
  });
});
