/**
 * The little things that drift off a creature: thoughts, feelings, confetti.
 *
 * A particle is a chunky pixel square, or a letter drawn with the companion's
 * own pixel font, floating up from a point and fading. That is how "z" says
 * asleep, "?" says confused, a heart says pleased and a spark says delighted —
 * a small vocabulary that reads instantly and costs nothing to draw.
 *
 * The model is pure and synchronous: `spawn` and `update` take the current time
 * and return new arrays, so lifetimes and drift are testable without a canvas
 * or a clock. `drawParticles` is the only part that touches a context, and it
 * takes any object with `fillRect`, so a recording stub can assert what was
 * painted.
 */

/**
 * How heavy a burst each moment deserves.
 *
 * `burst` is the half-open range a single emission rolls between — `[1, 2]`
 * means one or two — `every` is the minimum gap between emissions, and `life`
 * bounds how long each lives. A sleeping creature emits slowly and forever; a
 * celebration empties itself at once.
 */
/**
 * Emitters whose particles are thoughts.
 *
 * These leave from above the head rather than the crown, because a question
 * mark drawn on the forehead looks like a facial feature. Everything else —
 * dust, hearts, sparks — belongs at the body, where a physical puff would come
 * from.
 */
export const THOUGHT_EMITTERS = new Set(['sleep', 'think', 'notice', 'content', 'cheer', 'smoke']);

export const EMITTERS = {
  /** Drifting off. */
  sleep: { kind: 'sleep', burst: [1, 1], every: 1400, life: [3200, 4600], kinds: ['z'], rise: 13, drift: 8 },
  /** Wondering about something. */
  think: { kind: 'think', burst: [1, 1], every: 1100, life: [1800, 2800], kinds: ['?', '?', 'dot'], rise: 15, drift: 11 },
  /** Noticing something. */
  notice: { kind: 'notice', burst: [1, 2], every: 900, life: [1200, 1900], kinds: ['!'], rise: 24, drift: 7 },
  /** Getting on with it. */
  work: { kind: 'work', burst: [1, 1], every: 1500, life: [900, 1500], kinds: ['dust'], rise: 20, drift: 14 },
  /** Pleased with itself. */
  cheer: { kind: 'cheer', burst: [7, 11], every: 700, life: [900, 1700], kinds: ['spark', 'spark', 'heart', 'dot'], rise: 34, drift: 44 },
  /** A quiet moment of contentment. */
  content: { kind: 'content', burst: [1, 2], every: 2200, life: [1400, 2200], kinds: ['heart', 'spark'], rise: 16, drift: 10 },
  /** Crestfallen. */
  droop: { kind: 'droop', burst: [2, 3], every: 1400, life: [1100, 1900], kinds: ['dot'], rise: -16, drift: 6 },
  /** Just landed. */
  land: { kind: 'land', burst: [3, 5], every: 900, life: [500, 900], kinds: ['dust'], rise: 12, drift: 26 },
  /** A slow wisp, for a creature taking its time over something. */
  smoke: { kind: 'smoke', burst: [1, 2], every: 900, life: [2000, 3200], kinds: ['smoke'], rise: 12, drift: 9 },
  /**
   * The exhale: two or three rings, blown rather than puffed.
   *
   * One-shot from the toke's exhale frame rather than on an interval, so the
   * rings leave on the frame that draws the breath.
   */
  ring: { kind: 'ring', burst: [2, 3], every: 1000, life: [1500, 2300], kinds: ['ring'], rise: 26, drift: 30 },
  /**
   * A cough: smoke and rings, fast and wide.
   *
   * Deliberately a burst rather than a trickle. It answers a poke in the middle
   * of a toke, where a slow wisp would read as the joint carrying on.
   */
  cough: { kind: 'cough', burst: [4, 6], every: 900, life: [700, 1400], kinds: ['smoke', 'ring'], rise: 34, drift: 48 },
  /**
   * The raid.
   *
   * Blue and red, flashing, and fast — the point is that it is unmistakably
   * not part of the creature's usual palette.
   */
  siren: {
    // `kind` is how a caller asks for this emitter; `kinds` is what it may
    // draw. Every emitter needs the first, because `spawn` looks it up by name —
    // the siren had only the second, so `spawn` was handed `undefined` and the
    // police silently never arrived.
    kind: 'siren',
    burst: [2, 4],
    every: 220,
    life: [500, 900],
    kinds: ['sirenBlue', 'sirenRed', 'alarm'],
    rise: 26,
    drift: 30,
  },
};

/** Cosmetic description per particle kind. */
export const KIND_STYLE = {
  z: { text: 'z', colour: '#adbae8', size: 3, gravity: -2 },
  '?': { text: '?', colour: '#ffd479', size: 4, gravity: -1 },
  '!': { text: '!', colour: '#ffd479', size: 4, gravity: -1 },
  heart: { heart: true, colour: '#ff8fae', size: 3, gravity: 3 },
  spark: { spark: true, colour: '#ffd479', size: 3, gravity: 4 },
  dot: { square: true, colour: '#c7d3ff', size: 2, gravity: 2 },
  dust: { square: true, colour: '#c7d3ff', size: 1, gravity: 1 },
  smoke: { square: true, colour: '#d6dde2', size: 2, gravity: -1 },
  ring: { ring: true, colour: '#e8edf2', size: 2, gravity: 2 },
  sirenBlue: { square: true, colour: '#4f8dff', size: 3, gravity: 3 },
  sirenRed: { square: true, colour: '#ff5d5d', size: 3, gravity: 3 },
  alarm: { text: '!', colour: '#ff5d5d', size: 3, gravity: 2 },
};

/**
 * Pixel runs for the blocky heart, relative to the particle's centre.
 *
 * Geometry lives with the model so the browser painter and the reference
 * painter cannot disagree about the shape; both import this table.
 */
