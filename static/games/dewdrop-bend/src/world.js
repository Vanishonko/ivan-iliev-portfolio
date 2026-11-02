import { H, P, TAU, W, WORLD } from "./config.js";
import { drawWholeImage } from "./assets.js";
import { CloudField } from "./clouds.js";
import { SkyField } from "./sky.js";
import { getDayState, normalizeMinutes } from "./time-of-day.js";
import {
  clamp,
  drawDitherRect,
  drawRipple,
  mulberry32,
  pointInPolygon,
  polygonBounds,
  round,
} from "./utils.js";

const SKY_MARGIN_X = 28;
const CELESTIAL_HORIZON = 96;
const CELESTIAL_ARC = 76;

function tracePolygon(ctx, polygon) {
  ctx.beginPath();
  polygon.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function clipToWater(ctx) {
  tracePolygon(ctx, WORLD.water);
  const log = WORLD.log;
  ctx.rect(log.x, log.y, log.w, log.h);
  ctx.clip("evenodd");
}

function fillScanlinePolygon(ctx, polygon, color) {
  const bounds = polygonBounds(polygon);
  ctx.fillStyle = color;
  for (let y = Math.ceil(bounds.minY); y <= Math.floor(bounds.maxY); y += 1) {
    const intersections = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (yi > y !== yj > y) {
        intersections.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const x1 = Math.ceil(intersections[i]);
      const x2 = Math.floor(intersections[i + 1]);
      if (x2 >= x1) ctx.fillRect(x1, y, x2 - x1 + 1, 1);
    }
  }
}

export class World {
  constructor() {
    this.time = 0;
    this.ripples = [];
    this.wind = { strength: 0.13, direction: 1, gust: 0, phase: 0 };
    this.glints = [];
    this.ambientRandom = mulberry32(3010);
    this.ambientRippleClock = 2.6 + this.ambientRandom() * 2;
    this.fallbackSeed = 3010;
    this.clockDate = new Date();
    this.clockMinutes = 0;
    this.rainFactor = 0;
    this.sun = { x: 0, y: 0, r: 10, alpha: 0 };
    this.moon = { x: 0, y: 0, r: 8, alpha: 0, phase: 0 };
    this.skyField = new SkyField();
    this.cloudField = new CloudField();
    this.dayState = getDayState(0, this.clockDate);
    this.setClock(0, this.clockDate);
    this.#seedWater();
  }

  setClock(minutes, date = this.clockDate) {
    this.clockDate = date instanceof Date ? date : new Date(date);
    this.clockMinutes = normalizeMinutes(minutes);
    this.dayState = getDayState(this.clockMinutes, this.clockDate);
    const span = W - SKY_MARGIN_X * 2;
    this.sun = {
      x: SKY_MARGIN_X + this.dayState.sun.progress * span,
      y: CELESTIAL_HORIZON - this.dayState.sun.altitude * CELESTIAL_ARC,
      r: 10,
      alpha: this.dayState.sun.alpha,
    };
    this.moon = {
      x: SKY_MARGIN_X + this.dayState.moon.progress * span,
      y: CELESTIAL_HORIZON - this.dayState.moon.altitude * CELESTIAL_ARC,
      r: 8,
      alpha: this.dayState.moon.alpha,
      phase: this.dayState.moon.phase,
    };
    return this.dayState;
  }

  setRain(factor) {
    this.rainFactor = clamp(factor, 0, 1);
  }

  reset() {
    this.time = 0;
    this.ripples.length = 0;
    this.wind.strength = 0.13;
    this.wind.direction = 1;
    this.wind.gust = 0;
    this.ambientRippleClock = 2.6 + this.ambientRandom() * 2;
    this.rainFactor = 0;
    this.setClock(this.clockMinutes, new Date());
  }

  #seedWater() {
    const random = mulberry32(this.fallbackSeed);
    const bounds = polygonBounds(WORLD.water);
    let guard = 0;
    while (this.glints.length < 48 && guard++ < 900) {
      const x = bounds.minX + random() * bounds.w;
      const y = bounds.minY + 5 + random() * (bounds.h - 8);
      if (!pointInPolygon(x, y, WORLD.water)) continue;
      this.glints.push({
        x,
        y,
        width: 1 + Math.floor(random() * 4),
        phase: random() * TAU,
        speed: 0.3 + random() * 0.8,
        bright: random(),
      });
    }
    for (let i = 0; i < 3; i += 1) {
      // The painted backdrop owns distant cloud suggestions; the moving cloud
      // field is authored separately in sprite space.
      random();
    }
  }

  getLight() {
    const light = this.dayState.light;
    return {
      ...light,
      t: this.clockMinutes / 1440,
      altitude: this.dayState.sun.altitude,
      warm: light.golden,
      rain: this.rainFactor,
    };
  }

  update(dt, time) {
    this.time = time;
    const light = this.getLight();
    this.cloudField.update(dt, time, {
      rain: this.rainFactor,
      night: light.night,
      golden: light.golden,
    });
    this.wind.gust *= Math.exp(-1.7 * dt);
    this.wind.phase += dt * (0.8 + this.wind.strength * 1.4);
    this.wind.strength = clamp(0.12 + Math.sin(time * 0.38) * 0.045 + this.wind.gust, 0.05, 1);

    this.ambientRippleClock -= dt;
    if (this.ambientRippleClock <= 0) {
      this.ambientRippleClock = 2.8 + this.ambientRandom() * 4.2;
      const bounds = polygonBounds(WORLD.water);
      for (let i = 0; i < 12; i += 1) {
        const x = bounds.minX + 20 + this.ambientRandom() * Math.max(1, bounds.w - 40);
        const y = bounds.minY + 14 + this.ambientRandom() * Math.max(1, bounds.h - 24);
        if (this.isWater(x, y)) {
          this.addRipple(x, y, 0.22 + this.ambientRandom() * 0.25, "pond");
          break;
        }
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = this.ripples[i];
      ripple.age += dt;
      if (ripple.age > ripple.life) this.ripples.splice(i, 1);
    }
  }

  addWindImpulse(dx, speed) {
    if (Math.abs(dx) > 1) this.wind.direction = Math.sign(dx);
    const amount = clamp(speed / 340, 0, 0.62);
    this.wind.gust = clamp(this.wind.gust + amount, 0, 0.85);
  }

  addRipple(x, y, strength = 1, source = "click") {
    if (!this.isWater(x, y)) return false;
    this.ripples.push({
      x,
      y,
      age: 0,
      life: 1.3 + strength * 0.55,
      maxRadius: 12 + strength * 17,
      strength,
      source,
      phase: Math.random() * TAU,
    });
    return true;
  }

  isWater(x, y) {
    return pointInPolygon(x, y, WORLD.water);
  }

  isPlantable(x, y) {
    if (y >= H - 17) return false;
    const inLeft = pointInPolygon(x, y, WORLD.banks.left);
    const inRight = pointInPolygon(x, y, WORLD.banks.right);
    if (!inLeft && !inRight) return false;
    if (pointInPolygon(x, y, WORLD.water)) return false;
    return true;
  }
  drawBackdrop(ctx, assets) {
    if (assets?.landscape?.loaded) {
      drawWholeImage(ctx, assets.landscape, 0, 0);
      return;
    }
    this.#drawFallbackBackdrop(ctx);
  }

  #drawFallbackBackdrop(ctx) {
    const bands = [
      [0, 22, P.skyHigh],
      [22, 46, P.skyMid],
      [46, 68, P.skyLow],
      [68, 78, P.hillFar],
    ];
    for (const [y, y2, color] of bands) {
      ctx.fillStyle = color;
      ctx.fillRect(0, y, W, y2 - y);
    }
    drawDitherRect(ctx, 0, 56, W, 16, P.cream, 0.18, 3);
    // Pixel clouds.
    const cloudGroups = [
      [38, 26, 30],
      [132, 18, 22],
      [232, 30, 34],
    ];
    for (const [cx, cy, width] of cloudGroups) {
      ctx.fillStyle = P.cloud;
      ctx.fillRect(cx - 6, cy + 2, width, 3);
      ctx.fillRect(cx, cy, width * 0.68, 3);
      ctx.fillRect(cx + 7, cy - 2, width * 0.4, 3);
      ctx.fillStyle = P.cloudShade;
      ctx.fillRect(cx - 2, cy + 5, width - 4, 1);
    }
    // Distant hills, scanline-blocky.
    const farHill = [[0, 73], [38, 58], [73, 68], [116, 55], [158, 68], [201, 51], [255, 65], [320, 47], [320, 100], [0, 100]];
    const nearHill = [[0, 84], [42, 69], [80, 80], [118, 73], [153, 84], [194, 70], [230, 81], [271, 66], [320, 77], [320, 108], [0, 108]];
    fillScanlinePolygon(ctx, farHill, P.hillFar);
    fillScanlinePolygon(ctx, nearHill, P.hill);
    ctx.fillStyle = P.grassDeep;
    ctx.fillRect(0, 98, W, H - 98);
    fillScanlinePolygon(ctx, WORLD.banks.left, P.leafMid);
    fillScanlinePolygon(ctx, WORLD.banks.right, P.leafMid);
    tracePolygon(ctx, WORLD.water);
    ctx.fillStyle = P.water;
    ctx.fill();
    // Water depth in horizontal bands.
    const wb = polygonBounds(WORLD.water);
    ctx.save();
    tracePolygon(ctx, WORLD.water);
    ctx.clip();
    for (let y = wb.minY; y < wb.maxY; y += 1) {
      const d = (y - wb.minY) / wb.h;
      if (y > wb.minY + 14) {
        ctx.fillStyle = d > 0.68 ? P.waterDeep : P.waterMid;
        ctx.globalAlpha = d > 0.68 ? 0.25 : 0.18;
        ctx.fillRect(wb.minX, y, wb.w, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Bank greenery.
    ctx.fillStyle = P.leafDark;
    ctx.fillRect(0, 154, 92, 26);
    ctx.fillRect(286, 150, 34, 30);
    ctx.fillStyle = P.grassDeep;
    ctx.fillRect(0, 166, W, 14);
    // Hive and log placeholders.
    ctx.fillStyle = P.bark;
    ctx.fillRect(288, 90, 20, 20);
    ctx.fillStyle = P.barkLight;
    ctx.fillRect(290, 92, 16, 3);
    ctx.fillRect(290, 100, 16, 3);
    ctx.fillStyle = P.barkDark;
    ctx.fillRect(294, 106, 8, 4);
    ctx.fillStyle = P.bark;
    ctx.fillRect(204, 144, 58, 10);
    ctx.fillStyle = P.barkLight;
    ctx.fillRect(208, 143, 50, 3);
    ctx.fillStyle = P.leafMid;
    ctx.fillRect(212, 140, 11, 5);
  }

  drawWater(ctx, assets) {
    const light = this.getLight();
    ctx.save();
    clipToWater(ctx);

    // Shimmer points.
    for (const glint of this.glints) {
      const wobble = Math.sin(this.time * glint.speed + glint.phase) * 1.4;
      const pulse = 0.55 + Math.sin(this.time * 1.3 + glint.phase) * 0.25;
      const alpha = (0.18 + glint.bright * 0.34) * pulse;
      ctx.fillStyle = glint.bright > 0.66 ? P.foam : P.waterLight;
      ctx.globalAlpha = alpha;
      ctx.fillRect(round(glint.x + wobble), round(glint.y), glint.width, 1);
      if (glint.bright > 0.82) ctx.fillRect(round(glint.x + wobble) + 1, round(glint.y) - 1, 1, 1);
    }

    // Soft shore shadow.
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = P.waterDeep;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(0, 95 + i, W, 1);
    }
    ctx.globalAlpha = 1;
    this.cloudField.drawReflections(ctx, {
      color: light.night > 0.45 ? P.waterLight : P.cloudShade,
      alpha:
        (light.night > 0.45 ? 0.045 : 0.075) *
        (1 - this.rainFactor * 0.45) *
        (1 + light.golden * 0.2),
    });
    this.drawReflectionBody(ctx);
    ctx.restore();

    // Reed reflections and pads are rendered by the flora pass; ripples sit over water.
    this.drawRipples(ctx);
  }

  /**
   * Small local displacement of the reflected light by wind and live ripples.
   * The reflection is not a fixed decal: a passing ring bends and breaks it,
   * and rain makes the column shimmer apart.
   */
  reflectionWave(x, y) {
    let dx = Math.sin(y * 0.42 + this.time * 1.9 + x * 0.07) * (0.35 + (this.wind?.strength ?? 0) * 2.4);
    let alpha = 1;
    for (const ripple of this.ripples) {
      const progress = ripple.age / ripple.life;
      if (progress >= 1) continue;
      const radius = 3 + progress * ripple.maxRadius;
      const d = Math.hypot(x - ripple.x, y - ripple.y);
      const band = Math.exp(-(((d - radius) / 2.7) ** 2));
      if (band < 0.02) continue;
      const force = (ripple.strength ?? 1) * (1 - progress);
      dx += Math.sin((d - radius) * 2.2 + this.time * 5.2 + ripple.phase) * band * force * 1.35;
      alpha *= 1 - Math.min(0.5, band * force * 0.42);
    }
    return { dx, alpha };
  }

  /** Ridge height at a given x. Used to make a body above the landscape
   * genuinely visible (and therefore reflectable) while a body below it does
   * not leave a detached path on the pond. */
  skylineYAt(x) {
    const skyline = WORLD.skyline;
    if (!skyline || skyline.length < 3) return WORLD.horizon ?? 86;
    const cx = Math.max(0, Math.min(W, x));
    let ridge = 0;
    for (let i = 0, j = skyline.length - 1; i < skyline.length; j = i++) {
      const [x1, y1] = skyline[j];
      const [x2, y2] = skyline[i];
      if ((cx >= x1 && cx <= x2) || (cx >= x2 && cx <= x1)) {
        const span = x2 - x1;
        const t = span === 0 ? 0 : (cx - x1) / span;
        ridge = Math.max(ridge, y1 + (y2 - y1) * t);
      }
    }
    return ridge || (WORLD.horizon ?? 86);
  }

  drawReflectionBody(ctx) {
    const light = this.dayState.light;
    const bounds = polygonBounds(WORLD.water);
    const drawPath = (body, kind) => {
      if (body.alpha <= 0.02) return;
      if (body.y > this.skylineYAt(body.x) - 2) return;
      const isSun = kind === "sun";
      const cold = light.night > 0.45;
      const core = isSun
        ? cold
          ? P.cream
          : P.sunHigh
        : cold
          ? P.cream
          : P.waterLight;
      const accent = isSun ? (cold ? P.poppy : P.sun) : P.foam;
      const viewerX = W * 0.4;
      const nearX = body.x * 0.12 + viewerX * 0.88;
      const alpha = body.alpha * (isSun ? 0.92 : 0.72);
      // A broken head to the reflected column: the brightest part of a real
      // water reflection sits just below the body, then breaks into dashes.
      for (let k = 0; k < 4; k += 1) {
        const y = Math.round(bounds.minY + 5 + k * 2);
        const width = 11 - k * 2;
        const segmentWidth = Math.max(1, Math.floor(width / 4));
        const wave = this.reflectionWave(body.x, y);
        ctx.globalAlpha = alpha * (0.65 - k * 0.1) * wave.alpha;
        ctx.fillStyle = k < 2 ? core : accent;
        for (let s = 0; s < 4; s += 1) {
          const sx =
            body.x +
            wave.dx -
            width / 2 +
            s * (width / 3) +
            Math.sin(this.time * 0.4 + k + s) * 1.1;
          ctx.fillRect(round(sx), y, segmentWidth, 1);
        }
      }
      for (let i = 0; i < 38; i += 1) {
        const along = i / 37;
        const y = Math.round(bounds.minY + 6 + along * along * (bounds.h - 14) + Math.sin(i * 2.83) * 1.2);
        if (y < bounds.minY || y > bounds.maxY) continue;
        if (Math.sin(i * 1.73 + this.time * 0.3) < -0.32) continue;
        const bend = Math.pow(along, 0.55);
        const center = body.x + (nearX - body.x) * bend;
        const spread = 1 + along * 13;
        const x = center + Math.sin(i * 2.19 + this.time * 0.6) * spread * 0.5;
        const wave = this.reflectionWave(x, y);
        if (wave.alpha < 0.08) continue;
        const width = 2 + Math.min(7, Math.floor(along * 6));
        ctx.globalAlpha = alpha * (0.82 + along * 0.18) * wave.alpha;
        ctx.fillStyle = core;
        ctx.fillRect(round(x + wave.dx - width / 2), y, width, 1);
        if (i % 4 === 0) {
          ctx.globalAlpha = alpha * 0.16 * wave.alpha;
          ctx.fillStyle = P.sunHigh;
          ctx.fillRect(round(x + wave.dx - width / 2) - 3, y + 1, width + 6, 1);
        }
        if (i % 3 === 0) {
          ctx.globalAlpha = alpha * 0.38 * wave.alpha;
          ctx.fillStyle = accent;
          ctx.fillRect(round(x + wave.dx - width / 2) - 2, y + 1, width + 4, 1);
        }
        if (i % 4 === 0) {
          ctx.globalAlpha = alpha * 0.62 * wave.alpha;
          ctx.fillStyle = accent;
          ctx.fillRect(round(x + wave.dx + width / 2) - 1, y + 1, 1, 1);
        }
      }
    };
    drawPath(this.sun, "sun");
    drawPath(this.moon, "moon");
    ctx.globalAlpha = 1;
  }

  /**
   * Sparse post-grade speculars. These sit on top of the dark grade (and the
   * occasional water creature) but are only one pixel, so the reflected light
   * stays luminous without turning into opaque bars.
   */
  drawReflectionGlints(ctx, isOccluded = null) {
    const light = this.dayState.light;
    const bounds = polygonBounds(WORLD.water);
    const blocked = (x, y) => (typeof isOccluded === "function" ? isOccluded(x, y) : false);
    ctx.save();
    clipToWater(ctx);
    if (light.stars > 0.12) {
      for (let i = 0; i < 14; i += 1) {
        const x = 52 + ((i * 71 + 23) % 280);
        const y = 126 + ((i * 37 + 11) % 48);
        if (blocked(x, y)) continue;
        const twinkle = 0.45 + Math.sin(this.time * 1.7 + i * 2.1) * 0.35;
        ctx.globalAlpha = light.stars * 0.42 * twinkle;
        ctx.fillStyle = i % 4 === 0 ? P.waterLight : P.cream;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (const [body, kind] of [
      [this.sun, "sun"],
      [this.moon, "moon"],
    ]) {
      if (body.alpha <= 0.02) continue;
      if (body.y > this.skylineYAt(body.x) - 2) continue;
      const isSun = kind === "sun";
      const color = isSun
        ? light.night > 0.45
          ? P.blush
          : light.golden > 0.2
            ? P.sun
            : P.sunHigh
        : light.night > 0.3
          ? P.cream
          : P.waterLight;
      const spark = isSun ? P.poppy : P.foam;
      const nearX = body.x * 0.12 + W * 0.4 * 0.88;
      // The head is redrawn after the grade so the light survives the night.
      for (let k = 0; k < 3; k += 1) {
        const y = Math.round(bounds.minY + 5 + k * 2);
        const width = 9 - k * 2;
        const segmentWidth = Math.max(1, Math.floor(width / 3));
        const wave = this.reflectionWave(body.x, y);
        ctx.globalAlpha = body.alpha * (0.58 - k * 0.14) * wave.alpha;
        ctx.fillStyle = k === 0 ? color : spark;
        for (let s = 0; s < 3; s += 1) {
          const sx =
            body.x +
            wave.dx -
            width / 2 +
            s * (width / 2) +
            Math.sin(this.time * 0.5 + k + s);
          if (blocked(round(sx), y)) continue;
          const run = blocked(round(sx) + segmentWidth - 1, y) ? 1 : segmentWidth;
          ctx.fillRect(round(sx), y, run, 1);
        }
      }
      for (let i = 0; i < 38; i += 1) {
        const along = i / 37;
        const y = Math.round(bounds.minY + 8 + along * along * (bounds.h - 18) + Math.sin(i * 2.17) * 1.5);
        if (y < bounds.minY || y > bounds.maxY) continue;
        const bend = Math.pow(along, 0.55);
        const center = body.x + (nearX - body.x) * bend;
        const x = center + Math.sin(i * 1.87 + this.time * 0.5) * (1 + along * 8);
        const wave = this.reflectionWave(x, y);
        const px = round(x + wave.dx);
        if (wave.alpha < 0.08 || blocked(px, y)) continue;
        ctx.globalAlpha = body.alpha * (0.72 + along * 0.24) * wave.alpha;
        ctx.fillStyle = i % 7 === 0 ? spark : color;
        const run = i % 2 === 0 && !blocked(px + 1, y) ? 2 : 1;
        ctx.fillRect(px, y, run, 1);
        if (i % 4 === 0) {
          ctx.globalAlpha = body.alpha * 0.52 * wave.alpha;
          if (!blocked(px + 1, y)) ctx.fillRect(px + 1, y, 1, 1);
        }
        if (i % 6 === 0) {
          ctx.globalAlpha = body.alpha * 0.38 * wave.alpha;
          ctx.fillStyle = spark;
          if (!blocked(px - 2, y + 1)) ctx.fillRect(px - 2, y + 1, 1, 1);
        }
      }
    }
    ctx.restore();
  }

  drawSky(ctx, assets) {
    const light = this.dayState.light;
    const skyline = WORLD.skyline ?? [[0, 0], [W, 0], [W, 78], [0, 78]];
    this.skyField.drawStars(ctx, {
      alpha: light.stars * (1 - this.rainFactor * 0.75),
      skyline,
      time: this.time,
    });
    const cloudOptions = {
      night: light.night,
      golden: light.golden,
      dusk: light.dusk,
      dawn: light.dawn,
      rain: this.rainFactor,
    };
    // Far cloud decks sit behind the sun/moon; the middle/near decks pass in
    // front of them. Every sky layer is clipped to the painted ridge so the
    // celestial bodies genuinely rise and set behind the landscape.
    ctx.save();
    tracePolygon(ctx, skyline);
    ctx.clip();
    this.cloudField.draw(ctx, assets?.clouds, { ...cloudOptions, layers: [0] });
    this.skyField.drawSun(ctx, {
      x: this.sun.x,
      y: this.sun.y,
      alpha: this.sun.alpha,
      dusk: Math.max(light.dusk, light.golden * 0.7),
      time: this.time,
      rain: this.rainFactor,
    });
    this.skyField.drawMoon(ctx, {
      x: this.moon.x,
      y: this.moon.y,
      alpha: this.moon.alpha,
      phase: this.moon.phase,
      time: this.time,
      rain: this.rainFactor,
    });
    this.cloudField.draw(ctx, assets?.clouds, { ...cloudOptions, layers: [1, 2] });
    ctx.restore();
  }

  drawRipples(ctx) {
    if (!this.ripples.length) return;
    ctx.save();
    clipToWater(ctx);
    for (const ripple of this.ripples) {
      const p = ripple.age / ripple.life;
      const radius = 3 + p * ripple.maxRadius;
      const rain = ripple.source === "rain";
      const alpha =
        Math.pow(1 - p, 1.35) * (0.55 + ripple.strength * 0.14) * (rain ? 1.25 : 1);
      const dash = p < 0.35 ? 0 : 9;
      drawRipple(ctx, ripple.x, ripple.y, radius, P.foam, alpha, dash);
      if (p < 0.4 || rain) {
        drawRipple(
          ctx,
          ripple.x,
          ripple.y,
          Math.max(2, radius * (rain ? 0.62 : 0.45)),
          P.waterLight,
          alpha * (rain ? 0.85 : 0.7),
          rain ? 0 : 7,
        );
      }
    }
    ctx.restore();
  }

  drawLight(ctx) {
    const light = this.getLight();
    if (light.night > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = light.night * 0.55;
      ctx.fillStyle = "#1d3350";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light.night * 0.18;
      ctx.fillStyle = "#07151f";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = light.night * 0.16;
      ctx.fillStyle = "#081b30";
      ctx.fillRect(0, 0, W, 94);
      ctx.restore();
    }
    if (light.dusk > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = light.dusk * 0.3;
      ctx.fillStyle = "#88789a";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light.dusk * 0.11;
      ctx.fillStyle = "#df835f";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = light.dusk * 0.1;
      ctx.fillStyle = "#6b6b96";
      ctx.fillRect(0, 0, W, 72);
      ctx.globalAlpha = light.dusk * 0.12;
      ctx.fillStyle = "#e09a71";
      ctx.fillRect(0, 58, W, 40);
      ctx.globalAlpha = light.dusk * 0.08;
      ctx.fillStyle = "#796a86";
      ctx.fillRect(0, 108, W, 62);
      ctx.restore();
    }
    if (light.dawn > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = light.dawn * 0.17;
      ctx.fillStyle = "#5b6888";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light.dawn * 0.16;
      ctx.fillStyle = "#e0a0a5";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = light.dawn * 0.2;
      ctx.fillStyle = "#f0bd9b";
      ctx.fillRect(0, 55, W, 45);
      ctx.restore();
    }
    if (light.golden > 0.01 && light.dusk < 0.65) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = light.golden * 0.2;
      ctx.fillStyle = "#c0855c";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light.golden * 0.16;
      ctx.fillStyle = "#ffc37c";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = light.golden * 0.12;
      ctx.fillStyle = "#ffe0a2";
      ctx.fillRect(0, 0, W, 64);
      ctx.globalAlpha = light.golden * 0.1;
      ctx.fillStyle = "#eaa56f";
      ctx.fillRect(0, 58, W, 48);
      ctx.restore();
    }
    if (this.rainFactor > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = this.rainFactor * 0.3;
      ctx.fillStyle = "#53636b";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = this.rainFactor * 0.055;
      ctx.fillStyle = "#aec3c3";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  fireflyCapacity() {
    return Math.round(this.getLight().fireflies * 14);
  }

  drawCloudShadows(ctx) {
    const light = this.getLight();
    if (light.dusk > 0.72 || light.night > 0.75 || this.rainFactor > 0.55) return;
    this.cloudField.drawShadows(ctx, "#172b2b", 0.05);
  }
}
