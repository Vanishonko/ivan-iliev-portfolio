export const DAY = {
  petal: '#34422f',
  blush: '#a34e66',
  lip: '#84233a',
  lipDark: '#551428',
  gold: '#8a5c1f',
  stem: '#456043',
  leaf: '#385035',
  pot: '#6f4230',
  ink: '#2e382c',
  shadow: '#5f5040',
  glow: '#9e3348'
};

export const NIGHT = {
  petal: '#ffcfc2',
  blush: '#ff8fae',
  lip: '#ff4f7f',
  lipDark: '#7a1f3d',
  gold: '#ffd173',
  stem: '#9cc48f',
  leaf: '#7fae76',
  pot: '#b97a58',
  ink: '#f6ead6',
  shadow: '#3a2333',
  glow: '#e05a7c'
};

function parseColor(color) {
  if (color[0] === '#') {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0, 1];
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1];
}

function rgba([r, g, b, a]) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

export function lerpColor(a, b, t) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return rgba([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
    ca[3] + (cb[3] - ca[3]) * t
  ]);
}

export function paletteAt(t) {
  const out = {};
  for (const key of Object.keys(DAY)) out[key] = lerpColor(DAY[key], NIGHT[key], t);
  return out;
}

export function cssColor(color, alpha = 1) {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb')) return color;
  const [r, g, b] = parseColor(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);



