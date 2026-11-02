/**
 * The antenna: a springy stalk with an amber bulb on the end.
 *
 * The body sheets no longer paint an antenna. Instead this module owns a tiny
 * two-degree-of-freedom rig — one angle from the crown and one length — so the
 * bulb can trail behind a walking body, droop while asleep, and be pulled around
 * with the pointer. The bulb is clamped to the 32x32 cell, which is why the
 * limits in {@link ANTENNA_LIMITS} leave exactly three pixels of bulb margin on
 * every side.
 *
 * The model is pure and synchronous: no imports, no DOM, no clock. `stepAntenna`
 * advances one damped spring step, `pullAntenna`/`releaseAntenna` drive the
 * pointer interaction, and `drawAntenna` is the only part that touches a 2d
 * context. A recording context with `clearRect` and `fillRect` can assert the
 * whole painting.
 *
 * Coordinates are cell pixels from the top-left of the sprite: x grows right,
 * y grows down, and `angle` is radians from straight up with positive bending
 * right. The tip is therefore
 * `{ x: anchor.x + sin(angle) * length, y: anchor.y - cos(angle) * length }`.
 */

/**
 * The rest pose of every animation, plus a fallback.
 *
 * `angle` is radians from up, positive right; `length` is cell pixels.
 * `stiffness`/`damping` drive the angle spring, `lengthStiffness`/`lengthDamping`
 * the length spring. Softer values mean a lazier settle: sleep sags, laugh and
 * bolt are tight, and `tug` is deliberately springy because the user just let go
 * of it.
 *
 * A rest length of 3 from an idle anchor at y=5 puts the bulb's centre exactly on
 * `minY`; upright rest poses cannot be longer without pressing the bulb into the
 * top of the cell. Lengths above 3 lean, or belong to poses whose anchor sits
 * lower. `tipped` is the extreme: the lying anchor is `[9, 20]`, so the stalk has
 * to reach up-left to about `[3, 16]` to put the bulb beyond the face.
 */
export const ANTENNA_REST = {
  idle: { angle: 0, length: 3, stiffness: 120, damping: 9, lengthStiffness: 140, lengthDamping: 12 },
  walk: { angle: 0, length: 3, stiffness: 160, damping: 10, lengthStiffness: 180, lengthDamping: 13 },
  sit: { angle: 0.05, length: 2.9, stiffness: 95, damping: 8, lengthStiffness: 110, lengthDamping: 10 },
  sleep: { angle: 0.9, length: 2.8, stiffness: 60, damping: 6, lengthStiffness: 70, lengthDamping: 8 },
  look: { angle: 0.08, length: 3, stiffness: 120, damping: 9, lengthStiffness: 140, lengthDamping: 12 },
  happy: { angle: 0.15, length: 3, stiffness: 135, damping: 9, lengthStiffness: 155, lengthDamping: 12 },
  sad: { angle: -0.8, length: 2.7, stiffness: 75, damping: 7.5, lengthStiffness: 90, lengthDamping: 10 },
  work: { angle: 0.1, length: 3, stiffness: 115, damping: 9, lengthStiffness: 135, lengthDamping: 12 },
  jump: { angle: 0.25, length: 3, stiffness: 180, damping: 10, lengthStiffness: 200, lengthDamping: 13 },
  toke: { angle: 0.2, length: 2.9, stiffness: 85, damping: 8, lengthStiffness: 100, lengthDamping: 10 },
  giggle: { angle: 0.18, length: 3, stiffness: 170, damping: 9.5, lengthStiffness: 190, lengthDamping: 12 },
  laugh: { angle: 0.22, length: 3, stiffness: 180, damping: 10, lengthStiffness: 200, lengthDamping: 13 },
  laugh_hard: { angle: 0.28, length: 3, stiffness: 200, damping: 10, lengthStiffness: 220, lengthDamping: 13 },
  tipped: { angle: -0.98, length: 7.2, stiffness: 95, damping: 7, lengthStiffness: 110, lengthDamping: 9 },
  busted: { angle: -0.6, length: 2.6, stiffness: 80, damping: 8, lengthStiffness: 95, lengthDamping: 10 },
  bolt: { angle: -0.6, length: 3.2, stiffness: 220, damping: 9, lengthStiffness: 240, lengthDamping: 12 },
  cower: { angle: -0.35, length: 2.5, stiffness: 150, damping: 12, lengthStiffness: 170, lengthDamping: 15 },
  mellow: { angle: 0.18, length: 3, stiffness: 80, damping: 7.5, lengthStiffness: 95, lengthDamping: 9 },
  bounce: { angle: 0.12, length: 3, stiffness: 190, damping: 9, lengthStiffness: 210, lengthDamping: 12 },
  startle: { angle: 0.35, length: 3, stiffness: 240, damping: 7, lengthStiffness: 260, lengthDamping: 9 },
  giddy: { angle: 0.18, length: 3, stiffness: 175, damping: 9, lengthStiffness: 195, lengthDamping: 12 },
  tug: { angle: 0.15, length: 3, stiffness: 210, damping: 7.5, lengthStiffness: 230, lengthDamping: 10 },
  ponder: { angle: 0.06, length: 3, stiffness: 90, damping: 8, lengthStiffness: 110, lengthDamping: 10 },
  aha: { angle: 0.22, length: 3, stiffness: 220, damping: 9, lengthStiffness: 240, lengthDamping: 12 },
  scratch: { angle: -0.1, length: 3, stiffness: 150, damping: 9.5, lengthStiffness: 170, lengthDamping: 12 },
  default: { angle: 0, length: 3, stiffness: 120, damping: 9, lengthStiffness: 140, lengthDamping: 12 },
};

