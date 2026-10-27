// =============================================================
//  Prism Shift — core/simulation.js
//  The tick function. No DOM, no audio, no canvas.
//  Returns an events array for the adapter to dispatch.
// =============================================================

import {
  TAU, MILESTONE_STEP, UPGRADE_EVERY, MILESTONE_UPGRADE_STEP,
  START_LIVES, MAX_LIVES,
  CANNON_MAX_AMMO, CANNON_RELOAD, CANNON_AIM_EASE, CANNON_AIM_SNAP,
  CANNON_RECOIL, CANNON_RECOIL_DECAY, FIRE_COOLDOWN,
  BUBBLE_SPEED, BUBBLE_RADIUS, BUBBLE_LIFE,
  NEAR_MISS_DIST, PERFECT_WINDOW, PERFECT_BONUS,
  STREAK_THRESHOLD, RISER_TRIGGER_DIST, RISER_COOLDOWN,
  PURGE_SCORE, PURGE_DEBT_DRAIN, ADRENALINE_SCALE, ADRENALINE_SCORE_MULT,
  DEBT_MAX, DEBT_DECAY_PER_SEC, DEBT_ON_MISS, DEBT_ON_KILL,
  BOSS_SCORE, COMBO_LABELS, ZOOM_LERP,
  levelCfg, blocksForLevel, UPGRADES
} from "./tuning.js";
import {
  currentSectors, sectorArc, sectorIndexAt, sectorColor, colorAt,
  cannonSectorIndex, cannonColor, currentMaxAmmo,
  currentComboTier, addScore, addDebt, drainDebt, isColorDominant,
  rollUpgradeRewards, bumpMilestoneIfDue, calculateRunShards,
  shortestAngle, activeShardColor, shardWorldPos
} from "./rules.js";
import {
  spawnShard, spawnPowerup, shatter, chainExplode,
  applyPowerup, damage
} from "./spawn.js";
import { applyMetaToRunMods, defaultMods } from "./state.js";
import { SHOP_ITEMS } from "./tuning.js";

// ─────────────────────────────────────────────────────────────
// RUN LIFECYCLE — startRun and startLevel
// These move from the adapter's old gameOver/startRun logic
// into core so the state transitions are testable.
// ─────────────────────────────────────────────────────────────

/**
 * Begin a fresh run. Resets state in place.
 * @param {object} state
 * @param {object} meta
 * @param {object} opts - { countdown?: number, tutorial?: boolean }
 * @returns {Array} events
 */
export function startRun(state, meta, opts) {
  opts = opts || {};
  const events = [];

  state.runMods = defaultMods();
  applyMetaToRunMods(state.runMods, meta, SHOP_ITEMS);
  state.runUpgrades = [];
  state.runStartTime = Date.now();
  state.bestComboThisRun = 0;
  state.scoreFromRun = 0;
  state.shardsEarnedThisRun = 0;
  state._sumDoubleUsed = false;
  state._sumDoubleEarned = 0;

  let lives = START_LIVES + state.runMods.startingLives;
  if (meta.owned["mod_onelife"]) lives = 1;
  state.lives = Math.max(1, lives);

  state.score = 0;
  state.combo = 0;
  state.streak = 0;
  state.scorePopTimer = 0;
  state.nextMilestone = MILESTONE_STEP;
  state.nextUpgradeAt = UPGRADE_EVERY;
  state.nextUpgradeScore = MILESTONE_UPGRADE_STEP;
  state.zoomed = false;
  state.zoomLevel = 0;
  state.sectorImmuneUntil = [0, 0, 0, 0, 0, 0];
  state._upgradeHintShown = false;
  state.tutorial = opts.tutorial !== false ? { step: 0 } : null;
  state._tutorialShardSpawned = false;
  state.deathDiagnosis = null;
  state.deathDiagTimer = 0;
  state.debt = [0, 0, 0, 0];
  state.debtDominantUntil = [0, 0, 0, 0];
  state.nearMissCount = 0;
  state.perfectBlocks = 0;
  state.perfectFlash = 0;
  state.escalation = 0;
  state.escalationTier = 0;
  state.riserCooldown = 0;
  state.bossPending = false;
  state.purgeQueue = [];
  state.adrenaline = false;
  state.adrenalineMix = 0;
  state.coachingTip = null;
  state._pendingCoachSpawn = false;
  state.shockwaves = [];
  state.hitstop = 0;
  state.bubbles = [];
  state.bolts = [];
  state.cannonRecoil = 0;
  state.cannonAimed = false;

  startLevel(state, 0);

  if (meta.runs > 0) {
    state.countdown = opts.countdown !== undefined ? opts.countdown : 0.35;
  } else {
    state.countdown = opts.countdown !== undefined ? opts.countdown : 0;
  }

  return events;
}

/**
 * Begin a specific level. Resets per-level state in place.
 */
