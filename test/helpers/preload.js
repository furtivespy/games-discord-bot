const { mock } = require("bun:test");

/**
 * Native `canvas` needs Cairo/Pango in CI. Command-logic tests stub GameFormatter
 * anyway, so preload a cheap canvas so requiring GameFormatter/BGG never logs in
 * or compiles native bindings.
 */
function createFakeCanvas(width = 1, height = 1) {
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    drawImage() {},
    fillText() {},
    strokeText() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    stroke() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clip() {},
    measureText: (text) => ({ width: String(text || "").length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
  };

  return {
    width,
    height,
    getContext: () => ctx,
    toBuffer: () => Buffer.from(""),
    toDataURL: () => "data:image/png;base64,",
  };
}

class Image {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.src = "";
    this.onload = null;
    this.onerror = null;
  }
}

mock.module("canvas", () => ({
  createCanvas: (width, height) => createFakeCanvas(width, height),
  Image,
  loadImage: async () => ({ width: 1, height: 1 }),
  registerFont() {},
}));
