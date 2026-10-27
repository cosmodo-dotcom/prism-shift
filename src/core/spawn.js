// =============================================================
//  Prism Shift — core/spawn.js
//  Spawners and effects. Mutates state, returns events.
//  Uses state.rng for all randomness. No DOM, no audio.
// =============================================================

import {
  TAU, BOSS_HP, PURGE_SCORE, DEBT_ON_KILL, MAX_LIVES
} from "./tuning.js";
import {
  currentSectors, sectorColor, isColorDominant,
  addScore, addDebt, drainDebt, pickPowerup
} from "./rules.js";
import { levelCfg } from "./tuning.js";

// ─────────────────────────────────────────────────────────────
// SPAWN: SHARD
// ─────────────────────────────────────────────────────────────

/**
 * Spawn one shard. Handles the full priority order:
 *   1. Coaching tip (post-death guided spawn)
 *   2. Purge queue (debt-driven special shard)
 *   3. Boss shard (every 3 levels)
 *   4. Normal shard with debt-weighted color
 * @returns {Array} events
 */
export function spawnShard(state) {
  const events = [];
  const cfg = levelCfg(state.level);
  const pal = state.metaRef ? null : null; // used below via activeColors
  const colors = state.runMods ? state.runMods.extraColors : 0;
  // activeColors is called indirectly through colorAt / sectorColor,
  // but we also need the raw palette to build spawn objects.
  const palette = paletteFor(state);
  let colorCount = state.cachedColors;
  if (colorCount > palette.length) colorCount = palette.length;
  if (colorCount < 2) colorCount = 2;

  const shardSpeedMult = (state.metaRef && state.metaRef.owned && state.metaRef.owned["mod_frenzy"]) ? 1.1 : 1;

  // Smooth shard speed
  state.shardSpeedBase += (state.shardSpeedTarget - state.shardSpeedBase) * 0.35;
  const shardSpeed = state.shardSpeedBase * state.rng.rand(0.97, 1.03) * shardSpeedMult;
  if (state.rng.next() < 0.12) {
    state.shardSpeedTarget = cfg.speed * state.rng.rand(0.96, 1.07);
  }

  // ── 1. Coaching tip
  if (state._pendingCoachSpawn && state.coachingTip) {
    const tip = state.coachingTip;
    let shieldIdx = -1, shardIdx = -1;
    for (let i = 0; i < palette.length; i++) {
      if (palette[i].name === tip.shieldColorName) shieldIdx = i;
      if (palette[i].name === tip.shardColorName) shardIdx = i;
    }
    if (shieldIdx >= 0 && shardIdx >= 0) {
      const n = currentSectors(state);
      const arc = TAU / n;
      const secIdx = shieldIdx % n;
      const mid = state.shieldAngle + secIdx * arc + arc / 2;
      state.shards.push({
        angle: mid,
        color: palette[shardIdx],
        dist: state.layout.spawnDist(),
        speed: levelCfg(0).speed * 0.42,
        alive: true, trail: [], wobble: state.rng.rand(0, TAU),
        passedRing: false, coach: true, spawnFade: 0
      });
      state._pendingCoachSpawn = false;
      state.tutorial = null;
      state.countdown = 0.6;
      state.countdownText = "";
      return events;
    }
  }

  // ── 2. Purge
  if (state.purgeQueue.length > 0) {
    const pq = state.purgeQueue.shift();
    let purgeIdx = -1;
    for (let i = 0; i < palette.length; i++) {
      if (palette[i].name === pq.colorName) { purgeIdx = i; break; }
    }
    if (purgeIdx >= 0) {
      state.shards.push({
        angle: state.rng.rand(0, TAU),
        color: palette[purgeIdx],
        dist: state.layout.spawnDist(),
        speed: cfg.speed * 0.55,
        alive: true, trail: [], wobble: state.rng.rand(0, TAU),
        passedRing: false, purge: true, spawnFade: 0
      });
      events.push({ type: "banner", text: "PURGE SHARD",
        sub: "Block it to clear " + pq.colorName, color: "#ffdd5a" });
      return events;
    }
  }

  // ── 3. Boss
  if (state.bossPending) {
    state.bossPending = false;
    const colorA = palette[Math.floor(state.rng.next() * colorCount)];
    let colorB = palette[(palette.indexOf(colorA) + 1) % colorCount] || colorA;
    if (colorB.name === colorA.name && colorCount > 1) {
      colorB = palette[(palette.indexOf(colorA) + 2) % colorCount] || colorA;
    }
    state.shards.push({
      angle: state.rng.rand(0, TAU),
      color: colorA, colorB,
      dist: state.layout.spawnDist() * 1.02,
      speed: cfg.speed * 0.6,
      alive: true, trail: [], wobble: state.rng.rand(0, TAU),
      passedRing: false, boss: true,
      hp: BOSS_HP, maxHp: BOSS_HP,
      bossTimer: 0, bossCycle: 1.2, spawnFade: 0
    });
    events.push({ type: "banner", text: "BOSS SHARD",
      sub: "Hit it twice · watch the color", color: "#ffdd5a", life: 1.8 });
    events.push({ type: "sfx", name: "boss" });
    return events;
  }

  // ── 4. Normal shard, debt-weighted
  const weights = [];
  let total = 0;
  for (let i = 0; i < colorCount; i++) {
    const w = isColorDominant(state, palette[i].name, state.nowMs) ? 2.4 : 1;
    weights.push(w);
    total += w;
  }
  let roll = state.rng.next() * total;
  let chosenIdx = 0;
  for (let i = 0; i < colorCount; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosenIdx = i; break; }
  }

  state.shards.push({
    angle: state.rng.rand(0, TAU),
    color: palette[chosenIdx],
    dist: state.layout.spawnDist(),
    speed: shardSpeed,
    alive: true, trail: [], wobble: state.rng.rand(0, TAU),
    passedRing: false, spawnFade: 0
  });
  return events;
}

