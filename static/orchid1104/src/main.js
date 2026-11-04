import { ART_HD } from './art-hd.js';
import { OrchidScene } from './scene.js';

const canvas = document.getElementById('scene');
const body = document.body;
const replay = document.getElementById('replay');
const themeBtn = document.getElementById('theme');
const cameraBtn = document.getElementById('camera');
const hint = document.getElementById('hint');
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopQuery = window.matchMedia('(min-width: 760px)');
const reduced = reducedQuery.matches;
const artForPage = ART_HD;
document.querySelector('.plate-meta').textContent = `ASCII · ${artForPage.cols} × ${artForPage.rows}`;

const scene = new OrchidScene(canvas, artForPage, {
  reduced,
  onState: ({ night, revealed }) => {
    body.classList.toggle('is-night', night);
    body.classList.toggle('is-revealed', revealed);
    themeBtn.textContent = night ? '[ day ]' : '[ night ]';
    themeBtn.setAttribute('aria-pressed', String(night));
    document.querySelector('meta[name="theme-color"]').setAttribute('content', night ? '#0b0910' : '#f6efe0');
  }
});

scene.emit(true);
if (reduced) {
  body.classList.add('is-night', 'is-revealed');
  themeBtn.textContent = '[ day ]';
  themeBtn.setAttribute('aria-pressed', 'true');
}
if (!reduced) scene.start();

// The gift opens on a large, readable close-up; the button reveals the whole spray.
cameraBtn.hidden = false;
scene.setCamera('close');
cameraBtn.textContent = '[ full plant ]';
cameraBtn.addEventListener('click', () => {
  const next = scene.cameraMode === 'close' ? 'full' : 'close';
  scene.setCamera(next);
  cameraBtn.textContent = next === 'close' ? '[ full plant ]' : '[ close-up ]';
});

// controls
replay.addEventListener('click', () => {
  scene.reset();
  body.classList.remove('is-night', 'is-revealed');
  if (reduced) {
    body.classList.add('is-night', 'is-revealed');
  }
  themeBtn.textContent = reduced ? '[ day ]' : '[ night ]';
  themeBtn.setAttribute('aria-pressed', String(reduced));
  hint.classList.remove('is-hidden');
  window.setTimeout(() => hint.classList.add('is-hidden'), 7000);
});

themeBtn.addEventListener('click', () => {
  const night = !body.classList.contains('is-night');
  scene.setManualTheme(night ? 1 : 0);
  body.classList.toggle('is-night', night);
  body.classList.add('is-revealed');
  themeBtn.textContent = night ? '[ day ]' : '[ night ]';
  themeBtn.setAttribute('aria-pressed', String(night));
});

// pointer: lean, drag to turn, click for pollen
let downX = 0, downY = 0, moved = 0, dragging = false;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  moved = 0;
  downX = e.clientX;
  downY = e.clientY;
  canvas.setPointerCapture?.(e.pointerId);
  scene.beginDrag(e.clientX, e.clientY);
  body.classList.add('is-touched');
});

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  if (dragging) {
    moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    scene.moveDrag(e.clientX, rect.width, e.clientY, rect.height);
    if (moved > 8) hint.classList.add('is-hidden');
  } else {
    scene.setPointer(e.clientX, e.clientY, rect);
  }
});

function release(e) {
  if (!dragging) return;
  dragging = false;
  scene.endDrag();
  if (moved < 7) scene.burst();
  if (e?.pointerId != null) canvas.releasePointerCapture?.(e.pointerId);
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => {
  if (!dragging) scene.pointerLean = 0;
});

// keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') replay.click();
  if (e.key === 'd' || e.key === 'D') themeBtn.click();
});

// hint
window.setTimeout(() => hint.classList.add('is-hidden'), 9000);

// static copy for assistive tech, and a no-JS-ish fallback
const rows = Array.from({ length: artForPage.rows }, () => Array(artForPage.cols).fill(' '));
for (const c of artForPage.cells) rows[c.y][c.x] = c.ch;
document.getElementById('static-art').textContent = rows.map((r) => r.join('').replace(/\s+$/, '')).join('\n');

// resize
const ro = new ResizeObserver(() => scene.resize());
ro.observe(canvas.parentElement);
window.addEventListener('resize', () => scene.resize());

// if the motion preference changes, reload into the right version
reducedQuery.addEventListener?.('change', () => location.reload());
// the desktop plate and the phone plate are different drawings
desktopQuery.addEventListener?.('change', () => location.reload());

// expose for QA
window.__orchid = { scene, ART: artForPage, reduced };