export function startLevel(state, level) {
  state.level = level;
  const extraColors = state.runMods ? state.runMods.extraColors : 0;
  state.cachedColors = levelCfg(level).colors + extraColors;
  if (state.cachedColors > state.paletteRef.length) state.cachedColors = state.paletteRef.length;
  if (state.cachedColors < 2) state.cachedColors = 2;

  state.blocked = 0;
  state.streak = 0;
  state.shards = [];
  state.powerups = [];
  state.bolts = [];
  state.bubbles = [];
  state.particles = [];
  state.floaters = [];
  state.spawnTimer = 600;
  state.powerTimer = 5000 + state.rng.next() * 4000;
  state.shieldAngle = 0;
  state.targetAngle = 0;
  state.cannonAngle = 0;
  state.cannonTrail = [];
  state.cannonRecoil = 0;
  state.cannonAimed = false;
  state.introTimer = 1.2;
  state.countdown = 1.2;
  state.countdownText = "";
  state.timeScale = 1;
  state.slowTimer = 0;
  state.microSlow = 0;
  state.lastBlockAt = state.nowMs;
  state.mode = "playing";
  state.sectorFlash = [0, 0, 0, 0, 0, 0];
  state.ammo = currentMaxAmmo(state);
  state.reloadTimer = 0;
  state.cannonFlash = 0;
  state.fireCooldown = 0;
  state.bannerQueue = [];
  state.sectorImmuneUntil = [0, 0, 0, 0, 0, 0];
  state.failedSector = -1;
  state.failedSectorFlash = 0;
  state.shardSpeedBase = levelCfg(level).speed;
  state.shardSpeedTarget = levelCfg(level).speed;
  state.spawnDebt = 0;
  state.bossPending = (level > 0 && level % 3 === 0);
  state.shockwaves = [];
  state.hitstop = 0;
}

// ─────────────────────────────────────────────────────────────
// FIRE
// ─────────────────────────────────────────────────────────────

/**
 * Fire a bubble. Returns events.
 * @param {object} state
 * @param {Array<{a:number, sector:number}>|null} angles
 *   - null → fire 1 shot along targetAngle (+ boltCount fan)
 *   - array → fire those exact angles
 * @param {boolean} isFree - skip ammo/cooldown checks (auto-fire upgrades)
 */
export function fireCannon(state, angles, isFree) {
  const events = [];

  if (!isFree) {
    if (state.mode !== "playing" && state.mode !== "transition") return events;
    if (state.countdown > 0) { state.countdown = 0.01; return events; }
    if (state.ammo <= 0) return events;
    if (state.fireCooldown > 0) return events;
    if (state.tutorial && state.tutorial.step < 2) return events;
  }

  const c = state.layout;
  const cx = c.W / 2, cy = c.H / 2;
  const R = c.shieldRadius();
  const ca = state.targetAngle;
  state.cannonAngle = ca;
  const boltSectorIdx = sectorIndexAt(state, ca);

  let fireAngles;
  if (!angles) {
    fireAngles = [];
    const n = state.runMods ? state.runMods.boltCount : 1;
    const spread = state.runMods ? state.runMods.boltSpread : 0;
    for (let i = 0; i < n; i++) {
      const off = (n === 1) ? 0 : (i - (n - 1) / 2) * spread;
      fireAngles.push({ a: ca + off, sector: boltSectorIdx });
    }
  } else {
    fireAngles = angles.map(a => typeof a === "number"
      ? { a, sector: boltSectorIdx }
      : a
    );
  }

  for (const ang of fireAngles) {
    const muzzle = R + 26;
    state.bubbles.push({
      x: cx + Math.cos(ang.a) * muzzle,
      y: cy + Math.sin(ang.a) * muzzle,
      angle: ang.a,
      vx: Math.cos(ang.a) * BUBBLE_SPEED,
      vy: Math.sin(ang.a) * BUBBLE_SPEED,
      life: BUBBLE_LIFE,
      maxLife: BUBBLE_LIFE,
      radius: BUBBLE_RADIUS,
      trail: [],
      bounces: state.runMods ? state.runMods.ricochet : 0,
      colorIdx: ang.sector,
      wob: state.rng.next() * TAU,
      captured: false,
      captureShard: null
    });
  }

  if (!isFree) {
    state.ammo--;
    state.cannonFlash = 1;
    state.cannonRecoil = CANNON_RECOIL;
    state.fireCooldown = FIRE_COOLDOWN;
    if (state.ammo < currentMaxAmmo(state)) {
      if (state.reloadTimer <= 0) {
        state.reloadTimer = CANNON_RELOAD / (state.runMods ? state.runMods.reloadSpeed : 1);
      }
    }
    const bc = cannonColor(state);
    events.push({ type: "sfx", name: "fire", colorName: bc ? bc.name : "RED" });
    if (state.tutorial && state.tutorial.step === 2) {
      state.tutorial.step = 3;
      state._tutorialShardSpawned = false;
      state.countdown = 1.0;
      state.countdownText = "";
      state.floaters.push({ x: cx, y: cy - 120, text: "GO!", color: "#5affa0", life: 1.3 });
    }
  } else {
    state.cannonFlash = 0.6;
  }

  return events;
}

// ─────────────────────────────────────────────────────────────
// THE TICK
// ─────────────────────────────────────────────────────────────

/**
 * Advance the game by one frame.
 * @param {object} state
 * @param {number} dt   - delta time, in seconds
 * @param {object} input - { aimDelta: number, fire: boolean }
 * @returns {Array} events
 */
