import { FLOWERS, NOTE_BY_ID, P, TAU, WORLD } from "./config.js";
import { drawSheet } from "./assets.js";
import {
  clamp,
  distance,
  lerp,
  mulberry32,
  pixelEllipseRing,
  pointInPolygon,
  randomPointInPolygon,
  round,
  smoothstep,
} from "./utils.js";

const NOTE_COLOR = {
  honeybee: P.beeGold,
  bumblebee: P.beeGold,
  dragonfly: P.waterLight,
  damselfly: P.cornflower,
  butterfly: P.butterfly,
  ladybug: P.ladyRed,
  ant: P.barkLight,
  snail: P.shell,
  waterstrider: P.foam,
  tadpole: P.waterLight,
  frog: P.frogLight,
  firefly: P.firefly,
  gnat: P.cream,
};

/**
 * Night/rain ecology schedule.
 *
 * The world's light factors are already smooth 0..1 ramps (see
 * time-of-day.js), so the pond only maps them onto each animal's day. Every
 * threshold below is a blend edge, never a hard cut: smoothstep eases the
 * creature's activity, speed and opacity between the two values, so no one
 * pops in or out.
 *
 *   Diurnal flyers (honeybees, bumblebees, dragonflies, damselflies,
 *   butterflies and ladybugs) fade out between night 0.10 and 0.62. The night
 *   factor ramps from 19:30 to 20:00, so the fade runs roughly 19:36-19:48
 *   and they are roosting before full dark. They wake through the 04:30-05:30
 *   dawn fade; around 04:54-05:18 their alpha climbs back from 0.
 *
 *   Night flyers (fireflies and gnats) ride the world's own firefly ramp
 *   (`light.fireflies`, which is smoothstep(0.2, 0.85, night)) so they arrive
 *   with the first fireflies and leave before sunrise.
 *
 *   Rain shelter starts at rainFactor 0.22 and is complete at 0.42. The rain
 *   layer ramps over about two seconds, so by the time the toggle is raining
 *   (or `?rain=1` settles) every flyer is hidden. Above roughly 0.35 the
 *   activity alpha is below HOVER_MIN_ALPHA, so wet flyers are neither
 *   hoverable nor clickable. Ground life is never hidden by rain.
 *
 *   Ground/water life (ants, snails, water striders, tadpoles and frogs) keeps
 *   going all night, but at 55% speed; heavy rain takes it to 45%. Frogs keep
 *   their croak interactions, and rain-splash ripples are ignored by striders
 *   and tadpoles so a shower cannot make the pond look busy.
 *
 * HOVER_MIN_ALPHA doubles as the "asleep" line: below it a creature is
 * ignored by CreatureManager.getHovered(). HIDDEN_ALPHA is the point where
 * draw calls and movement stop entirely.
 */
const ECOLOGY = Object.freeze({
  DIURNAL_NIGHT_FADE_START: 0.1,
  DIURNAL_NIGHT_FADE_END: 0.62,
  RAIN_SHELTER_START: 0.22,
  RAIN_SHELTER_FULL: 0.42,
  GROUND_NIGHT_SLOWDOWN: 0.45,
  GROUND_RAIN_SLOWDOWN: 0.15,
  GROUND_MIN_SPEED: 0.45,
  FLYER_MIN_PACE: 0.3,
  HOVER_MIN_ALPHA: 0.3,
  HIDDEN_ALPHA: 0.01,
});

const frameAt = (time, fps, count, offset = 0) =>
  ((Math.floor(time * fps + offset) % count) + count) % count;

function moveToward(entity, tx, ty, speed, dt) {
  const dx = tx - entity.x;
  const dy = ty - entity.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.0001) return 0;
  const step = Math.min(d, speed * dt);
  entity.x += (dx / d) * step;
  entity.y += (dy / d) * step;
  if (Math.abs(dx) > 0.2) entity.flip = dx < 0;
  return d;
}

class Critter {
  constructor(game, options = {}) {
    this.game = game;
    this.species = options.species;
    this.spriteKey = options.spriteKey ?? options.species;
    this.noteId = options.noteId ?? options.species;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.baseX = this.x;
    this.baseY = this.y;
    this.flip = false;
    this.phase = options.phase ?? 0;
    this.seed = options.seed ?? 1;
    this.rand = mulberry32(this.seed);
    this.hitRadius = options.hitRadius ?? 7;
    this.alive = true;
    this.hovered = false;
    // Filled in by CreatureManager each frame from the light/rain schedule.
    this.activity = 1;
    this.awake = true;
    this.speedScale = 1;
  }

  get noteColor() {
    return NOTE_COLOR[this.noteId] ?? P.cream;
  }

  get label() {
    return NOTE_BY_ID[this.noteId]?.name ?? "CREATURE";
  }

  hitTest(x, y) {
    const r = this.hitRadius;
    return (x - this.x) ** 2 + (y - this.y) ** 2 <= r * r;
  }

  record() {
    const first = this.game.recordNote(this.noteId, {
      x: this.x,
      y: this.y,
      color: this.noteColor,
    });
    if (!first) this.game.setLive(`${this.label} responds.`);
    return first;
  }

  update() {}

  draw() {}

  interact() {
    this.record();
  }
}

