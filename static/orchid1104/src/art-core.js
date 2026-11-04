const STIPPLE = new Set(['.', ',', "'", '`', ':', ';']);
const BLOOM_KINDS = new Set(['P', 'L', 'G', 'C']);

function inBox(x, y, b, margin = 1) {
  return x >= b.x0 - margin && x <= b.x1 + margin && y >= b.y0 - margin && y <= b.y1 + margin;
}

function keyFor(layer, ch) {
  const stipple = STIPPLE.has(ch);
  if (layer === 'P') return { key: stipple ? 'blush' : 'petal', shade: stipple ? 0.35 : 0 };
  if (layer === 'L') {
    if (ch === '*' || ch === '+' || ch === '#') return { key: 'lipDark', shade: 0.15 };
    return { key: 'lip', shade: 0 };
  }
  if (layer === 'G') return { key: 'gold', shade: 0 };
  if (layer === 'C') return { key: ch === '*' ? 'gold' : 'petal', shade: 0.1 };
  if (layer === 'B') return { key: 'stem', shade: stipple ? 0.3 : 0.1 };
  if (layer === 'S') return { key: 'stem', shade: stipple ? 0.25 : 0 };
  if (layer === 'V') return { key: 'leaf', shade: stipple ? 0.45 : 0 };
  if (layer === 'T') return { key: ch === '_' || ch === '-' ? 'gold' : 'pot', shade: 0.2 };
  return { key: 'ink', shade: 0 };
}

function leafLayer(leafEls, x, y) {
  for (const e of leafEls) {
    if (!inBox(x, y, e.bbox, 2)) continue;
    if (e.id.includes('front')) return 'leaf-f';
    if (e.id.includes('left')) return 'leaf-l';
    if (e.id.includes('right')) return 'leaf-r';
  }
  return x < 32 ? 'leaf-l' : 'leaf-r';
}

export function parseArt({ text, layers, elements }, { bloomGap = 0.55 } = {}) {
  const rows = text.length;
  const cols = Math.max(...text.map((r) => r.length));
  const bloomEls = elements.filter((e) => e.kind === 'bloom');
  const budEls = elements.filter((e) => e.kind === 'bud');
  const leafEls = elements.filter((e) => e.kind === 'leaf');
  const stemEl = elements.find((e) => e.kind === 'stem');
  const heroEl = elements.find((e) => e.kind === 'hero');

  const findBloom = (x, y) => {
    for (let i = 0; i < bloomEls.length; i++) if (inBox(x, y, bloomEls[i].bbox)) return i;
    return -1;
  };
  const findBud = (x, y) => {
    for (let i = 0; i < budEls.length; i++) if (inBox(x, y, budEls[i].bbox)) return i;
    return -1;
  };

  const cells = [];
  for (let y = 0; y < rows; y++) {
    const line = text[y] || '';
    const mask = layers[y] || '';
    for (let x = 0; x < cols; x++) {
      const ch = line[x] || ' ';
      const layer = mask[x] || '.';
      if (ch === ' ' || layer === '.') continue;
      let animLayer = '';
      if (BLOOM_KINDS.has(layer)) {
        const b = findBloom(x, y);
        if (b >= 0) animLayer = `bloom${b}`;
      } else if (layer === 'B') {
        const b = findBud(x, y);
        if (b >= 0) animLayer = `bud${b}`;
      } else if (layer === 'S') {
        animLayer = 'stem';
      } else if (layer === 'V') {
        animLayer = leafLayer(leafEls, x, y);
      } else if (layer === 'T') {
        animLayer = 'pot';
      }
      const { key, shade } = keyFor(layer, ch);
      cells.push({ x, y, ch, key, shade, layer: animLayer });
    }
  }

  const blooms = bloomEls.map((e, i) => ({    cx: e.center.x,
    cy: e.center.y,
    rx: e.bbox.w / 2 + 1,
    ry: e.bbox.h / 2 + 1,
    x0: e.bbox.x0,
    y0: e.bbox.y0,
    w: e.bbox.w,
    h: e.bbox.h,
    delay: 1.8 + i * bloomGap,
    layer: `bloom${i}`
  }));
  const buds = budEls.map((e, i) => ({
    cx: e.center.x,
    cy: e.center.y,
    rx: e.bbox.w / 2 + 1,
    ry: e.bbox.h / 2 + 1,
    layer: `bud${i}`
  }));

  let bx0 = cols, by0 = rows, bx1 = -1, by1 = -1;
  for (const c of cells) {
    bx0 = Math.min(bx0, c.x);
    by0 = Math.min(by0, c.y);
    bx1 = Math.max(bx1, c.x);
    by1 = Math.max(by1, c.y);
  }
  const bounds = cells.length
    ? { x0: bx0, y0: by0, x1: bx1, y1: by1, w: bx1 - bx0 + 1, h: by1 - by0 + 1 }
    : { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1, w: cols, h: rows };

  return {
    cols,
    rows,
    bounds,
    cells,
    blooms,
    buds,
    hero: heroEl ? { ...heroEl.bbox, cx: heroEl.center?.x, cy: heroEl.center?.y } : null,
    stemPath: stemEl?.path || []
  };
}