export const HEART_RUNS = [
  [-2, 0, 1], [1, 0, 1],
  [-2, 1, 4],
  [-1, 2, 2],
  [0, 3, 1],
];

/**
 * Pixel runs for the smoke ring: a 7×7 hollow, square-ish circle.
 *
 * Stored as runs so every edge stays on the pixel grid; an arc would alias.
 */
export const RING_RUNS = [
  [-1, -3, 3],
  [-2, -2, 1], [2, -2, 1],
  [-3, -1, 1], [3, -1, 1],
  [-3, 0, 1], [3, 0, 1],
  [-3, 1, 1], [3, 1, 1],
  [-2, 2, 1], [2, 2, 1],
  [-1, 3, 3],
];

/** Longest life any emitter declares, used to prune cheaply. */
const MAX_LIFE = 6000;

/**
 * Where a particle of this kind should leave from.
 *
 * A thought floats in clear air above the head; anything physical — a puff of
 * dust, a heart, a spark — belongs at the body. Drawing a question mark at the
 * crown put it on the forehead, where it read as a facial feature rather than
 * as a thought.
 *
 * @param kind - the emitter name.
 * @param rect - the creature's box, in viewport pixels.
 * @returns `{ x, y, spreadX, spreadY }` for {@link spawn}.
 */
export function originForParticle(kind, rect, fallback = { x: 0, y: 0 }) {
  const thought = THOUGHT_EMITTERS.has(kind);
  // A detached node cannot be measured, and a caller may hold a stale element.
  // Returning a usable origin keeps the frame loop alive; refusing would take
  // the whole creature down over a particle.
  const box = rect !== null && rect !== undefined && Number.isFinite(rect.width) && rect.width > 0
    ? rect
    : { left: fallback.x, top: fallback.y, width: 0, height: 0 };

  return {
    x: box.left + box.width / 2,
    // Clear of the head: a thought starts above the silhouette, not on it.
    y: thought ? box.top - box.height * 0.06 : box.top + box.height * 0.35,
    spreadX: thought ? Math.max(6, box.width * 0.3) : Math.max(4, box.width * 0.22),
    spreadY: thought ? 8 : 6,
  };
}

/** A random float in `[min, max)`. */
function particleBetween(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one member of an array. */
function choose(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

/**
 * Spawn one burst from an emitter.
 *
 * @param options - `kind` names the emitter, `x` and `y` are the origin in
 *   screen pixels, `now` is the current time, `random` is injectable.
 * @returns a new array with the existing particles plus the new ones.
 */
export function spawn(existing, { kind, x, y, now, random = Math.random, spreadX = 14, spreadY = 6 }) {
  const emitter = EMITTERS[kind];
  if (emitter === undefined) {
    // Throw rather than return quietly. A silent drop here hid a real bug for a
    // long time: the siren emitter was being asked for `undefined` and produced
    // nothing, with no error anywhere to say so.
    throw new Error(`companion: no emitter for particle kind "${String(kind)}"`);
  }

  // The burst range is half-open `[low, high)`, so `[1, 2]` means "one or two"
  // and a floor selects between them. Rounding instead would have made `[1, 1]`
  // able to produce two, which is the kind of off-by-one that hides in plain
  // sight until someone counts the confetti.
  const count = Math.max(1, emitter.burst[0] + Math.floor(random() * (emitter.burst[1] + 1 - emitter.burst[0])));
  const created = [];
  for (let index = 0; index < count; index += 1) {
    // One kind, chosen once. Asking `choose` twice made the particle a spark in
    // one style and the wrong size in another, because the second roll landed
    // on a different entry.
    const particleKind = choose(random, emitter.kinds);
    const life = particleBetween(random, emitter.life[0], emitter.life[1]);
    created.push({
      id: `${now}-${index}-${Math.floor(random() * 1e6)}`,
      kind: particleKind,
      // Spawn across the creature's own width, not from a single point.
      x: x + particleBetween(random, -spreadX, spreadX),
      y: y + particleBetween(random, -spreadY, spreadY),
      born: now,
      life,
      // Upward for a thought, sideways for confetti.
      vx: particleBetween(random, -emitter.drift * 0.5, emitter.drift * 0.5),
      vy: -particleBetween(random, emitter.rise * 0.55, emitter.rise),
      size: KIND_STYLE[particleKind]?.size ?? 2,
    });
  }
  return existing.concat(created);
}

/**
 * Advance every particle and drop the expired ones.
 *
 * @param particles - the current array.
 * @param now - current time in milliseconds.
 * @returns `{ particles, alive }`, where `alive` is false when nothing is left.
 */
export function update(particles, now) {
  if (particles.length === 0) return { particles, alive: false };

  const kept = [];
  for (const particle of particles) {
    const age = now - particle.born;
    if (age >= particle.life || age > MAX_LIFE) continue;
    const style = KIND_STYLE[particle.kind] ?? {};
    // A gentle upward float that eases off, plus a little gravity per kind.
    const drift = particle.vx * (age / 1000);
    const rise = particle.vy * (age / 1000) * 0.6;
    const fall = (style.gravity ?? 0) * (age / 1000) * 0.5;
    kept.push({ ...particle, age, atX: particle.x + drift, atY: particle.y + rise + fall, alpha: 1 - age / particle.life });
  }
  return { particles: kept, alive: kept.length > 0 };
}

/** Whether an emitter should fire now, given when it last did. */
export function due(kind, lastAt, now) {
  const emitter = EMITTERS[kind];
  if (emitter === undefined) return false;
  return now - lastAt >= emitter.every;
}

/** Glyph metrics, so a caller can size a canvas around a text particle. */
export const PARTICLE_GLYPH = { width: 5, height: 7 };