export class Bee extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      noteId: options.species,
      hitRadius: options.species === "bumblebee" ? 8 : 7,
    });
    this.speed = options.species === "bumblebee" ? 13 + this.rand() * 8 : 19 + this.rand() * 12;
    this.wingFps = options.species === "bumblebee" ? 13 : 20;
    this.state = "seek";
    this.timer = this.rand() * 1.8;
    this.target = null;
    this.orbitAngle = this.rand() * TAU;
    this.orbitTime = 0;
    this.danceTime = 0;
    this.danceSeed = this.rand() * TAU;
    this.pollenClock = 0;
    this.pauseClock = 0;
    this.altitude = options.altitude ?? 0;
    this.home = { ...WORLD.beeHome };
  }

  startDance() {
    this.danceTime = 5.5 + this.rand() * 1.3;
    this.danceSeed = this.rand() * TAU;
  }

  #chooseFlower() {
    const blooms = this.game.garden.blooms();
    if (!blooms.length) return null;
    // Prefer blooms that are not already crowded, with a little happy randomness.
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < Math.min(8, blooms.length); i += 1) {
      const flower = blooms[Math.floor(this.rand() * blooms.length)];
      const visitors = this.game.creatures.bees.filter((bee) => bee.target === flower).length;
      const score = this.rand() * 4 - visitors * 2.1 - distance(this.x, this.y, flower.x, flower.y) * 0.012;
      if (score > bestScore) {
        bestScore = score;
        best = flower;
      }
    }
    return best;
  }

  #pickWanderTarget() {
    return {
      x: 18 + this.rand() * 316,
      y: 65 + this.rand() * 93,
    };
  }

  update(dt) {
    const currentTime = this.game.time;
    if (this.danceTime > 0) {
      // The hive interaction wakes the colony at any hour; after the dance the
      // bees fall back into whatever the light/rain schedule says.
      this.pollenClock -= dt;
      this.danceTime -= dt;
      const t = currentTime * 2.8 + this.danceSeed;
      const targetX = 315 + Math.sin(t) * 27;
      const targetY = 103 + Math.sin(t * 2) * 13;
      this.x = lerp(this.x, targetX, Math.min(1, dt * 7));
      this.y = lerp(this.y, targetY, Math.min(1, dt * 7));
      this.flip = Math.cos(t) < 0;
      if (this.pollenClock <= 0) {
        this.pollenClock = 0.3;
        this.game.particles.pollen(this.x, this.y, 1, P.gold);
      }
      if (this.danceTime <= 0) {
        this.state = "seek";
        this.timer = 0.2;
        this.target = null;
      }
      return;
    }
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    this.timer -= dt;
    this.pollenClock -= dt;
    const pace = this.speedScale;

    if (this.state === "orbit") {
      this.orbitTime -= dt;
      const pointer = this.game.pointer;
      const cx = pointer?.inside ? pointer.x : this.home.x;
      const cy = pointer?.inside ? pointer.y : this.home.y;
      this.orbitAngle += dt * 3.8;
      const tx = cx + Math.cos(this.orbitAngle) * 18;
      const ty = cy + Math.sin(this.orbitAngle * 2) * 8 - 4;
      moveToward(this, tx, ty, this.speed * 1.35 * pace, dt);
      if (this.orbitTime <= 0) {
        this.state = "seek";
        this.target = null;
        this.timer = 0.25;
      }
      return;
    }

    if (this.state === "forage" && this.target) {
      const flower = this.target;
      const hoverX = flower.x + Math.sin(currentTime * 2.1 + this.phase) * 3;
      const hoverY = flower.y - 21 + Math.cos(currentTime * 1.7 + this.phase) * 2;
      this.x = lerp(this.x, hoverX, Math.min(1, dt * 6 * pace));
      this.y = lerp(this.y, hoverY, Math.min(1, dt * 6 * pace));
      this.flip = flower.x < this.x;
      this.timer -= dt;
      if (this.pollenClock <= 0) {
        this.pollenClock = 0.58;
        const bloom = this.game.garden.bloomPosition(flower);
        this.game.particles.pollen(bloom.x, bloom.y, 2, FLOWERS[flower.species].petal);
        flower.glow = 1;
      }
      if (this.timer <= 0) {
        this.state = "seek";
        this.target = this.#chooseFlower();
        this.timer = 0.4 + this.rand() * 1.2;
      }
      return;
    }

    if (this.state === "seek") {
      if (!this.target && this.timer <= 0) {
        this.target = this.#chooseFlower();
        if (!this.target) this.target = this.#pickWanderTarget();
        this.timer = 1.2;
      }
      if (this.target) {
        const isFlower = this.target.species;
        const tx = isFlower ? this.target.x : this.target.x;
        const ty = isFlower ? this.target.y - 22 : this.target.y;
        const d = moveToward(this, tx, ty, this.speed * pace, dt);
        this.y += Math.sin(currentTime * 3.7 + this.phase) * 4 * dt;
        if (d < 2.5) {
          if (isFlower) {
            this.state = "forage";
            this.timer = 2.2 + this.rand() * 2.2;
            this.game.particles.pollen(this.target.x, this.target.y - 18, 3, FLOWERS[this.target.species].petal);
          } else {
            this.target = this.#pickWanderTarget();
            this.timer = 0.8;
          }
        }
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.target = this.#chooseFlower();
        this.timer = 1.8 + this.rand() * 2;
      }
      return;
    }
  }

  interact() {
    this.record();
    this.state = "orbit";
    this.orbitTime = 3.1;
    this.target = null;
    this.game.audio.buzz(0.4, this.species === "bumblebee" ? 0.75 : 1);
    this.game.particles.sparkle(this.x, this.y, 5, this.noteColor);
  }

  draw(ctx, assets, time) {
    // A hive-triggered dance is a deliberate exception to the roost schedule.
    const alpha = this.danceTime > 0 ? 1 : this.activity;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    const sheet = assets[this.spriteKey];
    const frame = frameAt(time, this.wingFps, 4, this.seed);
    const bob = Math.sin(time * 4.6 + this.phase) * 0.7;
    const y = this.y + bob;
    if (sheet?.loaded) {
      drawSheet(ctx, sheet, frame, this.x, y, { anchor: "center", flip: this.flip, alpha });
    } else {
      drawSheet(ctx, sheet, frame, this.x, y, { anchor: "center", flip: this.flip, alpha });
    }
    if (this.hovered) {
      // Hover feedback is a single bright pixel at the wing tip, not an outline.
      ctx.save();
      ctx.globalAlpha = 0.8 * alpha;
      ctx.fillStyle = P.cream;
      ctx.fillRect(round(this.x + 7), round(y - 5), 1, 1);
      ctx.restore();
    }
  }
}

