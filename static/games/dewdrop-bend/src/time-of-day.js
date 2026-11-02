/**
 * Dewdrop Bend — pure 24-hour clock and celestial model.
 *
 * One real second is one game minute, but this module knows nothing about the
 * frame clock: callers pass local minutes after midnight and get back a plain
 * object describing the sky. There is no canvas, DOM or mutable module state
 * here, so for a given `(minutes, date)` pair the result is deterministic.
 *
 * Schedule, in local minutes after midnight:
 *
 *   sunrise 05:30 (330) ......... sunset 18:30 (1110)
 *   moonrise 18:00 (1080) ....... moonset 06:00 (360, wraps)
 *   dawn 04:30-06:30 ............ day 07:00-16:30
 *   golden hour 16:30-18:30 ..... dusk 18:00-20:30
 *   night 20:00-04:30 (wraps)
 *
 * The sun and moon expose a normalized arc. `progress` (also available as
 * `x`) runs 0 at the eastern horizon to 1 at the western horizon; `altitude`
 * runs 0 at the horizon to 1 at the arc's peak. `alpha` fades to zero at both
 * ends of the arc, so the renderer never has to work out whether a body is in
 * view. The world renderer maps these normalized values to its own canvas.
 *
 * The light factors overlap on purpose. They are blend weights, not exclusive
 * states: a sunset frame may legitimately use day + golden + dusk + twilight
 * at the same time. Every factor is clamped to [0, 1].
 */

/** Length of one full local day, in minutes. */
export const MINUTES_PER_DAY = 1440;

/** Local minutes at which the sun reaches the horizon. */
const SUNRISE = 5 * 60 + 30;
const SUNSET = 18 * 60 + 30;

/** Local minutes at which the moon reaches the horizon (the arc wraps midnight). */
const MOONRISE = 18 * 60;
const MOONSET = 6 * 60;

const SUN_ARC = SUNSET - SUNRISE; // 780 minutes
const MOON_ARC = (MOONSET + MINUTES_PER_DAY - MOONRISE) % MINUTES_PER_DAY; // 720 minutes

/** Celestial bodies fade in/out over this many minutes at each horizon. */
const SUN_EDGE_FADE = 8;
const MOON_EDGE_FADE = 8;

/** Phase windows, in local minutes. Edges are blended by smoothstep. */
const DAWN_START = 4 * 60 + 30;
const DAWN_PEAK = 5 * 60 + 30;
const DAWN_END = 6 * 60 + 30;

const DAY_RAMP_START = 6 * 60;
const DAY_START = 7 * 60;
const DAY_END = 16 * 60 + 30;

const GOLDEN_START = 16 * 60 + 30;
const GOLDEN_FULL = 17 * 60;
const GOLDEN_FADE_START = 18 * 60;

const DUSK_START = 18 * 60;
const DUSK_FULL = 19 * 60;
const DUSK_END = 20 * 60 + 30;

const NIGHT_START = 20 * 60;
const NIGHT_END = 4 * 60 + 30;
const NIGHT_FADE_IN = 30;
const NIGHT_FADE_OUT = 60;

const DAY_MS = 86400000;
const SYNODIC_MONTH_DAYS = 29.53058867;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
/** 2000-01-06 18:14 UTC, a known new moon. */
const NEW_MOON_REFERENCE_MS = Date.UTC(2000, 0, 6, 18, 14);

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Classic Hermite smoothstep with inclusive edges; returns a value in [0, 1]. */
function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Wrap any finite number of minutes into the half-open range [0, 1440).
 *
 * Positive and negative wrapping are both supported, so -1 becomes 23:59 and
 * 1440 becomes 00:00. Non-finite input (NaN, ±Infinity, undefined) collapses
 * to 0 (midnight) rather than poisoning every derived value with NaN.
 *
 * @param {number} value Minutes, possibly fractional and possibly out of range.
 * @returns {number} Equivalent minutes in [0, 1440).
 */
