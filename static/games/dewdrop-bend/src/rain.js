import { H, P, W } from "./config.js";

/**
 * Rain — the optional weather layer for Dewdrop Bend.
 *
 * Integration (game.js):
 *
 *   import { Rain } from "./rain.js";
 *   this.rain = new Rain({
 *     onWaterDrop: (x, y) => this.world.addRipple(x, y, 0.28, "rain"),
 *     isWater: (x, y) => this.world.isWater(x, y),
 *   });
 *   this.rain.setIntensity(weatherOn ? 1 : 0); // ramps over ~2 s
 *   this.rain.update(dt, this.time);
 *   // Render after the world/light/life passes, below the UI:
 *   this.rain.draw(ctx);
 *
 * Everything is preallocated and deterministic (a local mulberry32, no
 * Math.random), so updates do not churn the GC or shimmer between frames.
 * `isWater` is optional but recommended: it keeps splash ripples on the pond
 * instead of the whole width at the rough `waterY` horizon. Without it the
 * layer treats the waterline as water all the way across. `reset()` reseeds
 * the streaks after a pond reset and deliberately preserves the current
 * intensity, so the weather button state stays truthful.
 */

const NEAR_DROPS = 58;
const FAR_DROPS = 32;
const TOTAL_DROPS = NEAR_DROPS + FAR_DROPS;
const SPLASH_POOL = 80;
const DEFAULT_SEED = 0x2f6e2b1;
const DEFAULT_RAMP_SECONDS = 2;
const WATERLINE_RATIO = 0.56;
const DROP_MARGIN = 32;
const FADE_WIDTH = 0.12;
const CALLBACK_MIN = 0.03;
const CALLBACK_MAX = 0.06;
const MIST_ROWS = [-5, -3];

/** Mid-tone streaks stay legible over both the pale day sky and dark water. */
const COLORS = {
  veil: "#17353b",
  veilSky: "#24464b",
  mist: "#d8ece4",
  nearBody: "#c6e2d9",
  nearTip: P.cream,
  farBody: "#8bafa8",
  farTip: "#b6d2cb",
  splash: P.foam,
};

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round = (n) => (n < 0 ? Math.ceil(n - 0.5) : Math.floor(n + 0.5));