export class Dragonfly extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      noteId: options.species,
      hitRadius: options.species === "dragonfly" ? 11 : 8,
    });
    this.speed = options.species === "dragonfly" ? 31 + this.rand() * 14 : 17 + this.rand() * 9;
    this.state = "patrol";
    this.timer = 0;
    this.target = this.#nextTarget();
    this.startle = 0;
    this.perch = 0;
    this.lastRipple = 0;
    this.wingFps = options.species === "dragonfly" ? 24 : 16;
    this.turn = 0;
  }

  #nextTarget() {
    if (this.species === "damselfly") {
      return {
        x: 48 + this.rand() * 270,
        y: 92 + this.rand() * 45,
      };
    }
    return {
      x: 36 + this.rand() * 282,
      y: 86 + this.rand() * 54,
    };
  }

  update(dt) {
    const t = this.game.time;
    if (this.startle > 0) {
      this.startle -= dt;
      const angle = t * 18 + this.phase;
      this.x += Math.cos(angle) * 44 * dt;
      this.y += Math.sin(angle * 1.3) * 26 * dt;
      this.flip = Math.cos(angle) < 0;
      if (this.startle <= 0) this.target = this.#nextTarget();
      return;
    }
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    if (this.perch > 0) {
      this.perch -= dt;
      if (this.perch <= 0) {
        this.target = this.#nextTarget();
        this.state = "patrol";
      }
      return;
    }
    const pace = this.speedScale;
    const d = moveToward(this, this.target.x, this.target.y, this.speed * pace, dt);
    this.y += Math.sin(t * 5.4 + this.phase) * 3.2 * dt * pace;
    if (d < 3.5) {
      this.state = "hover";
      this.timer = 0.35 + this.rand() * 0.8;
      this.target = this.#nextTarget();
      if (this.game.world.isWater(this.x, this.y) && t - this.lastRipple > 1.5) {
        this.lastRipple = t;
        this.game.world.addRipple(this.x, this.y, 0.4, "dragonfly");
      }
      if (this.species === "damselfly" && this.rand() < 0.35) {
        this.perch = 1.8 + this.rand() * 2.2;
        this.state = "perch";
      }
    }
    if (this.timer > 0) {
      this.timer -= dt;
      this.x += Math.sin(t * 8 + this.phase) * 5 * dt * pace;
    }
  }

  interact() {
    this.record();
    this.startle = 1.1;
    this.game.audio.flutter();
    this.game.particles.sparkle(this.x, this.y, 4, this.noteColor);
    if (this.game.world.isWater(this.x, this.y)) {
      this.game.world.addRipple(this.x, this.y, 0.7, "dragonfly");
    }
  }

  draw(ctx, assets, time) {
    const alpha = this.activity;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    const sheet = assets[this.spriteKey];
    const frame = frameAt(time, this.wingFps, 4, this.seed);
    const bob = Math.sin(time * 3.1 + this.phase) * 1.4;
    if (this.game.world.isWater(this.x, this.y + 7)) {
      ctx.save();
      ctx.globalAlpha = 0.14 * alpha;
      ctx.fillStyle = P.waterDeep;
      ctx.fillRect(round(this.x - 5), round(this.y + 7 + bob), 11, 1);
      ctx.restore();
    }
    drawSheet(ctx, sheet, frame, this.x, this.y + bob, {
      anchor: "center",
      flip: this.flip,
      alpha,
    });
    if (this.perch > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = P.cream;
      ctx.fillRect(round(this.x + 7), round(this.y - 4), 1, 1);
      ctx.restore();
    }
  }
}

export class Butterfly extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 8,
      noteId: "butterfly",
    });
    this.state = "wander";
    this.target = { x: this.x + 14, y: this.y - 12 };
    this.perch = 0;
    this.startle = 0;
    this.wingOffset = this.rand() * 4;
    this.speed = 9 + this.rand() * 5;
    this.pause = 0;
  }

  update(dt) {
    const t = this.game.time;
    if (this.startle > 0) {
      this.startle -= dt;
      this.y -= 18 * dt;
      this.x += Math.sin(t * 8 + this.phase) * 12 * dt;
      return;
    }
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    const pace = this.speedScale;
    const flower = this.game.garden.hoveredFlower;
    if (flower && this.state !== "perch" && this.pause <= 0 && this.rand() < dt * 0.62) {
      this.target = this.game.garden.bloomPosition(flower);
      this.state = "targetPerch";
    }
    if (this.state === "targetPerch") {
      const d = moveToward(this, this.target.x, this.target.y - 4, this.speed * pace, dt);
      this.y += Math.sin(t * 3.8 + this.phase) * 5 * dt * pace;
      if (d < 3) {
        this.state = "perch";
        this.perch = 3.5 + this.rand() * 3;
      }
    } else if (this.state === "perch") {
      this.perch -= dt;
      if (this.perch <= 0) {
        this.state = "wander";
        this.pause = 0.5 + this.rand();
      }
    } else if (this.pause > 0) {
      this.pause -= dt;
      this.y += Math.sin(t * 2.1 + this.phase) * 1.5 * dt * pace;
    } else {
      const d = moveToward(this, this.target.x, this.target.y, this.speed * pace, dt);
      this.y += Math.sin(t * 2.6 + this.phase) * 5 * dt * pace;
      if (d < 4) {
        const blooms = this.game.garden.blooms();
        if (blooms.length && this.rand() < 0.5) {
          const bloom = blooms[Math.floor(this.rand() * blooms.length)];
          this.target = this.game.garden.bloomPosition(bloom);
          this.state = "targetPerch";
        } else {
          this.target = {
            x: 25 + this.rand() * 302,
            y: 74 + this.rand() * 84,
          };
          this.pause = 0.7 + this.rand() * 1.8;
        }
      }
    }
  }

  interact() {
    this.record();
    this.state = "wander";
    this.startle = 1.3;
    this.game.audio.flutter();
    this.game.particles.sparkle(this.x, this.y, 7, this.noteColor);
    this.game.particles.petals(this.x, this.y, P.butterflyCream, 3);
  }

  draw(ctx, assets, time) {
    const alpha = this.activity;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    const sheet = assets.butterfly;
    const fps = this.state === "perch" ? 3.8 : 8.5;
    const frame = frameAt(time, fps, 4, this.seed);
    drawSheet(ctx, sheet, frame, this.x, this.y, {
      anchor: "center",
      alpha: (this.startle > 0 ? 0.92 : 1) * alpha,
    });
  }
}