export function tick(state, dt, input) {
  const events = [];
  input = input || {};
  state.tick++;
  state.dt = dt;

  // Shop freezes simulation
  if (state.mode === "shop") return events;

  // Hitstop freezes almost everything
  if (state.hitstop > 0) {
    state.hitstop -= dt;
    state.flash *= Math.pow(0.001, dt * 0.5);
    if (state.perfectFlash > 0) state.perfectFlash -= dt * 1.5;
    if (state.glitch > 0) state.glitch -= dt;
    if (state.shake > 0) state.shake *= Math.pow(0.001, dt);
    return events;
  }

// ── Input: aim
const totalAim = (input.aimDelta || 0) + (input.pointerAimDelta || 0);
if (totalAim !== 0) {
  const n = currentSectors(state);
  state.targetAngle += Math.sign(totalAim) * (TAU / n);
  if (state.tutorial && state.tutorial.step === 0) {
    state.tutorial.step = 1;
    const cx = state.layout.W / 2;
    const cy = state.layout.H / 2;
    state.floaters.push({
      x: cx, y: cy - 120, text: "HERE COMES A SHARD!",
      color: "#5affa0", life: 1.8
    });
    events.push({ type: "vibrate", pattern: [35, 40, 35] });
  }
  if (state.countdown > 0) state.countdown = 0.01;
}
  // ── Input: fire
  if (input.fire) {
    events.push(...fireCannon(state, null, false));
  }

  // ── Shield lerp
  const shieldDiff = shortestAngle(state.targetAngle, state.shieldAngle);
  state.shieldAngle += shieldDiff * Math.min(1, dt * 18);
  state.shieldAngle = ((state.shieldAngle % TAU) + TAU) % TAU;

  // ── Cannon lerp (aimable turret)
  const aimDelta = shortestAngle(state.targetAngle, state.cannonAngle);
  state.cannonAngle += aimDelta * Math.min(1, dt * CANNON_AIM_EASE);
  state.cannonAngle = ((state.cannonAngle % TAU) + TAU) % TAU;
  state.cannonAimed = Math.abs(aimDelta) < CANNON_AIM_SNAP;

  if (state.cannonRecoil > 0) {
    state.cannonRecoil -= CANNON_RECOIL_DECAY * dt;
    if (state.cannonRecoil < 0) state.cannonRecoil = 0;
  }

  // ── Zoom lerp
  const zoomTarget = state.zoomed ? 1 : 0;
  const zoomDiff = zoomTarget - state.zoomLevel;
  state.zoomLevel += zoomDiff * Math.min(1, dt * ZOOM_LERP);
  if (Math.abs(zoomDiff) < 0.001) state.zoomLevel = zoomTarget;

  // ── Cannon trail
  state.cannonTrail.push(state.cannonAngle);
  if (state.cannonTrail.length > 24) state.cannonTrail.shift();

  // ── Global timers
  state.pulse += dt;
  state.shake *= Math.pow(0.001, dt);
  state.flash *= Math.pow(0.001, dt);
  state.shakeX = (state.rng.next() - 0.5) * state.shake;
  state.shakeY = (state.rng.next() - 0.5) * state.shake;
  if (state.glitch > 0) state.glitch -= dt;
  if (state.comboPulse > 0) state.comboPulse -= dt;
  if (state.scorePopTimer > 0) state.scorePopTimer -= dt;
  if (state.cannonFlash > 0) state.cannonFlash -= dt * 4;
  if (state.fireCooldown > 0) state.fireCooldown -= dt;
  if (state.perfectFlash > 0) state.perfectFlash -= dt * 3;
  if (state.riserCooldown > 0) state.riserCooldown -= dt;
  if (state.heartsPopTimer > 0) state.heartsPopTimer -= dt;
  if (state.lowLifeWarning > 0) state.lowLifeWarning -= dt;
  if (state.failedSectorFlash > 0) state.failedSectorFlash -= dt;
  if (state.deathDiagTimer > 0) state.deathDiagTimer -= dt;

  // ── Banners
  for (let i = state.bannerQueue.length - 1; i >= 0; i--) {
    state.bannerQueue[i].life -= dt;
    if (state.bannerQueue[i].life <= 0) {
      state.bannerQueue.splice(i, 1);
      layoutBanners(state);
    }
  }

  // ── Shockwaves
  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const sw = state.shockwaves[i];
    sw.r += (sw.maxR - sw.r) * Math.min(1, dt * 8);
    sw.life -= dt;
    if (sw.life <= 0) state.shockwaves.splice(i, 1);
  }

  // ── Escalation
  const tier = currentComboTier(state);
  state.escalationTier = tier;
  const escTarget = tier >= 0 ? (1 - tier / 3) * 0.9 + 0.1 : 0;
  state.escalation += (escTarget - state.escalation) * Math.min(1, dt * 2.5);
  if (tier === 0 && state.mode === "playing") {
    state.glitch = Math.max(state.glitch, 0.08 + 0.05 * Math.sin(state.pulse * 14));
  }
  state.adrenalineMix += ((state.adrenaline ? 1 : 0) - state.adrenalineMix) * Math.min(1, dt * 3);

  // ── Debt decay
  if (state.mode === "playing") {
    for (let i = 0; i < 4; i++) {
      if (state.debt[i] > 0 && state.nowMs > state.debtDominantUntil[i]) {
        state.debt[i] = Math.max(0, state.debt[i] - DEBT_DECAY_PER_SEC * dt);
      }
    }
    for (let i = 0; i < 4; i++) {
      if (state.debt[i] >= DEBT_MAX) {
        const colorName = state.paletteRef[i].name;
        const already = state.purgeQueue.some(q => q.colorName === colorName);
        if (!already) {
          state.purgeQueue.push({ colorName, at: state.nowMs + 400 });
        }
      }
    }
  }
  if (state.purgeQueue.length > 0 && state.mode === "playing") {
    state.glitch = Math.max(state.glitch, 0.15);
  }

  // ── Sector flash decay
  for (let i = 0; i < currentSectors(state); i++) {
    if (state.sectorFlash[i] > 0) state.sectorFlash[i] -= dt * 2.5;
    if (state.sectorFlash[i] < 0) state.sectorFlash[i] = 0;
  }

  // ── Time scaling
  if (state.microSlow > 0) state.microSlow -= dt;
  if (state.slowTimer > 0) {
    state.slowTimer -= dt;
    state.timeScale += (0.4 - state.timeScale) * Math.min(1, dt * 8);
  } else if (state.microSlow > 0) {
    state.timeScale += (0.6 - state.timeScale) * Math.min(1, dt * 14);
  } else {
    state.timeScale += (1 - state.timeScale) * Math.min(1, dt * 4);
  }

  // ── Reload
  if (state.ammo < currentMaxAmmo(state) && state.runMods) {
    if (state.reloadTimer > 0) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        state.ammo++;
        state.reloadTimer = state.ammo < currentMaxAmmo(state)
          ? CANNON_RELOAD / state.runMods.reloadSpeed
          : 0;
      }
    } else {
      state.reloadTimer = CANNON_RELOAD / state.runMods.reloadSpeed;
    }
  }

  // ── Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.05, dt);
    p.vy *= Math.pow(0.05, dt);
    if (p.angular) p.rot += p.spin * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // ── Floaters
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const f = state.floaters[i];
    f.y -= 40 * dt;
    f.life -= dt * 1.1;
    if (f.life <= 0) state.floaters.splice(i, 1);
  }

  // ── Near-miss pulses
  for (let i = state.nearMisses.length - 1; i >= 0; i--) {
    state.nearMisses[i].life -= dt * 2;
    if (state.nearMisses[i].life <= 0) state.nearMisses.splice(i, 1);
  }

  if (state.mode !== "playing") return events;

  // ── Coaching tip timeout
  if (state.coachingTip) {
    state.coachingTip.ttl = (state.coachingTip.ttl || 8) - dt;
    if (state.coachingTip.ttl <= 0) {
      state.coachingTip = null;
      state._pendingCoachSpawn = false;
    }
  }

  // ── Tutorial gate
  if (state.tutorial) {
    events.push(...tickTutorial(state, dt));
    if (state.tutorial &&
        state.tutorial.step !== 1 && state.tutorial.step !== 2) return events;
  }

  // ── Countdown gate
  if (state.countdown > 0) {
    state.countdown -= dt;
    const n = Math.ceil(state.countdown);
    state.countdownText = n > 0 ? String(n) : "GO";
    if (state.countdown <= 0.6 && state.shards.length === 0) {
      events.push(...spawnShard(state));
    }
    return events;
  }
  if (state.introTimer > 0) state.introTimer -= dt;

  // ── Global time scale for spawns / motion
  const gdt = dt * state.timeScale * (1 - state.adrenalineMix * (1 - ADRENALINE_SCALE));

  // ── Shard spawning
  if (!state.tutorial) {
    state.spawnTimer -= gdt * 1000;
    if (state.spawnTimer <= 0) {
      events.push(...spawnShard(state));
      const spawnMult = state.metaRef && state.metaRef.owned && state.metaRef.owned["mod_frenzy"] ? 0.75 : 1;
      const nominal = levelCfg(state.level).spawnMs * spawnMult;
      const actual = nominal * state.rng.rand(0.85, 1.15);
      state.spawnDebt = (state.spawnDebt || 0) + (actual - nominal);
      state.spawnDebt *= 0.5;
      state.spawnTimer = Math.max(180, nominal + state.spawnDebt);
    }
  }

  // ── Powerup spawning
  if (!state.tutorial) {
    state.powerTimer -= dt * 1000;
    if (state.powerTimer <= 0) {
      spawnPowerup(state);
      const powerMult = state.runMods._prismfind ? 0.6 : 1;
      state.powerTimer = state.rng.rand(7000, 14000) * powerMult;
    }
  }

  // ── Riser sound trigger (approaching shard of wrong color)
  if (state.riserCooldown <= 0 && state.mode === "playing") {
    for (let i = 0; i < state.shards.length; i++) {
      const rsh = state.shards[i];
      if (!rsh.alive) continue;
      const rr = state.layout.shieldRadius();
      if (rsh.dist < rr + RISER_TRIGGER_DIST && rsh.dist > rr) {
        const rcol = colorAt(state, rsh.angle);
        const shardCol = activeShardColor(rsh);
        if (!rcol || rcol.name !== shardCol.name) {
          events.push({ type: "sfx", name: "riser" });
          state.riserCooldown = RISER_COOLDOWN;
          break;
        }
      }
    }
  }

  // ── Bubbles movement
  for (let i = state.bubbles.length - 1; i >= 0; i--) {
    const b = state.bubbles[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 10) b.trail.shift();
    b.wob += dt * 6;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.radius = BUBBLE_RADIUS * (1 + Math.sin(b.wob) * 0.06) *
              (1 - Math.max(0, 1 - b.life / 0.5) * 0.4);

    if (b.bounces > 0) {
      const W = state.layout.W, H = state.layout.H;
      if (b.x - b.radius < 0 || b.x + b.radius > W) {
        b.vx = -b.vx; b.bounces--;
        b.x = Math.max(b.radius, Math.min(W - b.radius, b.x));
      }
      if (b.y - b.radius < 0 || b.y + b.radius > H) {
        b.vy = -b.vy; b.bounces--;
        b.y = Math.max(b.radius, Math.min(H - b.radius, b.y));
      }
    }

    if (b.life <= 0 || b.x < -60 || b.x > state.layout.W + 60 ||
        b.y < -60 || b.y > state.layout.H + 60) {
      shatter(state, b.x, b.y, sectorColor(state, b.colorIdx).hex, 6);
      state.bubbles.splice(i, 1);
    }
  }

  const cx = state.layout.W / 2;
  const cy = state.layout.H / 2;
  const R = state.layout.shieldRadius();

  // ── Boss timer advance
  for (let i = 0; i < state.shards.length; i++) {
    const sh = state.shards[i];
    if (sh.boss && sh.alive) sh.bossTimer += gdt;
  }

  // ── Gravity upgrade
  if (state.runMods && state.runMods.gravity) {
    for (let i = 0; i < state.shards.length; i++) {
      const gs = state.shards[i];
      if (!gs.alive) continue;
      gs.dist -= (0.15 * (R / Math.max(1, gs.dist))) * 60 * dt;
    }
  }

  // ── Auto-slow upgrade
  if (state.runMods && state.runMods.autoSlowNear && state.slowTimer <= 0 && state.microSlow <= 0) {
    for (let i = 0; i < state.shards.length; i++) {
      const ash = state.shards[i];
      if (ash.alive && ash.dist < R + 80 && ash.dist > R) {
        state.microSlow = 0.25;
        break;
      }
    }
  }

  // ── Bubble ↔ shard collisions
  events.push(...resolveBubbleCollisions(state));

  // ── Shard → shield (block / hit)
  events.push(...resolveShardShield(state, gdt));

  // ── Powerup pickup
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pw = state.powerups[i];
    if (!pw.alive) { state.powerups.splice(i, 1); continue; }
    pw.dist -= pw.speed * gdt;
    pw.wob += gdt * 4;
    if (pw.dist <= R) {
      pw.alive = false;
      events.push(...applyPowerup(state, pw.type, cx, cy, R));
    }
    if (pw.dist < -50) pw.alive = false;
  }

  // ── Level advance
  if (!state.tutorial) {
    events.push(...advanceLevelIfNeeded(state));
  }

  // ── Game over check
  if (state.lives <= 0 && state.mode === "playing") {
    events.push(...endRun(state));
  }

  return events;
}