/** Small seeded PRNG so rain looks the same on every run and every reset. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rain {
  constructor({
    width = W,
    height = H,
    onWaterDrop = null,
    isWater = null,
    waterY = null,
    seed = DEFAULT_SEED,
    rampSeconds = DEFAULT_RAMP_SECONDS,
  } = {}) {
    this.width = Math.max(1, Math.round(Number(width) || W));
    this.height = Math.max(1, Math.round(Number(height) || H));
    this.waterY = Math.max(
      1,
      Math.min(
        this.height - 1,
        Math.round(
          Number.isFinite(waterY) ? waterY : this.height * WATERLINE_RATIO,
        ),
      ),
    );
    this.onWaterDrop = typeof onWaterDrop === "function" ? onWaterDrop : null;
    this.isWater = typeof isWater === "function" ? isWater : null;
    this.surface = null;
    this.#buildSurface();
    this.seed = seed >>> 0;
    this.rampSeconds = Math.max(
      0.1,
      Number.isFinite(rampSeconds) ? rampSeconds : DEFAULT_RAMP_SECONDS,
    );

    this.intensity = 0;
    this.targetIntensity = 0;
    this.time = 0;
    this.callbackClock = 0;
    this.splashCursor = 0;
    this.random = mulberry32(this.seed);

    // Near drops render in front, far drops behind; both pools are fixed.
    this.drops = new Array(TOTAL_DROPS);
    for (let i = 0; i < this.drops.length; i += 1) {
      this.drops[i] = {
        near: i < NEAR_DROPS,
        x: 0,
        y: 0,
        speed: 0,
        length: 0,
        alpha: 0,
        threshold: 1,
        slant: 0,
        splashed: false,
      };
    }
    this.splashes = new Array(SPLASH_POOL);
    for (let i = 0; i < this.splashes.length; i += 1) {
      this.splashes[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        life: 0,
      };
    }

    this.#populate();
  }

  /** Number of preallocated streaks (near + far). */
  get dropCount() {
    return this.drops.length;
  }

  /** Streaks currently visible at the present intensity. */
  get activeDropCount() {
    let count = 0;
    for (let i = 0; i < this.drops.length; i += 1) {
      if (this.intensity > this.drops[i].threshold) count += 1;
    }
    return count;
  }

  /** Toggle rain with a smooth, bounded ramp (~2 s at default settings). */
  setIntensity(target) {
    this.targetIntensity = clamp01(Number.isFinite(target) ? target : 0);
    return this;
  }

  /**
   * Reseed the streak field for a clean pond reset. Intensity and target are
   * preserved; call setIntensity(0) first if the reset should clear weather.
   */
  reset() {
    this.time = 0;
    this.callbackClock = 0;
    this.#populate();
    return this;
  }

  update(dt, time) {
    const delta = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.time = Number.isFinite(time) ? time : this.time + delta;

    const rampStep = delta / this.rampSeconds;
    if (this.intensity < this.targetIntensity) {
      this.intensity = Math.min(this.targetIntensity, this.intensity + rampStep);
    } else if (this.intensity > this.targetIntensity) {
      this.intensity = Math.max(this.targetIntensity, this.intensity - rampStep);
    }

    // A slow gust only changes the drift, never a per-frame random flicker.
    const gust = 0.72 + Math.sin(this.time * 0.37) * 0.28;
    const nearDrift = 18 * gust;
    const farDrift = 6 * gust;
    this.callbackClock -= delta;

    for (let i = 0; i < this.drops.length; i += 1) {
      const drop = this.drops[i];
      const beforeX = drop.x;
      const beforeY = drop.y;

      drop.x += (drop.near ? nearDrift : farDrift) * delta;
      drop.y += drop.speed * delta;

      // Find the actual painted water surface at this x. A fixed waterline
      // made every splash land on the same horizontal seam; this follows the
      // pond's uneven far shore and simply never splashes on the banks.
      const surfaceY = this.#surfaceAt(drop.x);
      if (!drop.splashed && surfaceY !== null && beforeY < surfaceY && drop.y >= surfaceY) {
        drop.splashed = true;
        const travel = drop.y - beforeY;
        const fraction = travel > 0 ? (surfaceY - beforeY) / travel : 0;
        const hitX = beforeX + (drop.x - beforeX) * fraction;
        const hitSurface = this.#surfaceAt(hitX);
        if (hitSurface !== null) {
          if (drop.near) this.#spawnSplash(hitX, hitSurface);
          // Only near drops and only on a shared cooldown reach the callback;
          // otherwise a heavy shower would fire a ring on every frame.
          if (drop.near && this.callbackClock <= 0) {
            this.callbackClock =
              CALLBACK_MIN + this.random() * (CALLBACK_MAX - CALLBACK_MIN);
            if (this.onWaterDrop) this.onWaterDrop(hitX, hitSurface);
          }
        }
      }

      if (
        drop.y > this.height + 12 ||
        drop.x < -DROP_MARGIN ||
        drop.x > this.width + DROP_MARGIN
      ) {
        this.#respawn(drop, false);
      }
    }

    for (let i = 0; i < this.splashes.length; i += 1) {
      const splash = this.splashes[i];
      if (!splash.active) continue;
      splash.age += delta;
      if (splash.age >= splash.life) {
        splash.active = false;
        continue;
      }
      splash.vy += 95 * delta;
      splash.x += splash.vx * delta;
      splash.y += splash.vy * delta;
    }
  }

  draw(ctx) {
    if (!ctx) return;
    let hasSplash = false;
    for (let i = 0; i < this.splashes.length; i += 1) {
      if (this.splashes[i].active) {
        hasSplash = true;
        break;
      }
    }
    if (this.intensity <= 0.001 && !hasSplash) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this.#drawVeil(ctx);
    this.#drawDrops(ctx);
    this.#drawSplashes(ctx);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  #populate() {
    this.random = mulberry32(this.seed);
    for (let i = 0; i < this.drops.length; i += 1) {
      const drop = this.drops[i];
      drop.threshold = this.random() * 0.72;
      this.#respawn(drop, true);
    }
    for (let i = 0; i < this.splashes.length; i += 1) {
      this.splashes[i].active = false;
    }
    this.splashCursor = 0;
  }

  /**
   * Cache the top of the pond for each column. The painted shoreline is not a
   * straight line, so rain needs a real per-column surface to splash in the
   * right place (or not at all, over a bank).
   */
  #buildSurface() {
    this.surface = null;
    if (!this.isWater) return;
    const surface = new Int16Array(this.width);
    surface.fill(-1);
    for (let x = 0; x < this.width; x += 1) {
      for (let y = 0; y < this.height; y += 1) {
        if (this.isWater(x, y)) {
          surface[x] = y;
          break;
        }
      }
    }
    this.surface = surface;
  }

  #surfaceAt(x) {
    if (!this.isWater) return this.waterY;
    if (!this.surface) return this.waterY;
    const column = Math.round(x);
    if (column < 0 || column >= this.surface.length) return null;
    const y = this.surface[column];
    return y >= 0 ? y : null;
  }

  #respawn(drop, initial) {
    const random = this.random;
    const near = drop.near;

    drop.x = random() * (this.width + DROP_MARGIN * 2) - DROP_MARGIN;
    drop.y = initial
      ? random() * (this.height + 20) - 20
      : -2 - random() * 28;
    drop.speed = near ? 320 + random() * 180 : 130 + random() * 90;
    drop.length = near
      ? 5 + Math.floor(random() * 4)
      : 2 + Math.floor(random() * 2);
    drop.alpha = near ? 0.55 + random() * 0.24 : 0.23 + random() * 0.16;
    drop.slant = near ? (random() < 0.7 ? 1 : 0) : random() < 0.25 ? 1 : 0;
    drop.splashed = false;
  }

  #spawnSplash(x, y) {
    for (let i = 0; i < 2; i += 1) {
      const splash = this.splashes[this.splashCursor];
      this.splashCursor = (this.splashCursor + 1) % this.splashes.length;
      splash.active = true;
      splash.x = x + (this.random() - 0.5) * 3;
      splash.y = y;
      splash.vx = (this.random() - 0.5) * 20;
      splash.vy = -9 - this.random() * 13;
      splash.age = 0;
      splash.life = 0.16 + this.random() * 0.16;
    }
  }

  #activation(drop) {
    const amount = this.intensity - drop.threshold;
    if (amount <= 0) return 0;
    return drop.alpha * Math.min(1, amount / FADE_WIDTH);
  }

  #drawVeil(ctx) {
    const intensity = this.intensity;
    if (intensity <= 0.001) return;

    // Thin, banded wash: no canvas gradients, so it stays in the pixel idiom.
    ctx.fillStyle = COLORS.veil;
    ctx.globalAlpha = 0.04 * intensity;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = COLORS.veilSky;
    ctx.globalAlpha = 0.028 * intensity;
    ctx.fillRect(0, 0, this.width, Math.round(this.height * 0.55));

    // Broken mist dashes soften the far shore without becoming a UI line.
    ctx.fillStyle = COLORS.mist;
    for (let row = 0; row < MIST_ROWS.length; row += 1) {
      const y = this.waterY + MIST_ROWS[row];
      if (y < 0) continue;
      ctx.globalAlpha = (0.044 - row * 0.012) * intensity;
      const offset = (row & 1) * 5;
      for (let x = offset; x < this.width; x += 17) {
        if (this.#surfaceAt(x + 2) === null) continue;
        ctx.fillRect(x, y, 4, 1);
      }
    }
  }

  #drawDrops(ctx) {
    if (this.intensity <= 0.001) return;
    this.#drawDropLayer(ctx, this.drops.length - FAR_DROPS, this.drops.length, false);
    this.#drawDropLayer(ctx, 0, NEAR_DROPS, true);
  }

  #drawDropLayer(ctx, start, end, near) {
    ctx.fillStyle = near ? COLORS.nearBody : COLORS.farBody;
    for (let i = start; i < end; i += 1) {
      const drop = this.drops[i];
      const alpha = this.#activation(drop);
      if (alpha <= 0.015) continue;
      ctx.globalAlpha = alpha;
      const x = round(drop.x);
      const y = round(drop.y);
      if (drop.slant === 0) {
        ctx.fillRect(x, y, 1, drop.length);
      } else {
        const upper = Math.max(1, drop.length - 2);
        ctx.fillRect(x, y, 1, upper);
        ctx.fillRect(x + 1, y + upper, 1, drop.length - upper);
      }
    }

    // One bright pixel at the leading edge sells the fall direction.
    ctx.fillStyle = near ? COLORS.nearTip : COLORS.farTip;
    for (let i = start; i < end; i += 1) {
      const drop = this.drops[i];
      const alpha = this.#activation(drop);
      if (alpha <= 0.015) continue;
      ctx.globalAlpha = Math.min(1, alpha * 1.3);
      ctx.fillRect(
        round(drop.x) + drop.slant,
        round(drop.y) + drop.length - 1,
        1,
        1,
      );
    }
  }

  #drawSplashes(ctx) {
    ctx.fillStyle = COLORS.splash;
    for (let i = 0; i < this.splashes.length; i += 1) {
      const splash = this.splashes[i];
      if (!splash.active) continue;
      const left = 1 - splash.age / splash.life;
      ctx.globalAlpha = left * 0.72;
      ctx.fillRect(round(splash.x), round(splash.y), 1, 1);
    }
  }
}
