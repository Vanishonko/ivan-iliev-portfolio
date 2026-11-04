import { paletteAt, lerpColor, clamp, smoothstep, easeOutCubic } from './palette.js';

const T = {
  grow: 1.8,
  nightStart: 6.2,
  nightEnd: 8.8,
  reveal: 6.9
};

const MONO = '"Cascadia Mono", Consolas, "SFMono-Regular", Menlo, monospace';
const rad = (d) => (d * Math.PI) / 180;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const gauss = (d, w) => Math.exp(-0.5 * (d / w) ** 2);
const PETAL_ANGLES = [90, 30, 150, 212, 328];

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
    this.occupied = Array.from({ length: art.rows }, () => Array(art.cols).fill(false));
    for (const c of art.cells) this.occupied[c.y][c.x] = true;
    this.initBloomPhysics();
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
    this.pitch = 0;
    this.pitchTarget = 0;
    this.pitchVel = 0;
    this.particles = [];
    this.fireflies = [];
    this.petals = [];
    this.hearts = [];
    this.heartsSpawned = false;
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

  initBloomPhysics() {
    this.bphysics = this.art.blooms.map((b, i) => ({
      x: 0, y: 0, vx: 0, vy: 0,
      rot: 0, vrot: 0,
      phase: i * 2.13 + 0.7
    }));
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

  setArt(art, cameraMode = 'full') {
    this.art = art;
    this.occupied = Array.from({ length: art.rows }, () => Array(art.cols).fill(false));
    for (const c of art.cells) this.occupied[c.y][c.x] = true;
    this.initBloomPhysics();
    this.cameraMode = cameraMode;
    this.setCamera(cameraMode);
    this.initParticles();
  }

  setCamera(mode = 'full') {
    this.cameraMode = mode;
    if (mode === 'close') {
      const b = this.art.blooms[0] || { cx: this.art.cols / 2, cy: this.art.rows / 2, w: 34, h: 18 };
      const w = Math.min((b.w || 34) + 14, this.art.cols);
      const h = Math.min((b.h || 18) + 14, this.art.rows);
      const x0 = clamp(b.cx - w * 0.5, 0, this.art.cols - w);
      const y0 = clamp(b.cy - h * 0.45, 0, this.art.rows - h);
      this.camera = { x0, y0, w, h };
    } else {
      const b = this.art.bounds || { x0: 0, y0: 0, w: this.art.cols, h: this.art.rows };
      const pad = 3;
      const x0 = clamp(b.x0 - pad, 0, this.art.cols - 1);
      const y0 = clamp(b.y0 - pad, 0, this.art.rows - 1);
      const x1 = clamp(b.x0 + b.w - 1 + pad, 0, this.art.cols - 1);
      const y1 = clamp(b.y0 + b.h - 1 + pad, 0, this.art.rows - 1);
      this.camera = { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
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
    this.font = Math.max(2.5, font);
    this.cw = this.font * 0.62;
    this.ch = this.font * 1.16;
    this.ox = (w - cam.w * this.cw) / 2 - cam.x0 * this.cw;
    const mobileBias = w < 700 ? Math.min(84, Math.max(0, (usableH - cam.h * this.ch) * 0.34)) : 0;
    this.oy = (usableH - cam.h * this.ch) / 2 - cam.y0 * this.ch - mobileBias;
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
    this.pitch = 0;
    this.pitchTarget = 0;
    this.pitchVel = 0;
    this.petals = [];
    this.hearts = [];
    this.heartsSpawned = false;
    this.lastPetal = 0;
    this.initBloomPhysics();
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
    if (this.revealed && !this.heartsSpawned) {
      this.heartsSpawned = true;
      const b = this.art.blooms[0] || { cx: this.art.cols / 2, cy: this.art.rows / 3 };
      this.hearts = Array.from({ length: 10 }, (_, i) => ({
        x: b.cx + (Math.random() - 0.5) * 18,
        y: b.cy + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.3,
        phase: i * 1.9,
        life: 0
      }));
    }

    // yaw spring
    const targetYaw = this.yawTarget + this.pointerLean;
    const k = 38, damp = 0.84;
    this.yawVel += (targetYaw - this.yaw) * k * dt;
    this.yawVel *= Math.pow(damp, dt * 60);
    this.yaw += this.yawVel * dt;
    this.yaw = clamp(this.yaw, -55, 55);

    this.pitchVel += (this.pitchTarget - this.pitch) * 30 * dt;
    this.pitchVel *= Math.pow(0.86, dt * 60);
    this.pitch += this.pitchVel * dt;
    this.pitch = clamp(this.pitch, -20, 20);

    // each flower has its own spring: it lags the plant, sways on its own
    // phase, and takes a separate kick from clicks and drags.
    const yr = (this.yaw * Math.PI) / 180;
    const pr = (this.pitch * Math.PI) / 180;
    for (const p of this.bphysics) {
      const tx = Math.sin(yr) * 0.55 + Math.sin(this.time * 0.8 + p.phase) * 0.12;
      const ty = Math.sin(pr) * 0.35 + Math.cos(this.time * 0.7 + p.phase) * 0.08;
      const tr = Math.sin(yr) * 0.035 + Math.sin(this.time * 0.9 + p.phase) * 0.008;
      p.vx += (tx - p.x) * 26 * dt;
      p.vx *= Math.pow(0.84, dt * 60);
      p.x += p.vx * dt;
      p.vy += (ty - p.y) * 24 * dt;
      p.vy *= Math.pow(0.84, dt * 60);
      p.y += p.vy * dt;
      p.vrot += (tr - p.rot) * 22 * dt;
      p.vrot *= Math.pow(0.82, dt * 60);
      p.rot += p.vrot * dt;
      p.x = clamp(p.x, -2.8, 2.8);
      p.y = clamp(p.y, -2.2, 2.2);
      p.rot = clamp(p.rot, -0.20, 0.20);
    }

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

    for (const h of this.hearts) {
      h.life += dt;
      h.x += (h.vx + Math.sin(this.time * 0.8 + h.phase) * 0.12) * dt;
      h.y += h.vy * dt;
    }
    this.hearts = this.hearts.filter((h) => h.life < 7);

    this.emit();
  }

  bloomOpen(b) {
    return bloomProgress(this.time, b.delay, this.reduced);
  }

  budOpen(b, i) {
    if (this.reduced) return 1;
    return smoothstep(4.6, 5.6, this.time);
  }

  drawBloomTexture(pal) {
    const { ctx, art } = this;
    const cam = this.camera;
    for (let bi = 0; bi < art.blooms.length; bi++) {
      if (this.cameraMode === 'close' && bi > 0) continue;
      const b = art.blooms[bi];
      const open = this.bloomOpen(b);
      if (open < 0.18) continue;
      const scale = 0.34 + 0.66 * open;
      const rx = b.rx || 16;
      const ry = b.ry || 8;
      for (let y = b.y0; y <= b.y0 + b.h; y++) {
        for (let x = b.x0; x <= b.x0 + b.w; x++) {
          if (x < 0 || x >= art.cols || y < 0 || y >= art.rows) continue;
          if (this.occupied[y][x]) continue;
          const dx = (x - b.cx) / rx;
          const dy = (y - b.cy) / ry;
          const rr = Math.hypot(dx, dy);
          const th = Math.atan2(-dy, dx);
          let R = 0.48;
          for (const a of PETAL_ANGLES) R += 0.20 * gauss(angDiff(th, rad(a)), 0.34);
          if (rr > R * 0.96) continue;
          const h = (x * 13 + y * 29 + bi * 7) % 100;
          let ch = '';
          let vein = false;
          for (const a of PETAL_ANGLES) {
            if (Math.abs(angDiff(th, rad(a))) < 0.07 && rr > 0.25 && rr < 0.88) { vein = true; break; }
          }
          if (vein && h < 42) ch = h % 3 === 0 ? "'" : '.';
          else if (h < (rr < 0.55 ? 14 : 8)) ch = h % 3 === 0 ? ':' : '.';
          if (!ch) continue;
          const sx = b.cx + (x - b.cx) * scale;
          const sy = b.cy + (y - b.cy) * scale;
          if (sx < cam.x0 - 1 || sx > cam.x0 + cam.w + 1 || sy < cam.y0 - 1 || sy > cam.y0 + cam.h + 1) continue;
          ctx.globalAlpha = (this.theme > 0.5 ? 0.30 : 0.20) * Math.min(1, open * 1.5);
          ctx.fillStyle = this.theme > 0.5 ? pal.blush : pal.ink;
          ctx.fillText(ch, this.ox + (sx + 0.5) * this.cw, this.oy + (sy + 0.5) * this.ch);
        }
      }
    }
    ctx.globalAlpha = 1;
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
    const pitchRad = (this.pitch * Math.PI) / 180;
    const ops = [];

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
        const p = this.bphysics[bIdx];
        if (p) {
          const rx = x - b.cx;
          const ry = y - b.cy;
          const ca = Math.cos(p.rot);
          const sa = Math.sin(p.rot);
          x = b.cx + rx * ca - ry * sa + p.x;
          y = b.cy + rx * sa + ry * ca + p.y;
        }
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

      // depth: the lip and column sit in front, the leaves and pot behind
      let depth = layerZ(layer);
      if (cell.key === 'lip' || cell.key === 'lipDark' || cell.key === 'gold') depth += 0.9;
      else if (cell.key === 'petal' || cell.key === 'blush') depth += 0.25;
      else if (cell.key === 'leaf') depth -= 0.7;
      else if (cell.key === 'pot') depth -= 1.3;

      const shift = Math.sin(yawRad) * depth * 3.0;
      const scale3d = 1 + Math.cos(yawRad) * depth * 0.012;
      x = cols / 2 + (x - cols / 2) * scale3d + shift;
      y += Math.sin(pitchRad) * depth * 1.8;
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

      ops.push({
        x, y, depth,
        ch: cell.ch,
        color,
        alpha,
        key: cell.key,
        stipple: '.,:;`\'"'.includes(cell.ch)
      });
    }

    const yawS = Math.sin(yawRad);
    const pitchS = Math.sin(pitchRad);

    // back stacked characters: the extrusion, in shadow
    for (const op of ops) {
      if (op.stipple) continue;
      const px = this.ox + (op.x + 0.5 - yawS * op.depth * 2.6 + 0.45) * this.cw;
      const py = this.oy + (op.y + 0.5 - pitchS * op.depth * 1.9 + 0.45) * this.ch;
      ctx.globalAlpha = op.alpha * 0.20;
      ctx.fillStyle = this.theme > 0.5 ? pal.lipDark : pal.ink;
      ctx.fillText(op.ch, px, py);
    }

    // ink
    for (const op of ops) {
      const px = this.ox + (op.x + 0.5) * this.cw;
      const py = this.oy + (op.y + 0.5) * this.ch;
      ctx.globalAlpha = op.alpha;
      ctx.fillStyle = op.color;
      ctx.fillText(op.ch, px, py);
    }

    // front stacked characters: the lit edge of the extrusion
    for (const op of ops) {
      if (op.stipple) continue;
      const px = this.ox + (op.x + 0.5 + yawS * op.depth * 1.6 - 0.4) * this.cw;
      const py = this.oy + (op.y + 0.5 + pitchS * op.depth * 1.2 - 0.4) * this.ch;
      ctx.globalAlpha = op.alpha * (this.theme > 0.5 ? 0.18 : 0.10);
      ctx.fillStyle = pal.gold;
      ctx.fillText(op.ch, px, py);
    }
    ctx.globalAlpha = 1;

    // the orchid's signature: a lit column, pollinia and a three-lobed lip
    // sit on top of the plate so the flower cannot be mistaken for a daisy.
    ctx.save();
    ctx.font = `${font * 1.06}px ${MONO}`;
    ctx.shadowBlur = this.theme > 0.5 ? 7 : 0;
    for (const op of ops) {
      if (op.key !== 'lip' && op.key !== 'lipDark' && op.key !== 'gold') continue;
      const px = this.ox + (op.x + 0.5) * this.cw;
      const py = this.oy + (op.y + 0.5) * this.ch;
      ctx.globalAlpha = op.alpha * 0.95;
      ctx.fillStyle = op.color;
      ctx.shadowColor = op.key === 'gold' ? pal.gold : pal.glow;
      ctx.fillText(op.ch, px, py);
    }
    ctx.restore();
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

    // the reveal gets a small burst of hearts
    if (!this.reduced && this.hearts.length) {
      ctx.save();
      ctx.font = `${Math.max(11, font * 0.95)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = pal.lip;
      ctx.shadowBlur = 7;
      for (const h of this.hearts) {
        const a = Math.sin((Math.PI * h.life) / 7) * 0.85;
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = h.phase % 2 > 1 ? pal.gold : pal.lip;
        ctx.fillText('♡', this.ox + (h.x + 0.5) * this.cw, this.oy + (h.y + 0.5) * this.ch);
      }
      ctx.restore();
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
    for (const p of this.bphysics) {
      p.vx += (Math.random() - 0.5) * 1.25;
      p.vy += (Math.random() - 0.5) * 0.9;
      p.vrot += (Math.random() - 0.5) * 0.12;
    }
  }

  setPointer(x, y, rect) {
    if (this.dragging) return;
    const nx = clamp((x - rect.left) / rect.width, 0, 1);
    this.pointerLean = (nx - 0.5) * 5;
  }

  beginDrag(x, y = 0) {
    this.dragging = true;
    this.dragStartX = x;
    this.dragStartY = y;
    this.dragStartYaw = this.yaw;
    this.dragStartPitch = this.pitch;
    this.lastDragX = x;
  }

  moveDrag(x, width, y = 0, height = 1) {
    if (!this.dragging) return;
    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;
    this.yawTarget = clamp(this.dragStartYaw + (dx / width) * 150, -50, 50);
    this.pitchTarget = clamp(this.dragStartPitch - (dy / height) * 55, -20, 20);
    const step = x - (this.lastDragX ?? x);
    this.lastDragX = x;
    for (const p of this.bphysics) {
      p.vx += (step / width) * 1.5 * (0.65 + Math.random() * 0.7);
      p.vrot += (step / width) * 0.055 * (Math.random() - 0.5);
    }
    this.dragHint = true;
  }

  endDrag() {
    this.dragging = false;
    this.yawTarget = 0;
    this.pitchTarget = 0;
    this.lastDragX = null;
  }
}

export const TIMELINE = T;