// ─────────────────────────────────────────────────────────────
// SUB-ROUTINES
// ─────────────────────────────────────────────────────────────

function tickTutorial(state, dt) {
  const events = [];
  const step = state.tutorial.step;
  state.spawnTimer = 600;

  if (step === 0) {
    state.countdown = 0;
    state.countdownText = "";
    return events;
  }
  if (step === 1) {
    state.countdown = 0;
    state.countdownText = "";
    if (!state.shards.some(shard => shard.alive)) {
      const pal0 = state.paletteRef;
      state.shards.push({
        angle: Math.PI * 1.5,
        color: pal0[0],
        dist: state.layout.spawnDist(),
        speed: levelCfg(0).speed * 0.55,
        alive: true, trail: [], wobble: 0, passedRing: false, spawnFade: 0
      });
      state._tutorialShardSpawned = true;
    }
  }
  if (step === 3) {
    if (state.countdown > 0) {
      state.countdown -= dt;
      const cn = Math.ceil(state.countdown);
      state.countdownText = cn > 0 ? String(cn) : "GO";
    } else {
      state.tutorial = null;
      state.spawnTimer = 200;
      state.introTimer = 1.2;
      state._tutorialShardSpawned = false;
      state.countdownText = "";
    }
    return events;
  }
  return events;
}

