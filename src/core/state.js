// =============================================================
//  Prism Shift — core/state.js
//  State factory + meta persistence helpers.
//  NO platform globals. Storage is injected.
// =============================================================

import {
  START_LIVES, CANNON_MAX_AMMO, MILESTONE_STEP, UPGRADE_EVERY,
  MILESTONE_UPGRADE_STEP
} from "./tuning.js";
import { createRng } from "./rng.js";

// ─────────────────────────────────────────────────────────────
// META — the persisted profile (shards, unlocks, best score)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_META = {
  shards: 0,
  totalShards: 0,
  runs: 0,
  bestScore: 0,
  maxScoreSingleRun: 0,
  owned: {},
  equipped: { shield: "neon", orb: "prism" },
  colorblind: false
};

export function createMeta() {
  // Deep clone so DEFAULT_META never gets mutated.
  return JSON.parse(JSON.stringify(DEFAULT_META));
}

/**
 * Load meta from storage. Falls back to defaults on any error.
 * @param {{ get(k:string):string|null }} storage
 * @returns {object} meta
 */
export function loadMeta(storage) {
  try {
    const raw = storage.get("psMeta");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        shards: parsed.shards || 0,
        totalShards: parsed.totalShards || 0,
        runs: parsed.runs || 0,
        bestScore: parsed.bestScore || 0,
        maxScoreSingleRun: parsed.maxScoreSingleRun || 0,
        owned: parsed.owned || {},
        equipped: {
          shield: (parsed.equipped && parsed.equipped.shield) || "neon",
          orb: (parsed.equipped && parsed.equipped.orb) || "prism"
        },
        colorblind: !!parsed.colorblind
      };
    }
  } catch (e) {
    // fall through to defaults
  }
  return createMeta();
}

/**
 * Save meta to storage. Silently swallows errors
 * (private mode, quota exceeded, etc).
 */
export function saveMeta(meta, storage) {
  try {
    storage.set("psMeta", JSON.stringify(meta));
  } catch (e) {
    // ignore
  }
}

/**
 * Migrate legacy "psBest" key into meta if it's higher.
 * Called once at boot after loadMeta. Kept here because
 * it's pure profile migration, not platform logic.
 */
export function migrateLegacyBest(meta, storage) {
  try {
    const legacyBest = parseInt(storage.get("psBest") || "0", 10) || 0;
    if (legacyBest > meta.bestScore) meta.bestScore = legacyBest;
    if (meta.maxScoreSingleRun > meta.bestScore) {
      meta.bestScore = meta.maxScoreSingleRun;
    }
    storage.set("psBest", String(meta.bestScore));
  } catch (e) {
    // ignore
  }
  return meta;
}

// ─────────────────────────────────────────────────────────────
// RUN MODS — per-run mutable modifier object
// ─────────────────────────────────────────────────────────────

export function defaultMods() {
  return {
    boltDamage: 1,
    boltCount: 1,
    boltSpread: 0,
    ricochet: 0,
    autoFireEvery: 0,
    stormOnBlock: false,
    sectorImmunity: 0,
    chainRadius: 0,
    chainCount: 2,
    slowOnNearMiss: 0.35,
    ammoBonus: 0,
    reloadSpeed: 1,
    startingLives: 0,
    scoreMult: 1,
    prismChance: 0.05,
    extraSectors: 0,
    extraColors: 0,
    autoSlowNear: false,
    echo: false,
    gravity: false,
    _vitalNow: 0,
    _glass: false,
    _warmup: false,
    _prismfind: false,
    _frenzy: false,
    _onelife: false,
    _thinshield: false
  };
}

/**
 * Apply owned shop perks + mods to a fresh run's mods object.
 * @param {object} mods - the result of defaultMods()
 * @param {object} meta - the player's persisted profile
 * @param {Array} shopItems - the SHOP_ITEMS catalog from tuning.js
 */
export function applyMetaToRunMods(mods, meta, shopItems) {
  for (let i = 0; i < shopItems.length; i++) {
    const it = shopItems[i];
    if (it.apply && meta.owned[it.id]) it.apply(mods);
  }
  if (meta.owned["mod_frenzy"])     mods.scoreMult *= 1.2;
  if (meta.owned["mod_onelife"])    mods.scoreMult *= 1.5;
  if (meta.owned["mod_thinshield"]) mods.scoreMult *= 1.3;
}

// ─────────────────────────────────────────────────────────────
// STATE — the per-session game state
// ─────────────────────────────────────────────────────────────

/**
 * Create a fresh game state object.
 * Every field matches the original `state` object in index.html,
 * plus a few new ones (rng, tick, shakeX, shakeY) added during
 * extraction. See the comment next to each new field.
 */
