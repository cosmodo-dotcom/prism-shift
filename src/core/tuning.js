// =============================================================
//  Prism Shift — core/tuning.js
//  All gameplay tunables. No logic, no imports, no DOM.
//  Extracted from index.html (constants block) on 2026-10-23.
// =============================================================

export const TAU = Math.PI * 2;

// ───── Arena & layout ────────────────────────────────────────
export const SECTORS = 4;
export const ARENA = 0.22;
export const SPAWN_DIST = 0.95;
export const ZOOM_SPAWN_DIST = 1.55;
export const ZOOM_ARENA = 0.155;
export const ZOOM_LERP = 6;

// ───── Progression ──────────────────────────────────────────
export const STREAK_THRESHOLD = 5;
export const MILESTONE_STEP = 4000;
export const MAX_LIVES = 5;
export const START_LIVES = 2;
export const UPGRADE_EVERY = 10;
export const MILESTONE_UPGRADE_STEP = 10000;

// ───── Cannon & bubbles ─────────────────────────────────────
export const CANNON_MAX_AMMO = 2;
export const CANNON_RELOAD = 2.2;
export const CANNON_AIM_EASE = 12;
export const CANNON_AIM_SNAP = Math.PI / 22;
export const CANNON_RECOIL = 14;
export const CANNON_RECOIL_DECAY = 8;
export const FIRE_COOLDOWN = 0.35;

export const BUBBLE_SPEED = 380;
export const BUBBLE_RADIUS = 26;
export const BUBBLE_LIFE = 2.2;

// ───── Blocking & near-miss ─────────────────────────────────
export const NEAR_MISS_DIST = 18;
export const PERFECT_WINDOW = 8;
export const PERFECT_BONUS = 300;

// ───── Boss ─────────────────────────────────────────────────
export const BOSS_EVERY_LEVEL = 3;
export const BOSS_HP = 2;
export const BOSS_SCORE = 800;

// ───── Riser & purge ────────────────────────────────────────
export const RISER_TRIGGER_DIST = 90;
export const RISER_COOLDOWN = 2.5;
export const PURGE_SCORE = 600;
export const PURGE_DEBT_DRAIN = 100;
export const PURGE_RETRY_MS = 6000;

// ───── Adrenaline ───────────────────────────────────────────
export const ADRENALINE_SCALE = 0.85;
export const ADRENALINE_SCORE_MULT = 2;

// ───── Debt system ──────────────────────────────────────────
export const DEBT_MAX = 100;
export const DEBT_DECAY_PER_SEC = 1.2;
export const DEBT_ON_MISS = 28;
export const DEBT_ON_KILL = 22;
export const DEBT_DOMINANT_AT = 70;
export const DEBT_DOMINANT_DURATION = 30;

// ───── Level curve ──────────────────────────────────────────
export const LEVELS = [
  { target: 999, spawnMs: 1100, speed: 95,  colors: 2 },
  { target: 999, spawnMs: 1000, speed: 110, colors: 2 },
  { target: 999, spawnMs: 900,  speed: 125, colors: 3 },
  { target: 999, spawnMs: 820,  speed: 140, colors: 3 },
  { target: 999, spawnMs: 760,  speed: 155, colors: 3 },
  { target: 999, spawnMs: 700,  speed: 165, colors: 4 },
  { target: 999, spawnMs: 640,  speed: 175, colors: 4 },
  { target: 999, spawnMs: 590,  speed: 185, colors: 4 },
  { target: 999, spawnMs: 540,  speed: 195, colors: 4 },
  { target: 999, spawnMs: 490,  speed: 205, colors: 4 }
];

export function levelCfg(i) {
  if (i < LEVELS.length) return LEVELS[i];
  const over = i - LEVELS.length + 1;
  return {
    target: 999,
    spawnMs: Math.max(260, 490 - over * 25),
    speed: Math.min(260, 205 + over * 8),
    colors: 4
  };
}

export function blocksForLevel(i) { return 20 * (i + 1); }

