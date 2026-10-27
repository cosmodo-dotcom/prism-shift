// =============================================================
//  Prism Shift — main.js
//  The wiring file. Instantiates every module, runs the loop,
//  dispatches events, connects input to state to UI.
//  NO game logic lives here — only assembly.
// =============================================================

import * as S from "./src/core/state.js";
import * as Sim from "./src/core/simulation.js";
import { buildScene } from "./src/core/scene.js";
import { draw } from "./src/renderers/canvas2d/draw.js";
import { playEvent, tickHeartbeat, setMuted, isMuted } from "./src/audio/webaudio/sfx.js";
import { ensureAudio } from "./src/audio/webaudio/engine.js";
import { setupKeyboard } from "./src/input/keyboard.js";
import { setupPointer } from "./src/input/pointer.js";
import { createStorage } from "./src/platform/web/storage.js";
import { createClock } from "./src/platform/web/clock.js";
import { createHaptics } from "./src/platform/web/haptics.js";
import { createHUD } from "./src/ui/dom/hud.js";
import { createOverlay } from "./src/ui/dom/overlay.js";
import { createUpgradeCollection } from "./src/ui/dom/upgrades.js";
import { createShop } from "./src/ui/dom/shop.js";
import { createSummary } from "./src/ui/dom/summary.js";
import { PALETTES } from "./src/core/tuning.js";
import { hashString } from "./src/core/rng.js";

// =============================================================
//  1. PLATFORM ADAPTERS
// =============================================================

const storage = createStorage();
const clock = createClock();
const haptics = createHaptics({ enabled: true });

// =============================================================
//  2. META (persisted profile)
// =============================================================

const meta = S.loadMeta(storage);
S.migrateLegacyBest(meta, storage);

// Restore mute preference
try {
  const muted = storage.get("psMuted") === "1";
  setMuted(muted);
} catch (e) {}

function saveMetaNow() {
  S.saveMeta(meta, storage);
}
function saveMutedFlag() {
  try { storage.set("psMuted", isMuted() ? "1" : "0"); } catch (e) {}
}

// =============================================================
//  3. STATE
// =============================================================

const state = S.createState();
state.metaRef = meta;
state.paletteRef = PALETTES[meta.equipped.shield] || PALETTES.neon;

// =============================================================
//  4. CANVAS
// =============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;
const touchOptimized = navigator.maxTouchPoints > 0
  || window.matchMedia?.("(pointer: coarse)").matches;

// Use reduced effects on touch devices and as a fallback without WebGL.
try {
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl") || probe.getContext("experimental-webgl");
  state.lowQuality = touchOptimized || !gl;
} catch (e) {
  state.lowQuality = true;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  DPR = Math.min(window.devicePixelRatio || 1, touchOptimized ? 1.5 : 2);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Update layout
  state.layout = {
    W, H,
    shieldRadius() {
      const base = Math.min(this.W, this.H) * 0.22;
      const zoomed = Math.min(this.W, this.H) * 0.155;
      return base + (zoomed - base) * state.zoomLevel;
    },
    spawnDist() {
      const base = Math.min(this.W, this.H) * 0.95;
      const zoomed = Math.min(this.W, this.H) * 1.55;
      return base + (zoomed - base) * state.zoomLevel;
    }
  };
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", resizeCanvas);

// =============================================================
//  5. UI MODULES
// =============================================================

const hud = createHUD();

const overlay = createOverlay({
  meta,
  onStart: () => startNewRun(false),
  onResume: () => resumeFromPause(),
  onDaily: () => startNewRun(true),
  onShop: () => openShop(),
  isDailyAttemptedToday: () => isDailyAttemptedToday()
});

const upgradeCollection = createUpgradeCollection();

const shop = createShop({
  meta,
  onBuy: (item) => handleBuy(item),
  onEquip: (item) => handleEquip(item),
  onClose: () => closeShop()
});

const summary = createSummary({
  meta,
  onRetry: () => retryRun(),
  onShop: () => openShopFromSummary(),
  onDoubleShards: (amount) => handleDoubleShards(amount),
  getLeaderboard: () => getLeaderboard()
});

// =============================================================
//  6. INPUT
// =============================================================

const input = {
  aimDelta: 0,
  fire: false
};

const detachKeyboard = setupKeyboard({
  input,
  getMode: () => state.mode,
  onFire: () => { ensureAudio(); },
  onPause: () => {
    if (state.mode === "paused") resumeFromPause();
    else pauseRun();
  },
  onShopClose: () => closeShop()
});

const detachPointer = setupPointer({
  canvas,
  fireButton: hud.elements.fire,
  input,
  getMode: () => state.mode,
  getCountdown: () => state.countdown,
  onCancelCountdown: () => { state.countdown = 0.01; },
  onFire: () => { ensureAudio(); }
});

// Mute button
hud.elements.fire; // already wired

const muteBtn = document.getElementById("mute");
if (muteBtn) {
  muteBtn.textContent = isMuted() ? "🔇" : "♪";
  muteBtn.addEventListener("click", () => {
    setMuted(!isMuted());
    muteBtn.textContent = isMuted() ? "🔇" : "♪";
    saveMutedFlag();
  });
}

const pauseBtn = document.getElementById("pause");
if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    if (state.mode === "paused") resumeFromPause();
    else pauseRun();
  });
}