function resolveBubbleCollisions(state) {
  const events = [];
  const cx = state.layout.W / 2;
  const cy = state.layout.H / 2;
  const R = state.layout.shieldRadius();

  for (let bi = state.bubbles.length - 1; bi >= 0; bi--) {
    const bb = state.bubbles[bi];
    if (bb.captured) continue;
    const bbColor = sectorColor(state, bb.colorIdx);
    let consumed = false;

    for (let si = 0; si < state.shards.length; si++) {
      const tgt = state.shards[si];
      if (!tgt.alive) continue;
      const pos = shardWorldPos(cx, cy, tgt);
      const shardR = (tgt.boss ? 20 : 12) * (tgt.spawnFade || 1);
      const dx = pos.x - bb.x, dy = pos.y - bb.y;
      if (dx * dx + dy * dy >= (bb.radius + shardR) * (bb.radius + shardR)) continue;

      const activeColor = activeShardColor(tgt);
      if (bbColor.name !== activeColor.name) {
        shatter(state, bb.x, bb.y, bbColor.hex, 6);
        state.floaters.push({
          x: pos.x, y: pos.y - 16, text: "WRONG COLOR",
          color: "#ff9bab", life: 0.8
        });
        events.push({ type: "sfx", name: "bubbleWrong" });
        state.bubbles.splice(bi, 1);
        consumed = true;
        break;
      }

      // Correct capture
      bb.captured = true;
      bb.captureShard = tgt;
      tgt.alive = false;
      shatter(state, pos.x, pos.y, activeColor.hex, 18);
      shatter(state, bb.x, bb.y, bbColor.hex, 12);
      state.shockwaves.push({
        x: pos.x, y: pos.y, r: 8, maxR: 60,
        life: 0.5, maxLife: 0.5, color: bbColor.hex
      });

      state.blocked++; state.combo++; state.streak++;
      if (state.combo > state.bestComboThisRun) state.bestComboThisRun = state.combo;
      state.lastBlockAt = state.nowMs;

      const smart = colorAt(state, tgt.angle) && colorAt(state, tgt.angle).name === tgt.color.name;
      let gained;
      if (tgt.purge) {
        gained = addScore(state, PURGE_SCORE);
        drainDebt(state, tgt.color.name, PURGE_DEBT_DRAIN);
        state.floaters.push({ x: pos.x, y: pos.y - 34, text: "PURGE!", color: "#ffdd5a", life: 1.6 });
      } else {
        gained = addScore(state, smart ? 200 : 120);
        drainDebt(state, tgt.color.name, DEBT_ON_KILL);
      }
      state.scorePopTimer = 0.15;
      events.push({ type: "sfx", name: "bubblePop", angle: tgt.angle });
      events.push({ type: "sfx", name: "block", combo: state.combo, angle: tgt.angle });
      events.push({ type: "vibrate", pattern: 12 });
      state.floaters.push({
        x: pos.x, y: pos.y - 20,
        text: (smart ? "SMART +" : "+") + gained,
        color: smart ? "#5affa0" : "#9affc4", life: 1.1
      });

      events.push(...checkMilestone(state));

      if (state.runMods && state.runMods.chainRadius > 0) {
        events.push(...chainExplode(state, pos.x, pos.y, tgt.color.hex));
      }
      if (state.runMods && state.runMods.autoFireEvery > 0 &&
          state.blocked % state.runMods.autoFireEvery === 0) {
        events.push(...fireCannon(state, null, true));
      }
      if (state.runMods && state.runMods.stormOnBlock) {
        events.push(...fireCannon(state,
          [state.rng.next() * TAU, state.rng.next() * TAU], true));
      }
      if (state.runMods && state.runMods.prismChance > 0 &&
          state.rng.next() < state.runMods.prismChance) {
        state.powerups.push({
          angle: tgt.angle,
          type: pickPowerupFromState(state),
          dist: tgt.dist, speed: 40, alive: true,
          wob: state.rng.next() * TAU
        });
      }

      state.bubbles.splice(bi, 1);
      consumed = true;

      events.push(...maybeGrantUpgrade(state));
      break;
    }
    if (consumed) continue;
  }
  return events;
}