// ───── Combo tiers (visual feedback) ────────────────────────
export const COMBO_TIERS = [
  { at: 12, label: "UNSTOPPABLE", color: "#ff5a7a", hueShift: true },
  { at: 8,  label: "ON FIRE",     color: "#ff8a3d", hueShift: true },
  { at: 5,  label: "FLOWING",     color: "#5affa0", hueShift: true }
];

export const COMBO_LABELS = [
  { at: 12, label: "UNSTOPPABLE", color: "#ffdd5a" },
  { at: 8,  label: "ON FIRE",     color: "#ff8a3d" },
  { at: 5,  label: "GREAT",       color: "#5affa0" },
  { at: 3,  label: "NICE",        color: "#5aa0ff" }
];

// ───── Powerup catalog ──────────────────────────────────────
export const POWERUP_TYPES = [
  { id: "slow",  hex: "#6ee7ff", glyph: "❄", label: "TIME WARP" },
  { id: "life",  hex: "#ff8ad0", glyph: "♥", label: "+1 LIFE" },
  { id: "burst", hex: "#ffffff", glyph: "★", label: "PRISM BURST" },
  { id: "ammo",  hex: "#9affc4", glyph: "▲", label: "AMMO +2" },
  { id: "zoom",  hex: "#ffd166", glyph: "🔭", label: "ZOOM OUT" }
];

// ───── Palettes (shield skins) ──────────────────────────────
export const PALETTES = {
  neon: [
    { name: "RED",    hex: "#ff5a7a", rgb: [255,90,122] },
    { name: "BLUE",   hex: "#5aa0ff", rgb: [90,160,255] },
    { name: "GREEN",  hex: "#5affa0", rgb: [90,255,160] },
    { name: "YELLOW", hex: "#ffdd5a", rgb: [255,221,90] }
  ],
  void: [
    { name: "RED",    hex: "#ff3d9e", rgb: [255,61,158] },
    { name: "BLUE",   hex: "#7a5aff", rgb: [122,90,255] },
    { name: "GREEN",  hex: "#5affe8", rgb: [90,255,232] },
    { name: "YELLOW", hex: "#e8d0ff", rgb: [232,208,255] }
  ],
  sunset: [
    { name: "RED",    hex: "#ff7a4d", rgb: [255,122,77] },
    { name: "BLUE",   hex: "#ff5a9a", rgb: [255,90,154] },
    { name: "GREEN",  hex: "#ffd166", rgb: [255,209,102] },
    { name: "YELLOW", hex: "#ffe0a3", rgb: [255,224,163] }
  ],
  forest: [
    { name: "RED",    hex: "#d4a017", rgb: [212,160,23] },
    { name: "BLUE",   hex: "#3d8b6e", rgb: [61,139,110] },
    { name: "GREEN",  hex: "#9fdc7a", rgb: [159,220,122] },
    { name: "YELLOW", hex: "#c98b3d", rgb: [201,139,61] }
  ]
};

// ───── Orb skins ────────────────────────────────────────────
export const ORB_SKINS = {
  prism:   { inner: "#ffffff", mid: "#cfe0ff", outer: "#6d8fe0", core: "#1a2440", glow: [140,180,255] },
  void:    { inner: "#ffffff", mid: "#e0c8ff", outer: "#7a5aff", core: "#1a0e3d", glow: [122,90,255] },
  sun:     { inner: "#ffffff", mid: "#ffe0a3", outer: "#ff7a4d", core: "#3d1a0e", glow: [255,122,77] },
  crystal: { inner: "#ffffff", mid: "#c8fff0", outer: "#5affe8", core: "#0e2a2a", glow: [90,255,232] }
};

// ───── Colorblind symbols ───────────────────────────────────
export const COLOR_SHAPES = { RED: "▲", BLUE: "●", GREEN: "■", YELLOW: "◆" };

// ───── Rarity weights & colors ──────────────────────────────
export const RARITY_WEIGHT = { common: 60, rare: 30, epic: 10, legendary: 4 };
export const RARITY_COLOR = {
  common: "#9affc4", rare: "#6ee7ff", epic: "#ff8ad0", legendary: "#ffdd5a"
};