// =============================================================
//  7. GAME LIFECYCLE
// =============================================================

function isDailyAttemptedToday() {
  try {
    const today = dateKey();
    return storage.get("psDailyDate") === today;
  } catch (e) {
    return false;
  }
}

function dateKey() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function startNewRun(isDaily) {
  ensureAudio();

  if (isDaily) {
    if (isDailyAttemptedToday()) return;
    const key = dateKey();
    try { storage.set("psDailyDate", key); } catch (e) {}
    const seed = hashString("prism-" + key);
    // Replace the RNG before startRun
    import("./src/core/rng.js").then(({ createSeededRng }) => {
      state.rng = createSeededRng(seed);
      beginRun();
    });
  } else {
    beginRun();
  }
}

function beginRun() {
  overlay.hide();
  summary.hide();

  const opts = { tutorial: meta.runs === 0 };
  // Only show the tutorial on the very first run
  Sim.startRun(state, meta, opts);

  // If not first run, use a short countdown
  if (meta.runs > 0) state.countdown = 0.35;

  hud.update(buildScene(state), meta.shards);
}

function pauseRun() {
  if (state.mode !== "playing" && state.mode !== "transition") return;
  state._prepauseMode = state.mode;
  state.mode = "paused";
  overlay.showPause();
}

function resumeFromPause() {
  if (state.mode !== "paused") return;
  state.mode = state._prepauseMode || "playing";
  overlay.hide();
  hud.update(buildScene(state), meta.shards);
}

function retryRun() {
  summary.hide();
  detachSummaryHandlers();
  // If there's a coaching tip queued, apply it
  if (state._coachQueued) {
    state.coachingTip = {
      shardColorName: state._coachQueued.shardColorName,
      shieldColorName: state._coachQueued.shieldColorName
    };
    state._pendingCoachSpawn = true;
  }
  state._coachQueued = null;
  beginRun();
}

function handleGameOver(event) {
  // Compute wasBest and almostBest
  const prevBest = meta.bestScore;
  const wasBest = state.score > prevBest;
  const almostBest = !wasBest && prevBest > 0 && state.score >= prevBest * 0.9;

  if (wasBest) meta.bestScore = state.score;
  if (state.score > meta.maxScoreSingleRun) meta.maxScoreSingleRun = state.score;
  meta.runs++;
  meta.shards += event.earned;
  meta.totalShards += event.earned;
  state.shardsEarnedThisRun = event.earned;
  state._sumDoubleEarned = event.earned;
  state.best = meta.bestScore;

  saveMetaNow();
  recordRunToLeaderboard();

  summary.show({
    score: state.score,
    level: state.level,
    blocked: state.blocked,
    bestCombo: state.bestComboThisRun,
    perfectBlocks: state.perfectBlocks,
    nearMissCount: state.nearMissCount,
    durationMs: Date.now() - state.runStartTime,
    runUpgrades: state.runUpgrades,
    deathDiagnosis: state.deathDiagnosis,
    earnedShards: event.earned,
    wasBest,
    almostBest
  });
}

// =============================================================
//  8. SHOP HANDLERS
// =============================================================

let shopReturnMode = "menu"; // "menu" | "summary"

function openShop() {
  shopReturnMode = "menu";
  overlay.hide();
  shop.open();
}

function openShopFromSummary() {
  shopReturnMode = "summary";
  summary.hide();
  detachSummaryHandlers();
  shop.open();
}

function closeShop() {
  shop.close();
  if (shopReturnMode === "summary") {
    // Restore the summary
    summary.show(buildSummaryArgs());
  } else {
    overlay.showMenu();
  }
}

function handleBuy(item) {
  if (meta.owned[item.id]) return;
  if (meta.shards < item.price) {
    playEvent({ type: "sfx", name: "deny" });
    return;
  }
  meta.shards -= item.price;
  meta.owned[item.id] = true;
  if (item.sub === "shield") {
    meta.equipped.shield = item.preview;
    state.paletteRef = PALETTES[item.preview] || PALETTES.neon;
  }
  if (item.sub === "orb") {
    meta.equipped.orb = item.preview;
  }
  saveMetaNow();
  shop.refresh();
  overlay.refreshShards();
  playEvent({ type: "sfx", name: "buy" });
  updateHUDWithShards();
}

