import { ASSETS, P } from "./config.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

/** Load every sheet, keeping a valid fallback entry when one is missing. */
export async function loadAssets() {
  const entries = Object.entries(ASSETS);
  const loaded = await Promise.all(
    entries.map(async ([key, spec]) => {
      try {
        const image = await loadImage(spec.src);
        const availableFrames = Math.max(1, Math.floor(image.naturalWidth / spec.fw));
        const expectedWidth = spec.fw * spec.frames;
        const expectedHeight = spec.fh;
        if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight) {
          console.warn(
            `[asset] ${key}: expected ${expectedWidth}x${expectedHeight}, got ${image.naturalWidth}x${image.naturalHeight}`,
          );
        }
        return {
          key,
          ...spec,
          image,
          loaded: true,
          availableFrames,
          observedWidth: image.naturalWidth,
          observedHeight: image.naturalHeight,
          fitsSpec: image.naturalWidth === expectedWidth && image.naturalHeight === expectedHeight,
        };
      } catch (error) {
        console.warn(`[asset] ${key} missing: ${error.message}`);
        return {
          key,
          ...spec,
          image: null,
          loaded: false,
          availableFrames: spec.frames,
          error: error.message,
        };
      }
    }),
  );

  const assets = Object.fromEntries(loaded.map((entry) => [entry.key, entry]));
  return {
    entries: assets,
    missing: loaded.filter((entry) => !entry.loaded).map((entry) => entry.key),
    malformed: loaded
      .filter((entry) => entry.loaded && !entry.fitsSpec)
      .map((entry) => entry.key),
  };
}

export function hasSheet(assets, key) {
  return Boolean(assets?.[key]?.loaded);
}

const FALLBACK_COLOR = {
  flowers: P.leaf,
  lilypad: P.lily,
  reeds: P.leafDark,
  grass: P.leaf,
  honeybee: P.beeGold,
  bumblebee: P.beeGold,
  dragonfly: P.waterLight,
  damselfly: P.cornflower,
  butterfly: P.butterfly,
  ladybug: P.ladyRed,
  "ladybug-fly": P.ladyRed,
  ant: P.inkWarm,
  snail: P.shell,
  waterstrider: P.ink,
  tadpole: P.waterDeep,
  frog: P.frog,
  firefly: P.firefly,
  gnat: P.inkWarm,
};

function fallback(ctx, sheet, x, y, options) {
  const { anchor = "bottom", scale = 1, alpha = 1, flip = false } = options;
  const key = sheet?.key ?? "unknown";
  const fw = sheet?.fw ?? 8;
  const fh = sheet?.fh ?? 6;
  ctx.save();
  ctx.globalAlpha = alpha;
  const px = Math.round(x);
  const py = Math.round(y);

  if (key === "reeds" || key === "grass") {
    const height = Math.max(4, Math.round(fh * 0.42 * scale));
    const spread = Math.max(2, Math.round(fw * 0.18 * scale));
    ctx.strokeStyle = FALLBACK_COLOR[key];
    ctx.fillStyle = FALLBACK_COLOR[key];
    for (let i = -1; i <= 1; i += 1) {
      const sway = Math.round(i * spread * 0.5);
      for (let h = 0; h < height; h += 1) {
        ctx.fillRect(px + Math.round((sway * h) / height), py - h, 1, 1);
      }
    }
    ctx.restore();
    return;
  }
  if (key === "lilypad") {
    ctx.fillStyle = P.lily;
    ctx.fillRect(px - 6 * scale, py - 2 * scale, 13 * scale, 2 * scale);
    ctx.fillStyle = P.lilyLight;
    ctx.fillRect(px - 4 * scale, py - 2 * scale, 5 * scale, 1 * scale);
    ctx.restore();
    return;
  }
  if (key === "flowers") {
    ctx.fillStyle = P.leaf;
    ctx.fillRect(px, py - 7 * scale, 1, 7 * scale);
    ctx.fillStyle = P.gold;
    ctx.fillRect(px - 2 * scale, py - 9 * scale, 3 * scale, 2 * scale);
    ctx.fillStyle = P.leafHigh;
    ctx.fillRect(px + 1, py - 4 * scale, 2 * scale, 1);
    ctx.restore();
    return;
  }

  const w = Math.max(2, Math.round(fw * 0.55 * scale));
  const h = Math.max(2, Math.round(fh * 0.5 * scale));
  const left = Math.round(px - w / 2);
  const top = anchor === "bottom" ? Math.round(py - h) : Math.round(py - h / 2);
  ctx.fillStyle = FALLBACK_COLOR[key] ?? P.leafHigh;
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = P.ink;
  ctx.fillRect(left + (flip ? 0 : w - 2), top + 1, 2, 1);
  if (key === "honeybee" || key === "bumblebee" || key === "firefly" || key === "gnat") {
    ctx.fillStyle = P.wing;
    ctx.fillRect(left + 1, top - 1, Math.max(1, w - 2), 1);
  }
  ctx.restore();
}

/**
 * Draw one frame of a horizontal sprite sheet.
 * anchor: bottom | center | top-left. x is the centre for bottom/center.
 */
export function drawSheet(ctx, sheet, frame, x, y, options = {}) {
  const {
    anchor = "bottom",
    flip = false,
    alpha = 1,
    scale = 1,
    silhouette = null,
  } = options;
  if (!sheet?.loaded || !sheet.image) {
    fallback(ctx, sheet ?? { fw: 8, fh: 6, key: "unknown" }, x, y, options);
    return;
  }
  const fw = sheet.fw;
  const fh = sheet.fh;
  const available = sheet.availableFrames ?? sheet.frames;
  const index = ((Math.floor(frame) % available) + available) % available;
  const sx = index * fw;
  const srcW = Math.min(fw, sheet.image.naturalWidth - sx);
  if (srcW <= 0) return;
  const drawW = srcW * scale;
  const drawH = fh * scale;
  let left;
  let top;
  if (anchor === "center") {
    left = Math.round(x - drawW / 2);
    top = Math.round(y - drawH / 2);
  } else if (anchor === "top-left") {
    left = Math.round(x);
    top = Math.round(y);
  } else {
    left = Math.round(x - drawW / 2);
    top = Math.round(y - drawH);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(left + drawW, top);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.image, sx, 0, srcW, fh, 0, 0, drawW, drawH);
  } else {
    ctx.drawImage(sheet.image, sx, 0, srcW, fh, left, top, drawW, drawH);
  }
  if (silhouette) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = silhouette;
    ctx.fillRect(left - 2, top - 2, drawW + 4, drawH + 4);
  }
  ctx.restore();
}

export function drawWholeImage(ctx, sheet, x, y) {
  if (!sheet?.loaded || !sheet.image) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.image, Math.round(x), Math.round(y));
  ctx.restore();
  return true;
}

/** Used by screenshots and QA to prove every authored asset arrived. */
export function assetStatus(assets) {
  return Object.values(assets).map((entry) => ({
    key: entry.key,
    loaded: entry.loaded,
    expected: `${entry.fw * entry.frames}x${entry.fh}`,
    observed: entry.loaded ? `${entry.observedWidth}x${entry.observedHeight}` : null,
    frames: entry.loaded ? entry.availableFrames : 0,
    fitsSpec: entry.fitsSpec ?? false,
  }));
}