export class Ladybug extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 6,
      noteId: "ladybug",
    });
    this.paths = [
      { x1: 14, x2: 40, y: 138 },
      { x1: 292, x2: 334, y: 136 },
      { x1: 8, x2: 30, y: 170 },
    ];
    this.pathIndex = options.pathIndex ?? 0;
    this.path = this.paths[this.pathIndex];
    this.x = options.x ?? this.path.x1;
    this.y = this.path.y;
    this.dir = this.rand() < 0.5 ? -1 : 1;
    this.state = "walk";
    this.pause = 0;
    this.fly = null;
    this.speed = 4.8 + this.rand() * 1.6;
    this.flip = this.dir < 0;
  }

  update(dt) {
    const t = this.game.time;
    if (this.state === "fly" && this.fly) {
      this.fly.t += dt / this.fly.duration;
      if (this.fly.t >= 1) {
        this.state = "walk";
        this.pathIndex = this.fly.pathIndex;
        this.path = this.paths[this.pathIndex];
        this.x = this.fly.toX;
        this.y = this.path.y;
        this.fly = null;
        this.dir = this.rand() < 0.5 ? -1 : 1;
        this.pause = 0.4;
        this.game.particles.sparkle(this.x, this.y - 2, 3, P.leafHigh);
      } else {
        const e = this.fly.t;
        this.x = lerp(this.fly.fromX, this.fly.toX, e);
        this.y = lerp(this.fly.fromY, this.path.y, e) - Math.sin(e * Math.PI) * 22;
      }
      return;
    }
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.x += this.dir * this.speed * this.speedScale * dt;
    this.y = this.path.y + Math.round(Math.sin(t * 2.8 + this.phase) * 0.7);
    if (this.x < this.path.x1 + 2) {
      this.x = this.path.x1 + 2;
      this.dir = 1;
      this.pause = 0.8 + this.rand() * 1.8;
    } else if (this.x > this.path.x2 - 2) {
      this.x = this.path.x2 - 2;
      this.dir = -1;
      this.pause = 0.8 + this.rand() * 1.8;
    }
    this.flip = this.dir < 0;
  }

  interact() {
    this.record();
    const targetIndex = (this.pathIndex + 1 + Math.floor(this.rand() * (this.paths.length - 1))) % this.paths.length;
    const targetPath = this.paths[targetIndex];
    const toX = targetPath.x1 + this.rand() * (targetPath.x2 - targetPath.x1);
    this.fly = {
      t: 0,
      duration: 0.9 + this.rand() * 0.4,
      fromX: this.x,
      fromY: this.y,
      toX,
      pathIndex: targetIndex,
    };
    this.state = "fly";
    this.game.audio.flutter();
    this.game.particles.sparkle(this.x, this.y - 4, 5, this.noteColor);
  }

  draw(ctx, assets, time) {
    const alpha = this.activity;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    if (this.state === "fly") {
      const frame = frameAt(time, 10, 2, this.seed);
      drawSheet(ctx, assets["ladybug-fly"], frame, this.x, this.y, {
        anchor: "bottom",
        flip: this.flip,
        alpha,
      });
    } else {
      const frame = this.pause > 0 ? Math.floor(this.seed) % 4 : frameAt(time, 8, 4, this.seed);
      drawSheet(ctx, assets.ladybug, frame, this.x, this.y, {
        anchor: "bottom",
        flip: this.flip,
        alpha,
      });
    }
  }
}

export class Ant extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 5,
      noteId: "ant",
    });
    this.x = options.x;
    this.y = options.y;
    this.dir = options.dir ?? 1;
    this.speed = 8 + this.rand() * 4;
    this.startle = 0;
    this.flip = this.dir < 0;
    this.offset = this.rand() * 10;
  }

  update(dt) {
    const t = this.game.time;
    const boosted = this.startle > 0 ? 2.6 : 1;
    this.startle = Math.max(0, this.startle - dt);
    this.x += this.dir * this.speed * this.speedScale * boosted * dt;
    this.y = this.baseY + Math.sin(this.x * 0.13 + this.offset) * 1.3;
    if (this.x > 278) {
      this.x = 278;
      this.dir = -1;
      this.flip = true;
    } else if (this.x < 222) {
      this.x = 222;
      this.dir = 1;
      this.flip = false;
    }
    this.flip = this.dir < 0;
    if (this.startle > 0 && this.startle % 0.15 < dt) {
      this.game.particles.add("mote", {
        x: this.x,
        y: this.y - 2,
        vx: -this.dir * 3,
        vy: -2,
        life: 0.3,
        color: P.barkLight,
      });
    }
  }

  interact() {
    this.record();
    this.startle = 1.3;
    this.dir *= -1;
    this.flip = this.dir < 0;
    this.game.particles.sparkle(this.x, this.y - 2, 3, this.noteColor);
  }

  draw(ctx, assets, time) {
    const frame = frameAt(time, 9 + (this.startle > 0 ? 7 : 0), 4, this.seed);
    drawSheet(ctx, assets.ant, frame, this.x, this.y, {
      anchor: "bottom",
      flip: this.flip,
    });
  }
}

export class Snail extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 7,
      noteId: "snail",
    });
    this.path = options.path;
    this.x = options.x;
    this.y = options.y;
    this.dir = this.rand() < 0.5 ? -1 : 1;
    this.speed = 1.6 + this.rand() * 0.7;
    this.pause = 0;
    this.retreat = 0;
    this.flip = this.dir < 0;
  }

  update(dt) {
    if (this.retreat > 0) {
      this.retreat -= dt;
      return;
    }
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.x += this.dir * this.speed * this.speedScale * dt;
    this.y = this.baseY + Math.sin(this.game.time * 1.2 + this.phase) * 0.5;
    if (this.x < this.path.x1) {
      this.x = this.path.x1;
      this.dir = 1;
      this.pause = 1 + this.rand() * 2;
    } else if (this.x > this.path.x2) {
      this.x = this.path.x2;
      this.dir = -1;
      this.pause = 1 + this.rand() * 2;
    }
    this.flip = this.dir < 0;
  }

  interact() {
    this.record();
    this.retreat = 2;
    this.game.particles.bubbles(this.x, this.y - 6, 2);
    this.game.particles.sparkle(this.x, this.y - 4, 2, this.noteColor);
    this.game.audio.flutter();
  }

  draw(ctx, assets, time) {
    const frame = this.retreat > 0 ? 0 : frameAt(time, 3, 4, this.seed);
    drawSheet(ctx, assets.snail, frame, this.x, this.y, {
      anchor: "bottom",
      flip: this.flip,
    });
    if (this.retreat > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = P.shellDark;
      ctx.fillRect(round(this.x + this.flip * 3), round(this.y - 4), 1, 1);
      ctx.restore();
    }
  }
}