function handleEquip(item) {
  if (item.sub === "shield") {
    meta.equipped.shield = item.preview;
    state.paletteRef = PALETTES[item.preview] || PALETTES.neon;
  }
  if (item.sub === "orb") {
    meta.equipped.orb = item.preview;
  }
  saveMetaNow();
  shop.refresh();
  playEvent({ type: "sfx", name: "buy" });
}

// =============================================================
//  10. LEADERBOARD
// =============================================================

function recordRunToLeaderboard() {
  try {
    const raw = storage.get("psRuns");
    const runs = raw ? JSON.parse(raw) : [];
    runs.push({ score: state.score, level: state.level + 1, blocks: state.blocked, date: Date.now() });
    runs.sort((a, b) => b.score - a.score);
    const trimmed = runs.slice(0, 10);
    storage.set("psRuns", JSON.stringify(trimmed));
  } catch (e) {}
}

function getLeaderboard() {
  try {
    const raw = storage.get("psRuns");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// =============================================================
//  11. DOUBLE SHARDS
// =============================================================

function handleDoubleShards(amount) {
  meta.shards += amount;
  meta.totalShards += amount;
  state.shardsEarnedThisRun += amount;
  saveMetaNow();
  updateHUDWithShards();
  playEvent({ type: "sfx", name: "shard" });
}

// =============================================================
//  12. MISC HELPERS
// =============================================================

function updateHUDWithShards() {
  hud.update(buildScene(state), meta.shards);
}

let summaryHandlersAttached = false;
function attachSummaryHandlers() {
  if (summaryHandlersAttached) return;
  summaryHandlersAttached = true;
  // The summary module already handles its own click/Enter handlers
}
function detachSummaryHandlers() {
  summaryHandlersAttached = false;
}

function buildSummaryArgs() {
  const prevBest = state.best || 0;
  return {
    score: state.score,
    level: state.level,
    blocked: state.blocked,
    bestCombo: state.bestComboThisRun,
    perfectBlocks: state.perfectBlocks,
    nearMissCount: state.nearMissCount,
    durationMs: Date.now() - state.runStartTime,
    runUpgrades: state.runUpgrades,
    deathDiagnosis: state.deathDiagnosis,
    earnedShards: state.shardsEarnedThisRun,
    wasBest: state.score >= prevBest,
    almostBest: false
  };
}

// =============================================================
//  13. EVENT DISPATCH
// =============================================================

function dispatchEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case "sfx":
      case "vibrate":
        playEvent(event);
        break;

      case "banner":
        // Banners are drawn on canvas by the renderer (already in
        // state.bannerQueue). No DOM action needed.
        break;

      case "gameOver":
        handleGameOver(event);
        break;

      default:
        // Unknown event types are silently ignored
        break;
    }
  }
}

// =============================================================
//  14. THE GAME LOOP
// =============================================================

let lastTime = clock.now();

function loop() {
  const now = clock.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000) || 0;
  lastTime = now;

  // Update state.nowMs so core can read the wall clock
  state.nowMs = now;

  // Tick (only if we're in a mode that advances time)
  const isLive = state.mode === "playing" || state.mode === "transition";
  let events = [];
  if (isLive) {
    events = Sim.tick(state, dt, input);

    // Reset single-frame input fields AFTER the tick consumed them
    input.aimDelta = 0;
    input.pointerAimDelta = 0;
    input.fire = false;

    // Heartbeat sound at 1 life
    tickHeartbeat(dt, state.lives, state.mode);
  } else {
    // Reset input even in non-playing modes (e.g. after death)
    input.aimDelta = 0;
    input.pointerAimDelta = 0;
    input.fire = false;
  }

  // Dispatch events (SFX, vibration, game over)
  dispatchEvents(events);

  // Render
  const scene = buildScene(state);
  draw(ctx, scene, W, H, { lowQuality: state.lowQuality });

  // HUD
  if (isLive || state.mode === "gameover") {
    hud.update(scene, meta.shards);
  }
  upgradeCollection.update(state.runUpgrades);

  // Scanline intensity (from escalation)
  const scanlines = document.getElementById("scanlines");
  if (scanlines) {
    const opacity = Math.min(1.4, 0.7 + state.escalation * 0.6);
    scanlines.style.opacity = opacity.toFixed(2);
  }

  requestAnimationFrame(loop);
}

// =============================================================
//  15. BOOT
// =============================================================

// Focus the canvas so keyboard events go to it
canvas.addEventListener("pointerdown", () => canvas.focus());
canvas.focus();

// Initial UI
overlay.showMenu();
hud.update(buildScene(state), meta.shards);

// Kick off the loop
requestAnimationFrame(loop);

// =============================================================
//  16. VISIBILITY / BLUR HANDLING
// =============================================================

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (state.mode === "playing" || state.mode === "transition")) {
    pauseRun();
  }
});

window.addEventListener("blur", () => {
  if (state.mode === "playing" || state.mode === "transition") {
    pauseRun();
  }
});