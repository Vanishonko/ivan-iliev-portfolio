import { P } from "./config.js";
import { pixelDisc, pixelEllipseRing, round, TAU, clamp } from "./utils.js";

/**
 * A 24-hour analogue clock face. The hour hand makes one revolution per day
 * (midnight at the top) and the minute hand one per hour. The UI calls
 * drawClock and hitClock; time ownership stays in the game.
 */

const TAU_LOCAL = TAU;

function drawPixelLine(ctx, x0, y0, x1, y1, color, alpha = 1, width = 1) {
  let x = round(x0);
  let y = round(y0);
  const tx = round(x1);
  const ty = round(y1);
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x, y, width, 1);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  ctx.restore();
}

export function clockCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function clockRadius(rect) {
  return Math.max(8, Math.min(rect.w, rect.h) / 2 - 2);
}

export function clockHandPoints(rect, minutes) {
  const c = clockCenter(rect);
  const r = clockRadius(rect);
  const hourAngle = (minutes / 1440) * TAU - Math.PI / 2;
  const minuteAngle = ((minutes % 60) / 60) * TAU - Math.PI / 2;
  return {
    center: c,
    radius: r,
    hour: {
      angle: hourAngle,
      x: c.x + Math.cos(hourAngle) * (r * 0.5),
      y: c.y + Math.sin(hourAngle) * (r * 0.5),
    },
    minute: {
      angle: minuteAngle,
      x: c.x + Math.cos(minuteAngle) * (r * 0.82),
      y: c.y + Math.sin(minuteAngle) * (r * 0.82),
    },
  };
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * Returns 'hour', 'minute', 'face' or null. Inner dial is the hour hand;
 * outer dial is the minute hand. Hand proximity wins when the hands overlap.
 */
export function clockHitTest(x, y, rect, minutes) {
  const c = clockCenter(rect);
  const r = clockRadius(rect);
  const distance = Math.hypot(x - c.x, y - c.y);
  if (distance > r + 1) return null;
  const hands = clockHandPoints(rect, minutes);
  const hourDistance = distanceToSegment(x, y, c.x, c.y, hands.hour.x, hands.hour.y);
  const minuteDistance = distanceToSegment(x, y, c.x, c.y, hands.minute.x, hands.minute.y);
  if (hourDistance <= 3.4 && minuteDistance > 3.4) return "hour";
  if (minuteDistance <= 3.4 && hourDistance > 3.4) return "minute";
  if (hourDistance <= 3.4 && minuteDistance <= 3.4) {
    return distance <= r * 0.52 ? "hour" : "minute";
  }
  return distance <= r * 0.46 ? "hour" : "minute";
}

export function clockMinutesFromPoint(x, y, rect, hand, currentMinutes) {
  const c = clockCenter(rect);
  let angle = Math.atan2(y - c.y, x - c.x) + Math.PI / 2;
  while (angle < 0) angle += TAU;
  while (angle >= TAU) angle -= TAU;
  if (hand === "hour") {
    const hour = Math.round((angle / TAU) * 24) % 24;
    const minute = Math.floor(currentMinutes) % 60;
    return (hour * 60 + minute + 1440) % 1440;
  }
  // Drag the minute hand by the shortest angular delta. This seamlessly carries
  // the hour when the hand crosses 12, so a full turn advances 60 minutes
  // instead of resetting the minute to where it started.
  const currentMinute = ((currentMinutes % 60) + 60) % 60;
  const currentAngle = (currentMinute / 60) * TAU;
  let delta = angle - currentAngle;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  const deltaMinutes = Math.round((delta / TAU) * 60);
  return (Math.round(currentMinutes) + deltaMinutes + 1440) % 1440;
}

export function drawClock(ctx, rect, minutes, options = {}) {
  const c = clockCenter(rect);
  const r = clockRadius(rect);
  const night = Boolean(options.night);
  const active = options.active ?? null;
  const hovered = Boolean(options.hovered);
  const cx = round(c.x);
  const cy = round(c.y);

  ctx.save();
  // Recessed face.
  pixelDisc(ctx, cx, cy + 1, r + 2, P.ink, 0.55);
  pixelDisc(ctx, cx, cy, r, P.ink, 0.94);
  pixelDisc(ctx, cx, cy, r - 1, "#10231f", 0.9);
  pixelEllipseRing(ctx, cx, cy, r + 1, r + 1, hovered ? P.gold : P.cream, hovered ? 0.95 : 0.7, 0);
  pixelEllipseRing(ctx, cx, cy, r - 2, r - 2, P.leafHigh, 0.22, 1);

  // 24 ticks; gold daylight half, cool night half, brighter every 6 hours.
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * TAU_LOCAL - Math.PI / 2;
    const major = i % 6 === 0;
    const day = i >= 6 && i < 18;
    const length = major ? 4 : 2;
    const inner = r - 2 - length;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * (r - 2);
    const y2 = cy + Math.sin(angle) * (r - 2);
    drawPixelLine(
      ctx,
      x1,
      y1,
      x2,
      y2,
      day ? P.gold : P.waterLight,
      major ? 0.95 : day ? 0.55 : 0.7,
      major ? 2 : 1,
    );
  }

  const hands = clockHandPoints(rect, minutes);
  drawPixelLine(
    ctx,
    cx,
    cy,
    hands.hour.x,
    hands.hour.y,
    active === "hour" ? P.gold : P.cream,
    active === "hour" ? 1 : 0.85,
    2,
  );
  drawPixelLine(
    ctx,
    cx,
    cy,
    hands.minute.x,
    hands.minute.y,
    active === "minute" ? P.gold : P.cream,
    active === "minute" ? 1 : 0.72,
    1,
  );
  // Knobs make it obvious which hand can be pulled.
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = P.gold;
  ctx.fillRect(round(hands.hour.x) - 1, round(hands.hour.y) - 1, 2, 2);
  ctx.fillStyle = active === "minute" ? P.gold : P.cream;
  ctx.fillRect(round(hands.minute.x) - 1, round(hands.minute.y) - 1, 2, 2);
  ctx.fillStyle = P.gold;
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.fillStyle = P.ink;
  ctx.fillRect(cx, cy, 1, 1);

  // A tiny 24h marker at midnight helps the dial read as a day, not a 12h watch.
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = night ? P.waterLight : P.gold;
  ctx.fillRect(cx, cy - r + 1, 1, 1);
  ctx.restore();
}