export class WaterStrider extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 7,
      noteId: "waterstrider",
    });
    this.home = { x: options.x, y: options.y };
    this.x = options.x;
    this.y = options.y;
    this.target = this.#newTarget();
    this.state = "glide";
    this.pause = 0;
    this.speed = 16 + this.rand() * 7;
    this.panic = 0;
    this.wake = this.rand() * TAU;
  }

  #newTarget() {
    for (let i = 0; i < 24; i += 1) {
      const x = this.home.x + (this.rand() - 0.5) * 64;
      const y = this.home.y + (this.rand() - 0.5) * 26;
      if (this.game.world.isWater(x, y)) return { x, y };
    }
    return { x: this.home.x, y: this.home.y };
  }

  update(dt) {
    const world = this.game.world;
    if (this.panic > 0) {
      this.panic -= dt;
      this.x += this.panicDir * 42 * dt;
      if (!world.isWater(this.x, this.y)) {
        this.x -= this.panicDir * 8 * dt;
        this.panicDir *= -1;
      }
      this.flip = this.panicDir < 0;
      return;
    }
    for (let i = world.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = world.ripples[i];
      if (ripple.age > 0.45) break;
      // Rain makes hundreds of rings; they must not turn the pond into a
      // permanent panic. A shower is background weather, not a predator.
      if (ripple.source === "rain") continue;
      if (distance(this.x, this.y, ripple.x, ripple.y) < 25) {
        this.panic = 0.55;
        this.panicDir = this.x < ripple.x ? -1 : 1;
        this.game.particles.add("spark", {
          x: this.x,
          y: this.y + 1,
          vx: this.panicDir * 6,
          vy: -3,
          life: 0.4,
          color: P.foam,
        });
        break;
      }
    }
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    const d = moveToward(this, this.target.x, this.target.y, this.speed * this.speedScale, dt);
    this.flip = this.target.x < this.x ? true : this.flip;
    if (d < 2) {
      this.target = this.#newTarget();
      this.pause = 0.2 + this.rand() * 1.1;
    }
  }

  interact() {
    this.record();
    this.panic = 0.7;
    this.panicDir = this.rand() < 0.5 ? -1 : 1;
    this.game.world.addRipple(this.x, this.y, 0.7, "strider");
    this.game.particles.sparkle(this.x, this.y, 4, this.noteColor);
    this.game.audio.plop(0.5);
  }

  draw(ctx, assets, time) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = P.foam;
    const phase = this.timeWake ?? 0;
    ctx.fillRect(round(this.x - 6 + Math.sin(time * 2 + phase) * 1.5), round(this.y + 2), 13, 1);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(round(this.x - 9), round(this.y + 4), 18, 1);
    ctx.restore();
    const frame = frameAt(time, this.panic > 0 ? 16 : 9, 4, this.seed);
    drawSheet(ctx, assets.waterstrider, frame, this.x, this.y, {
      anchor: "center",
      flip: this.flip,
    });
  }
}

export class Tadpole extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 5,
      noteId: "tadpole",
    });
    this.home = { x: options.x, y: options.y };
    this.x = options.x;
    this.y = options.y;
    this.angle = this.rand() * TAU;
    this.radiusX = 5 + this.rand() * 7;
    this.radiusY = 2 + this.rand() * 3;
    this.speed = 0.5 + this.rand() * 0.7;
    this.panic = 0;
    this.panicVx = 0;
    this.panicVy = 0;
  }

  update(dt) {
    if (this.panic > 0) {
      this.panic -= dt;
      this.x += this.panicVx * dt;
      this.y += this.panicVy * dt;
      this.panicVx *= 0.96;
      this.panicVy *= 0.96;
      if (!this.game.world.isWater(this.x, this.y + 2)) {
        this.panic = 0;
        this.home = { x: this.x, y: this.y };
      }
      return;
    }
    this.angle += dt * this.speed * this.speedScale;
    const targetX = this.home.x + Math.cos(this.angle) * this.radiusX;
    const targetY = this.home.y + Math.sin(this.angle * 0.9) * this.radiusY;
    this.x = lerp(this.x, targetX, Math.min(1, dt * 1.8 * this.speedScale));
    this.y = lerp(this.y, targetY, Math.min(1, dt * 1.8 * this.speedScale));
  }

  reactToRipple(ripple) {
    if (this.panic > 0) return;
    if (ripple.source === "rain") return;
    const d = distance(this.x, this.y, ripple.x, ripple.y);
    if (d < 22) {
      this.panic = 1.1;
      const angle = Math.atan2(this.y - ripple.y, this.x - ripple.x) + (this.rand() - 0.5) * 0.6;
      this.panicVx = Math.cos(angle) * 26;
      this.panicVy = Math.sin(angle) * 18;
    }
  }

  interact() {
    this.record();
    this.panic = 1.2;
    this.panicVx = (this.rand() - 0.5) * 40;
    this.panicVy = 14 + this.rand() * 16;
    this.game.particles.bubbles(this.x, this.y - 1, 3);
    this.game.particles.sparkle(this.x, this.y, 2, this.noteColor);
  }

  draw(ctx, assets, time) {
    const frame = frameAt(time, 7, 4, this.seed);
    drawSheet(ctx, assets.tadpole, frame, this.x, this.y, {
      anchor: "center",
      flip: Math.cos(this.angle) < 0,
      alpha: 0.82,
    });
  }
}

