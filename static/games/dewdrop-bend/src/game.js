import {
  FLOWERS,
  H,
  NOTE_BY_ID,
  NOTES,
  P,
  UI,
  W,
  WORLD,
} from "./config.js";
import { loadAssets, drawSheet } from "./assets.js";
import { World } from "./world.js";
import { Garden } from "./flora.js";
import { CreatureManager } from "./creatures.js";
import { Particles } from "./particles.js";
import { Soundscape } from "./audio.js";
import { Interface } from "./ui.js";
import { Rain } from "./rain.js";
import { WaterTrails } from "./wakes.js";
import { clamp, distance, mulberry32 } from "./utils.js";
import { clockMinutesFromPoint } from "./clock.js";
import { formatClock, minutesFromDate, normalizeMinutes } from "./time-of-day.js";

const TOOL_IDS = new Set(["look", "poppy", "cornflower", "marigold"]);

export class Game {
  static async create(canvas, options = {}) {
    const bundle = await loadAssets();
    return new Game(canvas, bundle, options);
  }

  constructor(canvas, bundle, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.assets = bundle.entries;
    this.assetReport = bundle;
    this.testMode = Boolean(options.testMode);
    this.debugMasks = new URLSearchParams(window.location.search).get("masks") === "1";
    this.reducedMotion = Boolean(options.reducedMotion);
    this.time = 0;
    this.random = mulberry32(3010);
    this.audio = new Soundscape();
    if (this.testMode) this.audio.enabled = false;
    this.world = new World();
    this.clockDate = new Date();
    this.clockMinutes = Number.isFinite(options.startMinutes)
      ? normalizeMinutes(options.startMinutes)
      : minutesFromDate(this.clockDate);
    this.freezeClock = Boolean(options.freezeClock);
    this.clockDrag = null;
    this.world.setClock(this.clockMinutes, this.clockDate);
    this.rainFactor = 0;
    this.rainTarget = options.rain ? 1 : 0;
    this.rain = new Rain({
      onWaterDrop: (x, y) => this.world.addRipple(x, y, 0.7, "rain"),
      isWater: (x, y) => this.world.isWater(x, y),
      waterY: 150,
    });
    this.rain.setIntensity(this.rainTarget);
    this.world.setRain(0);
    this.wakes = new WaterTrails({
      width: W,
      height: H,
      isWater: (x, y) => this.world.isWater(x, y),
    });
    this.particles = new Particles();
    this.garden = new Garden(this.assets);
    this.creatures = new CreatureManager(this);
    this.ui = new Interface(this);
    this.notes = new Set();
    this.events = [];
    this.selectedTool = "look";
    this.pointer = {
      x: W / 2,
      y: H / 2,
      px: W / 2,
      py: H / 2,
      inside: false,
      down: false,
      speed: 0,
    };
    this.hover = null;
    this.plantPreview = null;
    this.activePointerId = null;
    this.lastWindBurst = 0;
    this.lastPointerMove = 0;
    this.lastInteraction = 0;
    this.keyboardMode = false;
    this.keyboardCursor = { x: W / 2, y: H / 2 };
    this.lastKeyboardHoverKey = null;
    this.resetArmedUntil = 0;
    this.pendingCompletionToast = null;
    if (this.testMode) {
      this.ui.dismissIntro();
    }
    this.bindInput();
    this.bindA11y();
    this.syncA11y();
    this.setLive("Dewdrop Bend. Click or press a key to begin. A small interactive pond waits here.");
  }

  bindInput() {
    this.onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const point = this.#eventPoint(event);
      if (!point) return;
      event.preventDefault();
      this.canvas.focus({ preventScroll: true });
      this.audio.start();
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.px = point.x;
      this.pointer.py = point.y;
      this.pointer.inside = true;
      this.pointer.down = true;

      // A first gesture only wakes the pond. It must never ripple, plant or
      // touch anything underneath the title card.
      if (!this.ui.introDismissed) {
        this.#beginFromTitle();
        this.syncA11y();
        this.setLive(
          "Dewdrop Bend is awake. Turn the clock, click the water, plant a seed, or touch a creature. Press K for a keyboard cursor.",
        );
        return;
      }

      this.keyboardMode = false;
      this.syncA11y();
      this.#clearHighlights();
      const clockHand = this.ui.clockHit(point.x, point.y);
      if (clockHand) {
        this.clockDrag = clockHand;
        this.activePointerId = event.pointerId;
        this.canvas.classList.add("cursor-grabbing");
        try {
          this.canvas.setPointerCapture?.(event.pointerId);
        } catch {
          // A synthetic or already-released pointer may not be capturable.
        }
        this.setClock(
          clockMinutesFromPoint(point.x, point.y, UI.clock, clockHand, this.clockMinutes),
        );
        this.#updateHover();
        return;
      }
      const control = this.ui.hitTest(point.x, point.y);
      if (control) {
        this.#handleControl(control);
        this.#updateHover();
        return;
      }
      this.#activateWorld(point.x, point.y);
    };