/**
 * The cell rectangle the bulb is allowed to occupy.
 *
 * The bulb is six pixels wide and four tall, centred on the tip. These limits
 * leave exactly the bulb's half-extents at each edge, so a tip on a limit draws
 * the pattern flush with the sprite box: x 3..29 and y 2..30. They are also used
 * to clamp a pointer pull, so the handle can never drag the bulb out of the cell.
 */
export const ANTENNA_LIMITS = {
  minX: 3,
  maxX: 29,
  minY: 2,
  maxY: 30,
  minLength: 2,
  maxLength: 12,
  maxAngle: 2.4,
};

/** Colours taken straight from `sprites.js`'s palette. */
export const ANTENNA_STYLE = {
  stem: '#19203e',
  stemLight: '#6d84e9',
  outline: '#19203e',
  bulb: '#ffd166',
  highlight: '#fff0b5',
};

/**
 * The bulb, as characters from the sprite palette.
 *
 * `#` is the outline, `y` the amber bulb, `Y` the highlight, and `.` is
 * transparent. It is stamped centred on the tip, so the stalk meets the middle
 * of the bottom outline.
 */
export const ANTENNA_BULB = [
  '.####.',
  '#yyyy#',
  '#yYYy#',
  '.####.',
];

/** Largest angular speed a pull or release may transfer, in radians/second. */
const ANTENNA_MAX_ANGULAR_VELOCITY = 20;
/** Largest length speed a pull or release may transfer, in pixels/second. */
const ANTENNA_MAX_LENGTH_VELOCITY = 60;
/** Time constant of the smoothed pointer velocity, in seconds. */
const ANTENNA_DRAG_SMOOTHING = 0.05;
/** A pointer gap longer than this is a new gesture, not a fast flick. */
const ANTENNA_DRAG_GAP = 0.25;

/**
 * One clamp for the whole module.
 *
 * It is called `antennaClamp` rather than `clamp` because the generated browser
 * block already declares a `clamp` of its own, and `mirror` for the facing rule.
 */
function antennaClamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** A finite number, or the fallback when the caller passed junk. */
function antennaFinite(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Sanitize an anchor into the cell.
 *
 * The base of the stalk is part of the artwork, but a stale or half-written
 * anchor must never make the rig produce NaN for a frame.
 */
function antennaBasePoint(value, fallback = { x: 16, y: 5 }) {
  const base = fallback === null || fallback === undefined ? { x: 16, y: 5 } : fallback;
  const x = antennaFinite(value === null || value === undefined ? undefined : value.x, antennaFinite(base.x, 16));
  const y = antennaFinite(value === null || value === undefined ? undefined : value.y, antennaFinite(base.y, 5));
  return {
    x: antennaClamp(x, ANTENNA_LIMITS.minX, ANTENNA_LIMITS.maxX),
    y: antennaClamp(y, ANTENNA_LIMITS.minY, ANTENNA_LIMITS.maxY),
  };
}

/**
 * Sanitize a rest description, accepting an animation name as a convenience.
 *
 * Every spring gain must stay positive: a zero stiffness would turn the antenna
 * into a dead wire and a negative one would fling it, so bad input falls back to
 * the ordinary idle spring rather than being trusted.
 */
function antennaRestFor(value, fallback = ANTENNA_REST.default) {
  const named = typeof value === 'string' ? ANTENNA_REST[value] : value;
  const source = named !== null && typeof named === 'object' ? named : undefined;
  const previous = fallback !== null && typeof fallback === 'object' ? fallback : ANTENNA_REST.default;
  const pose = source ?? previous;
  const gain = (candidate, normal) => {
    const number = antennaFinite(candidate, normal);
    return number > 0 ? number : normal;
  };
  return {
    angle: antennaClamp(antennaFinite(pose.angle, 0), -ANTENNA_LIMITS.maxAngle, ANTENNA_LIMITS.maxAngle),
    length: antennaClamp(antennaFinite(pose.length, 3), ANTENNA_LIMITS.minLength, ANTENNA_LIMITS.maxLength),
    stiffness: gain(pose.stiffness, 120),
    damping: gain(pose.damping, 9),
    lengthStiffness: gain(pose.lengthStiffness, 140),
    lengthDamping: gain(pose.lengthDamping, 12),
  };
}

/** Replace the numeric fields of a state with finite, bounded values. */
function antennaPrepare(state) {
  if (state === null || state === undefined || typeof state !== 'object') return undefined;
  state.anchor = antennaBasePoint(state.anchor);
  state.rest = antennaRestFor(state.rest, state.rest);
  state.angle = antennaClamp(antennaFinite(state.angle, state.rest.angle), -ANTENNA_LIMITS.maxAngle, ANTENNA_LIMITS.maxAngle);
  state.length = antennaClamp(antennaFinite(state.length, state.rest.length), ANTENNA_LIMITS.minLength, ANTENNA_LIMITS.maxLength);
  state.angularVelocity = antennaClamp(
    antennaFinite(state.angularVelocity, 0),
    -ANTENNA_MAX_ANGULAR_VELOCITY,
    ANTENNA_MAX_ANGULAR_VELOCITY,
  );
  state.lengthVelocity = antennaClamp(
    antennaFinite(state.lengthVelocity, 0),
    -ANTENNA_MAX_LENGTH_VELOCITY,
    ANTENNA_MAX_LENGTH_VELOCITY,
  );
  state.dragged = state.dragged === true;
  const drag = state.dragVelocity !== null && typeof state.dragVelocity === 'object' ? state.dragVelocity : undefined;
  state.dragVelocity = {
    angle: antennaClamp(antennaFinite(drag?.angle, 0), -ANTENNA_MAX_ANGULAR_VELOCITY, ANTENNA_MAX_ANGULAR_VELOCITY),
    length: antennaClamp(antennaFinite(drag?.length, 0), -ANTENNA_MAX_LENGTH_VELOCITY, ANTENNA_MAX_LENGTH_VELOCITY),
  };
  state.dragAt = antennaFinite(state.dragAt, 0);
  return state;
}

/** The tip implied by an anchor, an angle and a length. */
function antennaProject(anchor, angle, length) {
  return {
    x: anchor.x + Math.sin(angle) * length,
    y: anchor.y - Math.cos(angle) * length,
  };
}

/**
 * How far the stalk may extend in this direction before the bulb leaves the cell.
 *
 * The cell is convex, so the ray from an anchor inside it exits exactly once. A
 * length no greater than this keeps every part of the bulb inside; a length
 * clamped to `maxLength` keeps the stalk itself from getting silly.
 */
function antennaRoom(anchor, angle) {
  const limits = ANTENNA_LIMITS;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const epsilon = 1e-9;
  let room = limits.maxLength;
  if (sine > epsilon) room = Math.min(room, (limits.maxX - anchor.x) / sine);
  else if (sine < -epsilon) room = Math.min(room, (anchor.x - limits.minX) / -sine);
  if (cosine < -epsilon) room = Math.min(room, (limits.maxY - anchor.y) / -cosine);
  else if (cosine > epsilon) room = Math.min(room, (anchor.y - limits.minY) / cosine);
  return Math.max(0, room);
}

/**
 * The angle nearest `angle` that still has room for the minimum length.
 *
 * A high anchor (a lifted jump frame can put the crown at y=2) or one close to a
 * side wall can make the requested direction too short. Snapping to the nearest
 * direction that fits is better than letting the bulb poke through the cell.
 */
function antennaNearestAngle(anchor, angle) {
  const limit = ANTENNA_LIMITS.maxAngle;
  const steps = 48;
  let best = 0;
  let bestGap = Infinity;
  for (let index = 0; index <= steps; index += 1) {
    const candidate = -limit + (2 * limit * index) / steps;
    if (antennaRoom(anchor, candidate) < ANTENNA_LIMITS.minLength) continue;
    const gap = Math.abs(candidate - angle);
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return bestGap === Infinity ? 0 : best;
}

/**
 * Store a pose, bounded by the angle limit, the length limits and the cell.
 *
 * Capping the length by {@link antennaRoom} is the invariant that makes the
 * drawing safe: once a pose is installed here, projecting it cannot put the tip
 * outside `ANTENNA_LIMITS`, so the 6x4 bulb also stays inside 0..31.
 *
 * @returns whether either coordinate had to move to get there.
 */
function antennaSetPose(state, angle, length) {
  const limits = ANTENNA_LIMITS;
  let nextAngle = antennaClamp(antennaFinite(angle, state.angle), -limits.maxAngle, limits.maxAngle);
  let room = antennaRoom(state.anchor, nextAngle);
  if (room < limits.minLength) {
    nextAngle = antennaNearestAngle(state.anchor, nextAngle);
    room = antennaRoom(state.anchor, nextAngle);
  }
  const wanted = antennaClamp(antennaFinite(length, state.length), limits.minLength, limits.maxLength);
  const nextLength = Math.min(wanted, Math.max(limits.minLength, room));
  const moved = Math.abs(nextAngle - state.angle) > 1e-9 || Math.abs(nextLength - state.length) > 1e-9;
  state.angle = nextAngle;
  state.length = nextLength;
  return moved;
}

/**
 * Aim the rig at a point in cell coordinates.
 *
 * The point is first clamped to the cell, then converted to an angle and a
 * length. A reachable point is followed exactly: the tip lands on it in the same
 * call. A point beyond `maxLength`, beyond `maxAngle`, or beyond the cell wall is
 * projected onto the nearest reachable pose instead.
 */
function antennaAim(state, point) {
  const limits = ANTENNA_LIMITS;
  const rawX = point === null || point === undefined ? undefined : point.x;
  const rawY = point === null || point === undefined ? undefined : point.y;
  const x = antennaClamp(antennaFinite(rawX, state.anchor.x), limits.minX, limits.maxX);
  const y = antennaClamp(antennaFinite(rawY, state.anchor.y), limits.minY, limits.maxY);
  const deltaX = x - state.anchor.x;
  const deltaY = y - state.anchor.y;
  const distance = Math.hypot(deltaX, deltaY);
  // At zero distance every direction is equally true; keep the current one so
  // dragging the bulb onto the crown does not make it snap.
  const angle = distance < 1e-6 ? state.angle : Math.atan2(deltaX, -deltaY);
  antennaSetPose(state, angle, distance);
}

/**
 * Create an antenna at rest.
 *
 * @param options.anchor - base of the stalk in cell pixels; defaults to the
 *   idle crown at `{ x: 16, y: 5 }`.
 * @param options.rest - a rest entry or animation name; defaults to idle.
 * @returns the mutable spring state.
 */
export function createAntenna({ anchor = { x: 16, y: 5 }, rest = ANTENNA_REST.idle } = {}) {
  const pose = antennaRestFor(rest);
  return {
    anchor: antennaBasePoint(anchor),
    angle: pose.angle,
    length: pose.length,
    angularVelocity: 0,
    lengthVelocity: 0,
    dragged: false,
    dragVelocity: { angle: 0, length: 0 },
    rest: pose,
    // When `pullAntenna` was last called, so the next sample can difference it.
    dragAt: 0,
  };
}

/**
 * Advance the spring by one frame.
 *
 * Semi-implicit Euler around a moving target. The target is the rest pose plus
 * a body-velocity lag; that lag is the whole trick behind a trailing antenna, so
 * there is deliberately no second velocity state.
 *
 * While `dragged` is true the pointer owns the pose: the anchor and rest are
 * still updated, but the angle and length are not integrated. `pullAntenna` is
 * the only writer during a drag.
 *
 * @param state - a state from {@link createAntenna}.
 * @param options.dt - frame time in seconds, clamped to `[1/240, 1/30]`;
 *   defaults to 1/60.
 * @param options.anchor - the current base of the stalk, if it moved.
 * @param options.rest - the current animation's rest pose (or its name).
 * @param options.bodyVelocity - local cell pixels/second, x right, y down.
 * @returns the same state, or `undefined` when it was not an object.
 */
export function stepAntenna(state, { dt = 1 / 60, anchor, rest, bodyVelocity } = {}) {
  const current = antennaPrepare(state);
  if (current === undefined) return undefined;

  if (anchor !== undefined) current.anchor = antennaBasePoint(anchor, current.anchor);
  if (rest !== undefined) current.rest = antennaRestFor(rest, current.rest);

  const step = antennaClamp(antennaFinite(dt, 1 / 60), 1 / 240, 1 / 30);
  if (current.dragged === true) {
    // The pointer may be holding the bulb in place while the animation's anchor
    // shifts underneath it. Keep the held pose inside the cell, but do not spring.
    antennaSetPose(current, current.angle, current.length);
    return current;
  }

  const velocity = bodyVelocity !== null && typeof bodyVelocity === 'object' ? bodyVelocity : {};
  const velocityX = antennaFinite(velocity.x, 0);
  const velocityY = antennaFinite(velocity.y, 0);
  const targetAngle = current.rest.angle - antennaClamp(velocityX * 0.03, -0.9, 0.9);
  const targetLength = current.rest.length + antennaClamp(-velocityY * 0.012, -1, 1);

  const angularAcceleration =
    current.rest.stiffness * (targetAngle - current.angle) - current.rest.damping * current.angularVelocity;
  current.angularVelocity = antennaClamp(
    current.angularVelocity + angularAcceleration * step,
    -ANTENNA_MAX_ANGULAR_VELOCITY,
    ANTENNA_MAX_ANGULAR_VELOCITY,
  );
  current.angle += current.angularVelocity * step;

  const lengthAcceleration =
    current.rest.lengthStiffness * (targetLength - current.length) - current.rest.lengthDamping * current.lengthVelocity;
  current.lengthVelocity = antennaClamp(
    current.lengthVelocity + lengthAcceleration * step,
    -ANTENNA_MAX_LENGTH_VELOCITY,
    ANTENNA_MAX_LENGTH_VELOCITY,
  );
  current.length += current.lengthVelocity * step;

  const beforeAngle = current.angle;
  const beforeLength = current.length;
  antennaSetPose(current, current.angle, current.length);
  // Hitting the cell wall is a hard stop: keep a little bounce, lose most of the
  // energy, and never let a target outside the cell pump the spring forever.
  if (Math.abs(current.angle - beforeAngle) > 1e-6 || Math.abs(current.length - beforeLength) > 1e-6) {
    current.angularVelocity *= 0.25;
    current.lengthVelocity *= 0.25;
  }
  return current;
}

/**
 * Pull the bulb towards a point.
 *
 * The point is clamped to the cell and followed immediately when it is
 * reachable. The movement between calls is differenced against `now` and blended
 * into `dragVelocity`, which is what {@link releaseAntenna} later throws into the
 * spring.
 *
 * @param state - the antenna state.
 * @param point - pointer position in unmirrored cell coordinates.
 * @param options.now - monotonic milliseconds, e.g. `performance.now()`.
 * @returns the same state, or `undefined` when it was not an object.
 */
export function pullAntenna(state, point, { now = 0 } = {}) {
  const current = antennaPrepare(state);
  if (current === undefined) return undefined;

  const at = antennaFinite(now, 0);
  const previousAngle = current.angle;
  const previousLength = current.length;
  antennaAim(current, point);

  if (current.dragged === true) {
    const elapsed = (at - current.dragAt) / 1000;
    if (elapsed > 0 && elapsed <= ANTENNA_DRAG_GAP) {
      const rawAngle = antennaClamp(
        (current.angle - previousAngle) / elapsed,
        -ANTENNA_MAX_ANGULAR_VELOCITY,
        ANTENNA_MAX_ANGULAR_VELOCITY,
      );
      const rawLength = antennaClamp(
        (current.length - previousLength) / elapsed,
        -ANTENNA_MAX_LENGTH_VELOCITY,
        ANTENNA_MAX_LENGTH_VELOCITY,
      );
      // Frame-rate independent smoothing: a long frame counts for more than a
      // short one, so a 144 Hz pointer and a 30 Hz one end up with similar toss.
      const blend = 1 - Math.exp(-elapsed / ANTENNA_DRAG_SMOOTHING);
      current.dragVelocity.angle += (rawAngle - current.dragVelocity.angle) * blend;
      current.dragVelocity.length += (rawLength - current.dragVelocity.length) * blend;
    } else if (elapsed > ANTENNA_DRAG_GAP) {
      // A pause before moving is not a flick.
      current.dragVelocity.angle = 0;
      current.dragVelocity.length = 0;
    }
    current.dragAt = at;
  } else {
    // The first sample of a gesture has no previous point to difference.
    current.dragged = true;
    current.dragVelocity.angle = 0;
    current.dragVelocity.length = 0;
    current.dragAt = at;
  }
  return current;
}

/**
 * Let go of the bulb.
 *
 * The smoothed drag velocity becomes the spring's initial velocity, clamped, and
 * the angle and length are left exactly where the pointer released them. `now` is
 * accepted for interface symmetry; the toss itself is the smoothed drag velocity
 * recorded by {@link pullAntenna}.
 *
 * @param state - the antenna state.
 * @param options.now - accepted for symmetry with `pullAntenna`.
 * @returns the same state, or `undefined` when it was not an object.
 */
export function releaseAntenna(state, { now = 0 } = {}) {
  void now;
  const current = antennaPrepare(state);
  if (current === undefined) return undefined;
  current.angularVelocity = antennaClamp(
    current.dragVelocity.angle,
    -ANTENNA_MAX_ANGULAR_VELOCITY,
    ANTENNA_MAX_ANGULAR_VELOCITY,
  );
  current.lengthVelocity = antennaClamp(
    current.dragVelocity.length,
    -ANTENNA_MAX_LENGTH_VELOCITY,
    ANTENNA_MAX_LENGTH_VELOCITY,
  );
  current.dragged = false;
  current.dragVelocity.angle = 0;
  current.dragVelocity.length = 0;
  return current;
}

/**
 * Where the bulb centre is.
 *
 * This is the raw pose, not a clamped drawing position: it is the same formula
 * the tests and the handle positioning use. `drawAntenna` clamps when it paints.
 *
 * @param state - the antenna state.
 * @returns `{ x, y }` in cell pixels.
 */
export function antennaTip(state) {
  if (state === null || state === undefined || typeof state !== 'object') return { x: 0, y: 0 };
  const anchor = antennaBasePoint(state.anchor);
  const angle = antennaFinite(state.angle, 0);
  const length = antennaFinite(state.length, 0);
  return antennaProject(anchor, angle, length);
}

/**
 * The three points the stem is drawn through: base, middle, tip.
 *
 * @param state - the antenna state.
 * @returns `[base, mid, tip]`, all finite cell coordinates.
 */
export function antennaSegments(state) {
  if (state === null || state === undefined || typeof state !== 'object') {
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
  }
  const base = antennaBasePoint(state.anchor);
  const tip = antennaTip(state);
  return [base, { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 }, tip];
}

/** Paint one 1x1 pixel, refusing anything outside the canvas. */
function antennaPixel(context, x, y, size) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) return;
  context.fillRect(x, y, 1, 1);
}

