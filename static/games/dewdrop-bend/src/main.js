import { Game } from "./game.js";
import { H, W } from "./config.js";

const canvas = document.getElementById("scene");
canvas.width = W;
canvas.height = H;
const stage = document.getElementById("stage");
const page = document.querySelector(".page");
const boot = document.getElementById("boot");
const query = new URLSearchParams(window.location.search);
const testMode = query.has("test");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function queryMinutes() {
  const raw = query.get("time");
  if (raw && /^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  if (query.has("dawn")) return 5 * 60 + 30;
  if (query.has("dusk")) return 18 * 60 + 30;
  if (query.has("night")) return 23 * 60;
  return null;
}

const requestedMinutes = queryMinutes();
const freezeClock = testMode
  ? query.has("freeze") || query.has("dusk") || query.has("dawn") || query.has("night")
  : query.has("freeze");

function fitStage() {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const wholeScale = Math.min(Math.floor(viewportWidth / W), Math.floor(viewportHeight / H));
  if (wholeScale >= 6) {
    // On displays large enough for a clean 6x/8x/12x scene, let the art own
    // the full screen instead of shrinking it into a padded card.
    page?.classList.add("is-bleed");
    stage.style.setProperty("--scale", String(wholeScale));
    return;
  }
  page?.classList.remove("is-bleed");
  const pad = Math.min(12, Math.max(4, viewportWidth * 0.01));
  // Keep one CSS pixel of slack so rounding can never create a horizontal
  // scrollbar on narrow viewports.
  const availableWidth = Math.max(120, viewportWidth - pad * 2 - 1);
  const availableHeight = Math.max(80, viewportHeight - pad * 2 - 1);
  const raw = Math.min(availableWidth / W, availableHeight / H);
  const scale = raw >= 2 ? Math.max(2, Math.floor(raw)) : Math.max(0.55, raw);
  stage.style.setProperty("--scale", String(scale));
}

fitStage();
window.addEventListener("resize", fitStage);
window.visualViewport?.addEventListener("resize", fitStage);

let game;
try {
  game = await Game.create(canvas, {
    testMode,
    reducedMotion,
    startMinutes: requestedMinutes ?? undefined,
    freezeClock,
    rain: query.get("rain") === "1",
  });
  window.__dewdrop = game;
  window.__dewdropReady = true;
  if (boot) {
    boot.classList.add("is-hidden");
    window.setTimeout(() => boot.remove(), reducedMotion ? 0 : 450);
  }
  if (game.assetReport.missing.length || game.assetReport.malformed.length) {
    console.warn("[Dewdrop Bend] asset warnings", game.assetReport);
  }
  // Prime the first frame before the loop starts.
  game.render();
} catch (error) {
  console.error(error);
  if (boot) {
    boot.innerHTML = `<span class="boot-title">THE POND WOULD NOT WAKE</span><span class="boot-detail">${escapeHtml(error.message)}</span>`;
    boot.classList.add("is-error");
  }
  throw error;
}

let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;
let paused = false;

document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
  if (document.hidden) {
    game.audio.suspend();
  } else {
    game.audio.resume();
    last = performance.now();
    accumulator = 0;
  }
});

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.08, (now - last) / 1000);
  last = now;
  if (paused) return;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    game.update(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;
  game.render();
}

requestAnimationFrame(frame);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
