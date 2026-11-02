import { H, P, W } from "./config.js";
import { TAU, clamp, mulberry32, pixelDisc, pixelEllipseRing, round } from "./utils.js";

/**
 * Celestial pass: deterministic stars, a moon and the sun. It never owns time;
 * the world maps `getDayState().sun/moon` to pixel positions and calls these
 * with an alpha. Stars clip to the painted skyline so they never appear on the
 * hills or in the pond.
 */

function tracePolygon(ctx, polygon) {
  ctx.beginPath();
  polygon.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function clipToSky(ctx, skyline) {
  if (!skyline || skyline.length < 3) {
    ctx.beginPath();
    ctx.rect(0, 0, W, 82);
    ctx.clip();
    return;
  }
  tracePolygon(ctx, skyline);
  ctx.clip();
}

function drawDitherDisc(ctx, cx, cy, radius, color, alpha, step = 2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2 && (x + y) % step === 0) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}

export class SkyField {
  constructor(seed = 9147) {
    const random = mulberry32(seed);
    this.stars = [];
    for (let i = 0; i < 250; i += 1) {
      this.stars.push({
        x: 3 + Math.floor(random() * (W - 6)),
        y: 3 + Math.floor(random() * 80),
        size: random() > 0.93 ? 2 : 1,
        phase: random() * TAU,
        speed: 0.3 + random() * 1.7,
        warm: random() > 0.72,
        brightness: 0.35 + random() * 0.65,
      });
    }
    // A faint, tilted star river. It is deliberately made of single pixels so
    // it reads as distance rather than a painted band.
    this.milkyWay = [];
    for (let i = 0; i < 72; i += 1) {
      const t = random();
      const x = 26 + t * 300 + Math.sin(t * 5.1) * 16 + (random() - 0.5) * 22;
      const y = 12 + t * 60 + (random() - 0.5) * 18;
      this.milkyWay.push({
        x: Math.round(x),
        y: Math.round(y),
        phase: random() * TAU,
        brightness: 0.18 + random() * 0.28,
      });
    }
    // A few connected stars make a quiet, readable constellation, placed clear
    // of the clock in the upper-left.
    this.constellation = [
      { x: 152, y: 24 },
      { x: 164, y: 18 },
      { x: 176, y: 27 },
      { x: 171, y: 40 },
      { x: 157, y: 37 },
    ];
  }

