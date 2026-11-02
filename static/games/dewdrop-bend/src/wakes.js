import { H, P, TAU, UI, W, WORLD } from "./config.js";
import { pointInPolygon } from "./utils.js";

/**
 * WaterTrails — persistent, deterministic surface wakes for Dewdrop Bend.
 *
 * Tracks where water striders, tadpoles and (when explicitly marked) swimming
 * frogs have travelled and leaves small 1px/2px marks on the water behind them.
 * The layer owns no creatures and no simulation: it receives emitter snapshots
 * once per fixed step and only emits once an emitter is active, has moved at
 * least ~2.4 px since its last wake and is currently over water.
 *
 * INTEGRATION (game.js; this file never edits another module)
 *
 *   import { WaterTrails } from "./wakes.js";
 *
 *   // constructor, after this.world and this.creatures exist:
 *   this.wakes = new WaterTrails({
 *     width: W,
 *     height: H,
 *     isWater: (x, y) => this.world.isWater(x, y),
 *   });
 *
 *   // fixed-step update, after this.creatures.update(dt):
 *   const emitters = [];
 *   for (const strider of this.creatures.striders) {
 *     emitters.push({
 *       id: `strider:${strider.seed}`,
 *       kind: "strider",
 *       x: strider.x,
 *       y: strider.y,
 *       active: true,
 *       speed: strider.speed,
 *     });
 *   }
 *   for (const tadpole of this.creatures.tadpoles) {
 *     emitters.push({
 *       id: `tadpole:${tadpole.seed}`,
 *       kind: "tadpole",
 *       x: tadpole.x,
 *       y: tadpole.y,
 *       active: true,
 *     });
 *   }
 *   // Frogs are optional and must be marked while they are actually swimming:
 *   // emitters.push({ id: `frog:${frog.seed}`, kind: "frog", x: frog.x,
 *   //   y: frog.y, active: true, swimming: true });
 *   this.wakes.update(dt, this.time, emitters);
 *
 *   // Game.render() — after the water and before pads/creatures:
 *   this.world.drawBackdrop(ctx, this.assets);
 *   this.world.drawWater(ctx, this.assets);   // reflection body + ripples
 *   this.wakes.draw(ctx);                     // <- water-surface wakes
 *   this.world.drawCloudShadows(ctx);         // weather tints the wakes too
 *   this.garden.drawPads(ctx, this.assets);
 *   ...                                        // flowers, life, particles ...
 *   this.world.drawLight(ctx);                 // day/night grade over wakes
 *   ...
 *   this.ui.draw(ctx, this);                   // HUD last, never painted over
 *
 *   // Game.reset():
 *   this.wakes.reset();
 *
 * Layer: water surface. Draw after world.drawWater() and before pads, water
 * life, the day/night grade and the HUD. Drawing before drawCloudShadows() and
 * drawLight() lets those passes tint the wakes with the rest of the pond;
 * drawing before the UI means the bottom bar and panels can never be touched.
 *
 * API:
 *   new WaterTrails({ width, height, isWater, maxSegments = 220, seed })
 *   update(dt, time, emitters) -> this
 *   draw(ctx)
 *   reset() -> this
 *   count   // live wake segments (never above maxSegments)
 *
 * EMITTER CONTRACT:
 *   { id, kind, x, y, active, speed?, swimming? }
 *   - id: stable primitive identity (a creature seed/string). Reuse the same id
 *     for the same creature every frame; a missing id is ignored.
 *   - kind: "strider" | "tadpole" | "frog". Other kinds are ignored.
 *   - active: false pauses emission and re-arms the trail. When it becomes true
 *     again, the first frame only anchors the emitter, so no line is drawn
 *     across an inactive gap.
 *   - speed: optional px/s hint. It only nudges wake strength; missing or
 *     non-finite values are treated as a neutral speed.
 *   - swimming: frogs only; must be true for a frog to leave a wake (the caller
 *     marks a frog while it is in/on the water; otherwise frogs are ignored).
 *     Strider and tadpole ignore this field.
 *
 * WAKE DESIGN:
 *   Strider — one centre dimple plus two short diagonal dashes forming a broken
 *   V behind the direction of travel (foam/waterLight, ~0.1–0.25 alpha).
 *   Tadpole — one tiny tail fleck plus, sometimes, a small broken ring fleck
 *   (waterLight/waterMid, ~0.05–0.13 alpha). Frog — low rings, optional.
 *   Every mark lives 1.2–2.0 s and fades with a very short fade-in; alpha
 *   shimmers on a sine so the static pixel groups read as surface light rather
 *   than smoke. Marks are sampled pixel-by-pixel against isWater at spawn (and
 *   clipped to the canvas and above the HUD), so a wake can never leak onto the
 *   bank, a bank decoration or the HUD. When isWater is omitted the class falls
 *   back to WORLD.water, so default construction is already pond-safe.
 *
 * DETERMINISM / MEMORY:
 *   One fixed pool of maxSegments is allocated in the constructor and recycled
 *   ring-buffer style (the oldest wakes are replaced when full). Jitter and ring
 *   patterns come from a seeded mulberry32; reset() reseeds it, so replaying the
 *   same emitter snapshots reproduces the same pixels. There is no per-frame
 *   object creation in steady state and no unseeded randomness.
 */