// ───── Upgrade catalog ──────────────────────────────────────
export const UPGRADES = [
  { id: "split", name: "Split Shot", icon: "split", rarity: "common",
    desc: "+1 bolt per shot (fan out).", maxStacks: 2,
    apply: function (m) { m.boltCount += 1; m.boltSpread = Math.max(m.boltSpread, 0.12); } },
  { id: "mag", name: "Extended Mag", icon: "mag", rarity: "common",
    desc: "+1 max ammo.", maxStacks: 3,
    apply: function (m) { m.ammoBonus += 1; } },
  { id: "reload", name: "Quick Hands", icon: "reload", rarity: "common",
    desc: "Reload 25% faster.", maxStacks: 2,
    apply: function (m) { m.reloadSpeed *= 0.75; } },
  { id: "score", name: "Prism Lens", icon: "score", rarity: "common",
    desc: "+15% score from all sources.", maxStacks: 3,
    apply: function (m) { m.scoreMult *= 1.15; } },
  { id: "near", name: "Phase Step", icon: "near", rarity: "common",
    desc: "Near-misses slow time longer.", maxStacks: 2,
    apply: function (m) { m.slowOnNearMiss += 0.15; } },
  { id: "vital", name: "Vitality", icon: "vital", rarity: "common",
    desc: "+1 life now and +1 starting life.", maxStacks: 2,
    apply: function (m) { m.startingLives += 1; m._vitalNow = (m._vitalNow || 0) + 1; } },

  { id: "ricochet", name: "Ricochet", icon: "ricochet", rarity: "rare",
    desc: "Bolts bounce off the arena once.", maxStacks: 2,
    apply: function (m) { m.ricochet += 1; } },
  { id: "chain", name: "Chain Reaction", icon: "chain", rarity: "rare",
    desc: "Blocked shards explode, damaging nearby shards.", maxStacks: 1,
    apply: function (m) { m.chainRadius = Math.max(m.chainRadius, 70); } },
  { id: "auto", name: "Overcharge", icon: "auto", rarity: "rare",
    desc: "Every 6th block fires a free auto-bolt.", maxStacks: 1,
    apply: function (m) { m.autoFireEvery = 6; } },
  { id: "immunity", name: "Prism Lock", icon: "immunity", rarity: "rare",
    desc: "After a block, that sector is immune for 1.2s.", maxStacks: 1,
    apply: function (m) { m.sectorImmunity = Math.max(m.sectorImmunity, 1.2); } },
  { id: "prismdrop", name: "Crystal Harvest", icon: "prismdrop", rarity: "rare",
    desc: "Killed shards sometimes drop a prism shard.", maxStacks: 2,
    apply: function (m) { m.prismChance += 0.10; } },

  { id: "chroma", name: "Chromatic", icon: "chroma", rarity: "epic",
    desc: "+1 shield sector (and +1 color).", maxStacks: 1,
    apply: function (m) { m.extraSectors += 1; m.extraColors += 1; } },
  { id: "slowmo", name: "Time Dilation", icon: "slowmo", rarity: "epic",
    desc: "Slow-mo triggers automatically near shards.", maxStacks: 1,
    apply: function (m) { m.autoSlowNear = true; } },
  { id: "chain3", name: "Hyper Chain", icon: "chain3", rarity: "epic",
    desc: "Chain explosions are larger and hit more shards.", maxStacks: 1,
    apply: function (m) { m.chainRadius = Math.max(m.chainRadius, 110); m.chainCount = 3; } },
  { id: "glass", name: "Glass Cannon", icon: "glass", rarity: "epic",
    desc: "+2 bolt damage, but -1 max life.", maxStacks: 1,
    apply: function (m) { m.boltDamage *= 2; m.startingLives = Math.max(-1, m.startingLives - 1); m._glass = true; } },

  { id: "storm", name: "Prism Storm", icon: "storm", rarity: "legendary",
    desc: "Every block fires 2 auto-bolts in random directions.", maxStacks: 1,
    apply: function (m) { m.stormOnBlock = true; } },
  { id: "echo", name: "Echo Shield", icon: "echo", rarity: "legendary",
    desc: "Blocking a shard repeats the block's score.", maxStacks: 1,
    apply: function (m) { m.echo = true; } },
  { id: "singularity", name: "Singularity", icon: "singularity", rarity: "legendary",
    desc: "The orb pulls nearby shards inward slightly.", maxStacks: 1,
    apply: function (m) { m.gravity = true; } }
];

