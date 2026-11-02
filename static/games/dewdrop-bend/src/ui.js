import { FLOWERS, H, NOTES, P, UI, W, WORLD } from "./config.js";
import {
  drawBookIcon,
  drawRainIcon,
  drawResetIcon,
  drawSeedIcon,
  drawSpeakerIcon,
  drawText,
  textWidth,
} from "./bitfont.js";
import { clockHitTest, drawClock } from "./clock.js";
import { formatClock } from "./time-of-day.js";
import { clamp, rgba, round, textWrap } from "./utils.js";

function panel(ctx, x, y, w, h, options = {}) {
  const {
    fill = "#132f2b",
    alpha = 0.94,
    border = P.gold,
    borderAlpha = 0.45,
    inner = null,
  } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = borderAlpha;
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  if (inner) {
    ctx.globalAlpha = borderAlpha * 0.4;
    ctx.fillStyle = inner;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
  }
  ctx.restore();
}

function fitText(text, maxWidth, scale = 1) {
  let value = String(text);
  if (textWidth(value, scale) <= maxWidth) return value;
  const ellipsis = "...";
  const words = value.split(/\s+/u);
  while (words.length > 1) {
    words.pop();
    const candidate = `${words.join(" ")}${ellipsis}`;
    if (textWidth(candidate, scale) <= maxWidth) return candidate;
  }
  while (value.length > 0 && textWidth(`${value}${ellipsis}`, scale) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}${ellipsis}`;
}

function hit(rect, x, y, padding = 2) {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.w + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.h + padding
  );
}

export class Interface {
  constructor(game) {
    this.game = game;
    this.toast = null;
    this.introDismissed = false;
    this.notesOpen = false;
    this.hoveredControl = null;
    this.hintIndex = 0;
    this.hintTimer = 0;
    this.time = 0;
    this.closeHover = false;
    this.unreadNotes = 0;
    this.clockHover = null;
  }

  reset() {
    this.notesOpen = false;
    this.toast = null;
    this.introDismissed = true;
    this.hoveredControl = null;
    this.hintTimer = 0;
    this.unreadNotes = 0;
  }

  update(dt, game) {
    this.time = game.time;
    if (this.toast) {
      this.toast.age += dt;
      if (this.toast.age >= this.toast.life) this.toast = null;
    }
    this.hintTimer += dt;
    if (this.hintTimer > 7.5) {
      this.hintTimer = 0;
      this.hintIndex = (this.hintIndex + 1) % this.#hints().length;
    }
  }

  dismissIntro() {
    if (!this.introDismissed) {
      this.introDismissed = true;
    }
  }

  clockHit(x, y) {
    if (this.notesOpen || !this.introDismissed) return null;
    return clockHitTest(x, y, UI.clock, this.game.clockMinutes);
  }

  notify({ header = "NEW FIELD NOTE", title, line, color = P.cream, unread = false }) {
    this.toast = {
      header,
      title,
      line,
      color,
      age: 0,
      life: 4.4,
    };
    if (unread) this.unreadNotes += 1;
  }

  markNotesRead() {
    this.unreadNotes = 0;
  }

  toggleNotes() {
    this.notesOpen = !this.notesOpen;
    if (this.notesOpen) {
      this.markNotesRead();
      this.game.setLive(`Field notes. ${this.game.notes.size} of ${NOTES.length} collected.`);
    } else {
      this.game.setLive("Field notes closed.");
      this.game.flushPendingToast?.();
    }
    this.game.syncA11y();
  }

  closeNotes() {
    if (!this.notesOpen) return;
    this.notesOpen = false;
    this.game.setLive("Field notes closed.");
    this.game.flushPendingToast?.();
    this.game.syncA11y();
  }

  hitTest(x, y) {
    if (this.notesOpen) {
      if (hit(UI.notesClose, x, y, 4)) return { kind: "notesClose", id: "close" };
      const p = UI.notesPanel;
      if (!hit(p, x, y, 0)) return { kind: "notesOutside", id: "outside" };
      return { kind: "notesPanel", id: "panel" };
    }
    for (const button of UI.buttons) {
      if (hit(button, x, y, 3)) return { kind: "button", id: button.id };
    }
    for (const tool of UI.tools) {
      if (hit(tool, x, y, 2)) return { kind: "tool", id: tool.id };
    }
    if (y >= UI.bar.y) return { kind: "hud", id: "bar" };
    return null;
  }

  #hints() {
    const extra = [];
    if (this.game.notes.size === 0) extra.push("TOUCH A CREATURE TO BEGIN");
    if (this.game.notes.size === NOTES.length - 1 && !this.game.notes.has("firefly")) {
      extra.push("FIREFLIES WAIT FOR DUSK");
    }
    return [
      "TURN THE CLOCK TO CHANGE THE HOUR",
      "CLICK THE WATER TO MAKE RINGS",
      "PLANT SEEDS, THEN WAIT FOR BEES",
      "CLICK A PAD TO HOP A FROG",
      "TOUCH A CREATURE FOR A NOTE",
      "CLICK THE HIVE FOR A DANCE",
      "SWEEP THE REEDS TO MAKE WIND",
      "REST ON A BLOOM FOR A PERCH",
      "N OPENS YOUR FIELD NOTES",
      "PRESS K FOR A KEYBOARD CURSOR",
      "RAIN IS A SMALL CLOUD BUTTON",
      "TURN THE CLOCK TO NIGHT FOR FIREFLIES",
      ...extra,
    ];
  }

  statusText() {
    const game = this.game;
    if (game.clockDrag) return `CLOCK ${formatClock(game.clockMinutes)} - RELEASE`;
    if (this.clockHover) return `CLOCK ${formatClock(game.clockMinutes)} - DRAG HANDS`;
    if (this.hoveredControl) {
      const control = this.hoveredControl;
      if (control.kind === "button") {
        if (control.id === "notes") return `NOTES: ${game.notes.size}/${NOTES.length}`;
        if (control.id === "sound") return game.audio.enabled ? "SOUND IS ON" : "SOUND IS OFF";
        if (control.id === "rain") return game.rainFactor > 0.05 ? "RAIN IS FALLING" : "CLOUDY: LET IT RAIN";
        return "RESET (PRESS TWICE)";
      }
      if (control.kind === "tool") {
        if (control.id === "look") return "EXPLORE THE POND";
        return `PLANT ${FLOWERS[control.id].shortName}`;
      }
    }
    if (game.hover?.type === "creature") {
      return game.keyboardMode ? `ENTER: ${game.hover.label}` : `CLICK THE ${game.hover.label}`;
    }
    if (game.hover?.type === "hive") {
      return game.keyboardMode ? "ENTER: WAGGLE DANCE" : "CLICK THE HIVE TO DANCE";
    }
    if (game.hover?.type === "pad") {
      return game.keyboardMode ? "ENTER: HOP A FROG" : "CLICK A PAD TO HOP A FROG";
    }
    if (game.hover?.type === "water") {
      return game.keyboardMode ? "ENTER: MAKE A RIPPLE" : "CLICK THE WATER FOR A RIPPLE";
    }
    if (game.hover?.type === "flower") {
      return game.keyboardMode
        ? `ENTER: SHAKE ${FLOWERS[game.hover.entity.species].name}`
        : `CLICK TO SHAKE ${FLOWERS[game.hover.entity.species].name}`;
    }
    if (game.selectedTool !== "look") {
      if (game.plantPreview && !game.plantPreview.ok) return game.plantPreview.reason;
      return game.keyboardMode
        ? `ENTER: PLANT ${FLOWERS[game.selectedTool].shortName}`
        : `PLANT ${FLOWERS[game.selectedTool].shortName}: CLICK A BANK`;
    }
    if (game.keyboardMode) return "ARROWS MOVE - ENTER ACTS";
    return this.#hints()[this.hintIndex % this.#hints().length];
  }

  draw(ctx, game) {
    const time = game.time;
    if (!this.introDismissed) {
      this.#drawIntro(ctx, game);
      return;
    }
    this.#drawTopLabel(ctx, game);
    this.#drawClock(ctx, game);
    this.#drawNotesIcon(ctx, game);
    this.#drawBar(ctx, game);
    this.#drawHoverTag(ctx, game);
    this.#drawToast(ctx, game);
    if (this.notesOpen) this.#drawNotes(ctx, game);
    this.#drawCursorHint(ctx, game);
  }

  #drawIntro(ctx, game) {
    ctx.save();
    ctx.fillStyle = "rgba(9, 26, 23, 0.18)";
    ctx.fillRect(0, 0, W, H);
    const x = 54;
    const y = 57;
    const w = 244;
    const h = 84;
    panel(ctx, x, y, w, h, { fill: "#0d2925", alpha: 0.88, border: P.gold, borderAlpha: 0.55, inner: P.leaf });
    // A small pixel sun in the corner, complete with four short rays.
    ctx.fillStyle = P.sun;
    ctx.fillRect(x + 11, y + 13, 5, 5);
    ctx.fillStyle = P.sunHigh;
    ctx.fillRect(x + 12, y + 14, 2, 2);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + 13, y + 9, 1, 2);
    ctx.fillRect(x + 13, y + 20, 1, 2);
    ctx.fillRect(x + 7, y + 15, 2, 1);
    ctx.fillRect(x + 18, y + 15, 2, 1);
    drawText(ctx, "DEWDROP BEND", W / 2, y + 12, {
      color: P.cream,
      shadow: P.ink,
      scale: 2,
      align: "center",
    });
    drawText(ctx, "A SMALL POND, LISTENING", W / 2, y + 32, {
      color: P.leafHigh,
      align: "center",
    });
    drawText(ctx, "TURN THE CLOCK  ·  PLANT  ·  LISTEN", W / 2, y + 45, {
      color: rgba(P.cream, 0.65),
      align: "center",
    });
    const blink = Math.floor(game.time * 2) % 2 === 0 ? 1 : 0.55;
    drawText(ctx, "CLICK OR PRESS A KEY TO BEGIN", W / 2, y + 58, {
      color: P.gold,
      alpha: blink,
      align: "center",
      shadow: P.ink,
    });
    ctx.fillStyle = P.leaf;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 10, y + h - 8, 22, 1);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + 18, y + h - 9, 4, 1);
    ctx.restore();
  }

  #drawTopLabel(ctx, game) {
    const x = UI.title.x;
    const y = UI.title.y;
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawText(ctx, "DEWDROP BEND", x, y, {
      color: P.cream,
      shadow: P.ink,
      alpha: 0.9,
    });
    ctx.fillStyle = P.gold;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y + 9, textWidth("DEWDROP BEND", 1), 1);
    ctx.restore();
  }

  #drawClock(ctx, game) {
    const rect = UI.clock;
    const state = game.world.dayState;
    const night = state.light.night > 0.45;
    drawClock(ctx, rect, game.clockMinutes, {
      night,
      active: game.clockDrag,
      hovered: this.clockHover !== null,
    });
    // The clock readout is an opaque little plaque. Sun and moon can pass
    // behind it at the horizon without washing out the most important text.
    panel(ctx, rect.x - 2, rect.y + rect.h + 1, rect.w + 4, 21, {
      fill: "#0a211e",
      alpha: 0.9,
      border: P.leaf,
      borderAlpha: 0.28,
    });
    const label = formatClock(game.clockMinutes);
    ctx.save();
    drawText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h + 3, {
      color: this.clockHover !== null || game.clockDrag ? P.gold : P.cream,
      shadow: P.ink,
      align: "center",
    });
    const light = state.light;
    const phase =
      light.night > 0.45
        ? "NIGHT"
        : light.dawn > 0.32
          ? "DAWN"
          : light.dusk > 0.45
            ? "DUSK"
            : light.golden > 0.32
              ? "GOLDEN"
              : "DAY";
    const phaseColor =
      phase === "NIGHT"
        ? P.waterLight
        : phase === "DAWN" || phase === "DUSK"
          ? P.poppy
          : P.gold;
    drawText(ctx, phase, rect.x + rect.w / 2, rect.y + rect.h + 13, {
      color: phaseColor,
      shadow: P.ink,
      alpha: 0.95,
      align: "center",
    });
    ctx.restore();
  }

  #drawNotesIcon(ctx, game) {
    const buttons = UI.buttons;
    const startX = buttons[0].x - 3;
    const startY = 3;
    panel(ctx, startX, startY, W - startX - 3, 18, {
      fill: "#112a27",
      alpha: 0.65,
      border: P.leaf,
      borderAlpha: 0.2,
    });
    for (const button of buttons) {
      const isHover = this.hoveredControl?.kind === "button" && this.hoveredControl.id === button.id;
      if (isHover) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = P.cream;
        ctx.fillRect(button.x + 1, button.y + 1, button.w - 2, button.h - 2);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = P.gold;
        ctx.fillRect(button.x + 1, button.y + button.h - 2, button.w - 2, 1);
        ctx.restore();
      }
      if (button.id === "notes") {
        drawBookIcon(ctx, button.x + 3, button.y + 2, P.cream, P.leafHigh);
        ctx.fillStyle = P.ink;
        ctx.fillRect(button.x + 3, button.y + 12, 12, 1);
        ctx.fillStyle = P.gold;
        ctx.fillRect(button.x + 3, button.y + 12, Math.round((12 * game.notes.size) / NOTES.length), 1);
        if (this.unreadNotes > 0) {
          ctx.fillStyle = P.gold;
          ctx.fillRect(button.x + button.w - 4, button.y + 3, 2, 2);
        } else if (this.notesOpen) {
          ctx.fillStyle = P.gold;
          ctx.fillRect(button.x + button.w - 4, button.y + 3, 2, 2);
        }
      } else if (button.id === "sound") {
        drawSpeakerIcon(ctx, button.x + 3, button.y + 2, P.cream, !game.audio.enabled);
      } else if (button.id === "rain") {
        drawRainIcon(ctx, button.x + 3, button.y + 2, P.cream, game.rainFactor > 0.05);
      } else {
        drawResetIcon(ctx, button.x + 3, button.y + 2, P.cream);
      }
    }
  }
  #drawBar(ctx, game) {
    panel(ctx, UI.bar.x, UI.bar.y, UI.bar.w, UI.bar.h, {
      fill: "#0d2823",
      alpha: 0.82,
      border: P.gold,
      borderAlpha: 0.28,
      inner: P.leaf,
    });
    for (const tool of UI.tools) {
      const selected =
        game.selectedTool === tool.id ||
        (tool.id === "look" && game.selectedTool === "look");
      const hovered = this.hoveredControl?.kind === "tool" && this.hoveredControl.id === tool.id;
      ctx.save();
      const fill = selected ? "#1d4034" : hovered ? "#17372f" : "#102b26";
      ctx.fillStyle = fill;
      ctx.fillRect(tool.x, tool.y, tool.w, tool.h);
      ctx.globalAlpha = selected ? 0.9 : hovered ? 0.7 : 0.35;
      ctx.fillStyle = selected ? P.gold : P.leaf;
      ctx.fillRect(tool.x, tool.y, tool.w, 1);
      ctx.fillRect(tool.x, tool.y + tool.h - 1, tool.w, 1);
      ctx.fillRect(tool.x, tool.y, 1, tool.h);
      ctx.fillRect(tool.x + tool.w - 1, tool.y, 1, tool.h);
      ctx.restore();
      if (tool.id === "look") {
        this.#drawLookIcon(ctx, tool.x + 8, tool.y + 1, selected ? P.cream : P.leafHigh);
      } else {
        const colors = {
          petal: FLOWERS[tool.id].petal,
          accent: FLOWERS[tool.id].accent,
          stem: P.leaf,
          leaf: P.leafHigh,
        };
        drawSeedIcon(ctx, tool.id, tool.x + 7, tool.y + 1, colors);
      }
    }
    const status = fitText(this.statusText(), UI.status.w - 7, 1);
    const isUrgent = game.plantPreview && !game.plantPreview.ok && game.selectedTool !== "look";
    drawText(ctx, status, UI.status.x, UI.status.y, {
      color: isUrgent ? P.blush : P.cream,
      shadow: P.ink,
      alpha: 0.94,
    });
  }

  #drawLookIcon(ctx, x, y, color) {
    ctx.fillStyle = color;
    // A pixel magnifier reads more clearly than a stylised eye at 1x.
    ctx.fillRect(x + 2, y + 1, 4, 1);
    ctx.fillRect(x + 1, y + 2, 1, 2);
    ctx.fillRect(x + 6, y + 2, 1, 2);
    ctx.fillRect(x + 2, y + 4, 4, 1);
    ctx.fillRect(x + 6, y + 5, 1, 1);
    ctx.fillRect(x + 7, y + 6, 2, 1);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x + 2, y + 2, 1, 1);
    ctx.globalAlpha = 1;
  }

  #drawHoverTag(ctx, game) {
    const hover = game.hover;
    if (!hover || this.notesOpen || this.hoveredControl) return;
    let x;
    let y;
    let label;
    if (hover.type === "creature") {
      x = hover.entity.x;
      y = hover.entity.y - (hover.entity.spriteKey === "frog" ? 20 : 14);
      label = hover.label;
    } else if (hover.type === "flower") {
      x = hover.entity.x;
      const scale = hover.entity.scale ?? 1;
      y = hover.entity.y - 29 * scale;
      label = hover.label;
    } else if (hover.type === "pad") {
      x = hover.entity.x;
      y = hover.entity.y - 13;
      label = "LILY PAD";
    } else if (hover.type === "hive") {
      x = WORLD.hive.x;
      y = WORLD.hive.y - 24;
      label = "BEEHIVE";
    } else {
      return;
    }
    const w = textWidth(label, 1) + 8;
    const tagX = clamp(round(x - w / 2), 2, W - w - 2);
    const tagY = clamp(round(y - 11), 2, H - 13);
    panel(ctx, tagX, tagY, w, 11, {
      fill: "#0c2521",
      alpha: 0.9,
      border: P.leafHigh,
      borderAlpha: 0.5,
    });
    drawText(ctx, label, tagX + w / 2, tagY + 2, {
      color: P.cream,
      align: "center",
      alpha: 0.95,
    });
  }

  #drawToast(ctx, game) {
    if (!this.toast || this.notesOpen) return;
    const t = this.toast;
    const fadeIn = Math.min(1, t.age / 0.25);
    const fadeOut = Math.min(1, Math.max(0, (t.life - t.age) / 0.55));
    const alpha = fadeIn * fadeOut;
    const r = UI.toast;
    ctx.save();
    ctx.globalAlpha = alpha;
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: "#0c2521",
      alpha: 0.93,
      border: P.gold,
      borderAlpha: 0.52,
    });
    ctx.fillStyle = t.color;
    ctx.fillRect(r.x + 1, r.y + 1, 3, r.h - 2);
    drawText(ctx, t.header, r.x + 8, r.y + 5, { color: P.gold });
    drawText(ctx, t.title, r.x + 8 + textWidth(t.header, 1) + 8, r.y + 5, {
      color: P.cream,
    });    const body = textWrap(t.line, 31);
    drawText(ctx, body[0] ?? "", r.x + 8, r.y + 17, {
      color: rgba(P.cream, 0.85),
    });
    drawText(ctx, body[1] ?? "", r.x + 8, r.y + 26, {
      color: rgba(P.cream, 0.85),
    });
    ctx.restore();
  }

  #drawNotes(ctx, game) {
    const p = UI.notesPanel;
    ctx.save();
    ctx.fillStyle = "rgba(7, 22, 19, 0.7)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, p.x, p.y, p.w, p.h, {
      fill: "#102b26",
      alpha: 0.98,
      border: P.gold,
      borderAlpha: 0.55,
      inner: P.leaf,
    });
    drawText(ctx, "FIELD NOTES", p.x + 10, p.y + 7, {
      color: P.cream,
      scale: 1,
      shadow: P.ink,
    });
    drawText(ctx, `${game.notes.size} / ${NOTES.length}`, p.x + p.w - 34, p.y + 7, {
      color: P.gold,
      align: "right",
    });
    ctx.fillStyle = P.leaf;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(p.x + 8, p.y + 18, p.w - 16, 1);
    ctx.globalAlpha = 1;
    const colWidth = 128;
    const startX = p.x + 12;
    const startY = p.y + 24;
    NOTES.forEach((note, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const x = startX + col * colWidth;
      const y = startY + row * 12;
      const collected = game.notes.has(note.id);
      if (collected) {
        ctx.fillStyle = P.gold;
        ctx.fillRect(x, y + 2, 4, 1);
        ctx.fillRect(x + 2, y + 3, 3, 1);
        ctx.fillRect(x + 5, y + 1, 2, 1);
        ctx.fillRect(x + 6, y, 1, 1);
      } else {
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = P.cream;
        ctx.fillRect(x + 1, y + 2, 3, 3);
        ctx.globalAlpha = 1;
      }
      drawText(ctx, note.name, x + 10, y, {
        color: collected ? P.cream : rgba(P.cream, 0.52),
      });
    });
    const done = game.notes.size >= NOTES.length;
    drawText(
      ctx,
      done ? "NATURALIST! EVERY WING AND SHELL, NOTED." : "TOUCH THE SMALL FOLK TO FILL THIS BOOK.",
      p.x + 10,
      p.y + p.h - 13,
      { color: done ? P.gold : rgba(P.cream, 0.62) },
    );
    // Close X.
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = P.cream;
    ctx.fillRect(UI.notesClose.x, UI.notesClose.y, 11, 1);
    ctx.fillRect(UI.notesClose.x, UI.notesClose.y + 9, 11, 1);
    ctx.fillRect(UI.notesClose.x, UI.notesClose.y, 1, 10);
    ctx.fillRect(UI.notesClose.x + 10, UI.notesClose.y, 1, 10);
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(UI.notesClose.x + 4 + i, UI.notesClose.y + 3 + i, 1, 1);
      ctx.fillRect(UI.notesClose.x + 7 - i, UI.notesClose.y + 3 + i, 1, 1);
    }
    ctx.restore();
  }

  #drawCursorHint(ctx, game) {
    if (!game.pointer?.inside || this.notesOpen) return;
    if (game.selectedTool !== "look" && game.hover?.type === "bank") {
      const valid = game.plantPreview?.ok;
      const x = round(game.pointer.x);
      const y = round(game.pointer.y);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = valid ? P.cream : P.blush;
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(x + i, y, 1, 1);
        ctx.fillRect(x, y + i, 1, 1);
      }
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.restore();
    }
  }
}