export function createState() {
  return {
    // ── mode & progression
    mode: "menu",             // "menu"|"playing"|"transition"|"gameover"|"paused"|"shop"
    level: 0,
    blocked: 0,
    lives: START_LIVES,
    score: 0,
    combo: 0,
    streak: 0,

    // ── shield & cannon angles
    shieldAngle: 0,
    targetAngle: 0,
    cannonAngle: 0,

    // ── entity arrays
    shards: [],
    powerups: [],
    bolts: [],                // legacy, kept for compat but unused since bubbles
    bubbles: [],
    particles: [],
    floaters: [],

    // ── timers
    spawnTimer: 0,
    powerTimer: 0,
    lastTime: 0,
    pulse: 0,
    countdown: 0,
    countdownText: "",
    introTimer: 0,

    // ── visual feedback
    shake: 0,
    shakeX: 0,                // NEW: computed in tick, not in draw
    shakeY: 0,                // NEW: computed in tick, not in draw
    flash: 0,
    glitch: 0,
    comboPulse: 0,
    comboLabel: "",
    sectorFlash: [0, 0, 0, 0, 0, 0],
    nearMisses: [],
    scorePopTimer: 0,
    heartsPopTimer: 0,
    lowLifeWarning: 0,
    bannerQueue: [],

    // ── time scaling
    timeScale: 1,
    slowTimer: 0,
    microSlow: 0,

    // ── combo & block tracking
    lastBlockAt: 0,
    nextMilestone: MILESTONE_STEP,
    nextUpgradeAt: UPGRADE_EVERY,
    nextUpgradeScore: MILESTONE_UPGRADE_STEP,
    bestComboThisRun: 0,

    // ── cannon & ammo
    ammo: CANNON_MAX_AMMO,
    reloadTimer: 0,
    cannonFlash: 0,
    fireCooldown: 0,
    cannonTrail: [],
    cannonRecoil: 0,
    cannonAimed: false,

    // ── zoom
    zoomed: false,
    zoomLevel: 0,

    // ── run config
    cachedColors: 2,
    runMods: null,
    runUpgrades: [],
    _upgradeHintShown: false,
    runStartTime: 0,
    sectorImmuneUntil: [0, 0, 0, 0, 0, 0],
    scoreFromRun: 0,
    shardsEarnedThisRun: 0,

    // ── shop UI (lives in state so pause/resume works)
    shopOpen: false,
    shopTab: "skins",

    // ── fail diagnostics
    failedSector: -1,
    failedSectorFlash: 0,
    deathDiagnosis: null,
    deathDiagTimer: 0,
    _coachQueued: null,

    // ── tutorial
    tutorial: null,
    _tutorialShardSpawned: false,
    coachingTip: null,
    _pendingCoachSpawn: false,

    // ── rendering quality
    lowQuality: false,

    // ── summary session flags
    _sumDoubleUsed: false,
    _sumDoubleEarned: 0,
    _retrying: false,

    // ── shard speed ramp
    shardSpeedBase: 95,
    shardSpeedTarget: 95,
    spawnDebt: 0,

    // ── debt system
    debt: [0, 0, 0, 0],
    debtDominantUntil: [0, 0, 0, 0],

    // ── counters for summary
    nearMissCount: 0,
    perfectBlocks: 0,
    perfectFlash: 0,

    // ── escalation visuals
    escalation: 0,
    escalationTier: 0,
    escalationHue: 0,

    // ── riser & boss
    riserCooldown: 0,
    bossPending: false,
    bossLevelsCleared: 0,
    purgeQueue: [],

    // ── adrenaline
    adrenaline: false,
    adrenalineMix: 0,

    // ── hint timer
    landscapeHintShown: false,
    landscapeHintTimer: 0,

    // ── hit-stop & shockwaves
    hitstop: 0,
    shockwaves: [],

    // ── visuals only
    best: 0,
    nebula: [],

    // ── audio
    muted: false,

    // ── NEW: instance RNG (replaces global rand/pick)
    rng: createRng(),
// ── NEW: injected by adapter at boot
layout: null,       // { W, H, shieldRadius(), spawnDist() }
nowMs: 0,           // updated each tick from the platform clock
paletteRef: null,   // PALETTES[meta.equipped.shield], updated on skin change
metaRef: null,      // reference to the meta object    // ── NEW: monotonic tick count (incremented in tick())
    tick: 0,

    // ── NEW: time since last update, seconds (set in tick())
    dt: 0
  };
}

// ─────────────────────────────────────────────────────────────
// SERIALIZATION — for save/resume, cloud saves, debugging
// ─────────────────────────────────────────────────────────────

/**
 * Snapshot the state to a plain JSON-safe object.
 * Excludes the RNG instance (can't serialize a closure) and
 * volatile per-frame values (shakeX/Y, dt).
 */
export function serializeState(state) {
  const out = {};
  for (const k in state) {
    if (k === "rng" || k === "shakeX" || k === "shakeY" || k === "dt") continue;
    out[k] = state[k];
  }
  return out;
}

/**
 * Restore a state from a snapshot. Missing fields fall back
 * to a fresh createState() so old saves survive new fields.
 */
export function deserializeState(json) {
  const fresh = createState();
  for (const k in json) {
    if (k in fresh) fresh[k] = json[k];
  }
  return fresh;
}