export function normalizeMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  // Keep already-normalized values bit-for-bit exact; the modulo round trip
  // would otherwise turn 59.9 into 59.90000000000009.
  if (numeric >= 0 && numeric < MINUTES_PER_DAY) return numeric === 0 ? 0 : numeric;
  const wrapped = numeric % MINUTES_PER_DAY;
  if (wrapped === 0) return 0;
  return wrapped < 0 ? wrapped + MINUTES_PER_DAY : wrapped;
}

/**
 * Read a Date as fractional local minutes after midnight.
 *
 * This is the boot-time bridge from the browser's wall clock to the game
 * clock. Seconds become 1/60 minute; milliseconds are deliberately ignored so
 * the clock advances in minute-sized steps. Pass a valid Date; an invalid one
 * naturally yields NaN.
 *
 * @param {Date} [date] Local date to read. Defaults to now.
 * @returns {number} Local minutes after midnight, in [0, 1440).
 */
export function minutesFromDate(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/**
 * Format minutes as a 24-hour local clock string.
 *
 * The value is wrapped first, then floored to the current whole minute, so
 * 23:59.9 displays as "23:59" and 1440 displays as "00:00".
 *
 * @param {number} minutes Minutes after midnight.
 * @returns {string} "HH:MM" with two-digit hours and minutes.
 */
export function formatClock(minutes) {
  const total = Math.floor(normalizeMinutes(minutes));
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Darkness factor for the wrapped night window (20:00-04:30).
 *
 * Night is fully on from 20:00 through 04:30, fades in over the half hour
 * before 20:00, and fades out over the hour after 04:30 as dawn arrives.
 */
function nightFactor(minutes) {
  if (minutes >= NIGHT_START || minutes <= NIGHT_END) return 1;
  if (minutes >= NIGHT_START - NIGHT_FADE_IN) {
    return smoothstep(NIGHT_START - NIGHT_FADE_IN, NIGHT_START, minutes);
  }
  if (minutes <= NIGHT_END + NIGHT_FADE_OUT) {
    return 1 - smoothstep(NIGHT_END, NIGHT_END + NIGHT_FADE_OUT, minutes);
  }
  return 0;
}

/**
 * Normalized sun state at a wrapped minute value.
 *
 * The sun is geometrically visible from 05:30 through 18:30 inclusive. At the
 * exact horizon minutes alpha is 0 and altitude is 0, so the renderer can skip
 * drawing it without a special case. Outside the arc, progress stays clamped
 * to the nearer horizon (0 before sunrise, 1 after sunset).
 */
function sunState(minutes) {
  const visible = minutes >= SUNRISE && minutes <= SUNSET;
  const progress = clamp01((minutes - SUNRISE) / SUN_ARC);
  const altitude = visible && progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) : 0;
  const alpha =
    smoothstep(SUNRISE, SUNRISE + SUN_EDGE_FADE, minutes) *
    (1 - smoothstep(SUNSET - SUN_EDGE_FADE, SUNSET, minutes));
  return { visible, alpha, progress, altitude, x: progress };
}

/**
 * Normalized moon state at a wrapped minute value.
 *
 * The moon rises at 18:00 and sets at 06:00, so its second arc peaks at
 * midnight. `visible` is true from 18:00 through 06:00 inclusive; alpha fades
 * over the first/last hour of that arc. During the daytime arc gap (06:00-
 * 18:00) it is invisible and progress stays at 1 (it has completed the arc).
 * The synodic phase is independent of the clock and comes from `date` (see
 * `moonPhase`).
 *
 * @param {number} minutes Wrapped local minutes.
 * @param {Date} date Instant used to place the moon in its real synodic cycle.
 */
function moonState(minutes, date) {
  const elapsed = normalizeMinutes(minutes - MOONRISE);
  const visible = elapsed <= MOON_ARC;
  const progress = Math.min(elapsed / MOON_ARC, 1);
  const altitude = visible && progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) : 0;
  const alpha = visible
    ? smoothstep(0, MOON_EDGE_FADE, elapsed) *
      (1 - smoothstep(MOON_ARC - MOON_EDGE_FADE, MOON_ARC, elapsed))
    : 0;
  return { visible, alpha, progress, altitude, phase: moonPhase(date), x: progress };
}

