import { GLYPHS, FALLBACK, GLYPH_W, GLYPH_H } from './pixeltext.js';
import { HEART_RUNS, KIND_STYLE, RING_RUNS } from './particles.js';

/**
 * Painting the particles.
 *
 * Split from the model in `particles.js` because this is the only part that
 * needs a font, and the browser half carries its own copy of that font rather
 * than importing one. It takes the glyph map as an argument for the same
 * reason, and any object with `fillRect` as a target, so a recording stub can
 * assert exactly what was painted.
 */

/**
 * Paint the particles.
 *
 * @param target - anything with a mutable `fillStyle` and `fillRect`.
 * @param particles - freshly updated particles, including `atX`, `atY`, `alpha`.
 * @param options - `font` maps a character to its glyph, defaulting to the
 *   built-in font; `scale` is the pixel size of one font pixel.
 */
export function drawParticles(target, particles, { font = GLYPHS, fallback = FALLBACK, scale = 2 } = {}) {
  for (const particle of particles) {
    const style = KIND_STYLE[particle.kind];
    if (style === undefined) continue;
    const size = particle.size ?? style.size ?? 2;
    const x = Math.round(particle.atX);
    const y = Math.round(particle.atY);
    target.fillStyle = style.colour;
    // The global alpha is managed by the caller through `globalAlpha`; the
    // model's own alpha is applied there so this stays a pure painter.
    if (style.square === true) {
      target.fillRect(x, y, size, size);
      continue;
    }
    if (style.heart === true) {
      drawHeart(target, x, y, size);
      continue;
    }
    if (style.spark === true) {
      drawSpark(target, x, y, size);
      continue;
    }
    if (style.ring === true) {
      drawRing(target, x, y, size);
      continue;
    }
    drawGlyph(target, style.text, x, y, size, font, fallback);
  }
}

/** A blocky heart, drawn as pixel runs so it stays on the pixel grid. */
function drawHeart(target, x, y, size) {
  const s = size;
  for (const [dx, dy, width] of HEART_RUNS) {
    target.fillRect(x + dx * s, y + dy * s, width * s, s);
  }
}

/** A four-point sparkle: a plus with a dot in the middle. */
function drawSpark(target, x, y, size) {
  const s = size;
  target.fillRect(x, y - s, s, s * 3);
  target.fillRect(x - s, y, s * 3, s);
}

/**
 * A hollow pixel ring, as a smoke ring.
 *
 * Drawn as horizontal runs so every edge stays on the pixel grid: one pixel of
 * ink per run cell, with a three-cell hole. A real circle would alias, and
 * aliasing is exactly what the rest of this plugin avoids.
 */
function drawRing(target, x, y, size) {
  const s = size;
  for (const [dx, dy, width] of RING_RUNS) {
    target.fillRect(x + dx * s, y + dy * s, width * s, s);
  }
}

/** One glyph from the pixel font, centred on the particle. */
function drawGlyph(target, text, x, y, size, font, fallback) {
  const glyph = font[text] ?? fallback;
  const offsetX = x - ((GLYPH_W * size) >> 1);
  for (let row = 0; row < glyph.length; row += 1) {
    const line = glyph[row];
    for (let column = 0; column < GLYPH_W; column += 1) {
      if (line[column] !== '#') continue;
      target.fillRect(offsetX + column * size, y + row * size, size, size);
    }
  }
}
