/**
 * A 5x7 pixel font, and the painter that draws with it.
 *
 * Pip speaks in pixels, so its speech cannot be set in a system font: a smooth
 * antialiased face next to chunky sprite art looks like two different
 * applications. Shipping a pixel font file would work, but it is a binary
 * asset, a licence, and a load that can fail — for the handful of characters a
 * speech bubble needs.
 *
 * So the font is data. Each glyph is five columns of seven rows, written as
 * strings, which makes them reviewable and fixable by eye. A test walks every
 * string this plugin can say and fails if a character has no glyph, so the font
 * cannot silently fall behind the copy.
 */

/** Glyph cell: five columns wide, seven rows tall. */
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** One column of blank between glyphs, so words stay readable. */
export const TRACKING = 1;
/** Width of a space, which has no glyph of its own. */
export const SPACE_ADVANCE = 4;

/**
 * The font, as `character` to five column strings.
 *
 * Every glyph is exactly five strings of exactly five characters, where `#` is
 * ink and anything else is empty. A taller row count would not fit; this size
 * keeps descenders legible without inventing a sixth column.
 */
const RAW_GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###..', '.#...', '.#...', '.#...', '.#...', '.#...', '###..'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.###.', '....#', '.####', '#...#', '#...#', '#..##', '.##.#'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['....', '....', '.###.', '#....', '#....', '#....', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['....', '....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#...', '####.', '.#...', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['#....', '.....', '##...', '.#...', '.#...', '.#...', '###..'],
  j: ['..#..', '.....', '.##..', '..#..', '..#..', '#.#..', '.#...'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['##...', '.#...', '.#...', '.#...', '.#...', '.#...', '###..'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##...', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['#....', '#....', '####.', '#....', '#....', '#....', '.###.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['....', '....', '....', '....', '....', '....', '....'],
  '.': ['....', '....', '....', '....', '....', '.##..', '.##..'],
  ',': ['....', '....', '....', '....', '.##..', '.##..', '#....'],
  '!': ['.#...', '.#...', '.#...', '.#...', '.#...', '.....', '.#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['....', '.##..', '.##..', '....', '.##..', '.##..', '....'],
  ';': ['....', '.##..', '.##..', '....', '.##..', '.##..', '#....'],
  "'": ['.#...', '.#...', '.....', '.....', '.....', '.....', '.....'],
  '"': ['#.#..', '#.#..', '.....', '.....', '.....', '.....', '.....'],
  '-': ['....', '....', '....', '#####', '....', '....', '....'],
  '\u2014': ['....', '....', '....', '#####', '....', '....', '....'],
  '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['#....', '.#...', '..#..', '..#..', '..#..', '.#...', '#....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '+': ['....', '..#..', '..#..', '#####', '..#..', '..#..', '....'],
  '=': ['....', '....', '#####', '....', '#####', '....', '....'],
  '*': ['....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '....'],
  '~': ['....', '....', '.##.#', '#..#.', '....', '....', '....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '....'],
};

/**
 * The font, normalised to five columns per row.
 *
 * Blank rows in the data above are written four wide, the usual shape of a 4x6
 * pixel font, and short rows are padded on the right so every glyph measures
 * the same in the painter. Padding right rather than centring is deliberate: a
 * blank row has no visible pixels, so its padding cannot shift anything.
 */
export const GLYPHS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_GLYPHS).map(([character, rows]) => [
      character,
      rows.map((row) => (row.length >= GLYPH_W ? row.slice(0, GLYPH_W) : row.padEnd(GLYPH_W, '.'))),
    ]),
  ),
);

/** The glyph drawn for a character the font does not have. */
export const FALLBACK = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'];

/** Whether one character can be drawn. */
export function hasGlyph(character) {
  return GLYPHS[character] !== undefined;
}

/** Every character this font can draw, as a sorted string. */
export function glyphSet() {
  return Object.keys(GLYPHS).sort().join('');
}

/**
 * Validate a string against the font.
 *
 * @param text - the string to check.
 * @returns the characters with no glyph, in first-seen order.
 */
export function missingGlyphs(text) {
  const missing = [];
  for (const character of String(text)) {
    if (hasGlyph(character)) continue;
    if (!missing.includes(character)) missing.push(character);
  }
  return missing;
}

/**
 * Measure a line in font pixels.
 *
 * @param text - the string to measure.
 * @param scale - integer upscale.
 * @returns `{ width, height }` in device pixels.
 */
export function measureText(text, scale = 1) {
  const characters = [...String(text)];
  let width = 0;
  for (const character of characters) {
    width += character === ' ' ? SPACE_ADVANCE + TRACKING : GLYPH_W + TRACKING;
  }
  // The trailing tracking is not part of the visible line.
  if (characters.length > 0) width -= TRACKING;
  return { width: Math.max(0, width) * scale, height: GLYPH_H * scale };
}

/**
 * Draw one line of pixel text.
 *
 * @param target - anything with a mutable `fillStyle` and `fillRect`.
 * @param text - the string to draw.
 * @param options - `x`, `y`, `scale`, and `colour`.
 * @returns the advance width in device pixels.
 */
export function drawText(target, text, { x = 0, y = 0, scale = 1, colour = '#000' } = {}) {
  target.fillStyle = colour;
  let cursor = x;
  for (const character of String(text)) {
    const glyph = GLYPHS[character] ?? FALLBACK;
    if (character !== ' ') {
      const rows = glyph.length;
      for (let row = 0; row < rows; row += 1) {
        const line = glyph[row];
        for (let column = 0; column < line.length; column += 1) {
          if (line[column] === '.' || line[column] === ' ') continue;
          target.fillRect(cursor + column * scale, y + row * scale, scale, scale);
        }
      }
    }
    cursor += (character === ' ' ? SPACE_ADVANCE : GLYPH_W) * scale + TRACKING * scale;
  }
  return cursor - x - TRACKING * scale;
}

/**
 * Break a string into lines that fit a width, preferring word boundaries.
 *
 * @param text - the string to wrap.
 * @param maxWidth - available width in font pixels (before scaling).
 * @returns the lines, never empty.
 */
export function wrapText(text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    // A word that does not fit starts a new line, unless the line is empty —
    // where overflowing is the lesser evil. Testing the line rather than "did
    // we just begin" is what stops a long word from silently overrunning.
    if (current !== '') lines.push(current);
    current = word;
  }
  if (current !== '') lines.push(current);
  return lines.length === 0 ? [''] : lines;
}
