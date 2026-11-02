import { P, W } from "./config.js";
import { clamp, mulberry32 } from "./utils.js";

/**
 * A tiny parallax cloud field. Cloud art is a horizontal 64x32 x3 sheet:
 * cumulus / stratus / wisp. The field owns motion and a small tint cache so
 * clouds can be dark blue at night and grey in rain without redrawing the
 * authored sheet. Draw after the painted backdrop, before celestial bodies.
 */

function hashKey(color, strength, variant) {
  return `${variant}|${color}|${Math.round(strength * 12)}`;
}

export class CloudField {
  constructor(seed = 4815) {
    const random = mulberry32(seed);
    this.random = random;
    this.items = [];
    this.tintCache = new Map();
    this.time = 0;
    const anchors = [
      { layer: 0, variant: 2, x: 70, y: 18 },
      { layer: 0, variant: 2, x: 250, y: 20 },
      { layer: 1, variant: 1, x: 130, y: 30 },
      { layer: 1, variant: 1, x: 300, y: 31 },
      { layer: 2, variant: 0, x: 190, y: 39 },
      { layer: 2, variant: 0, x: 330, y: 43 },
    ];
    for (const anchor of anchors) {
      this.items.push({
        ...anchor,
        speed: 0.7 + anchor.layer * 0.7 + random() * 0.8,
        bob: random() * Math.PI * 2,
        scale: 1,
      });
    }
  }

  reset() {
    // Do not rebuild the random stream; just nudge the field offscreen so a
    // reset starts visually fresh without a texture/memory rebuild.
    for (const [index, item] of this.items.entries()) {
      item.x = 8 + this.random() * (W + 80) - 40;
      item.bob = index * 1.7;
    }
  }

  update(dt, time, options = {}) {
    this.time = time;
    const rain = clamp(options.rain ?? 0, 0, 1);
    const night = clamp(options.night ?? 0, 0, 1);
    const speedScale = (1 - night * 0.45) * (1 + rain * 0.2);
    for (const cloud of this.items) {
      cloud.x += cloud.speed * dt * speedScale;
      if (cloud.x - 36 > W) cloud.x = -36;
    }
  }

  #tinted(sheet, cloud, tint) {
    if (!tint || !sheet?.image || typeof document === "undefined") return null;
    const key = hashKey(tint.color, tint.strength, cloud.variant);
    if (this.tintCache.has(key)) return this.tintCache.get(key);
    const fw = sheet.fw;
    const fh = sheet.fh;
    const canvas = document.createElement("canvas");
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet.image, cloud.variant * fw, 0, fw, fh, 0, 0, fw, fh);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = tint.strength;
    ctx.fillStyle = tint.color;
    ctx.fillRect(0, 0, fw, fh);
    const entry = { canvas, fw, fh };
    this.tintCache.set(key, entry);
    return entry;
  }

  draw(ctx, sheet, options = {}) {
    if (!sheet?.loaded || !sheet.image) return;
    const night = clamp(options.night ?? 0, 0, 1);
    const golden = clamp(options.golden ?? 0, 0, 1);
    const dusk = clamp(options.dusk ?? 0, 0, 1);
    const dawn = clamp(options.dawn ?? 0, 0, 1);
    const rain = clamp(options.rain ?? 0, 0, 1);
    let tint = null;
    if (rain > 0.15) {
      tint = { color: "#4a585f", strength: 0.42 + rain * 0.22 };
    } else if (night > 0.15) {
      tint = { color: "#26364e", strength: 0.35 + night * 0.35 };
    } else if (dusk > 0.12) {
      tint = { color: "#7c6a88", strength: 0.32 + dusk * 0.22 };
    } else if (dawn > 0.12) {
      tint = { color: "#c98b93", strength: 0.28 + dawn * 0.18 };
    } else if (golden > 0.15) {
      tint = { color: "#e6a06f", strength: golden * 0.28 };
    }
    const dayAlpha = 0.58 + golden * 0.08;
    const nightAlpha = 0.42;
    const baseAlpha =
      (dayAlpha * (1 - night) + nightAlpha * night) *
      (1 - rain * 0.16) *
      (1 - dusk * 0.12 - dawn * 0.08);
    const layers = Array.isArray(options.layers) ? new Set(options.layers) : null;
    const sorted = [...this.items]
      .filter((cloud) => !layers || layers.has(cloud.layer))
      .sort((a, b) => a.layer - b.layer);
    for (const cloud of sorted) {
      const tinted = this.#tinted(sheet, cloud, tint);
      const bob = Math.sin(this.time * 0.12 + cloud.bob) * 0.6;
      const x = Math.round(cloud.x - sheet.fw / 2);
      const y = Math.round(cloud.y + bob);
      ctx.save();
      ctx.globalAlpha = clamp(baseAlpha + cloud.layer * 0.04 - rain * 0.03, 0.2, 0.78);
      ctx.imageSmoothingEnabled = false;
      if (tinted) {
        ctx.drawImage(tinted.canvas, x, y);
        // Keep a whisper of the authored cream on the moonlit crown.
        if (night > 0.2 && rain < 0.35) {
          ctx.globalAlpha = Math.min(0.1, baseAlpha * 0.14);
          ctx.drawImage(
            sheet.image,
            cloud.variant * sheet.fw,
            0,
            sheet.fw,
            sheet.fh,
            x,
            y,
            sheet.fw,
            sheet.fh,
          );
        }
      } else {
        const fw = sheet.fw;
        const fh = sheet.fh;
        ctx.drawImage(sheet.image, cloud.variant * fw, 0, fw, fh, x, y, fw, fh);
      }
      ctx.restore();
    }
  }

  /**
   * Broken, very low-alpha cloud bands on the pond surface. The world clips
   * these to the water; drawing them before the sun/moon path keeps the
   * reflected weather behind the brighter speculars.
   */
  drawReflections(ctx, options = {}) {
    const color = options.color ?? P.cloudShade;
    const alpha = clamp(options.alpha ?? 0.07, 0, 0.2);
    ctx.save();
    ctx.fillStyle = color;
    for (const cloud of this.items) {
      const baseY = 123 + cloud.layer * 4 + Math.sin(this.time * 0.08 + cloud.bob) * 1.2;
      const width = 9 + cloud.layer * 5;
      for (let k = 0; k < 3; k += 1) {
        const y = Math.round(baseY + k * 2);
        const offset = Math.sin(this.time * 0.11 + cloud.bob + k) * 2;
        ctx.globalAlpha = alpha * (1 - k * 0.22);
        for (let s = 0; s < 3; s += 1) {
          const x = Math.round(cloud.x - width / 2 + offset + s * (width / 2));
          ctx.fillRect(x, y, Math.max(2, Math.floor(width / 3)), 1);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Soft, broad cloud shade on the water/hills. The world clips this to the
   * pond and keeps the alpha extremely low so it reads as drifting weather.
   */
  drawShadows(ctx, color = "#172b2b", alpha = 0.055) {    ctx.save();
    ctx.fillStyle = color;
    for (const cloud of this.items) {
      const x = Math.round(cloud.x);
      const bob = Math.sin(this.time * 0.1 + cloud.bob) * 2;
      const width = cloud.layer === 2 ? 38 : cloud.layer === 1 ? 28 : 20;
      ctx.globalAlpha = alpha * (0.5 + cloud.layer * 0.25);
      ctx.fillRect(x - width / 2, 96 + cloud.y * 0.28 + bob, width, 1);
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillRect(x - width / 2 + 4, 98 + cloud.y * 0.28 + bob, width - 8, 1);
    }
    ctx.restore();
  }
}
