import { FLOWERS, H, P, W, WORLD } from "./config.js";
import { drawSheet } from "./assets.js";
import {
  clamp,
  distance,
  mulberry32,
  pointInPolygon,
  round,
} from "./utils.js";

const MAX_FLOWERS = 56;
const GROW_TIMES = [0, 0.9, 3.1];

/** Flowers shrink with bank depth so the upper terraces read as background. */
export function flowerScaleAt(y) {
  if (y <= 132) return 0.55;
  if (y <= 150) return 0.72;
  if (y <= 168) return 0.86;
  return 1;
}

export class Garden {
  constructor(assets) {
    this.assets = assets;
    this.flowers = [];
    this.pads = [];
    this.random = mulberry32(7331);
    this.time = 0;
    this.hoveredFlower = null;
    this.hoveredPad = null;
    this.reset();
  }

  reset() {
    this.flowers.length = 0;
    this.pads = WORLD.lilyPads.map((pad) => ({
      ...pad,
      kick: -10,
      hoverGlow: 0,
    }));
    for (const [index, spec] of WORLD.initialFlowers.entries()) {
      this.#addFlower(spec.species, spec.x, spec.y, {
        instant: true,
        phase: index * 0.71 + 0.4,
        source: "initial",
      });
    }
    this.hoveredFlower = null;
    this.hoveredPad = null;
  }

  #addFlower(speciesId, x, y, options = {}) {
    const species = FLOWERS[speciesId];
    if (!species) return null;
    const flower = {
      id: `flower-${this.flowers.length + 1}-${Math.round(x)}-${Math.round(y)}`,
      species: speciesId,
      x: Math.round(x),
      y: Math.round(y),
      scale: options.scale ?? flowerScaleAt(y),
      age: options.instant ? GROW_TIMES[2] + 0.1 : 0,
      phase: options.phase ?? this.random() * Math.PI * 2,
      source: options.source ?? "planted",
      glow: 0,
      lastStage: options.instant ? 2 : 0,
      sway: 0,
      visitors: 0,
    };
    this.flowers.push(flower);
    return flower;
  }

  canPlant(x, y, ignoreId = null) {
    if (this.flowers.length >= MAX_FLOWERS) return { ok: false, reason: "THE BANK IS FULL" };
    if (!WORLD || !x || !y) return { ok: false, reason: "" };
    if (!this.#isPlantable(x, y)) return { ok: false, reason: "PLANT ON THE BANKS" };
    const scale = flowerScaleAt(y);
    const minGap = Math.max(6, 9 * (0.6 + scale * 0.4));
    for (const flower of this.flowers) {
      if (flower.id === ignoreId) continue;
      if (distance(x, y, flower.x, flower.y) < minGap) {
        return { ok: false, reason: "TOO CLOSE TO ANOTHER BLOOM" };
      }
    }
    if (distance(x, y, WORLD.hive.x, WORLD.hive.y + 8) < 24) {
      return { ok: false, reason: "MIND THE BEES" };
    }
    if (
      x > WORLD.boulder.x - 4 &&
      x < WORLD.boulder.x + WORLD.boulder.w + 4 &&
      y > WORLD.boulder.y - 4 &&
      y < WORLD.boulder.y + WORLD.boulder.h + 4
    ) {
      return { ok: false, reason: "THE STONE IS TAKEN" };
    }
    const log = WORLD.log;
    if (
      x > log.x - 5 &&
      x < log.x + log.w + 5 &&
      y > log.y - 8 &&
      y < log.y + log.h + 3
    ) {
      return { ok: false, reason: "THE LOG IS NOT A GARDEN" };
    }
    for (const pad of this.pads) {
      if (distance(x, y, pad.x, pad.y) < 18) return { ok: false, reason: "NOT IN THE POND" };
    }
    return { ok: true, reason: "", scale };
  }

  #isPlantable(x, y) {
    if (y >= H - 17) return false;
    const inBank =
      pointInPolygon(x, y, WORLD.banks.left) || pointInPolygon(x, y, WORLD.banks.right);
    if (!inBank) return false;
    if (pointInPolygon(x, y, WORLD.water)) return false;
    return true;
  }

  plant(speciesId, x, y) {
    const validity = this.canPlant(x, y);
    if (!validity.ok) return { ok: false, reason: validity.reason, flower: null };
    const flower = this.#addFlower(speciesId, x, y, {
      source: "planted",
      scale: validity.scale,
    });
    return { ok: true, reason: "", flower, scale: validity.scale };
  }

  update(dt, time, wind, particles, audio) {
    this.time = time;
    for (const flower of this.flowers) {
      flower.age += dt;
      const stage = this.#stageOf(flower);
      if (stage > flower.lastStage) {
        flower.lastStage = stage;
        const scale = flower.scale ?? 1;
        if (particles) {
          particles.pollen(
            flower.x,
            flower.y - (stage === 2 ? 17 : 10) * scale,
            stage === 2 ? 6 : 3,
            FLOWERS[flower.species].petal,
          );
          if (stage === 2) {
            particles.sparkle(flower.x, flower.y - 17 * scale, 3, P.cream);
          }
        }
        if (stage === 2 && audio) audio.seed();
      }
      flower.glow = Math.max(0, flower.glow - dt * 0.9);
      const swing = Math.sin(time * 1.9 + flower.phase) * 0.7;
      flower.sway = round(swing * (0.3 + (wind?.strength ?? 0)));
    }
    for (const pad of this.pads) {
      pad.hoverGlow = Math.max(0, pad.hoverGlow - dt * 2);
    }
    if (this.hoveredPad) this.hoveredPad.hoverGlow = 1;
    if (this.hoveredFlower) {
      this.hoveredFlower.hoverGlow = 1;
    }
  }

  #stageOf(flower) {
    if (flower.age >= GROW_TIMES[2]) return 2;
    if (flower.age >= GROW_TIMES[1]) return 1;
    return 0;
  }

  flowerFrame(flower) {
    const species = FLOWERS[flower.species];
    return species.frameStart + this.#stageOf(flower);
  }

  isBloom(flower) {
    return this.#stageOf(flower) === 2;
  }

  bloomPosition(flower) {
    const scale = flower.scale ?? 1;
    return { x: flower.x, y: flower.y - 18 * scale };
  }

  blooms() {
    return this.flowers.filter((flower) => this.isBloom(flower));
  }

  getFlowerAt(x, y) {
    for (let i = this.flowers.length - 1; i >= 0; i -= 1) {
      const flower = this.flowers[i];
      const scale = flower.scale ?? 1;
      const top = flower.y - 25 * scale;
      const half = 8 * scale;
      if (x >= flower.x - half && x <= flower.x + half && y >= top && y <= flower.y + 2) {
        return flower;
      }
    }
    return null;
  }

  getPadAt(x, y) {
    for (const pad of this.pads) {
      const dx = (x - pad.x) / 17;
      const dy = (y - pad.y) / 10;
      if (dx * dx + dy * dy <= 1) return pad;
    }
    return null;
  }

  shake(flower, particles) {
    if (!flower) return;
    flower.glow = 1;
    const bloom = this.bloomPosition(flower);
    particles?.petals(bloom.x, bloom.y, FLOWERS[flower.species].petal, 5);
    particles?.pollen(bloom.x, bloom.y, 4, FLOWERS[flower.species].petal);
  }

  kickPad(pad) {
    pad.kick = this.time;
  }

  drawPads(ctx, assets) {
    const padSheet = assets?.lilypad;
    for (const pad of this.pads) {
      const bob = Math.round(Math.sin(this.time * 0.9 + pad.phase) * 1.2);
      const sinceKick = this.time - pad.kick;
      const press = sinceKick >= 0 && sinceKick < 0.5 ? Math.sin((sinceKick / 0.5) * Math.PI) * 2 : 0;
      const y = pad.y + bob + press;
      // A broken contact glint makes the pad feel buoyant rather than pasted on.
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = P.waterDeep;
      ctx.fillRect(Math.round(pad.x - 9), Math.round(y + 4), 18, 1);
      ctx.restore();
      drawSheet(ctx, padSheet, pad.variant, pad.x, y, { anchor: "center" });
      if (pad.hoverGlow > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.55 * pad.hoverGlow;
        ctx.fillStyle = P.cream;
        const left = Math.round(pad.x - 14);
        const top = Math.round(y - 6);
        ctx.fillRect(left, top, 28, 1);
        ctx.fillRect(left, top + 11, 28, 1);
        ctx.fillRect(left, top, 1, 12);
        ctx.fillRect(left + 27, top, 1, 12);
        ctx.restore();
      }
    }
  }

  drawFlowers(ctx, assets) {
    const sheet = assets?.flowers;
    const sorted = [...this.flowers].sort((a, b) => a.y - b.y);
    for (const flower of sorted) {
      const stage = this.#stageOf(flower);
      const baseY = flower.y;
      const x = flower.x + (stage > 0 ? flower.sway : 0);
      const scale = flower.scale ?? 1;
      // Contact soil, deliberately one pixel, and scaled with the bloom.
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = P.grassDeep;
      ctx.fillRect(Math.round(x - 3 * scale), Math.round(baseY - 1), Math.round(6 * scale), 1);
      ctx.restore();
      drawSheet(ctx, sheet, this.flowerFrame(flower), x, baseY, {
        anchor: "bottom",
        scale,
      });
      if (flower.hoverGlow > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.5 * flower.hoverGlow;
        ctx.fillStyle = P.cream;
        const left = Math.round(x - 7 * scale);
        const top = Math.round(baseY - 23 * scale);
        const w = Math.max(3, Math.round(15 * scale));
        const h = Math.max(3, Math.round(24 * scale));
        ctx.fillRect(left, top, w, 1);
        ctx.fillRect(left, top + h, w, 1);
        ctx.fillRect(left, top, 1, h + 1);
        ctx.fillRect(left + w - 1, top, 1, h + 1);
        ctx.restore();
      }
      if (flower.glow > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.28 * flower.glow;
        ctx.fillStyle = FLOWERS[flower.species].petal;
        ctx.fillRect(Math.round(x - 4 * scale), Math.round(baseY - 18 * scale), Math.round(9 * scale), Math.max(1, Math.round(2 * scale)));
        ctx.fillRect(Math.round(x - 2 * scale), Math.round(baseY - 20 * scale), Math.round(5 * scale), 1);
        ctx.restore();
      }
    }
  }

  drawForeground(ctx, assets, wind) {
    const reedSheet = assets?.reeds;
    const grassSheet = assets?.grass;
    const strength = clamp(wind?.strength ?? 0.1, 0, 1);
    for (const reed of WORLD.reeds) {
      const frame = Math.sin(this.time * 1.15 + reed.x * 0.13) > 0 ? 0 : 1;
      const wobble = Math.round(Math.sin(this.time * 1.4 + reed.x) * (0.4 + strength));
      drawSheet(ctx, reedSheet, frame, reed.x + wobble, reed.y, {
        anchor: "bottom",
        flip: reed.flip,
      });
    }
    for (const tuft of WORLD.grass) {
      const frame = Math.floor((Math.sin(this.time * 1.3 + tuft.phase) * 0.5 + 0.5) * 4) % 4;
      const wobble = Math.round(Math.sin(this.time * 1.9 + tuft.phase) * (0.4 + strength * 1.2));
      drawSheet(ctx, grassSheet, frame, tuft.x + wobble, tuft.y, { anchor: "bottom" });
    }
  }

  drawWindIndicator(ctx) {
    // Not a UI element; sparse flakes show the direction of a recent sweep.
    const strength = this.windVisual ?? 0;
    if (strength <= 0.05) return;
    ctx.save();
    ctx.globalAlpha = strength * 0.32;
    ctx.fillStyle = P.cream;
    for (let i = 0; i < 4; i += 1) {
      const x = 20 + ((this.time * 24 + i * 73) % 280);
      const y = 108 + ((i * 11) % 38);
      ctx.fillRect(Math.round(x), y, 2, 1);
    }
    ctx.restore();
  }
}