function resolveShardShield(state, gdt) {
  const events = [];
  const cx = state.layout.W / 2;
  const cy = state.layout.H / 2;
  const R = state.layout.shieldRadius();

  for (let i = state.shards.length - 1; i >= 0; i--) {
    const sh = state.shards[i];
    if (!sh.alive) { state.shards.splice(i, 1); continue; }

    if (sh.spawnFade < 1) sh.spawnFade = Math.min(1, sh.spawnFade + gdt * 4);

    sh.trail.push({ angle: sh.angle, dist: sh.dist });
    const maxTrail = Math.min(16, 7 + Math.floor(state.combo / 4));
    if (sh.trail.length > maxTrail) sh.trail.shift();

    sh.wobble += gdt * 3;
    sh.dist -= sh.speed * gdt;

    const activeColor = activeShardColor(sh);

    if (!sh.passedRing && sh.dist < R + 40) {
      const nearCol = colorAt(state, sh.angle);
      if (nearCol && nearCol.name !== activeColor.name) {
        state.nearMisses.push({ angle: sh.angle, dist: R + 40, life: 1 });
        state.nearMissCount++;
        events.push({ type: "sfx", name: "near", angle: sh.angle });
      } else if (nearCol && nearCol.name === activeColor.name) {
        const sidx = sectorIndexAt(state, sh.angle);
        const arc = sectorArc(state);
        const s0 = state.shieldAngle + sidx * arc;
        const rel = ((sh.angle - s0) % TAU + TAU) % TAU;
        const edgeDist = Math.min(rel, arc - rel) * R;
        if (edgeDist < NEAR_MISS_DIST) {
          state.microSlow = state.runMods ? state.runMods.slowOnNearMiss : 0.35;
        }
      }
      sh.passedRing = true;
    }

    if (sh.dist <= R) {
      const sidx2 = sectorIndexAt(state, sh.angle);

      if (state.runMods && state.runMods.sectorImmunity > 0 &&
          state.nowMs < state.sectorImmuneUntil[sidx2]) {
        sh.alive = false;
        shatter(state, cx, cy, activeColor.hex, 10);
        state.floaters.push({ x: cx, y: cy - R - 20, text: "IMMUNE", color: "#6ee7ff", life: 1 });
        continue;
      }

      const col = colorAt(state, sh.angle);
      if (col && col.name === activeColor.name) {
        // ── Correct: block
        const arc = sectorArc(state);
        const s0b = state.shieldAngle + sidx2 * arc;
        const relb = ((sh.angle - s0b) % TAU + TAU) % TAU;
        const edgeDist2 = Math.min(relb, arc - relb) * R;
        const isPerfect = (edgeDist2 < PERFECT_WINDOW) && (R - sh.dist < PERFECT_WINDOW * 1.4);

        sh.alive = false;
        state.blocked++; state.combo++; state.streak++;
        if (state.combo > state.bestComboThisRun) state.bestComboThisRun = state.combo;
        state.lastBlockAt = state.nowMs;

        if (isPerfect) {
          state.perfectBlocks++;
          state.perfectFlash = 1;
          state.shake = Math.max(state.shake, 10);
          state.glitch = Math.max(state.glitch, 0.22);
          state.hitstop = 0.10;
          const perfGain = addScore(state, PERFECT_BONUS);
          events.push({ type: "sfx", name: "whoosh" });
          events.push({ type: "sfx", name: "perfect" });
          events.push({ type: "vibrate", pattern: [8, 12, 8] });
          const bx = cx + Math.cos(sh.angle) * R;
          const by = cy + Math.sin(sh.angle) * R;
          state.floaters.push({
            x: bx, y: by - 40,
            text: "PERFECT +" + perfGain, color: "#ffffff", life: 1.4
          });
          state.shockwaves.push({
            x: bx, y: by, r: 10, maxR: 140,
            life: 0.6, maxLife: 0.6, color: "#ffffff"
          });
          for (let k = 0; k < 18; k++) {
            const a = state.rng.next() * TAU;
            const sp = state.rng.rand(200, 500);
            state.particles.push({
              x: bx, y: by,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: state.rng.rand(0.3, 0.7), maxLife: 0.7,
              color: "#ffffff", size: state.rng.rand(2, 4),
              additive: true
            });
          }
        }

        if (state.tutorial && state.tutorial.step === 1) {
          state.tutorial.step = 2;
          state._tutorialShardSpawned = false;
          state.floaters.push({
            x: cx, y: cy - 120, text: "NOW FIRE THE CANNON!",
            color: "#6ee7ff", life: 1.8
          });
          events.push({ type: "vibrate", pattern: [35, 40, 35] });
        }

        const mult = state.combo * (state.streak >= STREAK_THRESHOLD ? 1.5 : 1);
        let gained2;
        if (sh.purge) {
          gained2 = addScore(state, PURGE_SCORE);
          drainDebt(state, sh.color.name, PURGE_DEBT_DRAIN);
          state.floaters.push({ x: cx, y: cy - R - 20, text: "PURGE CLEARED", color: "#ffdd5a", life: 1.6 });
        } else {
          gained2 = addScore(state, Math.round(100 * Math.max(1, mult)));
          drainDebt(state, activeColor.name, DEBT_ON_KILL * 0.6);
        }
        if (!isPerfect) {
          state.scorePopTimer = 0.15;
          events.push({ type: "sfx", name: "block", combo: state.combo, angle: sh.angle });
          events.push({ type: "vibrate", pattern: 10 });
        }
        const bx = cx + Math.cos(sh.angle) * R;
        const by = cy + Math.sin(sh.angle) * R;
        state.floaters.push({
          x: bx, y: by - 20, text: "+" + gained2,
          color: activeColor.hex, life: 1
        });

        events.push(...checkMilestone(state));

        state.sectorFlash[sidx2] = 1;
        if (state.runMods && state.runMods.sectorImmunity > 0) {
          state.sectorImmuneUntil[sidx2] = state.nowMs + state.runMods.sectorImmunity * 1000;
        }

        for (let ci = 0; ci < COMBO_LABELS.length; ci++) {
          if (state.combo === COMBO_LABELS[ci].at) {
            state.comboPulse = 0.7;
            state.comboLabel = COMBO_LABELS[ci];
            if (state.combo >= 8) state.shake = Math.max(state.shake, 6);
            break;
          }
        }

        shatter(state, bx, by, activeColor.hex, sh.purge ? 24 : 16);

        if (state.runMods && state.runMods.echo) {
          const echoGain = addScore(state, 100);
          state.floaters.push({ x: bx, y: by - 44, text: "ECHO +" + echoGain, color: "#ffdd5a", life: 1 });
        }

        if (state.runMods && state.runMods.chainRadius > 0) {
          events.push(...chainExplode(state, bx, by, activeColor.hex));
        }
        if (state.runMods && state.runMods.autoFireEvery > 0 &&
            state.blocked % state.runMods.autoFireEvery === 0) {
          events.push(...fireCannon(state, null, true));
        }
        if (state.runMods && state.runMods.stormOnBlock) {
          events.push(...fireCannon(state,
            [state.rng.next() * TAU, state.rng.next() * TAU], true));
        }
        if (state.runMods && state.runMods.prismChance > 0 &&
            state.rng.next() < state.runMods.prismChance) {
          state.powerups.push({
            angle: sh.angle, type: pickPowerupFromState(state),
            dist: R + 40, speed: 40, alive: true,
            wob: state.rng.next() * TAU
          });
        }

        events.push(...maybeGrantUpgrade(state));
      } else {
        // ── Wrong: damage
        sh.alive = false;
        shatter(state, cx, cy, activeColor.hex, 24);
        events.push(...damage(state, sh.angle));
        if (state.mode !== "playing") return events;
      }
    }
    if (sh.dist < -50) sh.alive = false;
  }
  return events;
}