const DEFAULT_SEED = 3010;
const DEFAULT_MAX_SEGMENTS = 260;
const MIN_STEP = 1.8;
const STALE_SECONDS = 8;
const PRUNE_EVERY = 8;
const RING_DENSITY = 0.62;

/** Wake pixels are never allowed into the HUD strip, even below the waterline. */
const HUD_TOP = Number.isFinite(UI?.bar?.y) ? UI.bar.y : H;

/** All three are pale enough to sit on the pond without becoming opaque lines. */
const WAKE_COLORS = [P.foam, P.waterLight, P.waterMid];

const SHAPE_DOT = 0;
const SHAPE_DASH = 1;
const SHAPE_RING = 2;

/**
 * A broken 2x1 ellipse outline. Ring segments pick a sparse subset of these
 * offsets, so the result is a fleck of ring, not a complete little circle.
 */
const RING_OFFSETS = [
  [-2, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [2, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
];

const LIFETIME = {
  strider: [2.0, 2.8],
  tadpole: [1.8, 2.4],
  frog: [1.8, 2.4],
};

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
const round = (n) => (n < 0 ? Math.ceil(n - 0.5) : Math.floor(n + 0.5));

/** Small seeded PRNG so wakes replay identically after reset. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WaterTrails {
  constructor({
    width = W,
    height = H,
    isWater = null,
    maxSegments = DEFAULT_MAX_SEGMENTS,
    seed = DEFAULT_SEED,
  } = {}) {
    this.width = Math.max(1, Math.round(Number(width) || W));
    this.height = Math.max(1, Math.round(Number(height) || H));
    this.isWater = typeof isWater === "function" ? isWater : null;
    const capacity = Math.floor(Number(maxSegments));
    this.maxSegments = Number.isFinite(capacity)
      ? Math.max(1, capacity)
      : DEFAULT_MAX_SEGMENTS;
    this.seed = seed >>> 0;

    this.time = 0;
    this.clock = 0;
    this.pruneAt = PRUNE_EVERY;
    /** id -> { x, y, armed, seen } — previous anchor per emitter. */
    this.tracks = new Map();
    this.random = mulberry32(this.seed);

    // Fixed pool. Segments are never created after construction.
    this.segments = new Array(this.maxSegments);
    for (let i = 0; i < this.maxSegments; i += 1) {
      this.segments[i] = {
        active: false,
        shape: SHAPE_DOT,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        mask: 0,
        color: 0,
        alpha: 0,
        life: 1.2,
        age: 0,
        phase: 0,
      };
    }
    this.cursor = 0;
    this.activeCount = 0;
  }

  /** Live wake segments (dots, dashes and ring flecks), never above maxSegments. */
  get count() {
    return this.activeCount;
  }

  /** Clear every wake and previous-position anchor, then reseed the jitter stream. */
  reset() {
    this.time = 0;
    this.clock = 0;
    this.pruneAt = PRUNE_EVERY;
    this.tracks.clear();
    for (let i = 0; i < this.segments.length; i += 1) {
      this.segments[i].active = false;
    }
    this.cursor = 0;
    this.activeCount = 0;
    this.random = mulberry32(this.seed);
    return this;
  }

  /**
   * Feed emitter snapshots and fade existing marks. Call once per fixed step
   * after creatures have moved; `time` only drives the alpha shimmer.
   */
  update(dt, time, emitters) {
    const delta = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.time = Number.isFinite(time) ? time : this.time + delta;
    this.clock += delta;

    if (delta > 0) this.#advance(delta);
    if (Array.isArray(emitters)) {
      for (let i = 0; i < emitters.length; i += 1) this.#trackEmitter(emitters[i]);
    }
    if (this.clock >= this.pruneAt) {
      this.pruneAt = this.clock + PRUNE_EVERY;
      this.#pruneTracks();
    }
    return this;
  }

  /** Draw the surface layer. All pixels were validated against water at spawn. */
  draw(ctx) {
    if (!ctx || this.activeCount === 0) return;
    ctx.save();
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      if (!segment.active) continue;
      const progress = segment.age / segment.life;
      if (progress >= 1) continue;
      // Start at 35% so a wake is visible on the frame it is emitted, then
      // ease to full over ~0.07 s instead of popping.
      const fadeIn =
        segment.age < 0.07 ? 0.35 + (segment.age / 0.07) * 0.65 : 1;
      const fadeOut = (1 - progress) ** 1.4;
      const shimmer = 0.8 + Math.sin(this.time * 2.3 + segment.phase) * 0.2;
      const alpha = segment.alpha * fadeIn * fadeOut * shimmer;
      if (alpha <= 0.012) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = WAKE_COLORS[segment.color];
      this.#plot(ctx, segment);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Age the pool; expired segments become free slots for the current frame. */
  #advance(dt) {
    let activeCount = this.activeCount;
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      if (!segment.active) continue;
      segment.age += dt;
      if (segment.age >= segment.life) {
        segment.active = false;
        activeCount -= 1;
      }
    }
    this.activeCount = activeCount;
  }

  /** Validate one emitter snapshot and, when warranted, leave a wake behind it. */
  #trackEmitter(emitter) {
    if (!emitter || typeof emitter !== "object") return;
    const kind = emitter.kind;
    if (kind !== "strider" && kind !== "tadpole" && kind !== "frog") return;

    const id = emitter.id;
    if (id === undefined || id === null) return;
    const x = Number(emitter.x);
    const y = Number(emitter.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    let track = this.tracks.get(id);
    if (!track) {
      track = { x, y, armed: false, seen: this.clock };
      this.tracks.set(id, track);
    }
    track.seen = this.clock;

    if (!emitter.active) {
      // Inactive creatures re-anchor when they come back, so a sleeping or
      // teleported emitter cannot drag a wake across the pond.
      track.armed = false;
      return;
    }
    if (kind === "frog" && emitter.swimming !== true) {
      // A frog is only a wake source when the caller says it is in the water.
      track.armed = false;
      track.x = x;
      track.y = y;
      return;
    }
    if (!track.armed) {
      track.armed = true;
      track.x = x;
      track.y = y;
      return;
    }
    if (!this.#isWakePixel(round(x), round(y))) {
      // Keep the anchor in sync while on land: no charge-up before re-entry.
      track.x = x;
      track.y = y;
      return;
    }

    const dx = x - track.x;
    const dy = y - track.y;
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return;
    const distance = Math.hypot(dx, dy);
    const dirX = dx / distance;
    const dirY = dy / distance;
    const energy = this.#energy(kind, Number(emitter.speed));

    if (kind === "strider") this.#strideWake(x, y, dirX, dirY, energy);
    else if (kind === "tadpole") this.#tadpoleWake(x, y, dirX, dirY, energy);
    else this.#frogWake(x, y, dirX, dirY, energy);

    track.x = x;
    track.y = y;
  }

  /** Optional speed hint: faster movement disturbs a little more water. */
  #energy(kind, speed) {
    if (!Number.isFinite(speed) || speed <= 0) return 1;
    const reference = kind === "strider" ? 20 : kind === "tadpole" ? 7 : 26;
    return clamp(speed / reference, 0.7, 1.25);
  }

  /** Pick a deterministic lifetime inside the kind's 1.2–2.0 s band. */
  #lifeFor(kind) {
    const range = LIFETIME[kind];
    return range[0] + this.random() * (range[1] - range[0]);
  }

  /** Three-pronged broken V: centre dimple plus two short diagonal arms. */
  #strideWake(x, y, dirX, dirY, energy) {
    const random = this.random;
    const backX = -dirX;
    const backY = -dirY;
    const sideX = -dirY;
    const sideY = dirX;

    const centreDistance = 2.6 + random() * 0.7;
    const centreOffset = (random() - 0.5) * 0.9;
    this.#addDot(
      x + backX * centreDistance + sideX * centreOffset,
      y + backY * centreDistance + sideY * centreOffset,
      random() < 0.55 ? 0 : 1,
      (0.34 + random() * 0.1) * energy,
      this.#lifeFor("strider"),
    );

    for (let side = -1; side <= 1; side += 2) {
      const rootDistance = 1.4 + random() * 0.5;
      const rootSpread = side * (0.9 + random() * 0.4);
      const rootX = x + backX * rootDistance + sideX * rootSpread;
      const rootY = y + backY * rootDistance + sideY * rootSpread;
      const armX = backX + sideX * side * 1.2 + (random() - 0.5) * 0.4;
      const armY = backY + sideY * side * 1.2 + (random() - 0.5) * 0.4;
      const armLength = Math.hypot(armX, armY) || 1;
      let stepX = Math.round(armX / armLength);
      let stepY = Math.round(armY / armLength);
      if (stepX === 0 && stepY === 0) stepX = -1;
      this.#addDash(
        rootX,
        rootY,
        stepX,
        stepY,
        random() < 0.6 ? 0 : 1,
        (0.26 + random() * 0.08) * energy,
        this.#lifeFor("strider"),
      );
    }
  }

  /** A dotted tail fleck and an occasional tiny broken ring. */
  #tadpoleWake(x, y, dirX, dirY, energy) {
    const random = this.random;
    const backX = -dirX;
    const backY = -dirY;
    const sideX = -dirY;
    const sideY = dirX;
    const offset = (random() - 0.5) * 1.1;
    const dotRoll = random();
    this.#addDot(
      x + backX * (2.0 + random() * 0.6) + sideX * offset,
      y + backY * (2.0 + random() * 0.6) + sideY * offset,
      dotRoll < 0.15 ? 0 : dotRoll < 0.8 ? 1 : 2,
      (0.18 + random() * 0.08) * energy,
      this.#lifeFor("tadpole"),
    );
    if (random() < 0.55) {
      this.#addRing(
        x + backX * (2.9 + random() * 0.8) + sideX * offset * 0.5,
        y + backY * (2.9 + random() * 0.8) + sideY * offset * 0.5,
        random() < 0.5 ? 1 : 2,
        (0.14 + random() * 0.06) * energy,
        this.#lifeFor("tadpole"),
      );
    }
  }

  /** Low, paired rings for a frog the caller has explicitly marked swimming. */
  #frogWake(x, y, dirX, dirY, energy) {
    const random = this.random;
    const backX = -dirX;
    const backY = -dirY;
    const sideX = -dirY;
    const sideY = dirX;
    const distance = 2.0 + random() * 1.0;
    const spread = 1.2 + random() * 1.1;
    for (let side = -1; side <= 1; side += 2) {
      this.#addRing(
        x + backX * distance + sideX * spread * side,
        y + backY * distance + sideY * spread * side,
        random() < 0.3 ? 0 : 1,
        (0.18 + random() * 0.06) * energy,
        this.#lifeFor("frog"),
      );
    }
  }

  /** Single water-valid pixel. */
  #addDot(x, y, color, alpha, life) {
    const px = round(x);
    const py = round(y);
    if (!this.#isWakePixel(px, py)) return;
    this.#spawn(SHAPE_DOT, px, py, 0, 0, 1, color, alpha, life);
  }

  /** A 1- or 2-pixel dash; the second pixel may be dropped at a shoreline. */
  #addDash(x, y, dx, dy, color, alpha, life) {
    const px = round(x);
    const py = round(y);
    let mask = 0;
    if (this.#isWakePixel(px, py)) mask |= 1;
    if (this.#isWakePixel(px + dx, py + dy)) mask |= 2;
    if (mask === 0) return;
    this.#spawn(SHAPE_DASH, px, py, dx, dy, mask, color, alpha, life);
  }

  /** A deterministic, broken ring fleck: only water-valid pixels get a bit. */
  #addRing(x, y, color, alpha, life) {
    const px = round(x);
    const py = round(y);
    let mask = 0;
    let bits = 0;
    for (let i = 0; i < RING_OFFSETS.length; i += 1) {
      if (this.random() >= RING_DENSITY) continue;
      const offset = RING_OFFSETS[i];
      if (!this.#isWakePixel(px + offset[0], py + offset[1])) continue;
      mask |= 1 << i;
      bits += 1;
      if (bits >= 5) break;
    }
    if (mask === 0) return;
    this.#spawn(SHAPE_RING, px, py, 0, 0, mask, color, alpha, life);
  }

  /** Copy a validated mark into the next free (or oldest) pool slot. */
  #spawn(shape, x, y, dx, dy, mask, color, alpha, life) {
    const segment = this.#claimSegment();
    segment.active = true;
    segment.shape = shape;
    segment.x = x;
    segment.y = y;
    segment.dx = dx;
    segment.dy = dy;
    segment.mask = mask;
    segment.color = color;
    segment.alpha = clamp(alpha, 0.02, 0.3);
    segment.life = clamp(life, 1.2, 2.0);
    segment.age = 0;
    segment.phase = this.random() * TAU;
  }

  /**
   * Fixed-pool allocator. Scans forward from the cursor for a free slot; when
   * the pool is full it overwrites the slot at the cursor (oldest wakes).
   */
  #claimSegment() {
    const total = this.segments.length;
    for (let i = 0; i < total; i += 1) {
      const segment = this.segments[this.cursor];
      this.cursor = this.cursor + 1 === total ? 0 : this.cursor + 1;
      if (!segment.active) {
        this.activeCount += 1;
        return segment;
      }
    }
    const segment = this.segments[this.cursor];
    this.cursor = this.cursor + 1 === total ? 0 : this.cursor + 1;
    return segment;
  }

  /**
   * A wake pixel must be inside the canvas, above the HUD strip and on water.
   * This is the single clipping authority for the layer; every plotted pixel
   * has passed it at spawn time.
   */
  #isWakePixel(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || y >= HUD_TOP) {
      return false;
    }
    if (this.isWater) return Boolean(this.isWater(x, y));
    return pointInPolygon(x + 0.5, y + 0.5, WORLD.water);
  }

  /** Plot every set bit of a segment's shape mask as 1x1 pixels. */
  #plot(ctx, segment) {
    if (segment.shape === SHAPE_RING) {
      for (let i = 0; i < RING_OFFSETS.length; i += 1) {
        if (!(segment.mask & (1 << i))) continue;
        const offset = RING_OFFSETS[i];
        ctx.fillRect(segment.x + offset[0], segment.y + offset[1], 1, 1);
      }
      return;
    }
    if (segment.shape === SHAPE_DASH) {
      if (segment.mask & 1) ctx.fillRect(segment.x, segment.y, 1, 1);
      if (segment.mask & 2) {
        ctx.fillRect(segment.x + segment.dx, segment.y + segment.dy, 1, 1);
      }
      return;
    }
    if (segment.mask & 1) ctx.fillRect(segment.x, segment.y, 1, 1);
  }

  /** Forget emitter ids that have not been seen for a while. */
  #pruneTracks() {
    if (this.tracks.size === 0) return;
    const cutoff = this.clock - STALE_SECONDS;
    for (const [id, track] of this.tracks) {
      if (track.seen <= cutoff) this.tracks.delete(id);
    }
  }
}
