import { paletteAt, lerpColor, clamp, smoothstep, easeOutCubic } from './palette.js';

const T = {
  grow: 1.8,
  nightStart: 6.2,
  nightEnd: 8.8,
  reveal: 6.9
};

const MONO = '"Cascadia Mono", Consolas, "SFMono-Regular", Menlo, monospace';

function layerZ(layer) {
  if (layer.startsWith('bloom')) {
    const i = Number(layer.slice(5)) || 0;
    return [0.6, -0.4, 0.9, 0.2, 1.1, -0.2][i] ?? 0;
  }
  if (layer.startsWith('bud')) return 0.4;
  if (layer === 'stem') return 0;
  if (layer.startsWith('leaf')) return -1.4;
  if (layer === 'pot') return -1.8;
  return 0;
}

function bloomIndex(layer) {
  const m = layer.match(/^bloom(\d+)$/);
  return m ? Number(m[1]) : -1;
}
function budIndex(layer) {
  const m = layer.match(/^bud(\d+)$/);
  return m ? Number(m[1]) : -1;
}

export function bloomProgress(time, delay, reduced = false) {
  if (reduced) return 1;
  return smoothstep(delay, delay + 1.25, time);
}

export class OrchidScene {
  constructor(canvas, art, { reduced = false, onState = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.art = art;
    this.reduced = reduced;
    this.onState = onState;
    this.time = 0;
    this.theme = reduced ? 1 : 0;
    this.manualTheme = null;
    this.revealed = reduced;
    this.running = false;
    this.last = 0;
    this.acc = 0;
    this.yaw = 0;
    this.yawTarget = 0;
    this.yawVel = 0;
    this.pointerLean = 0;
    this.dragging = false;
    this.dragHint = false;
    this.particles = [];
    this.fireflies = [];
    this.petals = [];
    this.lastPetal = 0;
    this.cameraMode = 'full';
    this.camera = { x0: 0, y0: 0, w: art.cols, h: art.rows };
    this.w = 1; this.h = 1; this.font = 12;
    this.ox = 0; this.oy = 0;
    this.dpr = 1;
    this.coalesced = 0;
    this.initParticles();
    this.resize();
  }

  initParticles() {
    const cols = this.art.cols, rows = this.art.rows;
    const count = cols > 80 ? 44 : 28;
    this.particles = Array.from({ length: count }, (_, i) => ({
      x: 4 + ((i * 37) % Math.max(8, cols - 8)),
      y: 3 + ((i * 19) % Math.max(8, rows - 8)),
      vx: (i % 2 ? 1 : -1) * (0.08 + (i % 5) * 0.03),
      vy: -0.05 - (i % 7) * 0.02,
      phase: i * 1.7,
      ch: i % 5 === 0 ? '+' : i % 3 === 0 ? "'" : '.'
    }));
    this.fireflies = Array.from({ length: 10 }, (_, i) => ({
      x: 5 + ((i * 23) % Math.max(10, cols - 10)),
      y: 5 + ((i * 13) % Math.max(10, rows - 10)),
      phase: i * 2.1,
      ch: i % 3 === 0 ? '*' : '+'
    }));
  }

  setCamera(mode = 'full') {
    this.cameraMode = mode;
    if (mode === 'close') {
      const b = this.art.blooms[0] || { cx: this.art.cols / 2, cy: this.art.rows / 2 };
      const w = Math.min(58, this.art.cols);
      const h = Math.min(34, this.art.rows);
      const x0 = clamp(b.cx - w * 0.5, 0, this.art.cols - w);
      const y0 = clamp(b.cy - b.ry - 1, 0, this.art.rows - h);
      this.camera = { x0, y0, w, h };
    } else {
      this.camera = { x0: 0, y0: 0, w: this.art.cols, h: this.art.rows };
    }
    this.resize();
    if (this.reduced) this.draw();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    // Supersample the text so 1px ASCII strokes stay crisp when scaled down.
    const dpr = 2;
    this.dpr = dpr;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = this.camera;
    const padX = Math.min(18, w * 0.03);
    const padY = Math.min(14, h * 0.03);
    const captionInset = Math.min(28, Math.max(20, h * 0.05));
    const usableH = h - captionInset;
    const font = Math.min((w - padX * 2) / (cam.w * 0.62), (usableH - padY * 2) / (cam.h * 1.16));
    this.font = Math.max(5.5, font);
    this.cw = this.font * 0.62;
    this.ch = this.font * 1.16;
    this.ox = (w - cam.w * this.cw) / 2 - cam.x0 * this.cw;
    this.oy = (usableH - cam.h * this.ch) / 2 - cam.y0 * this.ch;
    if (this.reduced) this.draw();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!document.hidden) {
        this.update(dt);
        this.acc += dt;
        if (this.acc >= 1 / 30) {
          this.acc = 0;
          this.draw();
        }
      }
      requestAnimationFrame(this.loop);
    };
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.time = 0;
    this.theme = this.reduced ? 1 : 0;
    this.manualTheme = null;
    this.revealed = this.reduced;
    this.yaw = 0;
    this.yawTarget = 0;
    this.yawVel = 0;
    this.pointerLean = 0;
    this.petals = [];
    this.lastPetal = 0;
    this.initParticles();
    this.emit(true);
    if (this.reduced) this.draw();
  }

  setManualTheme(value) {
    this.manualTheme = value;
    this.revealed = true;
    if (value > 0.5 && this.time < T.nightEnd) this.time = T.nightEnd + 0.2;
    this.emit(true);
    if (this.reduced) {
      this.theme = value;
      this.draw();
    }
  }

  clearManualTheme() {
    this.manualTheme = null;
    this.emit(true);
  }

  emit(force = false) {
    const night = this.manualTheme !== null
      ? this.manualTheme > 0.5
      : this.time >= T.nightStart || this.theme > 0.5;
    if (force || night !== this._night || this.revealed !== this._revealed) {
      this._night = night;
      this._revealed = this.revealed;
      this.onState({ night, revealed: this.revealed });
    }
  }

  update(dt) {
    if (this.reduced) return;
    this.time += dt;
    const autoTheme = smoothstep(T.nightStart, T.nightEnd, this.time);
    const target = this.manualTheme !== null ? this.manualTheme : autoTheme;
    this.theme += (target - this.theme) * Math.min(1, dt * 3.2);
    if (this.manualTheme === null && this.time >= T.reveal) this.revealed = true;

    // yaw spring
    const targetYaw = this.yawTarget + this.pointerLean;
    const k = 38, damp = 0.84;
    this.yawVel += (targetYaw - this.yaw) * k * dt;
    this.yawVel *= Math.pow(damp, dt * 60);
    this.yaw += this.yawVel * dt;
    this.yaw = clamp(this.yaw, -30, 30);

    // particles
    for (const p of this.particles) {
      p.x += (p.vx + Math.sin(this.time * 0.6 + p.phase) * 0.025) * dt;
      p.y += p.vy * dt;
      if (p.y < 1) { p.y = this.art.rows - 2; p.x = 4 + Math.random() * (this.art.cols - 8); }
      if (p.x < 1) p.x = this.art.cols - 2;
      if (p.x > this.art.cols - 1) p.x = 2;
    }
    for (const f of this.fireflies) {
      f.x += Math.sin(this.time * 0.22 + f.phase) * 0.018;
      f.y += Math.cos(this.time * 0.17 + f.phase * 1.3) * 0.012;
      f.x = clamp(f.x, 3, this.art.cols - 4);
      f.y = clamp(f.y, 3, this.art.rows - 6);
    }

    // a single petal falls after the reveal
    if (this.time > 8.4 && this.time - this.lastPetal > 11) {
      this.lastPetal = this.time;
      const b = this.art.blooms[0] || { cx: this.art.cols / 2, cy: this.art.rows / 2 };
      this.petals.push({ x: b.cx, y: b.cy, vx: 0.5 + Math.random() * 0.4, vy: 0.4, rot: 0, life: 0 });
    }
    for (const p of this.petals) {
      p.life += dt;
      p.vy += 0.12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 1.2;
      if (p.y > this.art.rows - 3) p.vy *= -0.18;
    }
    this.petals = this.petals.filter((p) => p.life < 14);

    this.emit();
  }

  bloomOpen(b) {
    return bloomProgress(this.time, b.delay, this.reduced);
  }

  budOpen(b, i) {
    if (this.reduced) return 1;
    return smoothstep(4.6 + i * 0.5, 5.6 + i * 0.5, this.time);
  }

  draw() {
    const { ctx, w, h, art } = this;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const pal = paletteAt(this.theme);
    const cols = art.cols, rows = art.rows;
    const cam = this.camera;
    const font = this.font;
    ctx.font = `700 ${font}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // glow behind the specimen
    const cx = this.ox + (cam.x0 + cam.w / 2) * this.cw;
    const cy = this.oy + (cam.y0 + cam.h / 2) * this.ch;
    const radius = Math.max(w, h) * 0.52;
    const glow = ctx.createRadialGradient(cx, cy, font, cx, cy, radius);
    glow.addColorStop(0, this.theme > 0.5 ? `rgba(224, 90, 124, ${0.10 * this.theme})` : 'rgba(158, 51, 72, 0.035)');
    glow.addColorStop(0.55, this.theme > 0.5 ? `rgba(89, 30, 62, ${0.06 * this.theme})` : 'rgba(158, 51, 72, 0.012)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // soft shadow under the pot
    const shadowY = this.oy + rows * this.ch * 0.90;
    const sh = ctx.createRadialGradient(cx, shadowY, 2, cx, shadowY, w * 0.24);
    sh.addColorStop(0, this.theme > 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(90, 70, 40, 0.10)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, w, h);

    // soft wash behind each bloom, so the line work has body
    if (this.theme > 0.02 || this.reduced) {
      ctx.save();
      ctx.filter = 'blur(12px)';
      for (let bi = 0; bi < art.blooms.length; bi++) {
        if (this.cameraMode === 'close' && bi > 0) continue;
        const b = art.blooms[bi];
        const bx = this.ox + (b.cx + 0.5) * this.cw;
        const by = this.oy + (b.cy + 0.5) * this.ch;
        const r = Math.max(b.rx * this.cw, b.ry * this.ch) * 1.15;
        const wash = ctx.createRadialGradient(bx, by, 2, bx, by, r);
        if (this.theme > 0.4) {
          wash.addColorStop(0, `rgba(224, 90, 124, ${0.16 * this.theme})`);
          wash.addColorStop(0.55, `rgba(246, 234, 214, ${0.06 * this.theme})`);
        } else {
          wash.addColorStop(0, 'rgba(157, 95, 98, 0.06)');
          wash.addColorStop(0.55, 'rgba(122, 75, 56, 0.03)');
        }
        wash.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wash;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const time = this.time;
    const sway = Math.sin(time * 0.55) * 0.35 + Math.sin(time * 0.27 + 1.4) * 0.18;
    const yawRad = (this.yaw * Math.PI) / 180;

    for (const cell of art.cells) {
      let { x, y } = cell;
      const layer = cell.layer;
      const bIdx = bloomIndex(layer);
      const uIdx = budIndex(layer);
      let alpha = 1;
      let bloomRaw = 1;

      if (bIdx > 0 && this.cameraMode === 'close') continue;

      if (bIdx >= 0) {
        const b = art.blooms[bIdx];
        if (!this.reduced && time < 1.5) continue;
        const raw = this.bloomOpen(b);
        bloomRaw = raw;
        const open = Math.max(0.06, raw);
        const scale = 0.16 + 0.84 * open;
        x = b.cx + (x - b.cx) * scale;
        y = b.cy + (y - b.cy) * scale;
        alpha = raw < 0.08 ? 0.55 : Math.min(1, open * 1.4);
      } else if (uIdx >= 0) {
        const b = art.buds[uIdx];
        if (!this.reduced && time < 1.8) continue;
        const raw = this.budOpen(b, uIdx);
        const open = Math.max(0.06, raw);
        const scale = 0.18 + 0.82 * open;
        x = b.cx + (x - b.cx) * scale;
        y = b.cy + (y - b.cy) * scale;
        alpha = raw < 0.08 ? 0.55 : Math.min(1, open * 1.5);
      } else {
        const grow = this.reduced ? 1 : smoothstep(0, T.grow, time - (rows - y) * 0.018);
        if (grow <= 0.01) continue;
        alpha = Math.min(1, grow * 1.2);
      }

      // 2.5D turn: near layers move more; keep characters upright
      const z = layerZ(layer);
      const shift = Math.sin(yawRad) * z * 2.2;
      const scale3d = 1 + Math.cos(yawRad) * z * 0.012;
      x = cols / 2 + (x - cols / 2) * scale3d + shift;
      const drift = sway * (0.35 + (rows - y) / rows * 0.65);
      x += drift;
      if (layer.startsWith('leaf')) x += Math.sin(time * 0.8 + (layer === 'leaf-r' ? 2 : 0)) * 0.25 * (rows - y) * 0.03;
      if (layer.startsWith('stem')) x += Math.sin(time * 0.45 + y * 0.18) * 0.16;

      if (x < cam.x0 - 1 || x > cam.x0 + cam.w + 1 || y < cam.y0 - 1 || y > cam.y0 + cam.h + 1) continue;

      let color = pal[cell.key] || pal.ink;
      if (bIdx >= 0 && bloomRaw < 0.3 && (cell.key === 'lip' || cell.key === 'lipDark' || cell.key === 'gold')) {
        color = pal.blush;
      }
      if (cell.shade) color = lerpColor(color, pal.shadow, cell.shade * 0.55);
      if (this.theme > 0.45 && cell.key === 'gold') color = pal.gold;

      // a slow light wave across the night bloom
      if (this.theme > 0.55 && (cell.key === 'petal' || cell.key === 'blush' || cell.key === 'lip')) {
        const wave = ((time * 0.16) % 1.6) - 0.3;
        const pos = (x / cols) * 0.7 + (y / rows) * 0.3;
        const d = Math.abs(pos - wave);
        if (d < 0.05) {
          const k = (1 - d / 0.05) * this.theme * 0.35;
          if (k > 0.04) color = lerpColor(color, pal.petal, k);
        }
      }

      const px = this.ox + (x + 0.5) * this.cw;
      const py = this.oy + (y + 0.5) * this.ch;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillText(cell.ch, px, py);
      if (!'.,:;`\'"'.includes(cell.ch)) {
        ctx.globalAlpha = alpha * 0.26;
        ctx.fillText(cell.ch, px + 0.35, py + 0.35);
      }
    }
    ctx.globalAlpha = 1;

    // pollen
    if (!this.reduced && (this.theme < 0.95 || time < 9)) {
      ctx.font = `${Math.max(8, font * 0.72)}px ${MONO}`;
      for (const p of this.particles) {
        if (p.x < cam.x0 - 1 || p.x > cam.x0 + cam.w + 1 || p.y < cam.y0 - 1 || p.y > cam.y0 + cam.h + 1) continue;
        const a = (0.35 + 0.3 * Math.sin(time * 1.1 + p.phase)) * (this.theme > 0.5 ? 0.9 : 0.55);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = this.theme > 0.5 ? pal.gold : pal.ink;
        ctx.fillText(p.ch, this.ox + (p.x + 0.5) * this.cw, this.oy + (p.y + 0.5) * this.ch);
      }
      ctx.globalAlpha = 1;
    }

    // fireflies
    if (!this.reduced && this.theme > 0.35) {
      const a = (this.theme - 0.35) * 1.5;
      ctx.save();
      ctx.shadowColor = pal.gold;
      ctx.shadowBlur = 9;
      ctx.font = `${Math.max(8, font * 0.8)}px ${MONO}`;
      for (const f of this.fireflies) {
        if (f.x < cam.x0 - 1 || f.x > cam.x0 + cam.w + 1 || f.y < cam.y0 - 1 || f.y > cam.y0 + cam.h + 1) continue;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.9 + f.phase));
        ctx.globalAlpha = Math.min(1, a * tw);
        ctx.fillStyle = pal.gold;
        ctx.fillText(f.ch, this.ox + (f.x + 0.5) * this.cw, this.oy + (f.y + 0.5) * this.ch);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // falling petals
    if (!this.reduced) {
      ctx.font = `${Math.max(9, font * 0.85)}px ${MONO}`;
      for (const p of this.petals) {
        const ch = Math.sin(p.rot) > 0 ? ')' : '(';
        ctx.globalAlpha = 0.8 * Math.min(1, (14 - p.life) / 2);
        ctx.fillStyle = pal.blush;
        ctx.fillText(ch, this.ox + (p.x + 0.5) * this.cw, this.oy + (p.y + 0.5) * this.ch);
      }
      ctx.globalAlpha = 1;
    }
  }

  burst() {
    if (this.reduced) return;
    const b = this.art.blooms[0] || { cx: this.art.cols / 2, cy: this.art.rows / 2 };
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: b.cx, y: b.cy,
        vx: (Math.random() - 0.5) * 1.7,
        vy: (Math.random() - 0.5) * 1.1 - 0.2,
        phase: Math.random() * 6,
        ch: i % 3 === 0 ? '+' : i % 2 === 0 ? "'" : '.'
      });
    }
    if (this.particles.length > 90) this.particles.splice(0, this.particles.length - 90);
  }

  setPointer(x, y, rect) {
    if (this.dragging) return;
    const nx = clamp((x - rect.left) / rect.width, 0, 1);
    this.pointerLean = (nx - 0.5) * 5;
  }

  beginDrag(x) {
    this.dragging = true;
    this.dragStartX = x;
    this.dragStartYaw = this.yaw;
  }

  moveDrag(x, width) {
    if (!this.dragging) return;
    const dx = x - this.dragStartX;
    this.yawTarget = clamp(this.dragStartYaw + (dx / width) * 90, -28, 28);
    this.dragHint = true;
  }

  endDrag() {
    this.dragging = false;
    this.yawTarget = 0;
  }
}

export const TIMELINE = T;