/**
 * Plot a one-pixel Bresenham line.
 *
 * The guard keeps a corrupted (enormously long) state from spinning the frame
 * loop: a 32px cell can only need so many steps, and pixels outside the canvas
 * are dropped by {@link antennaPixel}.
 */
function antennaLine(context, fromX, fromY, toX, toY, size) {
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const endX = Math.round(toX);
  const endY = Math.round(toY);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(endX) || !Number.isFinite(endY)) return;
  const deltaX = Math.abs(endX - x);
  const deltaY = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = deltaX + deltaY;
  const limit = size * 2 + 4;
  for (let index = 0; index <= limit; index += 1) {
    antennaPixel(context, x, y, size);
    if (x === endX && y === endY) return;
    const doubled = 2 * error;
    if (doubled >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubled <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

/**
 * Paint the antenna into a 32x32 (or `cell`-sized) canvas.
 *
 * Clears first, then draws the stem through {@link antennaSegments} as dark
 * pixels with one light glint, then stamps {@link ANTENNA_BULB} centred on the
 * tip. Every fill is a 1x1 `fillRect` inside `0..cell-1`; the bulb's origin is
 * clamped so even a hand-built state cannot paint outside the canvas.
 *
 * @param context - a 2d context (or a recording stub with the same methods).
 * @param state - the antenna state.
 * @param options.cell - canvas edge in pixels, default 32.
 */
export function drawAntenna(context, state, { cell = 32 } = {}) {
  if (
    context === null ||
    context === undefined ||
    typeof context.fillRect !== 'function' ||
    typeof context.clearRect !== 'function'
  ) {
    return;
  }
  const size = Math.max(1, Math.floor(antennaFinite(cell, 32)));
  context.clearRect(0, 0, size, size);

  const [base, mid, tip] = antennaSegments(state);
  context.fillStyle = ANTENNA_STYLE.stem;
  antennaLine(context, base.x, base.y, mid.x, mid.y, size);
  antennaLine(context, mid.x, mid.y, tip.x, tip.y, size);

  // One lit pixel on the stalk, just above the crown.
  const glintX = Math.round(mid.x);
  const glintY = Math.round(mid.y);
  if (glintX >= 0 && glintX < size && glintY >= 0 && glintY < size) {
    context.fillStyle = ANTENNA_STYLE.stemLight;
    context.fillRect(glintX, glintY, 1, 1);
  }

  const patternWidth = ANTENNA_BULB[0].length;
  const patternHeight = ANTENNA_BULB.length;
  if (size < patternWidth || size < patternHeight) return;
  const originX = antennaClamp(Math.round(tip.x) - Math.floor(patternWidth / 2), 0, size - patternWidth);
  const originY = antennaClamp(Math.round(tip.y) - Math.floor(patternHeight / 2), 0, size - patternHeight);
  const palette = {
    '#': ANTENNA_STYLE.outline,
    y: ANTENNA_STYLE.bulb,
    Y: ANTENNA_STYLE.highlight,
  };
  for (let row = 0; row < patternHeight; row += 1) {
    const line = ANTENNA_BULB[row];
    for (let column = 0; column < patternWidth; column += 1) {
      const character = line[column];
      if (character === '.' || character === undefined) continue;
      const colour = palette[character];
      if (colour === undefined) continue;
      context.fillStyle = colour;
      context.fillRect(originX + column, originY + row, 1, 1);
    }
  }
}