/** Which palette are we currently using? Reads state.metaRef. */
function paletteFor(state) {
  const skin = (state.metaRef && state.metaRef.equipped && state.metaRef.equipped.shield) || "neon";
  // dynamic import would be overkill; hardcode via rules export.
  return state.paletteRef || PALETTES_FALLBACK(skin);
}

// Minimal fallback so spawn.js doesn't need to import PALETTES.
// The adapter sets state.paletteRef at boot to the real palette.
function PALETTES_FALLBACK() {
  return [
    { name: "RED", hex: "#ff5a7a", rgb: [255,90,122] },
    { name: "BLUE", hex: "#5aa0ff", rgb: [90,160,255] },
    { name: "GREEN", hex: "#5affa0", rgb: [90,255,160] },
    { name: "YELLOW", hex: "#ffdd5a", rgb: [255,221,90] }
  ];
}

// ─────────────────────────────────────────────────────────────
// SPAWN: POWERUP
// ─────────────────────────────────────────────────────────────

export function spawnPowerup(state) {
  const type = pickPowerup(state);
  state.powerups.push({
    angle: state.rng.rand(0, TAU),
    type,
    dist: state.layout.spawnDist(),
    speed: levelCfg(state.level).speed * 0.8,
    alive: true,
    wob: state.rng.rand(0, TAU)
  });
}

// ─────────────────────────────────────────────────────────────
// EFFECTS: SHATTER (particle burst, mutates state only)
// ─────────────────────────────────────────────────────────────

export function shatter(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.rand(0, TAU);
    const sp = state.rng.rand(80, 320);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: state.rng.rand(0.5, 1.0),
      maxLife: 1.0,
      color: typeof color === "string" ? color : color.hex,
      size: state.rng.rand(3, 7),
      angular: true,
      rot: state.rng.rand(0, TAU),
      spin: state.rng.rand(-8, 8),
      additive: true
    });
  }
}

// ─────────────────────────────────────────────────────────────
// EFFECTS: CHAIN EXPLOSION
// ─────────────────────────────────────────────────────────────

/**
 * Damage shards within state.runMods.chainRadius of (x,y).
 * Returns events (banner, sfx) for the caller to dispatch.
 */
export function chainExplode(state, x, y, color) {
  const events = [];
  const radius = state.runMods.chainRadius;
  const count = state.runMods.chainCount || 2;
  const c = { x: state.layout.W / 2, y: state.layout.H / 2 };
  let hits = 0;

  for (let i = 0; i < state.shards.length && hits < count; i++) {
    const s = state.shards[i];
    if (!s.alive) continue;
    const sx = c.x + Math.cos(s.angle) * s.dist;
    const sy = c.y + Math.sin(s.angle) * s.dist;
    const dx = sx - x, dy = sy - y;
    if (dx * dx + dy * dy < radius * radius) {
      s.alive = false;
      hits++;
      state.blocked++;
      state.combo++;
      state.streak++;
      if (state.combo > state.bestComboThisRun) state.bestComboThisRun = state.combo;
      addScore(state, 80);
      drainDebt(state, s.color.name, DEBT_ON_KILL * 0.5);
      shatter(state, sx, sy, s.color.hex, 10);
      events.push({ type: "sfx", name: "block", combo: state.combo, angle: s.angle });
    }
  }

  state.particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.4, maxLife: 0.4, color,
    size: radius / 2, angular: false, additive: true
  });

  return events;
}

// ─────────────────────────────────────────────────────────────
// EFFECTS: APPLY POWERUP
// ─────────────────────────────────────────────────────────────

