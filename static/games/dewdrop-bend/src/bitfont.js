const GLYPH_W = 5;
const GLYPH_H = 7;
const TRACKING = 1;

const RAW = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10011", "10101", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00110", "00100"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  ";": ["00000", "00110", "00110", "00000", "00110", "00110", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "=": ["00000", "11111", "00000", "11111", "00000", "00000", "00000"],
  "%": ["11001", "11010", "00100", "01000", "10110", "00110", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
};

const GLYPHS = new Map(Object.entries(RAW));

export const FONT_WIDTH = GLYPH_W;
export const FONT_HEIGHT = GLYPH_H;

export function textWidth(text, scale = 1, tracking = TRACKING) {
  const count = String(text).length;
  if (!count) return 0;
  return (count * GLYPH_W + (count - 1) * tracking) * scale;
}

export function lineHeight(scale = 1) {
  return (GLYPH_H + 3) * scale;
}

/**
 * Draw uppercase pixel text. Unknown characters become spaces.
 * Coordinates are top-left unless align is centre/right.
 */
export function drawText(ctx, text, x, y, options = {}) {
  const {
    color = "#f7eccf",
    shadow = null,
    shadowOffset = 1,
    scale = 1,
    tracking = TRACKING,
    align = "left",
    alpha = 1,
  } = options;
  const value = String(text).toUpperCase();
  const width = textWidth(value, scale, tracking);
  let startX = Math.round(x);
  if (align === "center") startX = Math.round(x - width / 2);
  if (align === "right") startX = Math.round(x - width);
  const startY = Math.round(y);

  const paint = (ox, oy, fill) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    let cursor = startX + ox;
    for (const char of value) {
      const glyph = GLYPHS.get(char.toUpperCase());
      if (glyph) {
        for (let row = 0; row < GLYPH_H; row += 1) {
          const pattern = glyph[row];
          for (let col = 0; col < GLYPH_W; col += 1) {
            if (pattern[col] === "1") {
              ctx.fillRect(cursor + col * scale, startY + oy + row * scale, scale, scale);
            }
          }
        }
      }
      cursor += (GLYPH_W + tracking) * scale;
    }
    ctx.restore();
  };

  if (shadow) paint(shadowOffset * scale, shadowOffset * scale, shadow);
  paint(0, 0, color);
}

/** Tiny pixel icons used by the HUD, drawn without font dependencies. */
export function drawBookIcon(ctx, x, y, color, accent) {
  // A little cream note page with a gold bookmark. Reads as "notes", not pause.
  ctx.fillStyle = "#1c2928";
  ctx.fillRect(x + 1, y, 9, 11);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 1, 7, 9);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 3, y + 3, 5, 1);
  ctx.fillRect(x + 3, y + 5, 4, 1);
  ctx.fillRect(x + 3, y + 7, 5, 1);
  ctx.fillStyle = "#f1c75a";
  ctx.fillRect(x + 7, y, 2, 4);
  ctx.fillStyle = "#1c2928";
  ctx.fillRect(x + 8, y + 3, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 10, 7, 1);
}

export function drawNoteIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 6, y + 2, 2, 8);
  ctx.fillRect(x + 5, y + 1, 1, 2);
  ctx.fillRect(x + 2, y + 8, 5, 3);
  ctx.fillRect(x + 2, y + 10, 3, 1);
}

export function drawSpeakerIcon(ctx, x, y, color, muted = false) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 4, 2, 3);
  ctx.fillRect(x + 3, y + 3, 1, 5);
  ctx.fillRect(x + 4, y + 2, 2, 7);
  if (!muted) {
    ctx.fillRect(x + 7, y + 3, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 3);
    ctx.fillRect(x + 7, y + 7, 1, 1);
    ctx.fillRect(x + 9, y + 2, 1, 1);
    ctx.fillRect(x + 10, y + 5, 1, 2);
    ctx.fillRect(x + 9, y + 8, 1, 1);
  } else {
    ctx.fillRect(x + 7, y + 4, 4, 1);
    ctx.fillRect(x + 10, y + 4, 1, 1);
    ctx.fillRect(x + 7, y + 8, 4, 1);
    ctx.fillRect(x + 7, y + 5, 1, 1);
    ctx.fillRect(x + 10, y + 7, 1, 1);
  }
}

export function drawResetIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 2, 5, 1);
  ctx.fillRect(x + 2, y + 3, 1, 5);
  ctx.fillRect(x + 3, y + 8, 5, 1);
  ctx.fillRect(x + 5, y + 6, 4, 1);
  ctx.fillRect(x + 8, y + 4, 1, 2);
  ctx.fillRect(x + 2, y + 1, 1, 1);
  ctx.fillRect(x + 3, y + 1, 1, 2);
  ctx.fillRect(x + 4, y + 1, 1, 1);
  ctx.fillRect(x + 9, y + 7, 1, 2);
}

export function drawRainIcon(ctx, x, y, color, active = false) {
  // A compact pixel cloud with three falling drops.
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, 5, 1);
  ctx.fillRect(x + 1, y + 3, 2, 2);
  ctx.fillRect(x + 6, y + 3, 2, 2);
  ctx.fillRect(x + 3, y + 5, 4, 1);
  ctx.fillStyle = active ? "#f1c75a" : color;
  ctx.globalAlpha = active ? 1 : 0.65;
  ctx.fillRect(x + 2, y + 7, 1, 2);
  ctx.fillRect(x + 4, y + 8, 1, 2);
  ctx.fillRect(x + 6, y + 7, 1, 2);
  ctx.globalAlpha = 1;
}

export function drawSeedIcon(ctx, id, x, y, colors) {
  const { petal, accent, stem, leaf } = colors;
  ctx.fillStyle = stem;
  ctx.fillRect(x + 5, y + 4, 1, 7);
  ctx.fillStyle = leaf;
  ctx.fillRect(x + 2, y + 7, 3, 1);
  ctx.fillRect(x + 3, y + 8, 2, 1);
  ctx.fillRect(x + 6, y + 9, 3, 1);
  if (id === "poppy") {
    ctx.fillStyle = petal;
    ctx.fillRect(x + 3, y, 3, 2);
    ctx.fillRect(x + 1, y + 2, 3, 2);
    ctx.fillRect(x + 6, y + 2, 3, 3);
    ctx.fillRect(x + 2, y + 4, 2, 1);
    ctx.fillRect(x + 5, y + 4, 2, 1);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 4, y + 1, 1, 1);
    ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillRect(x + 7, y + 3, 1, 1);
    ctx.fillStyle = "#1c2928";
    ctx.fillRect(x + 4, y + 2, 2, 2);
  } else if (id === "cornflower") {
    ctx.fillStyle = petal;
    ctx.fillRect(x + 4, y, 3, 3);
    ctx.fillRect(x + 2, y + 1, 2, 3);
    ctx.fillRect(x + 7, y + 1, 2, 3);
    ctx.fillRect(x + 3, y + 4, 2, 1);
    ctx.fillRect(x + 6, y + 4, 2, 1);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 4, y + 2, 1, 1);
    ctx.fillRect(x + 6, y + 2, 1, 1);
  } else {
    ctx.fillStyle = petal;
    ctx.fillRect(x + 3, y, 4, 4);
    ctx.fillRect(x + 2, y + 2, 1, 2);
    ctx.fillRect(x + 7, y + 2, 1, 2);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 4, y + 2, 2, 1);
    ctx.fillRect(x + 5, y + 1, 1, 2);
    ctx.fillStyle = "#1c2928";
    ctx.fillRect(x + 5, y + 3, 1, 1);
  }
}