function checkMilestone(state) {
  const events = [];
  const r = bumpMilestoneIfDue(state);
  if (r.bumped) {
    state.glitch = 0.35;
    state.scorePopTimer = 0.35;
    events.push({ type: "sfx", name: "milestone" });
    const cx = state.layout.W / 2;
    const cy = state.layout.H / 2;
    const R = state.layout.shieldRadius();
    if (r.livesGranted > 0) {
      state.floaters.push({
        x: cx, y: cy - R - 30, text: "MILESTONE · +1 LIFE",
        color: "#ffdd5a", life: 1.6
      });
    } else {
      state.floaters.push({
        x: cx, y: cy - R - 30, text: "MILESTONE!",
        color: "#ffdd5a", life: 1.6
      });
    }
  }
  return events;
}

function maybeGrantUpgrade(state) {
  const events = [];
  if (state.mode !== "playing") return events;
  if (state.tutorial) return events;
  if (state.blocked >= state.nextUpgradeAt || state.score >= state.nextUpgradeScore) {
    const [upgrade] = rollUpgradeRewards(state, 1);
    state.nextUpgradeAt = state.blocked + UPGRADE_EVERY;
    state.nextUpgradeScore = state.score + MILESTONE_UPGRADE_STEP;
    if (upgrade) {
      applyUpgrade(state, upgrade);
      events.push({ type: "sfx", name: "pick" });
      if (!state._upgradeHintShown) {
        state._upgradeHintShown = true;
        state.floaters.push({
          x: state.layout.W / 2,
          y: state.layout.H / 2 - 120,
          text: "UPGRADE AUTO-APPLIED",
          color: "#5affa0",
          life: 2
        });
      }
    } else {
      events.push({ type: "sfx", name: "deny" });
    }
  }
  return events;
}

