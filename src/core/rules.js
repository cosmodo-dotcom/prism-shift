// =============================================================
//  Prism Shift — core/rules.js
//  Pure predicates and small computations.
//  Every function takes `state` as its first arg.
//  No DOM, no audio, no Math.random() (use state.rng).
// =============================================================

import {
  TAU, SECTORS, MAX_LIVES, MILESTONE_STEP,
  COMBO_TIERS, POWERUP_TYPES, UPGRADES,
  PALETTES, RARITY_WEIGHT,
  DEBT_MAX, DEBT_DOMINANT_AT, DEBT_DOMINANT_DURATION
} from "./tuning.js";

// ─────────────────────────────────────────────────────────────
// SECTOR GEOMETRY
// ─────────────────────────────────────────────────────────────

/** Total number of shield sectors (4 by default, more with Chromatic). */
export function currentSectors(state) {
  return SECTORS + (state.runMods ? state.runMods.extraSectors : 0);
}

/** Arc length of one sector, in radians. */
export function sectorArc(state) {
  return TAU / currentSectors(state);
}

/**
 * Which sector index does a world-space angle fall into?
 * Sectors are laid out starting at state.shieldAngle, going clockwise
 * (in canvas coords where +angle rotates clockwise because y is down).
 */
export function sectorIndexAt(state, angle) {
  const n = currentSectors(state);
  const arc = TAU / n;
  for (let i = 0; i < n; i++) {
    let rel = angle - state.shieldAngle - i * arc;
    rel = ((rel % TAU) + TAU) % TAU;
    if (rel < arc) return i;
  }
  return 0;
}

/** Color object for a given sector index. Wraps around if more
 *  sectors than palette entries (which can't happen currently but
 *  is worth guarding against). */
export function sectorColor(state, i) {
  const n = state.cachedColors;
  const pal = activeColors(state);
  return pal[i % n];
}

/** Color object for a given world-space angle. */
export function colorAt(state, angle) {
  return sectorColor(state, sectorIndexAt(state, angle));
}

/** Which color is the shield currently pointing at from the
 *  cannon's POV? Uses state.targetAngle — the cannon aims where
 *  the player aims, not where the visual is lagging. */
export function cannonSectorIndex(state) {
  return sectorIndexAt(state, state.targetAngle);
}

export function cannonColor(state) {
  return sectorColor(state, cannonSectorIndex(state));
}

/** The currently-equipped shield palette. */
export function activeColors(state) {
  // state.meta is looked up via state.metaRef which the adapter sets
  // at boot. Falls back to neon if absent.
  const skin = (state.metaRef && state.metaRef.equipped && state.metaRef.equipped.shield) || "neon";
  return PALETTES[skin] || PALETTES.neon;
}

/** The currently-equipped orb skin. */
export function activeOrb(state) {
  const skin = (state.metaRef && state.metaRef.equipped && state.metaRef.equipped.orb) || "prism";
  // ORB_SKINS is looked up by the renderer; rules.js only needs the key.
  return skin;
}

// ─────────────────────────────────────────────────────────────
// AMMO & RELOAD
// ─────────────────────────────────────────────────────────────

export function currentMaxAmmo(state) {
  return 2 + (state.runMods ? state.runMods.ammoBonus : 0);
}

// ─────────────────────────────────────────────────────────────
// SCORE & SHARDS
// ─────────────────────────────────────────────────────────────

/**
 * Apply score with all multipliers (run mods + adrenaline).
 * Mutates state.score and state.scoreFromRun. Returns the amount added.
 */
export function addScore(state, base) {
  let mult = state.runMods ? state.runMods.scoreMult : 1;
  if (state.adrenaline) mult *= 2;
  const amt = Math.round(base * mult);
  state.score += amt;
  state.scoreFromRun += amt;
  return amt;
}

/**
 * How many shards should be awarded at end of run?
 * This is the exact formula from the original game.
 */
export function calculateRunShards(state, bestScore) {
  let s = 0;
  s += Math.floor(state.score / 50);
  s += (state.level + 1) * 5;
  s += state.runUpgrades.length * 10;
  s += state.blocked * 2;
  if (state.score > bestScore) s += 25;
  s += Math.min(50, Math.floor(state.nearMissCount * 2));
  s += Math.min(80, state.perfectBlocks * 6);
  return s;
}

// ─────────────────────────────────────────────────────────────
// COMBO TIERS
// ─────────────────────────────────────────────────────────────