export class Frog extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 12,
      noteId: "frog",
    });
    this.padIndex = options.padIndex;
    this.pad = this.game.garden.pads[this.padIndex];
    this.x = this.pad.x;
    this.y = this.pad.y - 2;
    this.state = "idle";
    this.idleTime = this.rand() * 2;
    this.croakTimer = 0;
    this.responseTimer = 0;
    this.hop = null;
    this.flip = this.rand() < 0.5;
    this.blinkTimer = 2 + this.rand() * 3;
    this.blink = 0;
    this.answer = null;
  }

  requestCroak(delay = 0) {
    if (delay > 0) {
      this.responseTimer = delay;
      return;
    }
    if (this.state === "hop") return;
    this.state = "croak";
    this.croakTimer = 1.4;
    this.game.audio.croak(this.padIndex === 0 ? 1 : 0.82);
    this.game.particles.note(this.x, this.y - 13, P.cream);
    this.game.particles.bubbles(this.x - 3, this.y - 6, 2);
  }

  croak() {
    this.record();
    this.requestCroak(0);
    const others = this.game.creatures.frogs.filter((frog) => frog !== this);
    for (const other of others) {
      if (other.state !== "hop") other.requestCroak(0.32 + this.rand() * 0.22);
    }
  }

  startHop(pad) {
    if (this.state === "hop" || !pad) return false;
    if (pad === this.pad) {
      this.requestCroak(0);
      return false;
    }
    const duration = clamp(0.48 + distance(this.x, this.y, pad.x, pad.y) / 115, 0.5, 0.95);
    this.hop = {
      fromX: this.x,
      fromY: this.y,
      toX: pad.x,
      toY: pad.y - 2,
      t: 0,
      duration,
      targetPad: pad,
      arc: 8 + distance(this.x, this.y, pad.x, pad.y) * 0.18,
    };
    this.state = "hop";
    this.flip = pad.x < this.x;
    return true;
  }

  update(dt) {
    if (this.responseTimer > 0) {
      this.responseTimer -= dt;
      if (this.responseTimer <= 0 && this.state !== "hop") {
        this.requestCroak(0);
        this.game.creatures.frogs.forEach((frog) => {
          if (frog !== this && frog.state !== "hop") frog.answer = 0;
        });
      }
    }
    if (this.state === "hop" && this.hop) {
      this.hop.t += dt / this.hop.duration;
      const t = Math.min(1, this.hop.t);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.x = lerp(this.hop.fromX, this.hop.toX, ease);
      this.y = lerp(this.hop.fromY, this.hop.toY, ease) - Math.sin(t * Math.PI) * this.hop.arc;
      if (t >= 1) {
        this.pad = this.hop.targetPad;
        this.padIndex = this.game.garden.pads.indexOf(this.pad);
        this.x = this.hop.toX;
        this.y = this.hop.toY;
        this.state = "idle";
        this.hop = null;
        this.game.garden.kickPad(this.pad);
        this.game.world.addRipple(this.pad.x, this.pad.y + 2, 1.1, "frog");
        this.game.particles.splash(this.pad.x, this.pad.y + 3, 0.55);
        this.game.audio.plop(1.2);
        this.croakTimer = 0.4;
        this.game.particles.sparkle(this.x, this.y - 4, 4, P.cream);
      }
      return;
    }
    if (this.state === "croak") {
      this.croakTimer -= dt;
      if (this.croakTimer <= 0) this.state = "idle";
      return;
    }
    this.idleTime += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 0.1;
      this.blinkTimer = 2.4 + this.rand() * 3;
    }
    this.blink = Math.max(0, this.blink - dt);
    if (this.pad) {
      this.x = this.pad.x;
      this.y = this.pad.y - 2;
    }
  }

  interact() {
    this.croak();
    this.game.particles.sparkle(this.x, this.y - 5, 5, this.noteColor);
  }

  draw(ctx, assets, time) {
    let frame;
    if (this.state === "hop" && this.hop) {
      const t = this.hop.t;
      frame = t < 0.12 ? 4 : 5 + Math.min(2, Math.floor(t * 3));
    } else if (this.state === "croak") {
      frame = 2 + (Math.floor(time * 8) % 2);
    } else {
      frame = Math.floor((time + this.phase) / 2.7) % 2;
      if (this.blink > 0) frame = 0;
    }
    if (this.pad) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = P.waterDeep;
      ctx.fillRect(round(this.pad.x - 5), round(this.pad.y + 3), 11, 1);
      ctx.restore();
    }
    drawSheet(ctx, assets.frog, frame, this.x, this.y, {
      anchor: "bottom",
      flip: this.flip,
    });
  }
}

export class Firefly extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 6,
      noteId: "firefly",
    });
    this.home = { x: this.x, y: this.y };
    this.phase = this.rand() * TAU;
    this.pulsePhase = this.rand() * TAU;
    this.bright = 0.5 + this.rand() * 0.5;
    this.state = "drift";
    this.speed = 2.6 + this.rand() * 2.4;
    this.driftAngle = this.rand() * TAU;
    this.alpha = 0;
    // Fireflies ease in after spawning (and ease out with `activity`), so the
    // field never pops into existence all at once.
    this.fade = 0;
  }

  update(dt) {
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    this.fade = Math.min(1, this.fade + dt * 1.8);
    const t = this.game.time;
    const pace = this.speedScale;
    this.driftAngle += Math.sin(t * 0.7 + this.phase) * 0.9 * dt;
    this.x += Math.cos(this.driftAngle) * this.speed * pace * dt;
    this.y += Math.sin(this.driftAngle * 1.3) * this.speed * 0.55 * pace * dt;
    if (distance(this.x, this.y, this.home.x, this.home.y) > 30) {
      this.driftAngle += Math.PI;
    }
    this.alpha = 0.45 + 0.55 * (0.5 + Math.sin(t * 2.6 + this.pulsePhase) * 0.5);
    this.y = clamp(this.y, 98, 154);
    if (!this.game.world.isPlantable(this.x, this.y) && !this.game.world.isWater(this.x, this.y)) {
      this.x = this.home.x;
      this.y = this.home.y;
    }
  }

  interact() {
    this.record();
    this.game.particles.sparkle(this.x, this.y, 10, P.firefly);
    this.game.audio.chime(1);
  }

  draw(ctx, assets, time) {
    const alpha = this.activity * this.fade;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    const frame = frameAt(time, 4.2, 4, this.seed);
    const x = round(this.x);
    const y = round(this.y);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = this.alpha * 0.18 * alpha;
    ctx.fillStyle = P.firefly;
    ctx.fillRect(x - 2, y - 2, 5, 1);
    ctx.fillRect(x - 2, y + 2, 5, 1);
    ctx.fillRect(x - 2, y - 1, 1, 4);
    ctx.fillRect(x + 2, y - 1, 1, 4);
    ctx.globalAlpha = this.alpha * 0.1 * alpha;
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.restore();
    drawSheet(ctx, assets.firefly, frame, x, y, {
      anchor: "center",
      alpha: (0.6 + this.alpha * 0.4) * alpha,
    });
  }
}

export class Gnat extends Critter {
  constructor(game, options) {
    super(game, {
      ...options,
      hitRadius: 5,
      noteId: "gnat",
    });
    this.home = { x: this.x, y: this.y };
    this.state = "drift";
    this.target = { x: this.x + 4, y: this.y + 2 };
    this.speed = 9 + this.rand() * 6;
    this.timer = this.rand() * 1.2;
    this.flip = this.rand() < 0.5;
  }

  update(dt) {
    if (this.activity <= ECOLOGY.HIDDEN_ALPHA) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.target = {
        x: this.home.x + (this.rand() - 0.5) * 28,
        y: this.home.y + (this.rand() - 0.5) * 16,
      };
      this.timer = 0.35 + this.rand() * 1.1;
    }
    const pace = this.speedScale;
    moveToward(this, this.target.x, this.target.y, this.speed * pace, dt);
    this.y += Math.sin(this.game.time * 7 + this.phase) * 3 * dt * pace;
  }

  interact() {
    this.record();
    this.game.particles.sparkle(this.x, this.y, 3, this.noteColor);
    this.game.audio.flutter();
  }

  draw(ctx, assets, time) {
    const alpha = this.activity;
    if (alpha <= ECOLOGY.HIDDEN_ALPHA) return;
    const frame = frameAt(time, 15, 2, this.seed);
    drawSheet(ctx, assets.gnat, frame, this.x, this.y, {
      anchor: "center",
      flip: this.flip,
      alpha,
    });
  }
}

