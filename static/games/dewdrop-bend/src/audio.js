/**
 * A tiny procedural pond soundscape. No samples, no external files.
 *
 * Signal flow (one AudioContext for the whole app):
 *
 *   daytime water bed ───────────────► waterBus ─┐
 *   day bird calls ─────────────────► birdBus ──┤
 *   night water + crickets + owl ───► nightBus ─┼─► master ─► destination
 *   rain bed + droplet ticks ───────► rainBus ──┘
 *
 * `master` is the mute gain controlled by `enabled`. The four climate buses are
 * faded with `setTargetAtTime`, so muting and day/night/weather changes never
 * click. One-shots the player triggers (plop, chime, seed, flutter, croak,
 * buzz, splash) still connect straight to the master so existing interactions
 * keep their levels and never fight the ambience buses.
 */
export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseSource = null;
    this.noiseGain = null;

    // Climate buses and buffers; created once in start() with the context.
    this.waterBus = null;
    this.birdBus = null;
    this.nightBus = null;
    this.rainBus = null;
    this.waterBuffer = null;
    this.rainBuffer = null;

    this.enabled = true;
    this.started = false;

    /**
     * Current climate targets, clamp-safe even before start() and while muted.
     * night: 0 = full day ... 1 = full night
     * rain:  0 = dry ... 1 = steady soft rain
     */
    this.nightFactor = 0;
    this.rainFactor = 0;
    this.appliedClimate = { water: -1, bird: -1, night: -1, rain: -1 };

    // Sparse ambience schedulers, in seconds until the next event.
    this.birdTimer = 5 + Math.random() * 6;
    this.cricketTimer = 0.6 + Math.random() * 1.4;
    this.owlTimer = 16 + Math.random() * 24;
    this.dropletTimer = 0.2 + Math.random() * 0.5;

    this.ambientLevel = 0.032;
    this.supported = typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  start() {
    if (!this.supported || this.started) {
      if (this.context?.state === "suspended") this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.65 : 0;
    this.master.connect(this.context.destination);
    this.#createBuses();
    this.started = true;
    this.#startWater();
    this.#startNightWater();
    this.#startRainBed();
    this.#applyClimate(true);
    if (this.context.state === "suspended") this.context.resume();
  }

  /** Four gain buses, all quiet until #applyClimate sets their targets. */
  #createBuses() {
    const ctx = this.context;
    const makeBus = () => {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      return bus;
    };
    this.waterBus = makeBus();
    this.birdBus = makeBus();
    this.nightBus = makeBus();
    this.rainBus = makeBus();
  }

  #startWater() {
    const ctx = this.context;
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last;
    }
    this.waterBuffer = buffer;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = this.ambientLevel;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.waterBus);
    source.start();
    this.noiseSource = source;
    this.noiseGain = gain;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = this.ambientLevel * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  /**
   * A very still, dark water layer for the night. It fades in with nightBus
   * (which tops out at 1) and sits far below the daytime lapping.
   */
  #startNightWater() {
    const ctx = this.context;
    if (!ctx || !this.waterBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.waterBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 430;
    filter.Q.value = 0.3;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 0.0035;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.nightBus);
    // Offset the loop so it never phase-locks with the daytime water bed.
    source.start(0, 1.5);
    lfo.start();
  }

  /**
   * Pink-noise rain bed: a high hiss layer plus a low body layer, both routed
   * through rainBus. rainBus stays at 0 when dry, so this costs no sound.
   */
  #startRainBed() {
    const ctx = this.context;
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink));
    }
    this.rainBuffer = buffer;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const hiss = ctx.createBiquadFilter();
    hiss.type = "highpass";
    hiss.frequency.value = 1400;
    hiss.Q.value = 0.4;
    const hissTop = ctx.createBiquadFilter();
    hissTop.type = "lowpass";
    hissTop.frequency.value = 6500;
    hissTop.Q.value = 0.3;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.011;

    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 700;
    body.Q.value = 0.5;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.013;

    source.connect(hiss);
    hiss.connect(hissTop);
    hissTop.connect(hissGain);
    hissGain.connect(this.rainBus);
    source.connect(body);
    body.connect(bodyGain);
    bodyGain.connect(this.rainBus);

    // A slow swell keeps the noise from sounding like flat static.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.003;
    lfo.connect(lfoGain);
    lfoGain.connect(hissGain.gain);
    source.start(0, Math.random() * 2);
    lfo.start();
  }

  get isAudible() {
    return this.enabled && this.started && this.context?.state === "running";
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.start();
      if (this.context?.state === "suspended") await this.context.resume();
    }
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.enabled ? 0.65 : 0, now, 0.06);
    }
    return this.enabled;
  }

  /**
   * Crossfade the pond between day and night.
   *
   * factor 0 = full day (normal water bed, daytime birds)
   * factor 1 = full night (birds stop, water falls to a very quiet still bed,
   *            sparse cricket chirps and an occasional distant owl)
   *
   * Values are clamped to 0..1; non-finite input is treated as day (0). Safe to
   * call every frame, before start(), or while muted. Fades take ~1-2 seconds,
   * so a dragged clock or a hard dusk switch still sounds gentle.
   *
   * @param {number} factor 0 (day) to 1 (night)
   * @returns {number} the clamped factor now stored
   */
  setNight(factor = 0) {
    const value = this.#clamp01(factor);
    this.nightFactor = value;
    this.#applyClimate();
    return value;
  }

  /**
   * Blend the soft procedural rain bed and sparse droplet ticks in or out.
   *
   * factor 0 = dry
   * factor 1 = steady, soft rain with droplets ticking on the pond
   *
   * Values are clamped to 0..1; non-finite input is treated as dry (0). Above
   * roughly 0.06 droplets begin; at higher levels the rain gently ducks the
   * daytime birds and the water bed so it never fights them. Safe before
   * start(), while muted, or every frame; the bus fade takes under a second.
   *
   * @param {number} factor 0 (dry) to 1 (rain)
   * @returns {number} the clamped factor now stored
   */
  setRain(factor = 0) {
    const value = this.#clamp01(factor);
    this.rainFactor = value;
    this.#applyClimate();
    return value;
  }

  /**
   * Bus targets for the current climate. Ramp targets, not node levels, are
   * cached in appliedClimate so per-frame calls only schedule real changes.
   */
  #applyClimate(immediate = false) {
    if (!this.context || !this.waterBus || !this.birdBus || !this.nightBus || !this.rainBus) return;
    const now = this.context.currentTime;
    const night = this.nightFactor;
    const rain = this.rainFactor;
    // "A little" ducking: about -3 dB on water and -5 dB on birds at full rain.
    const rainDuck = 1 - 0.28 * rain;
    const buses = [
      ["water", this.waterBus, (1 - 0.82 * night) * rainDuck, 1.2],
      ["bird", this.birdBus, Math.pow(1 - night, 1.5) * (1 - 0.45 * rain), 1.6],
      ["night", this.nightBus, Math.pow(night, 1.25), 1.4],
      ["rain", this.rainBus, rain, 0.7],
    ];

    for (const [key, bus, target, timeConstant] of buses) {
      if (immediate) {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(target, now);
        this.appliedClimate[key] = target;
        continue;
      }
      // Never reschedule an unchanged target. Endpoints (0/1) must still land
      // exactly so birds and rain fully stop; tiny in-between changes stay
      // unscheduled to keep per-frame updates cheap.
      if (target === this.appliedClimate[key]) continue;
      if (target !== 0 && target !== 1 && Math.abs(target - this.appliedClimate[key]) < 0.004) continue;
      bus.gain.setTargetAtTime(target, now, timeConstant);
      this.appliedClimate[key] = target;
    }
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return number < 0 ? 0 : number > 1 ? 1 : number;
  }

  update(dt) {
    if (!this.isAudible) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.5) : 0;
    if (!step) return;
    const night = this.nightFactor;
    const rain = this.rainFactor;

    this.birdTimer -= step;
    if (this.birdTimer <= 0) {
      // Birds thin out through dusk and stop at full night; rain also keeps
      // them quieter and less frequent, but the birdBus handles the level.
      if (night < 0.55) this.#bird();
      // Keep the original daytime rhythm; dusk and rain stretch the gaps.
      this.birdTimer = 8 + Math.random() * 12 + night * 8 + rain * 10;
    }

    if (night > 0.3) {
      this.cricketTimer -= step;
      if (this.cricketTimer <= 0) {
        if (night > 0.4) this.#cricket();
        this.cricketTimer = 0.7 + Math.random() * 1.8 + (1 - night) * 1.6;
      }
    }

    if (night > 0.55) {
      this.owlTimer -= step;
      if (this.owlTimer <= 0) {
        this.#owl();
        this.owlTimer = 24 + Math.random() * 34;
      }
    }

    if (rain > 0.06) {
      this.dropletTimer -= step;
      if (this.dropletTimer <= 0) {
        this.#droplet();
        this.dropletTimer = (0.45 + (1 - rain) * 2.4) * (0.65 + Math.random() * 0.7);
      }
    }
  }

  #env(duration, peak, attack = 0.01) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(this.master);
    return gain;
  }

  #tone(type, from, to, duration, peak = 0.05, attack = 0.01) {
    if (!this.isAudible) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    const env = this.#env(duration, peak, attack);
    osc.connect(env);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  /**
   * Optional stereo placement for sparse night/rain events. Returns the
   * destination unchanged when panning is unavailable or the pan is centred.
   */
  #panOutput(destination, pan) {
    const ctx = this.context;
    if (!destination || !ctx || typeof ctx.createStereoPanner !== "function") return destination;
    if (Math.abs(pan) < 0.05) return destination;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(destination);
    return panner;
  }

  #bird() {
    if (!this.isAudible) return;
    const base = 1250 + Math.random() * 500;
    const count = 2 + Math.floor(Math.random() * 3);
    const dest = this.birdBus || this.master;
    for (let i = 0; i < count; i += 1) {
      const ctx = this.context;
      const when = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base + i * 55, when);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5 + i * 80, when + 0.07);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.035, when + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);
      osc.connect(env);
      env.connect(dest);
      osc.start(when);
      osc.stop(when + 0.13);
    }
  }

  /** Sparse, high, very quiet cricket chirp: 3-5 short sine pulses. */
  #cricket() {
    if (!this.isAudible || !this.nightBus) return;
    const ctx = this.context;
    const start = ctx.currentTime + 0.02;
    const base = 3300 + Math.random() * 900;
    const pulses = 3 + Math.floor(Math.random() * 3);
    const dest = this.#panOutput(this.nightBus, (Math.random() * 2 - 1) * 0.7);
    for (let pulse = 0; pulse < pulses; pulse += 1) {
      const when = start + pulse * 0.082;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base, when);
      osc.frequency.exponentialRampToValueAtTime(base * 1.08, when + 0.028);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.0065, when + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.032);
      osc.connect(env);
      env.connect(dest);
      osc.start(when);
      osc.stop(when + 0.04);
    }
  }

  /** A rare, distant "hoo ... hoo-hoo", low and soft, off to one side. */
  #owl() {
    if (!this.isAudible || !this.nightBus) return;
    const ctx = this.context;
    const start = ctx.currentTime + 0.03;
    const base = 330 + Math.random() * 55;
    const dest = this.#panOutput(this.nightBus, (Math.random() * 2 - 1) * 0.65);
    const hoots = [
      { at: 0, length: 0.42, level: 1 },
      { at: 0.68, length: 0.22, level: 0.72 },
      { at: 0.97, length: 0.32, level: 0.85 },
    ];
    for (const hoot of hoots) {
      const when = start + hoot.at;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(base * 1.04, when);
      osc.frequency.exponentialRampToValueAtTime(base * 0.94, when + hoot.length);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 520;
      filter.Q.value = 1.2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.014 * hoot.level, when + 0.055);
      env.gain.exponentialRampToValueAtTime(0.006 * hoot.level, when + hoot.length * 0.68);
      env.gain.exponentialRampToValueAtTime(0.0001, when + hoot.length);
      osc.connect(filter);
      filter.connect(env);
      env.connect(dest);
      osc.start(when);
      osc.stop(when + hoot.length + 0.03);
    }
  }

  /** A tiny bandpassed noise tick from the rain bed, randomly placed. */
  #droplet() {
    if (!this.isAudible || !this.rainBuffer) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.rainBuffer;
    const offset = Math.random() * Math.max(0, this.rainBuffer.duration - 0.12);
    source.start(now, offset, 0.09);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800 + Math.random() * 3200;
    band.Q.value = 2.2;
    const env = ctx.createGain();
    const peak = 0.0035 + Math.random() * 0.0025;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    source.connect(band);
    band.connect(env);
    env.connect(this.#panOutput(this.rainBus, (Math.random() * 2 - 1) * 0.7));
  }

  plop(strength = 1) {
    if (!this.isAudible) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    this.#tone("sine", 340 + Math.random() * 80, 95, 0.18, 0.055 * strength, 0.006);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.022 * strength, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  chime(level = 1) {
    if (!this.isAudible) return;
    const notes = level > 1 ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const ctx = this.context;
      const when = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, when);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.035, when + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
      osc.connect(env);
      env.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.45);
    });
  }

  croak(pitch = 1) {
    if (!this.isAudible) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const base = 92 * pitch;
    for (let pulse = 0; pulse < 3; pulse += 1) {
      const when = now + pulse * 0.085;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(base + pulse * 4, when);
      osc.frequency.linearRampToValueAtTime(base * 0.82, when + 0.07);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 380;
      filter.Q.value = 2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(0.055, when + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.075);
      osc.connect(filter);
      filter.connect(env);
      env.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.09);
    }
  }

  buzz(duration = 0.45, pitch = 1) {
    if (!this.isAudible) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 145 * pitch;
    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    tremolo.frequency.value = 23;
    tremoloGain.gain.value = 0.018;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.025, now + 0.035);
    env.gain.setValueAtTime(0.025, now + duration - 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(env.gain);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    tremolo.start(now);
    osc.stop(now + duration + 0.02);
    tremolo.stop(now + duration + 0.02);
  }

  flutter() {
    if (!this.isAudible) return;
    this.#tone("triangle", 780, 520, 0.09, 0.012, 0.004);
  }

  seed() {
    if (!this.isAudible) return;
    this.#tone("sine", 420, 680, 0.13, 0.03, 0.015);
  }

  splash(strength = 1) {
    if (!this.isAudible) return;
    this.plop(strength);
    this.#tone("triangle", 1200, 420, 0.16, 0.012 * strength, 0.005);
  }

  suspend() {
    if (this.context?.state === "running") this.context.suspend().catch(() => {});
  }

  resume() {
    if (this.enabled && this.context?.state === "suspended") this.context.resume().catch(() => {});
  }
}