/** Which index into COMBO_TIERS the current combo hits, or -1. */
export function currentComboTier(state) {
  for (let i = 0; i < COMBO_TIERS.length; i++) {
    if (state.combo >= COMBO_TIERS[i].at) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────
// LIVES DISPLAY
// ─────────────────────────────────────────────────────────────

/** How many hearts to render in the HUD. */
export function maxLivesForDisplay(state) {
  const base = MAX_LIVES + (state.runMods ? Math.max(0, state.runMods.startingLives) : 0);
  return Math.max(3, base);
}

// ─────────────────────────────────────────────────────────────
// DEBT SYSTEM
// ─────────────────────────────────────────────────────────────

/** Palette index (0..3) for a color name, or -1 if unknown. */
export function debtColorIndex(state, colorName) {
  const pal = activeColors(state);
  for (let i = 0; i < 4; i++) {
    if (pal[i].name === colorName) return i;
  }
  return -1;
}

/**
 * Add debt for a color. If it crosses the dominant threshold,
 * returns a "dominant" event. If it maxes out, returns a "purge" event.
 * Caller is responsible for showing banners / playing sounds.
 * @returns {Array<{type:string, colorName?:string}>}
 */
export function addDebt(state, colorName, amount, nowMs) {
  const events = [];
  const idx = debtColorIndex(state, colorName);
  if (idx < 0) return events;

  const wasBelow = state.debt[idx] < DEBT_DOMINANT_AT;
  state.debt[idx] = Math.min(DEBT_MAX, state.debt[idx] + amount);

  if (wasBelow && state.debt[idx] >= DEBT_DOMINANT_AT) {
    state.debtDominantUntil[idx] = nowMs + DEBT_DOMINANT_DURATION * 1000;
    events.push({ type: "debtDominant", colorName });
  }

  if (state.debt[idx] >= DEBT_MAX) {
    let alreadyQueued = false;
    for (let q = 0; q < state.purgeQueue.length; q++) {
      if (state.purgeQueue[q].colorName === colorName) { alreadyQueued = true; break; }
    }
    if (!alreadyQueued) {
      state.purgeQueue.push({ colorName, at: nowMs + 400 });
      events.push({ type: "purgeQueued", colorName });
    }
  }

  return events;
}

/** Reduce debt for a color. Clamps at 0. */
export function drainDebt(state, colorName, amount) {
  const idx = debtColorIndex(state, colorName);
  if (idx < 0) return;
  state.debt[idx] = Math.max(0, state.debt[idx] - amount);
}

/** Is this color currently spawning more often? */
export function isColorDominant(state, colorName, nowMs) {
  const idx = debtColorIndex(state, colorName);
  if (idx < 0) return false;
  return nowMs < state.debtDominantUntil[idx];
}

// ─────────────────────────────────────────────────────────────
// UPGRADE REWARDS
// ─────────────────────────────────────────────────────────────

/**
 * Pick random upgrades using weighted rarity and respecting stack limits.
 * Deterministic for a given rng state (caller passes state.rng).
 * @returns {Array<UpgradeDef>}
 */
export function rollUpgradeRewards(state, count) {
  const pool = [];
  for (let i = 0; i < UPGRADES.length; i++) {
    const u = UPGRADES[i];
    const stacks = state.runUpgrades.filter(x => x === u.id).length;
    if (u.id === "chroma" && currentSectors(state) >= state.paletteRef.length) continue;
    if (stacks < (u.maxStacks || 1)) pool.push(u);
  }

  if (state.adrenaline) {
    const epicPool = pool.filter(u => u.rarity === "epic" || u.rarity === "legendary");
    if (epicPool.length >= count) {
      pool.length = 0;
      for (let i = 0; i < epicPool.length; i++) pool.push(epicPool[i]);
    }
  }

  const offers = [];
  for (let k = 0; k < count && pool.length > 0; k++) {
    let total = 0;
    for (let j = 0; j < pool.length; j++) {
      total += RARITY_WEIGHT[pool[j].rarity] || 10;
    }
    let r = state.rng.next() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= RARITY_WEIGHT[pool[j].rarity] || 10;
      if (r <= 0) { idx = j; break; }
    }
    offers.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return offers;
}

// ─────────────────────────────────────────────────────────────
// POWERUPS
// ─────────────────────────────────────────────────────────────

/** Pick a random powerup type. */
export function pickPowerup(state) {
  return POWERUP_TYPES[Math.floor(state.rng.next() * POWERUP_TYPES.length)];
}

// ─────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────

/** True if current state is in one of the interactive modes. */
export function isPlaying(state) {
  return state.mode === "playing" || state.mode === "transition";
}

/** True if the game is currently in a modal overlay. */
export function isModal(state) {
  return state.mode === "paused" || state.mode === "gameover" ||
         state.mode === "shop";
}

/** Milestone bumping: advance the threshold, return how many lives
 *  to grant (0 or 1). Caller decides whether to show the banner. */
export function bumpMilestoneIfDue(state) {
  if (state.score < state.nextMilestone) return { bumped: false, livesGranted: 0 };
  state.nextMilestone += MILESTONE_STEP;
  let livesGranted = 0;
  const maxLives = MAX_LIVES + (state.runMods ? state.runMods.startingLives : 0);
  if (state.lives < maxLives) {
    state.lives++;
    livesGranted = 1;
  }
  return { bumped: true, livesGranted };
}
// ─────────────────────────────────────────────────────────────
// HELPERS NEEDED BY simulation.js
// ─────────────────────────────────────────────────────────────

/** Distance from center to shard, in world units. */
export function shardWorldPos(cx, cy, shard) {
  return {
    x: cx + Math.cos(shard.angle) * shard.dist,
    y: cy + Math.sin(shard.angle) * shard.dist
  };
}

/** Resolve a shard's currently-active color (handles boss alternate phase). */
export function activeShardColor(shard) {
  if (!shard.boss || !shard.colorB) return shard.color;
  const phase = (shard.bossTimer % shard.bossCycle) / shard.bossCycle;
  return phase < 0.5 ? shard.color : shard.colorB;
}

/** Shortest signed angular difference from b to a (in range -π..π). */
export function shortestAngle(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}