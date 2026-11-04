// A quiet full-page particle layer: dust and pollen by day, fireflies and
// spores by night. It lives behind the plate so the room never feels empty.
const MONO = '"Cascadia Mono", Consolas, monospace';

export class Ambient {
  constructor(canvas, { reduced = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = reduced;
    this.night = false;
    this.theme = 0;
    this.time = 0;
    this.running = false;
    this.last = 0;
    this.w = 1;
    this.h = 1;
    this.motes = [];
    this.resize();
    this.init();
    if (reduced) this.draw();
  }

  init() {
    const n = 72;
    this.motes = Array.from({ length: n }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.012,
      vy: -0.006 - Math.random() * 0.012,
      phase: Math.random() * Math.PI * 2,
      size: i % 9 === 0 ? 2 : 1,
      ch: i % 11 === 0 ? '*' : i % 7 === 0 ? '+' : i % 3 === 0 ? "'" : '.'
    }));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = 2;
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.reduced) this.draw();
  }

  setNight(night) {
    this.night = night;
    if (this.reduced) {
      this.theme = night ? 1 : 0;
      this.draw();
    }
  }

  start() {
    if (this.running || this.reduced) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!document.hidden) {
        this.update(dt);
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  update(dt) {
    this.time += dt;
    this.theme += ((this.night ? 1 : 0) - this.theme) * Math.min(1, dt * 2.2);
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.time * 0.3 + m.phase) * 0.006) * dt;
      m.y += m.vy * dt;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      if (m.x < -0.02) m.x = 1.02;
      if (m.x > 1.02) m.x = -0.02;
    }
  }

  draw() {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const t = this.reduced ? 8 : this.time;

    // a very soft wash so the empty page has depth
    const g = ctx.createRadialGradient(w * 0.28, h * 0.18, 10, w * 0.45, h * 0.4, Math.max(w, h) * 0.8);
    g.addColorStop(0, this.night ? 'rgba(126, 52, 88, 0.09)' : 'rgba(158, 51, 72, 0.025)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.font = '12px ' + MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of this.motes) {
      const x = m.x * w;
      const y = m.y * h;
      const twinkle = 0.55 + 0.45 * Math.sin(t * 0.7 + m.phase);
      if (this.night) {
        const a = (0.16 + 0.32 * twinkle) * this.theme;
        ctx.globalAlpha = a;
        ctx.fillStyle = m.size > 1 ? '#efc266' : '#f6ead6';
        if (m.size > 1) {
          ctx.save();
          ctx.shadowColor = '#efc266';
          ctx.shadowBlur = 8;
          ctx.fillText(m.ch, x, y);
          ctx.restore();
        } else {
          ctx.fillText(m.ch, x, y);
        }
      } else {
        ctx.globalAlpha = 0.13 + 0.12 * twinkle;
        ctx.fillStyle = '#5a513e';
        ctx.fillText(m.ch, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
}