  drawStars(ctx, { alpha = 0, skyline = null, time = 0 } = {}) {
    if (alpha <= 0.01) return;
    ctx.save();
    clipToSky(ctx, skyline);
    for (const star of this.stars) {
      const twinkle = 0.55 + Math.sin(time * star.speed + star.phase) * 0.35;
      const a = alpha * clamp(twinkle, 0.15, 1) * star.brightness;
      ctx.globalAlpha = a;
      ctx.fillStyle = star.warm ? P.cream : "#dfeef0";
      ctx.fillRect(star.x, star.y, star.size, star.size);
      if (star.size > 1) {
        ctx.globalAlpha = a * 0.35;
        ctx.fillRect(star.x - 1, star.y + 1, 1, 1);
        ctx.fillRect(star.x + 2, star.y, 1, 1);
      }
    }
    for (const star of this.milkyWay) {
      const twinkle = 0.55 + Math.sin(time * 0.7 + star.phase) * 0.3;
      ctx.globalAlpha = alpha * star.brightness * twinkle;
      ctx.fillStyle = "#c9e2df";
      ctx.fillRect(star.x, star.y, 1, 1);
    }
    // A very faint constellation line keeps the eye moving across the sky.
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = "#cfe5e4";
    for (let i = 0; i < this.constellation.length - 1; i += 1) {
      const a = this.constellation[i];
      const b = this.constellation[i + 1];
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let s = 1; s < steps; s += 1) {
        const px = Math.round(a.x + ((b.x - a.x) * s) / steps);
        const py = Math.round(a.y + ((b.y - a.y) * s) / steps);
        if (s % 2 === 0) ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.restore();
  }

  drawMoon(ctx, { x, y, alpha = 0, radius = 10, phase = 0, time = 0, rain = 0 } = {}) {
    const a = alpha * (1 - rain * 0.985);
    if (a <= 0.01) return;
    const cx = round(x);
    const cy = round(y);
    const p = ((phase % 1) + 1) % 1;
    const cosPhase = Math.cos(TAU * p);
    const waxing = p <= 0.5;
    const r = radius;
    const r2 = r * r;
    const maria = [
      [-4, -2, 2.4, 1.7],
      [2, -3, 2.0, 1.3],
      [1, 3, 2.4, 1.4],
      [-2, 4, 1.2, 0.8],
    ];

    // A layered, low-alpha corona instead of a hard UI ring. At 4x these
    // dither bands read as atmosphere around the disc.
    drawDitherDisc(ctx, cx, cy, r + 20, "#b9d6d8", a * 0.024, 3);
    drawDitherDisc(ctx, cx, cy, r + 13, P.waterLight, a * 0.038, 2);
    drawDitherDisc(ctx, cx, cy, r + 7, "#dbe9dc", a * 0.05, 3);
    pixelEllipseRing(ctx, cx, cy, r + 7, r + 7, "#dcebe6", a * 0.09, 3);
    pixelEllipseRing(ctx, cx, cy, r + 11, r + 11, "#a9c8c8", a * 0.055, 3);

    // The unlit earthshine disc. It stays visible as a soft blue-grey shape on
    // a new moon, so the phase change reads as a moon rather than a hole.
    pixelDisc(ctx, cx, cy, r + 1, "#203746", a * 0.72);
    pixelDisc(ctx, cx, cy, r, "#41616d", a * 0.92);
    pixelDisc(ctx, cx - 1, cy - 1, Math.max(2, r - 2), "#6d8b8e", a * 0.14);
    pixelEllipseRing(ctx, cx, cy, r, r, "#9ab5b8", a * 0.28, 3);

    // Per-pixel terminator. The lit limb is a real crescent/gibbous mask, not
    // a single 1px scanline; the shape is visible at both 1x and 4x.
    for (let dy = -r; dy <= r; dy += 1) {
      const hx = Math.sqrt(Math.max(0, r2 - dy * dy));
      const left = Math.ceil(-hx);
      const right = Math.floor(hx);
      for (let dx = left; dx <= right; dx += 1) {
        if (dx * dx + dy * dy > r2) continue;
        const lit = waxing ? dx >= cosPhase * hx : dx <= -cosPhase * hx;
        if (!lit) continue;
        const nx = dx / r;
        const ny = dy / r;
        const inMaria = maria.some(
          ([mx, my, rx, ry]) => ((dx - mx) / rx) ** 2 + ((dy - my) / ry) ** 2 <= 1,
        );
        const limb = Math.abs(dx) >= hx - 1.2;
        let color = inMaria ? "#eadfc4" : P.cream;
        if (limb) color = "#e8d4ad";
        if (nx + ny < -0.7) color = "#fff7d8";
        ctx.globalAlpha = a * (limb ? 0.9 : 1);
        ctx.fillStyle = color;
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
        if (dx === 0 && dy === 0) {
          ctx.globalAlpha = a * 0.16;
          ctx.fillStyle = "#fffde8";
          ctx.fillRect(cx - 2, cy - 2, 2, 2);
        }
      }
    }

    // Soft craters only on the lit face.
    const craters = [
      [-3, -1, 2, 2],
      [2, 2, 2, 1],
      [0, 4, 1, 1],
      [-4, 3, 1, 1],
      [3, -3, 1, 1],
    ];
    ctx.fillStyle = "#9fb6b4";
    for (const [ox, oy, w, h] of craters) {
      const hx = Math.sqrt(Math.max(0, r2 - oy * oy));
      const lit = waxing ? ox >= cosPhase * hx : ox <= -cosPhase * hx;
      ctx.globalAlpha = a * (lit ? 0.28 : 0.1);
      ctx.fillRect(cx + ox, cy + oy, w, h);
    }
    ctx.globalAlpha = 1;
  }

  drawSun(ctx, { x, y, alpha = 1, dusk = 0, time = 0, radius = 10, rain = 0 } = {}) {
    const a = alpha * (1 - rain * 0.995);
    if (a <= 0.01) return;
    const cx = round(x);
    const cy = round(y);
    const base = dusk > 0.55 ? P.sunDeep : P.sun;
    const core = dusk > 0.55 ? P.sun : P.sunHigh;
    drawDitherDisc(ctx, cx, cy, radius + 12, P.sunHigh, a * (0.055 + (1 - dusk) * 0.04), 3);
    drawDitherDisc(ctx, cx, cy, radius + 6, P.sun, a * (0.07 + (1 - dusk) * 0.05), 2);
    pixelDisc(ctx, cx, cy, radius + 3, base, a * 0.17);
    pixelDisc(ctx, cx, cy, radius + 1, base, a * 0.38);
    pixelDisc(ctx, cx, cy, radius, base, a);
    pixelDisc(ctx, cx - 1, cy - 1, Math.max(3, radius - 3), core, a * 0.95);
    ctx.save();
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = dusk > 0.55 ? P.poppy : P.sunDeep;
    ctx.fillRect(cx - 5, cy + 6, 7, 2);
    ctx.fillRect(cx - 2, cy + 8, 3, 1);
    ctx.restore();
    const rayAlpha = a * (0.22 + (1 - dusk) * 0.2) * (1 - rain);
    const ray = 14 + Math.sin(time * 1.2) * 1.5;
    ctx.save();
    ctx.fillStyle = core;
    ctx.globalAlpha = rayAlpha;
    ctx.fillRect(cx, cy - ray, 1, 3);
    ctx.fillRect(cx, cy + ray - 2, 1, 3);
    ctx.fillRect(cx - ray, cy, 3, 1);
    ctx.fillRect(cx + ray - 2, cy, 3, 1);
    ctx.globalAlpha = rayAlpha * 0.7;
    ctx.fillRect(cx - 10, cy - 10, 2, 2);
    ctx.fillRect(cx + 9, cy - 10, 2, 2);
    ctx.fillRect(cx - 11, cy + 9, 2, 2);
    ctx.fillRect(cx + 10, cy + 9, 2, 2);
    ctx.restore();
  }
}
