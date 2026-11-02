export const TAU = Math.PI * 2;

export const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, n) => (b === a ? 0 : clamp((n - a) / (b - a), 0, 1));
export const smoothstep = (a, b, n) => {
  const t = invLerp(a, b, n);
  return t * t * (3 - 2 * t);
};
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const distance2 = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};
export const round = (n) => (n < 0 ? Math.ceil(n - 0.5) : Math.floor(n + 0.5));
export const wrap = (n, max) => ((n % max) + max) % max;
export const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function randRange(random, lo, hi) {
  return lo + (hi - lo) * random();
}

export function pick(random, values) {
  return values[Math.floor(random() * values.length)];
}

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBounds(poly) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function polygonCentroid(poly) {
  let x = 0;
  let y = 0;
  for (const point of poly) {
    x += point[0];
    y += point[1];
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function path2D(polygon) {
  const path = new Path2D();
  polygon.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

export function rgba(hex, alpha = 1) {
  if (hex.startsWith("rgba(") || hex.startsWith("rgb(")) return hex;
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function fillPx(ctx, x, y, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(round(x), round(y), 1, 1);
  ctx.globalAlpha = 1;
}

/** Solid pixel disc, without antialiasing. */
export function pixelDisc(ctx, cx, cy, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const ri = Math.max(0, round(r));
  const cxi = round(cx);
  const cyi = round(cy);
  for (let y = -ri; y <= ri; y += 1) {
    const half = Math.floor(Math.sqrt(ri * ri - y * y));
    ctx.fillRect(cxi - half, cyi + y, half * 2 + 1, 1);
  }
  ctx.restore();
}

/** Pixel-perfect ellipse outline, drawn from individual pixels. */
export function pixelEllipseRing(ctx, cx, cy, rx, ry, color, alpha = 1, dash = 0) {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const steps = Math.max(18, Math.ceil((rx + ry) * 2.4));
  const seen = new Set();
  for (let i = 0; i < steps; i += 1) {
    if (dash > 0 && i % dash === Math.floor(dash / 2)) continue;
    const a = (i / steps) * TAU;
    const x = round(cx + Math.cos(a) * rx);
    const y = round(cy + Math.sin(a) * ry);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

/** A broken, shimmering water ring with a brighter near edge. */
export function drawRipple(ctx, cx, cy, rx, color = "#c4e5ce", alpha = 0.55, dash = 0) {
  const cyi = round(cy);
  const ry = Math.max(1, Math.round(rx * 0.32));
  pixelEllipseRing(ctx, cx, cyi, rx, ry, color, alpha, dash);
  if (rx > 5) {
    pixelEllipseRing(ctx, cx, cyi + 1, Math.max(1, rx - 1), Math.max(1, ry - 1), color, alpha * 0.55, 3);
  }
}

export function pixelLine(ctx, x0, y0, x1, y1, color, alpha = 1) {
  let x = round(x0);
  let y = round(y0);
  const xe = round(x1);
  const ye = round(y1);
  const dx = Math.abs(xe - x);
  const sx = x < xe ? 1 : -1;
  const dy = -Math.abs(ye - y);
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  let guard = 0;
  while (guard++ < 500) {
    ctx.fillRect(x, y, 1, 1);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  ctx.restore();
}

export function drawDitherRect(ctx, x, y, w, h, color, alpha = 0.1, step = 2) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x + ((yy - y) % 2); xx < x + w; xx += step) {
      ctx.fillRect(xx, yy, 1, 1);
    }
  }
  ctx.restore();
}

export function textWrap(text, maxChars) {
  const words = text.split(/\s+/u);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if ((line + " " + word).length <= maxChars) {
      line += " " + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function randomPointInPolygon(random, polygon, inset = 0) {
  const bounds = polygonBounds(polygon);
  for (let i = 0; i < 80; i += 1) {
    const x = bounds.minX + inset + random() * Math.max(1, bounds.w - inset * 2);
    const y = bounds.minY + inset + random() * Math.max(1, bounds.h - inset * 2);
    if (pointInPolygon(x, y, polygon)) return { x, y };
  }
  return { x: bounds.minX + bounds.w / 2, y: bounds.minY + bounds.h / 2 };
}

export function almostEqual(a, b, epsilon = 0.001) {
  return Math.abs(a - b) <= epsilon;
}