/**
 * Real synodic moon phase, 0 = new, 0.5 = full.
 *
 * The reference new moon is 2000-01-06 18:14 UTC and one cycle is
 * 29.53058867 days. The phase is returned in [0, 1) and is intended for a
 * subtle, slowly changing moon shape; the renderer may ignore it entirely.
 * A missing or invalid date falls back to phase 0.
 *
 * @param {Date|number} [date] Instant (or epoch milliseconds) to evaluate.
 * @returns {number} Synodic phase in [0, 1).
 */
function moonPhase(date) {
  const instant = date instanceof Date ? date.getTime() : Number(date);
  if (!Number.isFinite(instant)) return 0;
  const cycles = (instant - NEW_MOON_REFERENCE_MS) / SYNODIC_MONTH_MS;
  return cycles - Math.floor(cycles);
}

/**
 * Everything the renderer needs for one clock value.
 *
 * Pure for a given `(minutes, date)` pair: no canvas dimensions, DOM or module
 * state are touched. `date` is used only for the synodic moon phase; pass a
 * fixed Date in tests/screenshots and omit it in the running game.
 *
 * Returned shape:
 *
 *   {
 *     minutes, hour, minute, progress,          // clock
 *     sun:  { visible, alpha, progress, altitude, x },
 *     moon: { visible, alpha, progress, altitude, phase, x },
 *     light: {
 *       night, dawn, day, golden, dusk, twilight,
 *       moonlight, fireflies, stars,
 *     },
 *     stars,                                    // === light.stars
 *   }
 *
 * `minutes` keeps its fractional part (seconds as 1/60 minute); `hour` and
 * `minute` are the whole local clock fields. `progress` is day progress in
 * [0, 1), 0 at midnight. Every alpha and light factor is in [0, 1].
 *
 * Light factor semantics:
 *   night     1 from 20:00 through 04:30; ramps 19:30-20:00, fades 04:30-05:30.
 *   dawn      morning colour over 04:30-06:30, peaking at sunrise 05:30.
 *   day       full 07:00-16:30; ramps 06:00-07:00, fades 16:30-18:30.
 *   golden    ramps 16:30-17:00, full 17:00-18:00, fades 18:00-18:30.
 *   dusk      ramps 18:00-19:00, full 19:00-20:00, fades 20:00-20:30.
 *   twilight  (1 - sun.alpha) * (1 - night): no direct sun, but not full night.
 *   moonlight moon.alpha * night.
 *   fireflies smoothstep(0.2, 0.85, night).
 *   stars     smoothstep(0.55, 0.95, night); strong only in the dark.
 *
 * @param {number} minutes Local minutes after midnight; wrapped internally.
 * @param {Date|number} [date] Instant for the moon phase. Defaults to now.
 * @returns {object} The complete day state.
 */
export function getDayState(minutes, date = new Date()) {
  const time = normalizeMinutes(minutes);
  const hour = Math.floor(time / 60);
  const minute = Math.floor(time % 60);

  const sun = sunState(time);
  const moon = moonState(time, date);

  const dawn =
    smoothstep(DAWN_START, DAWN_PEAK, time) * (1 - smoothstep(DAWN_PEAK, DAWN_END, time));
  const day =
    smoothstep(DAY_RAMP_START, DAY_START, time) * (1 - smoothstep(DAY_END, SUNSET, time));
  const golden =
    smoothstep(GOLDEN_START, GOLDEN_FULL, time) *
    (1 - smoothstep(GOLDEN_FADE_START, SUNSET, time));
  const dusk =
    smoothstep(DUSK_START, DUSK_FULL, time) *
    (1 - smoothstep(NIGHT_START, DUSK_END, time));
  const night = nightFactor(time);
  const twilight = (1 - sun.alpha) * (1 - night);
  const moonlight = moon.alpha * night;
  const fireflies = smoothstep(0.2, 0.85, night);
  const stars = smoothstep(0.55, 0.95, night);

  return {
    minutes: time,
    hour,
    minute,
    progress: time / MINUTES_PER_DAY,
    sun,
    moon,
    light: {
      night,
      dawn,
      day,
      golden,
      dusk,
      twilight,
      moonlight,
      fireflies,
      stars,
    },
    stars,
  };
}