function advanceLevelIfNeeded(state) {
  const events = [];
  const threshold = blocksForLevel(state.level);
  if (state.blocked < threshold) return events;
  if (state.level >= 9) return events;

  const nextLevel = state.level + 1;
  const cx = state.layout.W / 2;
  const cy = state.layout.H / 2;
  for (let i = 0; i < 40; i++) {
    const color = state.paletteRef[Math.floor(state.rng.next() * state.paletteRef.length)];
    const a = state.rng.next() * TAU;
    const sp = state.rng.rand(200, 500);
    state.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: state.rng.rand(0.7, 1.3), maxLife: 1.3,
      color: color.hex, size: state.rng.rand(3, 6), additive: true
    });
  }
  events.push({ type: "sfx", name: "milestone" });
  events.push({ type: "banner", text: "LEVEL " + (nextLevel + 1), sub: "Difficulty up" });

  state.level = nextLevel;
  const extraColors = state.runMods ? state.runMods.extraColors : 0;
  state.cachedColors = levelCfg(nextLevel).colors + extraColors;
  if (state.cachedColors > state.paletteRef.length) state.cachedColors = state.paletteRef.length;
  if (state.cachedColors < 2) state.cachedColors = 2;
  state.shardSpeedTarget = levelCfg(nextLevel).speed;
  state.shardSpeedBase = levelCfg(nextLevel).speed;
  state.spawnDebt = 0;
  state.bossPending = (nextLevel % 3 === 0);
  return events;
}

function pickPowerupFromState(state) {
  const types = [
    { id: "slow",  hex: "#6ee7ff", glyph: "❄", label: "TIME WARP" },
    { id: "life",  hex: "#ff8ad0", glyph: "♥", label: "+1 LIFE" },
    { id: "burst", hex: "#ffffff", glyph: "★", label: "PRISM BURST" },
    { id: "ammo",  hex: "#9affc4", glyph: "▲", label: "AMMO +2" },
    { id: "zoom",  hex: "#ffd166", glyph: "🔭", label: "ZOOM OUT" }
  ];
  return types[Math.floor(state.rng.next() * types.length)];
}

function layoutBanners(state) {
  const H = state.layout.H;
  for (let i = 0; i < state.bannerQueue.length; i++) {
    state.bannerQueue[i].targetY = H * 0.22 + i * 74;
  }
}

// ─────────────────────────────────────────────────────────────
// END RUN
// ─────────────────────────────────────────────────────────────

/**
 * Compute and return the run's final shard award, mark mode=gameover.
 * The caller (adapter) persists meta and shows the summary.
 */
export function endRun(state) {
  const events = [];
  state.mode = "gameover";

  // Death particles
  const cx = state.layout.W / 2;
  const cy = state.layout.H / 2;
  for (let i = 0; i < 30; i++) {
    const a = state.rng.next() * TAU;
    const sp = state.rng.rand(120, 400);
    const color = state.paletteRef[Math.floor(state.rng.next() * state.paletteRef.length)];
    state.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: state.rng.rand(0.8, 1.6), maxLife: 1.6,
      color: color.hex, size: state.rng.rand(4, 9),
      angular: true, rot: state.rng.next() * TAU,
      spin: state.rng.rand(-6, 6), additive: true
    });
  }
  state.shake = 30;
  state.glitch = 0.6;

  const bestScore = state.metaRef.bestScore;
  const earned = calculateRunShards(state, bestScore);

  events.push({ type: "sfx", name: "death" });
  events.push({ type: "vibrate", pattern: [60, 40, 90] });
  events.push({ type: "gameOver", earned, wasBest: state.score > bestScore });

  return events;
}

// ─────────────────────────────────────────────────────────────
// UPGRADE APPLICATION
// ─────────────────────────────────────────────────────────────

function applyUpgrade(state, upgrade) {
  state.runUpgrades.push(upgrade.id);
  upgrade.apply(state.runMods);
  if (state.runMods._vitalNow > 0) {
    const maxLives = MAX_LIVES + state.runMods.startingLives;
    state.lives = Math.min(maxLives, state.lives + state.runMods._vitalNow);
    state.runMods._vitalNow = 0;
  }
  if (state.runMods._glass) {
    state.lives = Math.max(1, state.lives - 1);
    state.runMods._glass = false;
  }
  state.ammo = Math.min(state.ammo, currentMaxAmmo(state));
  if (state.ammo === 0) state.ammo = 1;
}