export class CreatureManager {
  constructor(game) {
    this.game = game;
    this.seed = 8103;
    this.bees = [];
    this.dragonflies = [];
    this.butterflies = [];
    this.ladybugs = [];
    this.ants = [];
    this.snails = [];
    this.striders = [];
    this.tadpoles = [];
    this.frogs = [];
    this.fireflies = [];
    this.gnats = [];
    this.rng = mulberry32(this.seed);
    this.fireflySpawnClock = 0;
    this.reset();
  }

  reset() {
    const game = this.game;
    this.bees = [];
    for (let i = 0; i < 7; i += 1) {
      const isBumble = i > 4;
      const angle = (i / 7) * TAU;
      this.bees.push(
        new Bee(game, {
          species: isBumble ? "bumblebee" : "honeybee",
          x: isBumble ? 84 + (i - 5) * 36 : 300 + Math.cos(angle) * 18,
          y: isBumble ? 146 + (i % 2) * 6 : 100 + Math.sin(angle) * 12,
          seed: 101 + i * 17,
          phase: this.rng() * TAU,
        }),
      );
    }
    this.dragonflies = [
      new Dragonfly(game, { species: "dragonfly", x: 120, y: 112, seed: 201, phase: 0.4 }),
      new Dragonfly(game, { species: "dragonfly", x: 224, y: 110, seed: 202, phase: 2.2 }),
      new Dragonfly(game, { species: "damselfly", x: 64, y: 130, seed: 203, phase: 1.3 }),
      new Dragonfly(game, { species: "damselfly", x: 300, y: 130, seed: 204, phase: 3.4 }),
    ];
    this.butterflies = [
      new Butterfly(game, { species: "butterfly", x: 58, y: 138, seed: 301, phase: 1.1 }),
      new Butterfly(game, { species: "butterfly", x: 296, y: 138, seed: 302, phase: 2.9 }),
    ];
    this.ladybugs = [
      new Ladybug(game, { species: "ladybug", pathIndex: 0, x: 22, seed: 401, phase: 0.7 }),
      new Ladybug(game, { species: "ladybug", pathIndex: 1, x: 310, seed: 402, phase: 2.3 }),
    ];
    this.ants = [
      new Ant(game, { species: "ant", x: 232, y: 158, dir: 1, seed: 501 }),
      new Ant(game, { species: "ant", x: 248, y: 157, dir: -1, seed: 502 }),
      new Ant(game, { species: "ant", x: 264, y: 158, dir: 1, seed: 503 }),
    ];
    this.snails = [
      new Snail(game, {
        species: "snail",
        x: 26,
        y: 150,
        path: { x1: 6, x2: 32 },
        seed: 601,
        phase: 0.4,
      }),
      new Snail(game, {
        species: "snail",
        x: 318,
        y: 144,
        path: { x1: 304, x2: 338 },
        seed: 602,
        phase: 1.9,
      }),
    ];
    this.striders = [
      new WaterStrider(game, { species: "waterstrider", x: 112, y: 140, seed: 701 }),
      new WaterStrider(game, { species: "waterstrider", x: 176, y: 150, seed: 702 }),
      new WaterStrider(game, { species: "waterstrider", x: 246, y: 144, seed: 703 }),
    ];
    this.tadpoles = [];
    for (let i = 0; i < 6; i += 1) {
      this.tadpoles.push(
        new Tadpole(game, {
          species: "tadpole",
          x: 136 + i * 8,
          y: 150 + (i % 3) * 3,
          seed: 801 + i,
        }),
      );
    }
    this.frogs = [
      new Frog(game, { species: "frog", padIndex: 0, seed: 901, phase: 0.3 }),
      new Frog(game, { species: "frog", padIndex: 3, seed: 902, phase: 1.8 }),
    ];
    this.fireflies = [];
    this.gnats = [
      new Gnat(game, { species: "gnat", x: 84, y: 136, seed: 1001 }),
      new Gnat(game, { species: "gnat", x: 300, y: 130, seed: 1002 }),
      new Gnat(game, { species: "gnat", x: 190, y: 120, seed: 1003 }),
    ];
    this.fireflySpawnClock = 0;
    this.#applySchedule(this.game.world.getLight(), this.game.rainFactor ?? 0);
  }