// ───── Shop catalog (skins, perks, mods) ────────────────────
export const SHOP_ITEMS = [
  { id: "shield_neon", cat: "skins", sub: "shield", name: "Neon Shield",
    desc: "The default prism palette. Bright and readable.",
    price: 0, preview: "neon" },
  { id: "shield_void", cat: "skins", sub: "shield", name: "Void Shield",
    desc: "Deep purples and cyan. For the night shift.",
    price: 300, preview: "void" },
  { id: "shield_sunset", cat: "skins", sub: "shield", name: "Sunset Shield",
    desc: "Warm oranges and pinks. Golden hour vibes.",
    price: 400, preview: "sunset" },
  { id: "shield_forest", cat: "skins", sub: "shield", name: "Forest Shield",
    desc: "Earthy greens and amber. Calm, natural.",
    price: 500, preview: "forest" },

  { id: "orb_prism", cat: "skins", sub: "orb", name: "Prism Orb",
    desc: "The default crystalline core.",
    price: 0, preview: "prism" },
  { id: "orb_void", cat: "skins", sub: "orb", name: "Void Orb",
    desc: "A purple singularity. Subtle and ominous.",
    price: 350, preview: "void" },
  { id: "orb_sun", cat: "skins", sub: "orb", name: "Sun Orb",
    desc: "A tiny star at the center of the arena.",
    price: 450, preview: "sun" },
  { id: "orb_crystal", cat: "skins", sub: "orb", name: "Crystal Orb",
    desc: "Ice-cold teal. Crystal clear.",
    price: 600, preview: "crystal" },

  { id: "perk_headstart", cat: "perks", name: "Head Start",
    desc: "+1 max ammo at the start of every run.",
    price: 300, apply: function (mods) { mods.ammoBonus += 1; } },
  { id: "perk_thick", cat: "perks", name: "Thick Skin",
    desc: "+1 starting life on every run.",
    price: 500, apply: function (mods) { mods.startingLives += 1; } },
  { id: "perk_steady", cat: "perks", name: "Steady Hands",
    desc: "Reload 15% faster on every run.",
    price: 400, apply: function (mods) { mods.reloadSpeed *= 0.85; } },
  { id: "perk_warmup", cat: "perks", name: "Warm-Up",
    desc: "First shard of every run spawns slower.",
    price: 250, apply: function (mods) { mods._warmup = true; } },
  { id: "perk_prismfind", cat: "perks", name: "Prism Find",
    desc: "Powerups drop 40% more often.",
    price: 350, apply: function (mods) { mods._prismfind = true; } },

  { id: "mod_frenzy", cat: "mods", name: "Frenzy",
    desc: "Shards spawn 25% faster. Score ×1.2.",
    price: 0, unlockAt: { type: "score", value: 2000 },
    apply: function (mods) { mods._frenzy = true; } },
  { id: "mod_onelife", cat: "mods", name: "One Life",
    desc: "Start with 1 life. Score ×1.5.",
    price: 0, unlockAt: { type: "score", value: 10000 },
    apply: function (mods) { mods._onelife = true; } },
  { id: "mod_thinshield", cat: "mods", name: "Glass Shield",
    desc: "Shield hitbox 15% thinner. Score ×1.3.",
    price: 0, unlockAt: { type: "score", value: 15000 },
    apply: function (mods) { mods._thinshield = true; } }
];