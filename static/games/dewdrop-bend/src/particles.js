import { P } from "./config.js";
import { round, TAU } from "./utils.js";

const MAX_PARTICLES = 420;

export class Particles {
  constructor() {
    this.items = [];
    this.dustClock = 0;
    this.pollenClock = 0;
    this.fluffClock = 0;
  }

  clear() {
    this.items.length = 0;
  }

  add(type, options) {
    if (this.items.length >= MAX_PARTICLES) this.items.shift();
    const life = options.life ?? 1.5;
    this.items.push({
      type,
      x: options.x ?? 0,
      y: options.y ?? 0,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      gravity: options.gravity ?? 0,
      drag: options.drag ?? 0,
      size: options.size ?? 1,
      color: options.color ?? P.cream,
      phase: options.phase ?? Math.random() * TAU,
      age: 0,
      life,
      wobble: options.wobble ?? 0,
      alpha: options.alpha ?? 1,
    });
    return this;
  }

  pollen(x, y, count = 4, color = P.gold) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 4 + Math.random() * 9;
      this.add("pollen", {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        gravity: -1,
        drag: 0.9,
        life: 0.8 + Math.random() * 1.1,
        size: Math.random() < 0.25 ? 2 : 1,
        color: Math.random() < 0.4 ? P.cream : color,
        phase: Math.random() * TAU,
      });
    }
  }

  splash(x, y, strength = 1) {
    const count = Math.round(8 + strength * 12);
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI * (0.15 + Math.random() * 0.7);
      const speed = (20 + Math.random() * 45) * Math.min(1.6, strength);
      this.add("droplet", {
        x,
        y,
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed,
        gravity: 100,
        life: 0.45 + Math.random() * 0.45,
        color: Math.random() < 0.55 ? P.foam : P.waterLight,
        size: 1,
        phase: Math.random() * TAU,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      this.add("bubble", {
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -2 - Math.random() * 4,
        gravity: -2,
        life: 0.7 + Math.random() * 0.5,
        color: P.foam,
        size: Math.random() < 0.4 ? 2 : 1,
      });
    }
  }

  ripplesplash(x, y, strength = 1) {
    this.splash(x, y, strength * 0.55);
  }

  petals(x, y, color = P.poppy, count = 5) {
    for (let i = 0; i < count; i += 1) {
      this.add("petal", {
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 12,
        vy: -4 - Math.random() * 8,
        gravity: 7,
        drag: 0.7,
        life: 1.8 + Math.random() * 2,
        color,
        size: Math.random() < 0.35 ? 2 : 1,
        phase: Math.random() * TAU,
      });
    }
  }

  sparkle(x, y, count = 6, color = P.cream) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + Math.random() * 0.3;
      const speed = 5 + Math.random() * 12;
      this.add("spark", {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        gravity: 2,
        drag: 0.55,
        life: 0.65 + Math.random() * 0.65,
        color: Math.random() < 0.4 ? P.sunHigh : color,
        phase: Math.random() * TAU,
      });
    }
  }

  seedFluff(x, y, wind = 1) {
    this.add("fluff", {
      x,
      y,
      vx: (2 + Math.random() * 5) * wind,
      vy: -4 - Math.random() * 6,
      gravity: 1.1,
      drag: 0.25,
      life: 4 + Math.random() * 3,
      color: P.cream,
      phase: Math.random() * TAU,
      wobble: 2.4,
    });
  }

  note(x, y, color = P.cream) {
    this.add("note", {
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: -8,
      gravity: -1.5,
      life: 1.8,
      color,
      phase: Math.random() * TAU,
    });
    this.add("note", {
      x: x + 4,
      y: y + 2,
      vx: (Math.random() - 0.5) * 4,
      vy: -7,
      gravity: -1.2,
      life: 1.6,
      color,
      phase: Math.random() * TAU,
    });
  }

  bubbles(x, y, count = 4) {
    for (let i = 0; i < count; i += 1) {
      this.add("bubble", {
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: -4 - Math.random() * 5,
        gravity: -1,
        drag: 0.35,
        life: 0.8 + Math.random() * 0.8,
        color: P.foam,
        size: Math.random() < 0.35 ? 2 : 1,
      });
    }
  }

  windSeedBurst(x, y, direction = 1, count = 3) {
    for (let i = 0; i < count; i += 1) {
      const offsetX = x + (Math.random() - 0.5) * 30;
      const offsetY = y - Math.random() * 14;
      this.add("petal", {
        x: offsetX,
        y: offsetY,
        vx: direction * (10 + Math.random() * 14),
        vy: -3 - Math.random() * 7,
        gravity: 6,
        drag: 0.6,
        life: 1.6 + Math.random() * 1.4,
        color: Math.random() < 0.5 ? P.leafHigh : P.cream,
        size: 1,
        phase: Math.random() * TAU,
      });
    }
    if (Math.random() < 0.6) this.seedFluff(x, y - 3, direction);
  }

  burstNoteAt(x, y, color) {
    this.sparkle(x, y, 8, color);
    this.note(x, y - 8, color);
  }

  ambient(dt, { time, sun, wind }) {
    this.dustClock -= dt;
    this.pollenClock -= dt;
    this.fluffClock -= dt;
    const daylight = 0.55 + Math.sin((time + sun.x) * 0.13) * 0.12;
    if (this.dustClock <= 0) {
      this.dustClock = 0.25 + Math.random() * 0.6;
      const x = 20 + Math.random() * 280;
      const y = 20 + Math.random() * 115;
      this.add("mote", {
        x,
        y,
        vx: (0.7 + Math.random() * 2) * (wind?.direction || 1),
        vy: -0.6 - Math.random() * 1.1,
        life: 4 + Math.random() * 4,
        size: 1,
        color: Math.random() < 0.25 ? P.sunHigh : P.cream,
        alpha: 0.18 + daylight * 0.2,
        wobble: 1.5,
      });
    }
    if (this.pollenClock <= 0) {
      this.pollenClock = 1.2 + Math.random() * 2.4;
      const x = 40 + Math.random() * 250;
      const y = 72 + Math.random() * 50;
      this.add("pollen", {
        x,
        y,
        vx: (1.2 + Math.random() * 2.4) * (wind?.direction || 1),
        vy: 0.2 + Math.random() * 1.4,
        life: 3 + Math.random() * 3,
        color: Math.random() < 0.55 ? P.gold : P.cream,
        alpha: 0.35,
        size: 1,
        wobble: 1.2,
      });
    }
    if (this.fluffClock <= 0) {
      this.fluffClock = 3.5 + Math.random() * 6;
      this.seedFluff(14 + Math.random() * 290, 106 + Math.random() * 38, wind?.direction || 1);
    }
  }

  update(dt, environment = {}) {
    const wind = environment.wind ?? { strength: 0, direction: 1 };
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const particle = this.items[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        this.items.splice(i, 1);
        continue;
      }
      const dragFactor = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= dragFactor;
      particle.vy *= dragFactor;
      particle.vy += particle.gravity * dt;
      if (particle.type === "mote" || particle.type === "pollen" || particle.type === "fluff" || particle.type === "petal") {
        particle.vx += wind.strength * wind.direction * dt * (particle.type === "fluff" ? 18 : 6);
        particle.x += Math.sin(particle.age * 2.1 + particle.phase) * particle.wobble * dt;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.x < -12 || particle.x > 332 || particle.y < -18 || particle.y > 198) {
        this.items.splice(i, 1);
      }
    }
  }

  draw(ctx, layer = "all") {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const particle of this.items) {
      const progress = particle.age / particle.life;
      const fade = Math.min(1, progress < 0.15 ? progress / 0.15 : (1 - progress) / 0.5);
      const alpha = particle.alpha * Math.max(0, fade);
      if (alpha <= 0.01) continue;
      const x = round(particle.x);
      const y = round(particle.y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      switch (particle.type) {
        case "pollen":
        case "mote": {
          const twinkle = particle.type === "mote" ? Math.sin(particle.age * 3 + particle.phase) * 0.32 + 0.68 : 1;
          ctx.globalAlpha = alpha * twinkle;
          ctx.fillRect(x, y, particle.size, particle.size);
          break;
        }
        case "droplet": {
          const length = particle.vy < 0 ? 2 : 1;
          ctx.fillRect(x, y, 1, length);
          break;
        }
        case "bubble": {
          if (particle.size > 1) {
            ctx.fillRect(x, y, 2, 1);
            ctx.fillRect(x, y + 1, 1, 1);
            ctx.fillRect(x + 1, y + 1, 1, 1);
          } else {
            ctx.fillRect(x, y, 1, 1);
          }
          break;
        }
        case "petal": {
          ctx.fillRect(x, y, particle.size === 2 ? 2 : 1, 1);
          if (particle.size === 2) ctx.fillRect(x + 1, y + 1, 1, 1);
          break;
        }
        case "fluff": {
          const wobble = Math.sin(particle.age * 2.7 + particle.phase) > 0 ? 1 : -1;
          ctx.fillRect(x, y, 1, 1);
          ctx.fillRect(x + wobble, y - 1, 1, 1);
          ctx.fillRect(x - wobble, y - 1, 1, 1);
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillRect(x, y + 1, 1, 1);
          break;
        }
        case "spark": {
          const blink = Math.sin(particle.age * 10 + particle.phase) > -0.25;
          if (blink) {
            ctx.fillRect(x, y, 1, 1);
            ctx.fillRect(x - 1, y, 1, 1);
            ctx.fillRect(x + 1, y, 1, 1);
            ctx.fillRect(x, y - 1, 1, 1);
            ctx.fillRect(x, y + 1, 1, 1);
          }
          break;
        }
        case "note": {
          ctx.fillRect(x + 1, y, 1, 4);
          ctx.fillRect(x, y + 3, 2, 2);
          ctx.fillRect(x + 2, y + 1, 1, 1);
          break;
        }
        default:
          ctx.fillRect(x, y, particle.size, particle.size);
      }
    }
    ctx.restore();
  }
}