export function applyPowerup(state, type, cx, cy, R) {
  const events = [];
  const skin = state.paletteRef;
  events.push({ type: "sfx", name: "powerup" });

  if (type.id === "slow") {
    state.slowTimer = 4;
    state.floaters.push({ x: cx, y: cy - R - 20, text: "TIME WARP", color: type.hex, life: 1.3 });
  } else if (type.id === "life") {
    if (state.lives < MAX_LIVES + state.runMods.startingLives) state.lives++;
    state.floaters.push({ x: cx, y: cy - R - 20, text: "+1 LIFE", color: type.hex, life: 1.3 });
  } else if (type.id === "burst") {
    let cleared = 0;
    for (let i = 0; i < state.shards.length && cleared < 2; i++) {
      const s = state.shards[i];
      if (s.alive) {
        s.alive = false;
        cleared++;
        state.blocked++;
        state.combo++;
        state.streak++;
        addScore(state, 100 * Math.max(1, state.combo));
        drainDebt(state, s.color.name, DEBT_ON_KILL * 0.5);
        const sx = cx + Math.cos(s.angle) * Math.max(s.dist, R);
        const sy = cy + Math.sin(s.angle) * Math.max(s.dist, R);
        shatter(state, sx, sy, s.color.hex, 12);
      }
    }
    state.floaters.push({ x: cx, y: cy - R - 20, text: "PRISM BURST", color: type.hex, life: 1.3 });
  } else if (type.id === "ammo") {
    state.ammo = Math.min(currentMaxAmmoFromState(state), state.ammo + 2);
    state.reloadTimer = 0;
    state.floaters.push({ x: cx, y: cy - R - 20, text: "AMMO +2", color: type.hex, life: 1.3 });
  } else if (type.id === "zoom") {
    if (state.zoomed) {
      state.floaters.push({ x: cx, y: cy - R - 20, text: "ALREADY ZOOMED", color: type.hex, life: 1.3 });
    } else {
      state.zoomed = true;
      state.floaters.push({ x: cx, y: cy - R - 20, text: "ZOOM OUT", color: type.hex, life: 1.4 });
    }
  }
  return events;
}

// Tiny helper (rules.js's currentMaxAmmo returns based on runMods)
function currentMaxAmmoFromState(state) {
  return 2 + (state.runMods ? state.runMods.ammoBonus : 0);
}

// ─────────────────────────────────────────────────────────────
// DAMAGE (missed shard hits shield) — moved here because it
// pushes to floaters, computes diagnosis, queues coaching tip
// ─────────────────────────────────────────────────────────────

export function damage(state, failAngle) {
  const events = [];

  // Streak lost floater
  if (state.streak >= 3) {
    state.floaters.push({
      x: state.layout.W / 2,
      y: state.layout.H / 2 + 40,
      text: "STREAK LOST ×" + state.streak,
      color: "#ff5a7a", life: 1.3
    });
  }

  // Diagnose the failure
  if (typeof failAngle === "number") {
    const c = { x: state.layout.W / 2, y: state.layout.H / 2 };
    let failingShard = null;
    let bestAng = Infinity;
    for (let i = 0; i < state.shards.length; i++) {
      const sh = state.shards[i];
      if (!sh.alive) continue;
      const ad = Math.abs(((sh.angle - failAngle) % TAU + TAU + Math.PI) % TAU - Math.PI);
      if (ad < bestAng) { bestAng = ad; failingShard = sh; }
    }
    const failSector = sectorIndexAtSafe(state, failAngle);
    const failColor = sectorColor(state, failSector);
    state.failedSector = failSector;
    state.failedSectorFlash = 0.7;
    state.deathDiagnosis = {
      shardColor: failingShard ? failingShard.color : failColor,
      shieldColor: failColor
    };
    state.deathDiagTimer = 2.0;

    const shardColorName = failingShard ? failingShard.color.name : failColor.name;
    const shieldColorName = failColor.name;
    if (failingShard) {
      events.push(...addDebt(state, shardColorName, 28, state.nowMs));
    }
    state._coachQueued = { shardColorName, shieldColorName };
  }

  // Apply the hit
  state.lives--;
  state.combo = 0;
  state.streak = 0;
  state.shake = 22;
  state.flash = 1;
  state.glitch = 0.4;
  state.heartsPopTimer = 0.2;

  events.push({ type: "sfx", name: "hit", angle: failAngle });
  events.push({ type: "vibrate", pattern: [30, 20, 30] });

  // Zoom loss
  if (state.zoomed) {
    state.zoomed = false;
    state.floaters.push({
      x: state.layout.W / 2, y: state.layout.H / 2 - 80,
      text: "ZOOM LOST", color: "#ff5a7a", life: 1.4
    });
  }

  // Adrenaline trigger
  if (state.lives === 1) {
    state.lowLifeWarning = 3;
    events.push(...triggerAdrenaline(state));
  }

  return events;
}

export function triggerAdrenaline(state) {
  const events = [];
  if (state.adrenaline) return events;
  state.adrenaline = true;
  events.push({ type: "sfx", name: "adrenaline" });
  events.push({ type: "banner", text: "ADRENALINE",
    sub: "Score ×2 · Epic upgrades", color: "#ff5a7a", life: 1.8 });
  state.floaters.push({
    x: state.layout.W / 2, y: state.layout.H / 2 - 120,
    text: "LAST LIFE", color: "#ff5a7a", life: 1.8
  });
  return events;
}

// Local helper — sectorIndexAt with the state
function sectorIndexAtSafe(state, angle) {
  const n = currentSectors(state);
  const arc = TAU / n;
  for (let i = 0; i < n; i++) {
    let rel = angle - state.shieldAngle - i * arc;
    rel = ((rel % TAU) + TAU) % TAU;
    if (rel < arc) return i;
  }
  return 0;
}