    this.onPointerMove = (event) => {
      const point = this.#eventPoint(event);
      if (!point) return;
      if (this.keyboardMode) this.#setKeyboardMode(false, { silent: true });
      if (this.clockDrag) {
        this.pointer.x = point.x;
        this.pointer.y = point.y;
        this.pointer.inside = true;
        this.setClock(
          clockMinutesFromPoint(
            point.x,
            point.y,
            UI.clock,
            this.clockDrag,
            this.clockMinutes,
          ),
        );
        return;
      }
      const now = performance.now();
      const elapsed = Math.max(8, now - this.lastPointerMove);
      const dx = point.x - this.pointer.x;
      const dy = point.y - this.pointer.y;
      const speed = Math.min(1400, (Math.hypot(dx, dy) / elapsed) * 1000);
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.speed = speed;
      this.pointer.inside = true;
      this.lastPointerMove = now;
      if (this.ui.introDismissed && speed > 40 && !this.ui.notesOpen) {
        this.world.addWindImpulse(dx, speed);
        if (speed > 100 && this.gameTimeSince(this.lastWindBurst) > 0.18) {
          const inGrass = point.y > 105;
          if (inGrass) {
            this.lastWindBurst = this.time;
            this.particles.windSeedBurst(point.x, point.y, Math.sign(dx) || 1, 1);
          }
        }
      }
    };

    this.onPointerUp = () => {
      this.pointer.down = false;
      if (this.clockDrag) {
        this.clockDrag = null;
        this.canvas.classList.remove("cursor-grabbing");
        if (this.activePointerId !== null) {
          try {
            this.canvas.releasePointerCapture?.(this.activePointerId);
          } catch {
            // The synthetic pointer may already be gone.
          }
          this.activePointerId = null;
        }
        this.setLive(`The clock reads ${formatClock(this.clockMinutes)}.`);
      }
    };

    this.onPointerLeave = () => {
      this.pointer.inside = false;
      this.hover = null;
      this.ui.clockHover = null;
      this.#clearHighlights();
      this.plantPreview = null;
    };

    this.onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key;
      const targetIsButton =
        event.target instanceof HTMLElement &&
        (event.target.tagName === "BUTTON" || event.target.tagName === "INPUT");
      if (targetIsButton && (key === " " || key === "Enter")) return;

      if (!this.ui.introDismissed) {
        // Tab must remain a focus key. Any other meaningful key wakes the pond
        // once, without also acting underneath the title card.
        if (["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"].includes(key)) return;
        this.audio.start();
        this.#beginFromTitle();
        this.syncA11y();
        this.setLive(
          "Dewdrop Bend is awake. Turn the clock, click the water, plant a seed, or touch a creature. Press K for a keyboard cursor.",
        );
        if (key === "k" || key === "K") this.#setKeyboardMode(true);
        event.preventDefault();
        return;
      }

      if (key === "k" || key === "K") {
        this.#setKeyboardMode(!this.keyboardMode);
        event.preventDefault();
        return;
      }

      if (key === "[" || key === "]") {
        this.adjustClock(key === "[" ? -15 : 15);
        event.preventDefault();
        return;
      }

      if (this.ui.notesOpen && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(key)) {
        return;
      }