  /**
   * Activity alpha for one schedule kind. See ECOLOGY at the top of the file
   * for the thresholds and the clock windows they map to.
   */
  #activityAlpha(kind, light, rain) {
    if (kind === "ground") return 1;
    const wet = clamp(rain ?? 0, 0, 1);
    const dry = 1 - smoothstep(ECOLOGY.RAIN_SHELTER_START, ECOLOGY.RAIN_SHELTER_FULL, wet);
    if (kind === "night") {
      // The world already publishes its firefly ramp; gnats share it.
      return clamp(light?.fireflies ?? 0, 0, 1) * dry;
    }
    const night = clamp(light?.night ?? 0, 0, 1);
    return (
      (1 - smoothstep(ECOLOGY.DIURNAL_NIGHT_FADE_START, ECOLOGY.DIURNAL_NIGHT_FADE_END, night)) *
      dry
    );
  }

  /** A creature below the hover threshold is asleep/sheltered: no hover, no click. */
  #isAwake(kind, light, rain) {
    return this.#activityAlpha(kind, light, rain) >= ECOLOGY.HOVER_MIN_ALPHA;
  }

  /**
   * Movement multiplier. Ground/water life stays visible but calm at night and
   * in rain; flyers slow down as their fade-out progresses.
   */
  #speedScale(kind, light, rain) {
    if (kind !== "ground") {
      return (
        ECOLOGY.FLYER_MIN_PACE +
        (1 - ECOLOGY.FLYER_MIN_PACE) * this.#activityAlpha(kind, light, rain)
      );
    }
    const night = clamp(light?.night ?? 0, 0, 1);
    const wet = clamp(rain ?? 0, 0, 1);
    return clamp(
      1 - ECOLOGY.GROUND_NIGHT_SLOWDOWN * night - ECOLOGY.GROUND_RAIN_SLOWDOWN * wet,
      ECOLOGY.GROUND_MIN_SPEED,
      1,
    );
  }

  /** Push the current light/rain schedule onto every creature, once per frame. */
  #applySchedule(light, rain) {
    this.light = light;
    this.rain = rain;
    const groups = [
      ["diurnal", this.bees, this.dragonflies, this.butterflies, this.ladybugs],
      ["ground", this.ants, this.snails, this.striders, this.tadpoles, this.frogs],
      ["night", this.gnats, this.fireflies],
    ];
    for (const [kind, ...lists] of groups) {
      const alpha = this.#activityAlpha(kind, light, rain);
      const awake = this.#isAwake(kind, light, rain);
      const speedScale = this.#speedScale(kind, light, rain);
      for (const list of lists) {
        for (const critter of list) {
          critter.activity = alpha;
          critter.awake = awake;
          critter.speedScale = speedScale;
          if (!awake) critter.hovered = false;
        }
      }
    }
  }

  /** A freshly spawned firefly must start at the current schedule, not at 1. */
  #applyToCritter(critter, kind, light, rain) {
    critter.activity = this.#activityAlpha(kind, light, rain);
    critter.awake = this.#isAwake(kind, light, rain);
    critter.speedScale = this.#speedScale(kind, light, rain);
  }

  update(dt) {
    const t = this.game.time;
    const light = this.game.world.getLight();
    const rain = clamp(this.game.rainFactor ?? 0, 0, 1);
    this.#applySchedule(light, rain);
    for (const bee of this.bees) bee.update(dt);
    for (const dragonfly of this.dragonflies) dragonfly.update(dt);
    for (const butterfly of this.butterflies) butterfly.update(dt);
    for (const ladybug of this.ladybugs) ladybug.update(dt);
    for (const ant of this.ants) ant.update(dt);
    for (const snail of this.snails) snail.update(dt);
    for (const strider of this.striders) strider.update(dt);
    for (const tadpole of this.tadpoles) tadpole.update(dt);
    for (const frog of this.frogs) frog.update(dt);
    for (const gnat of this.gnats) gnat.update(dt);
    for (const firefly of this.fireflies) firefly.update(dt);

    // Ripples disturb the underwater nursery; rain rings are just weather.
    for (const ripple of this.game.world.ripples) {
      if (ripple.age > dt * 1.5) continue;
      if (ripple.source === "rain") continue;
      for (const tadpole of this.tadpoles) tadpole.reactToRipple(ripple);
    }

    this.fireflySpawnClock -= dt;
    const capacity = this.game.world.fireflyCapacity();
    if (capacity > this.fireflies.length && this.fireflySpawnClock <= 0) {
      this.fireflySpawnClock = 0.22;
      this.#spawnFirefly();
    } else if (capacity < this.fireflies.length && this.fireflies.length > 0 && this.fireflySpawnClock <= 0) {
      // If the sun comes back up, the little lights should leave promptly,
      // not linger as daylight ghosts.
      this.fireflySpawnClock = capacity === 0 ? 0.04 : 0.22;
      this.fireflies.pop();
    }
  }

  #spawnFirefly() {
    for (let i = 0; i < 30; i += 1) {
      const chooseLeft = this.rng() < 0.58;
      const x = chooseLeft ? 4 + this.rng() * 92 : 255 + this.rng() * 60;
      const y = 105 + this.rng() * 47;
      if (this.game.world.isPlantable(x, y) || this.game.world.isWater(x, y)) {
        const firefly = new Firefly(this.game, {
          species: "firefly",
          x,
          y,
          seed: 1100 + this.fireflies.length * 13,
        });
        this.#applyToCritter(
          firefly,
          "night",
          this.light ?? this.game.world.getLight(),
          this.rain ?? 0,
        );
        this.fireflies.push(firefly);
        return;
      }
    }
  }

  startWaggleDance() {
    this.game.audio.buzz(1.0, 0.9);
    for (const bee of this.bees) bee.startDance();
    this.game.world.addRipple(315, 112, 0.4, "hive");
    this.game.particles.sparkle(315, 104, 8, P.gold);
  }

  hopToPad(pad) {
    if (!pad) return false;
    const occupant = this.frogs.find((frog) => frog.pad === pad && frog.state !== "hop");
    if (occupant) {
      occupant.croak();
      return false;
    }
    const candidates = this.frogs
      .filter((frog) => frog.state !== "hop")
      .sort(
        (a, b) =>
          distance(a.x, a.y, pad.x, pad.y) - distance(b.x, b.y, pad.x, pad.y),
      );
    if (!candidates.length) return false;
    return candidates[0].startHop(pad);
  }

  getHovered(x, y) {
    let best = null;
    let bestScore = Infinity;
    const all = [
      ...this.frogs,
      ...this.bees,
      ...this.butterflies,
      ...this.dragonflies,
      ...this.ladybugs,
      ...this.snails,
      ...this.striders,
      ...this.tadpoles,
      ...this.ants,
      ...this.gnats,
      ...this.fireflies,
    ];
    for (const critter of all) {
      // Sleeping day flyers and rain-sheltered night flyers are invisible to
      // the pointer; ground life (activity 1) is always interactive.
      if (critter.awake === false || (critter.activity ?? 1) < ECOLOGY.HOVER_MIN_ALPHA) {
        continue;
      }
      if (!critter.hitTest(x, y)) continue;
      const score = distance(x, y, critter.x, critter.y) - (critter.hitRadius || 0) * 0.2;
      if (score < bestScore) {
        best = critter;
        bestScore = score;
      }
    }
    return best;
  }

  drawWaterLife(ctx, assets, time) {
    for (const tadpole of this.tadpoles) tadpole.draw(ctx, assets, time);
    for (const strider of this.striders) strider.draw(ctx, assets, time);
  }

  drawGround(ctx, assets, time) {
    const ground = [...this.snails, ...this.ladybugs, ...this.ants, ...this.frogs];
    ground.sort((a, b) => a.y - b.y);
    for (const critter of ground) critter.draw(ctx, assets, time);
  }

  drawAir(ctx, assets, time) {
    const air = [...this.butterflies, ...this.dragonflies, ...this.gnats, ...this.bees];
    air.sort((a, b) => a.y - b.y);
    for (const critter of air) critter.draw(ctx, assets, time);
  }

  drawFireflies(ctx, assets, time) {
    for (const firefly of this.fireflies) firefly.draw(ctx, assets, time);
  }

  allNotes() {
    return [
      ...this.bees.map((bee) => bee.noteId),
      ...this.dragonflies.map((dragonfly) => dragonfly.noteId),
      ...this.butterflies.map((butterfly) => butterfly.noteId),
      ...this.ladybugs.map((ladybug) => ladybug.noteId),
      ...this.ants.map((ant) => ant.noteId),
      ...this.snails.map((snail) => snail.noteId),
      ...this.striders.map((strider) => strider.noteId),
      ...this.tadpoles.map((tadpole) => tadpole.noteId),
      ...this.frogs.map((frog) => frog.noteId),
      ...this.fireflies.map((firefly) => firefly.noteId),
      ...this.gnats.map((gnat) => gnat.noteId),
    ];
  }
}
