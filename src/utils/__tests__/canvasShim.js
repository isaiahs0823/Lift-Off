// A minimal fake 2D canvas context + `document`, so workoutShareCard.js's canvas-drawing code
// can run in plain Node (no jsdom/node-canvas dependency added to the app just for this). It
// doesn't render real pixels — it tracks every fillText call (with the font size active at the
// time, so measureText-driven wrapping/truncation/fitFontSize logic exercises real branches) and
// approximates text width from a fixed average-character-width heuristic. That's enough to test
// what actually matters here: the function never throws, respects export dimensions, keeps text
// within its allotted width (no clipping), and draws the real data-derived strings (PR labels,
// weight×reps, volume, no NaN) rather than literal pixel output.
const CHAR_WIDTH_FACTOR = 0.58;

class FakePath2D {
  constructor() {}
}

function parseFontSize(fontStr) {
  const m = /(\d+(?:\.\d+)?)px/.exec(fontStr || "");
  return m ? Number(m[1]) : 16;
}

function makeGradient() {
  return { addColorStop() {} };
}

export function createFakeContext() {
  const calls = { fillText: [], strokeText: [] };
  let fontSize = 16;
  const ctx = {
    canvas: { width: 0, height: 0 },
    font: "16px sans-serif",
    textAlign: "left",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    shadowColor: "transparent",
    shadowBlur: 0,
    globalAlpha: 1,
    save() {},
    restore() {},
    scale() {},
    translate() {},
    clip() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    rect() {},
    stroke() {},
    fill() {},
    fillRect() {},
    strokeRect() {},
    createLinearGradient: makeGradient,
    createRadialGradient: makeGradient,
    measureText(text) {
      return { width: String(text).length * fontSize * CHAR_WIDTH_FACTOR };
    },
    fillText(text, x, y) {
      calls.fillText.push({ text: String(text), x, y, fontSize, align: ctx.textAlign, fillStyle: ctx.fillStyle });
    },
    strokeText(text, x, y) {
      calls.strokeText.push({ text: String(text), x, y, fontSize });
    },
  };
  Object.defineProperty(ctx, "font", {
    get() { return this._font; },
    set(v) { this._font = v; fontSize = parseFontSize(v); },
  });
  ctx.font = "16px sans-serif";
  ctx.__calls = calls;
  return ctx;
}

// Installs `document.createElement("canvas")` and a global `Path2D` stub for the duration of a
// test file. workoutShareCard.js only ever calls createElement for a canvas (the real preview)
// or a scratch 1x1 measuring context (in the real browser build) — this fake always returns a
// canvas-shaped object regardless of tag, which is fine since nothing else in this module touches
// the DOM.
export function installCanvasShim() {
  const contexts = [];
  globalThis.Path2D = FakePath2D;
  globalThis.document = {
    createElement() {
      const ctx = createFakeContext();
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: (type) => `data:${type || "image/png"};base64,FAKE`,
      };
      ctx.canvas = canvas;
      contexts.push(ctx);
      return canvas;
    },
  };
  return { contexts };
}

export function uninstallCanvasShim() {
  delete globalThis.Path2D;
  delete globalThis.document;
}