      if (this.keyboardMode) {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
          if (event.shiftKey) {
            this.adjustClock(key === "ArrowLeft" || key === "ArrowUp" ? -60 : 60);
          } else {
            const stepX = key === "ArrowLeft" ? -5 : key === "ArrowRight" ? 5 : 0;
            const stepY = key === "ArrowUp" ? -4 : key === "ArrowDown" ? 4 : 0;
            this.keyboardCursor.x = clamp(this.keyboardCursor.x + stepX, 1, W - 1);
            this.keyboardCursor.y = clamp(this.keyboardCursor.y + stepY, 1, H - 1);
            this.pointer.x = this.keyboardCursor.x;
            this.pointer.y = this.keyboardCursor.y;
            this.pointer.inside = true;
            this.#updateHover();
          }
          event.preventDefault();
          return;
        }
        if (key === "Enter" || key === " ") {
          const control = this.ui.hitTest(this.pointer.x, this.pointer.y);
          if (control) {
            this.#handleControl(control);
            this.#updateHover();
          } else {
            this.#activateWorld(this.pointer.x, this.pointer.y);
          }
          event.preventDefault();
          return;
        }
      }

      if (key === "1" || key === "2" || key === "3") {
        const id = ["poppy", "cornflower", "marigold"][Number(key) - 1];
        this.selectTool(id);
        event.preventDefault();
      } else if (key === "0" || key === "Escape") {
        if (this.ui.notesOpen) {
          this.ui.closeNotes();
        } else if (this.keyboardMode) {
          this.#setKeyboardMode(false);
        } else {
          this.selectTool("look");
        }
        event.preventDefault();
      } else if (key === "n" || key === "N") {
        this.ui.toggleNotes();
        event.preventDefault();
      } else if (key === "m" || key === "M") {
        this.toggleSound();
        event.preventDefault();
      } else if (key === "p" || key === "P") {
        this.toggleRain();
        event.preventDefault();
      } else if (key === "r" || key === "R") {
        this.requestReset();
        event.preventDefault();
      }
    };

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("keydown", this.onKeyDown);
  }

  setClock(minutes, options = {}) {
    this.clockMinutes = normalizeMinutes(minutes);
    this.world.setClock(this.clockMinutes, this.clockDate);
    this.syncA11y();
    if (options.announce) {
      this.setLive(`The clock reads ${formatClock(this.clockMinutes)}.`);
    }
  }

  adjustClock(delta) {
    this.setClock(this.clockMinutes + delta, { announce: true });
  }

  #setKeyboardMode(active, options = {}) {
    if (active === this.keyboardMode) return;
    this.keyboardMode = active;
    if (active) {
      this.ui.closeNotes();
      this.audio.start();
      this.pointer.inside = true;
      this.pointer.x = this.keyboardCursor.x;
      this.pointer.y = this.keyboardCursor.y;
      this.canvas.focus({ preventScroll: true });
      this.lastKeyboardHoverKey = null;
      this.#updateHover();
      this.syncA11y();
      if (!options.silent) {
        this.setLive("Keyboard cursor on. Arrow keys move, Enter acts, K turns it off.");
      }
    } else {
      this.pointer.inside = false;
      this.hover = null;
      this.plantPreview = null;
      this.lastKeyboardHoverKey = null;
      this.#clearHighlights();
      this.syncA11y();
      if (!options.silent) this.setLive("Keyboard cursor off.");
    }
  }

  #announceKeyboardHover() {
    if (!this.keyboardMode) {
      this.lastKeyboardHoverKey = null;
      return;
    }
    const hover = this.hover;
    if (!hover) {
      this.lastKeyboardHoverKey = null;
      return;
    }
    let key;
    let text;
    if (hover.type === "creature") {
      key = `creature:${hover.label}`;
      text = `${hover.label}. Press Enter to interact.`;
    } else if (hover.type === "flower") {
      key = `flower:${hover.entity.id}`;
      text = `${hover.label} bloom. Press Enter to shake it.`;
    } else if (hover.type === "pad") {
      key = `pad:${hover.entity.phase}`;
      text = "Lily pad. Press Enter to send a frog hopping.";
    } else if (hover.type === "hive") {
      key = "hive";
      text = "Beehive. Press Enter to call a waggle dance.";
    } else if (hover.type === "water") {
      key = "water";
      text = "Open water. Press Enter to make a ripple.";
    } else if (hover.type === "bank") {
      key = "bank";
      const flower = this.selectedTool === "look" ? null : FLOWERS[this.selectedTool];
      text = flower
        ? `Planting bank. Press Enter to plant ${flower.name}.`
        : "A plantable bank.";
    } else {
      return;
    }
    if (key === this.lastKeyboardHoverKey) return;
    this.lastKeyboardHoverKey = key;
    this.setLive(text);
  }

  bindA11y() {
    const byId = (id) => document.getElementById(id);
    const toolButtonMap = {
      "a11y-explore": "look",
      "a11y-poppy": "poppy",
      "a11y-cornflower": "cornflower",
      "a11y-marigold": "marigold",
    };
    for (const [id, tool] of Object.entries(toolButtonMap)) {
      byId(id)?.addEventListener("click", () => {
        this.#ensureStarted();
        this.#beginFromTitle();
        this.selectTool(tool);
        this.canvas.focus({ preventScroll: true });
      });
    }
    byId("a11y-notes")?.addEventListener("click", () => {
      this.#ensureStarted();
      this.#beginFromTitle();
      this.ui.toggleNotes();
    });
    byId("a11y-sound")?.addEventListener("click", () => this.toggleSound());
    byId("a11y-rain")?.addEventListener("click", () => this.toggleRain());
    byId("a11y-reset")?.addEventListener("click", () => this.requestReset());
    byId("a11y-time")?.addEventListener("input", (event) => {
      this.#beginFromTitle();
      this.setClock(Number(event.target.value));
    });
    byId("a11y-time-earlier")?.addEventListener("click", () => {
      this.#beginFromTitle();
      this.adjustClock(-15);
    });
    byId("a11y-time-later")?.addEventListener("click", () => {
      this.#beginFromTitle();
      this.adjustClock(15);
    });
    byId("a11y-keyboard")?.addEventListener("click", () => {
      this.#ensureStarted();
      this.#beginFromTitle();
      this.#setKeyboardMode(!this.keyboardMode);
      this.canvas.focus({ preventScroll: true });
    });
    this.syncA11y();
  }

  syncA11y() {
    const ids = {
      "a11y-explore": "look",
      "a11y-poppy": "poppy",
      "a11y-cornflower": "cornflower",
      "a11y-marigold": "marigold",
    };
    for (const [id, tool] of Object.entries(ids)) {
      document.getElementById(id)?.setAttribute("aria-pressed", String(this.selectedTool === tool));
    }
    document.getElementById("a11y-notes")?.setAttribute("aria-expanded", String(this.ui.notesOpen));
    document.getElementById("a11y-sound")?.setAttribute("aria-pressed", String(this.audio.enabled));
    const rainButton = document.getElementById("a11y-rain");
    rainButton?.setAttribute("aria-pressed", String(this.rainTarget > 0.5));
    if (rainButton) rainButton.textContent = this.rainTarget > 0.5 ? "Turn off rain" : "Turn on rain";
    const timeValue = Math.floor(this.clockMinutes) % 1440;
    const timeRange = document.getElementById("a11y-time");
    if (timeRange) {
      timeRange.value = String(timeValue);
      timeRange.setAttribute("aria-valuetext", formatClock(timeValue));
    }
    const timeReadout = document.getElementById("a11y-time-readout");
    if (timeReadout) timeReadout.textContent = formatClock(timeValue);
    const keyboardButton = document.getElementById("a11y-keyboard");
    keyboardButton?.setAttribute("aria-pressed", String(this.keyboardMode));
    if (keyboardButton) {
      keyboardButton.textContent = this.keyboardMode
        ? "Turn off keyboard pond cursor"
        : "Turn on keyboard pond cursor";
    }
    const collected = NOTES.filter((note) => this.notes.has(note.id)).map((note) => note.name);
    const remaining = NOTES.filter((note) => !this.notes.has(note.id)).map((note) => note.name);
    const summary = `Field notes: ${this.notes.size} of ${NOTES.length} collected. Collected: ${
      collected.length ? collected.join(", ") : "none yet"
    }. Still to find: ${remaining.length ? remaining.join(", ") : "none"}.`;
    const notesContent = document.getElementById("a11y-notes-content");
    if (notesContent) notesContent.textContent = summary;
  }

  #eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    if (x < 0 || y < 0 || x > W || y > H) return null;
    return { x: clamp(x, 0, W), y: clamp(y, 0, H) };
  }

  /**
   * The one world-interaction path, shared by pointer clicks and the keyboard
   * cursor. Callers have already handled HUD, title card and clock dragging.
   */
  #activateWorld(x, y) {
    // The skep is a large, deliberate landmark. A bee crossing its face should
    // not steal the click from the colony's dance.
    if (this.#hiveHit(x, y)) {
      this.creatures.startWaggleDance();
      this.ui.notify({
        header: "THE HIVE",
        title: "WAGGLE DANCE",
        line: "The colony traces a figure eight in the air.",
        color: P.gold,
      });
      this.setLive("The colony pours out and begins a waggle dance.");
      this.lastInteraction = this.time;
      return true;
    }

    const creature = this.creatures.getHovered(x, y);
    if (creature) {
      creature.interact();
      this.lastInteraction = this.time;
      this.#updateHover();
      return true;
    }

    const pad = this.garden.getPadAt(x, y);
    if (pad) {
      const notesBefore = this.notes.size;
      const hopped = this.creatures.hopToPad(pad);
      if (this.notes.size === notesBefore) {
        this.setLive(hopped ? "A frog hops to a new lily pad." : "A frog answers with a croak.");
      }
      this.lastInteraction = this.time;
      return true;
    }

    // While a seed is selected, a valid bank position wins over the wide
    // flower hitbox. Otherwise a new planting near an existing bloom is
    // impossible to perform.
    if (this.selectedTool !== "look" && this.world.isPlantable(x, y)) {
      const check = this.garden.canPlant(x, y);
      if (check.ok) {
        this.#plantHere(x, y);
        return true;
      }
    }

    const flower = this.garden.getFlowerAt(x, y);
    if (flower) {
      this.garden.shake(flower, this.particles);
      this.audio.flutter();
      this.setLive(`Petals shake loose from the ${FLOWERS[flower.species].name}.`);
      this.lastInteraction = this.time;
      return true;
    }

    if (this.world.isWater(x, y)) {
      return this.dropRipple(x, y, 1.1, true);
    }

    if (this.selectedTool !== "look" && this.world.isPlantable(x, y)) {
      this.#plantHere(x, y);
      return false;
    }

    // An empty click in the grass releases a little seed fluff.
    this.particles.seedFluff(x, y - 4, this.world.wind.direction);
    this.setLive("A little seed fluff drifts from the bank.");
    this.lastInteraction = this.time;
    return false;
  }

  #plantHere(x, y) {
    const result = this.garden.plant(this.selectedTool, x, y);
    if (result.ok) {
      this.audio.seed();
      this.particles.petals(x, y - 2, FLOWERS[this.selectedTool].petal, 3);
      this.particles.pollen(x, y - 5, 4, FLOWERS[this.selectedTool].petal);
      this.ui.notify({
        header: "THE GARDEN",
        title: FLOWERS[this.selectedTool].name,
        line: "Tucked into the bank. Give it a moment to open.",
        color: FLOWERS[this.selectedTool].petal,
      });
      this.setLive(`${FLOWERS[this.selectedTool].name} planted on the bank.`);
    } else {
      this.setLive(result.reason || "That spot is not free.");
    }
    this.lastInteraction = this.time;
    return result.ok;
  }

  #ensureStarted() {
    this.audio.start();
  }

  /**
   * Dismiss the title as a clean wake-up: no action, and no ambient ring that
   * could be mistaken for the player's first click.
   */
  #beginFromTitle() {
    if (this.ui.introDismissed) return;
    this.ui.dismissIntro();
    this.world.ripples.length = 0;
    this.world.ambientRippleClock = 3.5;
  }

  #hiveHit(x, y) {
    return (
      x >= WORLD.hive.x - WORLD.hive.w / 2 &&
      x <= WORLD.hive.x + WORLD.hive.w / 2 &&
      y >= WORLD.hive.y - WORLD.hive.h / 2 &&
      y <= WORLD.hive.y + WORLD.hive.h / 2
    );
  }

  #handleControl(control) {
    if (control.kind === "notesClose" || control.kind === "notesOutside") {
      this.ui.closeNotes();
      return;
    }
    if (control.kind === "notesPanel") return;
    if (control.kind === "tool") {
      this.selectTool(control.id);
      return;
    }
    if (control.kind === "button") {
      if (control.id === "notes") {
        this.ui.toggleNotes();
      } else if (control.id === "sound") {
        this.toggleSound();
      } else if (control.id === "rain") {
        this.toggleRain();
      } else if (control.id === "reset") {
        this.requestReset();
      }
    }
  }

  selectTool(id) {
    if (!TOOL_IDS.has(id)) return;
    if (id === "look") this.selectedTool = "look";
    else this.selectedTool = this.selectedTool === id ? "look" : id;
    this.plantPreview = null;
    this.syncA11y();
    const message =
      this.selectedTool === "look"
        ? "Exploring."
        : `Selected ${FLOWERS[this.selectedTool].name} seed. Click a bank to plant.`;
    this.setLive(message);
  }

  async toggleSound() {
    if (!this.audio.supported) {
      this.setLive("Sound is not available in this browser.");
      return;
    }
    this.#ensureStarted();
    const on = await this.audio.toggle();
    this.syncA11y();
    this.setLive(on ? "Sound on." : "Sound off.");
  }

  toggleRain() {
    this.rainTarget = this.rainTarget > 0.5 ? 0 : 1;
    this.rain.setIntensity(this.rainTarget);
    this.syncA11y();
    this.setLive(this.rainTarget ? "Clouds gather. Rain begins." : "The rain eases. The pond clears.");
  }

  requestReset() {
    if (this.time <= this.resetArmedUntil) {
      this.reset();
      return;
    }
    this.resetArmedUntil = this.time + 4;
    this.ui.closeNotes();
    this.ui.notify({
      header: "HOLD ON",
      title: "RESET THE POND?",
      line: "Press reset again within a moment to begin again.",
      color: P.blush,
    });
    this.setLive("Reset pending. Activate reset again to confirm. This clears field notes and planted flowers.");
  }

  reset() {
    this.notes.clear();
    this.world.reset();
    this.garden.reset();
    this.creatures.reset();
    this.particles.clear();
    this.time = 0;
    this.events.length = 0;
    this.selectedTool = "look";
    this.hover = null;
    this.plantPreview = null;
    this.clockDrag = null;
    this.keyboardMode = false;
    this.pointer.inside = false;
    this.resetArmedUntil = 0;
    this.pendingCompletionToast = null;
    this.rainTarget = 0;
    this.rainFactor = 0;
    this.rain.setIntensity(0);
    this.rain.reset();
    this.world.setRain(0);
    this.wakes.reset();
    if (!this.freezeClock) {
      this.clockDate = new Date();
      this.clockMinutes = minutesFromDate(this.clockDate);
      this.world.setClock(this.clockMinutes, this.clockDate);
    }
    this.ui.reset();
    this.ui.notify({
      header: "THE POND",
      title: "FRESH START",
      line: "Every wing, petal and ripple is new again.",
      color: P.leafHigh,
    });
    this.syncA11y();
    this.setLive("The pond has been reset.");
  }

  dropRipple(x, y, strength = 1, withSplash = true) {
    const added = this.world.addRipple(x, y, strength, "click");
    if (!added) return false;
    if (withSplash) {
      this.particles.splash(x, y, strength);
      this.audio.plop(strength);
    }
    this.setLive("The water ripples.");
    this.lastInteraction = this.time;
    return true;
  }

  recordNote(id, position = {}) {
    const note = NOTE_BY_ID[id];
    if (!note) return false;
    if (this.notes.has(id)) {
      this.particles.sparkle(position.x ?? W / 2, position.y ?? H / 2, 2, position.color ?? P.cream);
      return false;
    }
    this.notes.add(id);
    this.ui.notify({
      title: note.name,
      line: note.line,
      color: position.color ?? P.cream,
      unread: true,
    });
    this.audio.chime(this.notes.size >= NOTES.length ? 2 : 1);
    this.particles.sparkle(position.x ?? W / 2, position.y ?? H / 2, 9, position.color ?? P.cream);
    this.particles.note((position.x ?? W / 2) + 5, (position.y ?? H / 2) - 9, position.color ?? P.cream);
    this.syncA11y();
    this.setLive(`${note.name}. ${note.line} Field notes: ${this.notes.size} of ${NOTES.length}.`);
    if (this.notes.size >= NOTES.length) {
      this.events.push({
        at: this.time + 2.1,
        run: () => {
          const showToast = () => {
            this.ui.notify({
              header: "ALL NOTES FOUND",
              title: "NATURALIST",
              line: "You have met every small life at Dewdrop Bend.",
              color: P.gold,
            });
          };
          if (this.ui.notesOpen) this.pendingCompletionToast = showToast;
          else showToast();
          this.audio.chime(2);
          for (let i = 0; i < 4; i += 1) {
            const x = 60 + i * 65;
            this.particles.sparkle(x, 62 + (i % 2) * 22, 12, P.gold);
          }
          this.setLive("Pond Naturalist. You have met every creature.");
        },
      });
    }
    return true;
  }

  flushPendingToast() {
    if (!this.pendingCompletionToast) return;
    const show = this.pendingCompletionToast;
    this.pendingCompletionToast = null;
    show();
  }

  setLive(message) {
    if (this.lastLive === message) return;
    this.lastLive = message;
    const live = document.getElementById("live");
    if (live) live.textContent = message;
  }

  gameTimeSince(timestamp) {
    return Math.max(0, this.time - timestamp);
  }

  update(dt) {
    this.time += dt;
    const previousMinute = Math.floor(this.clockMinutes);
    if (!this.freezeClock && !this.clockDrag) {
      this.clockMinutes = normalizeMinutes(this.clockMinutes + dt);
      this.world.setClock(this.clockMinutes, this.clockDate);
    }
    this.world.update(dt, this.time);
    this.rain.update(dt, this.time);
    this.rainFactor = this.rain.intensity;
    this.world.setRain(this.rainFactor);
    this.garden.update(dt, this.time, this.world.wind, this.particles, this.audio);
    this.creatures.update(dt);
    const emitters = [];
    for (const strider of this.creatures.striders) {
      emitters.push({
        id: `strider:${strider.seed}`,
        kind: "strider",
        x: strider.x,
        y: strider.y,
        active: true,
        speed: strider.speed,
      });
    }
    for (const tadpole of this.creatures.tadpoles) {
      emitters.push({
        id: `tadpole:${tadpole.seed}`,
        kind: "tadpole",
        x: tadpole.x,
        y: tadpole.y,
        active: true,
      });
    }
    this.wakes.update(dt, this.time, emitters);
    this.particles.update(dt, { wind: this.world.wind, sun: this.world.sun });
    if (!this.reducedMotion) {
      this.particles.ambient(dt, { time: this.time, sun: this.world.sun, wind: this.world.wind });
    }
    this.ui.update(dt, this);
    this.audio.setNight(this.world.dayState.light.night);
    this.audio.setRain(this.rainFactor ?? 0);
    this.audio.update(dt);
    this.#updateHover();
    this.#announceKeyboardHover();
    if (Math.floor(this.clockMinutes) !== previousMinute) this.syncA11y();
    if (this.events.length) {
      for (let i = this.events.length - 1; i >= 0; i -= 1) {
        if (this.events[i].at <= this.time) {
          const event = this.events[i];
          this.events.splice(i, 1);
          event.run();
        }
      }
    }
  }

  #clearHighlights() {
    for (const creature of this.creatures.bees) creature.hovered = false;
    for (const creature of this.creatures.dragonflies) creature.hovered = false;
    for (const creature of this.creatures.butterflies) creature.hovered = false;
    for (const creature of this.creatures.ladybugs) creature.hovered = false;
    for (const creature of this.creatures.ants) creature.hovered = false;
    for (const creature of this.creatures.snails) creature.hovered = false;
    for (const creature of this.creatures.striders) creature.hovered = false;
    for (const creature of this.creatures.tadpoles) creature.hovered = false;
    for (const creature of this.creatures.frogs) creature.hovered = false;
    for (const creature of this.creatures.fireflies) creature.hovered = false;
    for (const creature of this.creatures.gnats) creature.hovered = false;
    this.garden.hoveredFlower = null;
    this.garden.hoveredPad = null;
  }

  #updateHover() {
    this.hover = null;
    this.plantPreview = null;
    this.ui.hoveredControl = null;
    this.ui.clockHover = null;
    this.#clearHighlights();
    if (!this.pointer.inside || this.ui.notesOpen || !this.ui.introDismissed) {
      this.#applyCursor();
      return;
    }
    const clockHand = this.keyboardMode ? null : this.ui.clockHit(this.pointer.x, this.pointer.y);
    this.ui.clockHover = clockHand;
    if (clockHand) {
      this.#applyCursor();
      return;
    }
    const control = this.ui.hitTest(this.pointer.x, this.pointer.y);
    if (control) {
      this.ui.hoveredControl = control;
      this.#applyCursor();
      return;
    }
    const x = this.pointer.x;
    const y = this.pointer.y;
    const creature = this.creatures.getHovered(x, y);
    if (this.#hiveHit(x, y)) {
      this.hover = { type: "hive", label: "BEEHIVE", x: WORLD.hive.x, y: WORLD.hive.y };
      this.#applyCursor();
      return;
    }
    if (creature) {
      creature.hovered = true;
      this.hover = {
        type: "creature",
        entity: creature,
        label: creature.label,
        x: creature.x,
        y: creature.y,
      };
      this.#applyCursor();
      return;
    }
    const pad = this.garden.getPadAt(x, y);
    if (pad) {
      pad.hoverGlow = 1;
      this.garden.hoveredPad = pad;
      this.hover = { type: "pad", entity: pad, label: "LILY PAD", x: pad.x, y: pad.y };
      this.#applyCursor();
      return;
    }
    // In planting mode a valid patch of bank outranks the wider flower hitbox,
    // matching what a click will actually do.
    if (this.selectedTool !== "look" && this.world.isPlantable(x, y)) {
      const validity = this.garden.canPlant(x, y);
      this.plantPreview = validity;
      this.hover = { type: "bank", label: "BANK", x, y };
      this.#applyCursor();
      return;
    }
    const flower = this.garden.getFlowerAt(x, y);
    if (flower) {
      flower.hoverGlow = 1;
      this.garden.hoveredFlower = flower;
      this.hover = {
        type: "flower",
        entity: flower,
        label: FLOWERS[flower.species].name,
        x: flower.x,
        y: flower.y,
      };
      this.#applyCursor();
      return;
    }
    if (this.selectedTool !== "look") {
      if (this.world.isWater(x, y)) {
        this.plantPreview = { ok: false, reason: "THE POND IS NOT A FLOWERBED" };
        this.hover = { type: "water", label: "WATER", x, y };
      }
    } else if (this.world.isWater(x, y)) {
      this.hover = { type: "water", label: "POND", x, y };
    }
    this.#applyCursor();
  }

  #applyCursor() {
    const canvas = this.canvas;
    canvas.classList.remove("cursor-grab", "cursor-grabbing", "cursor-pointer", "cursor-plant");
    if (this.clockDrag) {
      canvas.classList.add("cursor-grabbing");
    } else if (this.ui.clockHover) {
      canvas.classList.add("cursor-grab");
    } else if (this.ui.hoveredControl) {
      canvas.classList.add("cursor-pointer");
    } else if (["creature", "pad", "flower", "hive"].includes(this.hover?.type)) {
      canvas.classList.add("cursor-pointer");
    } else if (
      this.selectedTool !== "look" &&
      (this.hover?.type === "bank" || this.hover?.type === "water")
    ) {
      canvas.classList.add("cursor-plant");
    } else if (this.hover?.type === "water") {
      canvas.classList.add("cursor-pointer");
    }
  }

  #reflectionOccluded(x, y) {
    if (this.garden.getPadAt(x, y)) return true;
    for (const reed of WORLD.reeds) {
      if (Math.abs(x - reed.x) < 13 && y > reed.y - 30 && y < reed.y + 2) return true;
    }
    if (this.creatures.getHovered(x, y)) return true;
    const groups = [
      this.creatures.striders,
      this.creatures.tadpoles,
      this.creatures.frogs,
      this.creatures.dragonflies,
      this.creatures.butterflies,
      this.creatures.bees,
      this.creatures.gnats,
      this.creatures.fireflies,
    ];
    for (const group of groups) {
      for (const critter of group) {
        if (critter.activity !== undefined && critter.activity <= 0.05) continue;
        if (distance(x, y, critter.x, critter.y) < 9) return true;
      }
    }
    return false;
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    this.world.drawBackdrop(ctx, this.assets);
    this.world.drawWater(ctx, this.assets);
    this.wakes.draw(ctx);
    this.world.drawCloudShadows(ctx);
    this.garden.drawPads(ctx, this.assets);
    this.garden.drawFlowers(ctx, this.assets);
    this.creatures.drawWaterLife(ctx, this.assets, this.time);
    this.creatures.drawGround(ctx, this.assets, this.time);
    this.garden.drawForeground(ctx, this.assets, this.world.wind);
    this.creatures.drawAir(ctx, this.assets, this.time);
    this.particles.draw(ctx);
    this.world.drawLight(ctx);
    this.world.drawSky(ctx, this.assets);
    this.world.drawReflectionGlints(ctx, (x, y) => this.#reflectionOccluded(x, y));
    this.creatures.drawFireflies(ctx, this.assets, this.time);
    if (this.rain) this.rain.draw(ctx);
    this.drawPlantGhost(ctx);
    if (this.keyboardMode) this.drawKeyboardCursor(ctx);
    if (this.debugMasks) this.drawDebugMasks(ctx);
    this.ui.draw(ctx, this);
    ctx.restore();
  }

  drawKeyboardCursor(ctx) {
    const x = Math.round(this.pointer.x);
    const y = Math.round(this.pointer.y);
    ctx.save();
    const corner = (sx, sy, offset, size) => {
      const cx = x + sx * offset;
      const cy = y + sy * offset;
      ctx.fillRect(sx < 0 ? cx : cx - size + 1, cy, size, 1);
      ctx.fillRect(cx, sy < 0 ? cy : cy - size + 1, 1, size);
    };
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = P.ink;
    corner(-1, -1, 9, 4);
    corner(1, -1, 9, 4);
    corner(-1, 1, 9, 4);
    corner(1, 1, 9, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.cream;
    corner(-1, -1, 8, 3);
    corner(1, -1, 8, 3);
    corner(-1, 1, 8, 3);
    corner(1, 1, 8, 3);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x, y, 1, 1);
    ctx.restore();
  }

  drawDebugMasks(ctx) {
    const outline = (polygon, color) => {
      ctx.beginPath();
      polygon.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x + 0.5, y + 0.5);
        else ctx.lineTo(x + 0.5, y + 0.5);
      });
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.save();
    ctx.globalAlpha = 0.9;
    outline(WORLD.water, "#ff5577");
    outline(WORLD.banks.left, "#4ee6ff");
    outline(WORLD.banks.right, "#e78cff");
    for (const pad of this.garden.pads) {
      ctx.strokeStyle = "#ffe680";
      ctx.strokeRect(pad.x - 14, pad.y - 7, 28, 14);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(
      WORLD.hive.x - WORLD.hive.w / 2,
      WORLD.hive.y - WORLD.hive.h / 2,
      WORLD.hive.w,
      WORLD.hive.h,
    );
    ctx.strokeRect(WORLD.log.x, WORLD.log.y, WORLD.log.w, WORLD.log.h);
    ctx.restore();
  }

  drawPlantGhost(ctx) {
    if (
      this.selectedTool === "look" ||
      this.ui.notesOpen ||
      !this.pointer.inside ||
      !this.hover ||
      this.hover.type !== "bank" ||
      !this.assets.flowers?.loaded
    ) {
      return;
    }
    const frame = FLOWERS[this.selectedTool].frameStart + 2;
    const scale = this.plantPreview?.scale ?? 1;
    ctx.save();
    ctx.globalAlpha = this.plantPreview?.ok ? 0.45 : 0.2;
    drawSheet(ctx, this.assets.flowers, frame, this.pointer.x, this.pointer.y, {
      anchor: "bottom",
      scale,
    });
    ctx.restore();
  }

  getDebugState() {
    return {
      time: Number(this.time.toFixed(2)),
      notes: [...this.notes],
      noteCount: this.notes.size,
      selectedTool: this.selectedTool,
      missingAssets: this.assetReport?.missing ?? [],
      malformedAssets: this.assetReport?.malformed ?? [],
      clockMinutes: Number(this.clockMinutes.toFixed(2)),
      clock: formatClock(this.clockMinutes),
      sun: { x: this.world.sun.x, y: this.world.sun.y, alpha: this.world.sun.alpha },
      moon: { x: this.world.moon.x, y: this.world.moon.y, alpha: this.world.moon.alpha },
      light: this.world.getLight(),
      rain: this.rainFactor ?? 0,
      counts: {
        bees: this.creatures.bees.length,
        frogs: this.creatures.frogs.length,
        fireflies: this.creatures.fireflies.length,
        particles: this.particles.items.length,
      },
      hover: this.hover?.type ?? null,
      notesOpen: this.ui.notesOpen,
      introDismissed: this.ui.introDismissed,
      keyboardMode: this.keyboardMode,
      keyboardCursor: { ...this.keyboardCursor },
      resetArmed: this.resetArmedUntil > this.time,
    };
  }

  debugDusk() {
    this.freezeClock = true;
    this.setClock(18 * 60 + 30);
    if (this.testMode) this.ui.dismissIntro();
  }

  debugSetClock(minutes) {
    this.freezeClock = true;
    this.setClock(minutes);
  }

  debugPlantAll() {
    const species = ["poppy", "cornflower", "marigold"];
    let count = 0;
    for (let i = 0; i < 27; i += 1) {
      const x = i < 14 ? 8 + (i % 14) * 6.2 : 258 + ((i - 14) % 14) * 4.2;
      const y = i < 14 ? 124 + (i % 5) * 5 : 116 + (i % 6) * 5;
      const result = this.garden.plant(species[i % 3], x, y);
      if (result.ok) count += 1;
    }
    return count;
  }
}

