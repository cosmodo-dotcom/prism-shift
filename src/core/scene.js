// =============================================================
//  Prism Shift — core/scene.js
//  Display-list builder. Reads state, returns a plain object
//  describing everything to render. Never draws. Never randomizes.
// =============================================================

import {
  TAU, COMBO_TIERS, COLOR_SHAPES, ORB_SKINS,
  POWERUP_TYPES, MAX_LIVES, MILESTONE_STEP
} from "./tuning.js";
import {
  currentSectors, sectorColor, cannonColor, cannonSectorIndex,
  currentComboTier, maxLivesForDisplay, activeOrb,
  currentMaxAmmo
} from "./rules.js";

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

/**
 * Build the scene for the current frame.
 * @param {object} state
 * @returns {Scene}
 */
export function buildScene(state) {
  const W = state.layout ? state.layout.W : 0;
  const H = state.layout ? state.layout.H : 0;
  const cx = W / 2, cy = H / 2;
  const R = state.layout ? state.layout.shieldRadius() : 0;
  const t = state.pulse;

  return {
    // ── canvas space
    W, H, cx, cy, t,

    // ── background & shake
    shake: { x: state.shakeX, y: state.shakeY },
    escalation: state.escalation,
    escalationTier: state.escalationTier,
    adrenalineMix: state.adrenalineMix,

    // ── primary elements
    shield: buildShield(state, cx, cy, R),
    orb: buildOrb(state, cx, cy, R, t),
    cannon: buildCannon(state, cx, cy, R, t),
    shards: state.shards.filter(s => s.alive).map(s => buildShard(state, s, cx, cy)),
    powerups: state.powerups.filter(p => p.alive).map(p => buildPowerup(state, p, cx, cy)),
    bubbles: state.bubbles.filter(b => !b.captured).map(b => buildBubble(state, b)),

    // ── effects
    particles: state.particles.map(p => ({
      x: p.x, y: p.y,
      size: p.size,
      life: p.life,
      maxLife: p.maxLife,
      color: p.color,
      angular: p.angular,
      rot: p.rot || 0,
      additive: p.additive
    })),
    floaters: state.floaters.map(f => ({
      x: f.x, y: f.y, text: f.text, color: f.color, life: f.life
    })),
    shockwaves: state.shockwaves.map(s => ({
      x: s.x, y: s.y, r: s.r, color: s.color,
      life: s.life, maxLife: s.maxLife
    })),
    nearMisses: state.nearMisses.map(m => ({
      angle: m.angle, dist: m.dist, life: m.life, cx, cy
    })),

    // ── overlays
    countdown: state.countdown > 0 && state.countdownText ? {
      text: state.countdownText,
      alpha: Math.min(1, state.countdown),
      cx, cy: cy - R - 40
    } : null,

    intro: state.introTimer > 0 && state.mode === "playing"
           && state.countdown <= 0 && !state.tutorial ? {
      text: "LEVEL " + (state.level + 1),
      alpha: Math.min(1, state.introTimer),
      cx, cy: cy - R - 50
    } : null,

    comboLabel: state.comboPulse > 0 && state.comboLabel ? {
      label: state.comboLabel.label,
      color: state.comboLabel.color,
      alpha: Math.min(1, state.comboPulse / 0.3),
      size: 32 + (1 - state.comboPulse / 0.7) * 24,
      cx, cy: cy - R - 80,
      pulse: state.comboPulse
    } : null,

    banners: state.bannerQueue.map(b => ({
      text: b.text, sub: b.sub, color: b.color,
      life: b.life, maxLife: b.maxLife,
      y: b.targetY, cx, W
    })),

    tutorial: state.tutorial ? {
      step: state.tutorial.step,
      cx, cy: cy + R + 50
    } : null,

    coachingTip: state.coachingTip && state.mode === "playing" ? {
      shieldColorName: state.coachingTip.shieldColorName,
      shardColorName: state.coachingTip.shardColorName,
      ttl: state.coachingTip.ttl || 8,
      cx, cy: cy + R + 46
    } : null,

    deathDiagnosis: state.deathDiagnosis && state.deathDiagTimer > 0 ? {
      shardColor: state.deathDiagnosis.shardColor,
      shieldColor: state.deathDiagnosis.shieldColor,
      alpha: Math.min(1, state.deathDiagTimer),
      cx, cy: cy + R + 30
    } : null,

    // ── screens
    flash: state.flash,
    perfectFlash: state.perfectFlash,
    glitch: state.glitch,
    lowLifeWarning: state.lowLifeWarning,

    // ── HUD mirrors (for the DOM side; renderer can ignore these)
    hud: buildHUDState(state),
  };
}

// ─────────────────────────────────────────────────────────────
// SHIELD
// ─────────────────────────────────────────────────────────────

function buildShield(state, cx, cy, R) {
  const n = currentSectors(state);
  const arc = TAU / n;
  const redTint = state.lives === 1 && state.mode === "playing"
    ? 0.25 + 0.15 * Math.sin(state.pulse * 8)
    : 0;

  const sectors = [];
  for (let i = 0; i < n; i++) {
    const color = sectorColor(state, i);
    const flash = state.sectorFlash[i] || 0;
    const immune = state.runMods && state.runMods.sectorImmunity > 0
      && state.nowMs < state.sectorImmuneUntil[i];
    sectors.push({
      index: i,
      color,
      startAngle: state.shieldAngle + i * arc,
      endAngle: state.shieldAngle + (i + 1) * arc,
      arc,
      flash,
      immune
    });
  }

  let failed = null;
  if (state.failedSectorFlash > 0 && state.failedSector >= 0 && state.failedSector < n) {
    const fs = state.failedSector;
    failed = {
      startAngle: state.shieldAngle + fs * arc,
      endAngle: state.shieldAngle + (fs + 1) * arc,
      alpha: Math.min(1, state.failedSectorFlash * 1.4)
    };
  }

  return {
    cx, cy, R,
    escalation: state.escalation,
    redTint,
    sectors,
    failed
  };
}

// ─────────────────────────────────────────────────────────────
// ORB
// ─────────────────────────────────────────────────────────────

function buildOrb(state, cx, cy, R, t) {
  const skinKey = activeOrb(state);
  const skin = ORB_SKINS[skinKey] || ORB_SKINS.prism;

  const pulseRate = 3 + state.escalation * 2 + state.adrenalineMix * 3;
  const beatBoost = state.combo >= 5 ? 0.05 : 0;
  const nearMissBoost = state.nearMisses.length > 0 ? 0.12 : 0;
  const pulse = 1 + (0.035 + beatBoost + nearMissBoost) * Math.sin(t * pulseRate);
  const radius = R * 0.45 * pulse;

  return {
    cx, cy, R, radius, skin, pulse,
    escalation: state.escalation,
    adrenalineMix: state.adrenalineMix
  };
}

// ─────────────────────────────────────────────────────────────
// CANNON
// ─────────────────────────────────────────────────────────────

function buildCannon(state, cx, cy, R, t) {
  const bc = cannonColor(state);
  return {
    cx, cy, R,
    angle: state.cannonAngle,
    targetAngle: state.targetAngle,
    color: bc,
    sector: cannonSectorIndex(state),
    recoil: state.cannonRecoil,
    flash: state.cannonFlash,
    aimed: state.cannonAimed,
    t,
    colorblind: state.metaRef ? state.metaRef.colorblind : false,
    colorShape: bc ? COLOR_SHAPES[bc.name] : ""
  };
}

// ─────────────────────────────────────────────────────────────
// SHARD
// ─────────────────────────────────────────────────────────────

function buildShard(state, sh, cx, cy) {
  const wob = Math.sin(sh.wobble) * 2;
  const x = cx + Math.cos(sh.angle) * (sh.dist + wob);
  const y = cy + Math.sin(sh.angle) * (sh.dist + wob);

  // Active color for boss (alternates)
  let activeColor = sh.color;
  if (sh.boss && sh.colorB) {
    const phase = (sh.bossTimer % sh.bossCycle) / sh.bossCycle;
    activeColor = phase < 0.5 ? sh.color : sh.colorB;
  }

  const baseSizeMul = sh.boss ? 1.7 : (sh.purge ? 1.35 : 1);
  const spawnFade = sh.spawnFade !== undefined ? sh.spawnFade : 1;
  const comboBoost = Math.min(1, state.combo / 12);

  return {
    x, y,
    angle: sh.angle,
    dist: sh.dist,
    color: activeColor,
    baseSizeMul,
    spawnFade,
    comboBoost,
    isBoss: !!sh.boss,
    isPurge: !!sh.purge,
    hp: sh.hp,
    maxHp: sh.maxHp,
    hasColorB: !!sh.colorB,
    colorB: sh.colorB || null,
    bossPhase: sh.boss ? (sh.bossTimer % sh.bossCycle) / sh.bossCycle : 0,
    trail: sh.trail.map(tr => ({
      x: cx + Math.cos(tr.angle) * tr.dist,
      y: cy + Math.sin(tr.angle) * tr.dist
    })),
    wobble: sh.wobble,
    colorblind: state.metaRef ? state.metaRef.colorblind : false,
    colorShape: COLOR_SHAPES[activeColor.name] || ""
  };
}

// ─────────────────────────────────────────────────────────────
// POWERUP
// ─────────────────────────────────────────────────────────────

function buildPowerup(state, pw, cx, cy) {
  const x = cx + Math.cos(pw.angle) * pw.dist;
  const y = cy + Math.sin(pw.angle) * pw.dist;
  return {
    x, y,
    type: pw.type,
    wob: pw.wob,
    radius: 10 + Math.sin(pw.wob) * 2
  };
}

// ─────────────────────────────────────────────────────────────
// BUBBLE
// ─────────────────────────────────────────────────────────────

function buildBubble(state, b) {
  return {
    x: b.x, y: b.y,
    radius: b.radius,
    color: sectorColor(state, b.colorIdx),
    life: b.life,
    maxLife: b.maxLife,
    trail: b.trail.map(t => ({ x: t.x, y: t.y }))
  };
}

// ─────────────────────────────────────────────────────────────
// HUD (DOM renderer consumes this; canvas renderer may ignore)
// ─────────────────────────────────────────────────────────────

function buildHUDState(state) {
  const playing = state.mode === "playing";

  // Hearts
  const maxH = maxLivesForDisplay(state);
  let hearts = "";
  for (let i = 0; i < maxH; i++) hearts += i < state.lives ? "♥" : "♡";

  // Ammo pips
  const maxAmmo = currentMaxAmmo(state);
  const ammoPips = [];
  for (let i = 0; i < maxAmmo; i++) ammoPips.push(i < state.ammo);

  // Combo tier
  const tierIdx = currentComboTier(state);
  const tier = tierIdx >= 0 ? COMBO_TIERS[tierIdx] : null;

  // Cannon color for the fire button ring
  const fireColor = playing ? cannonColor(state) : null;

  return {
    level: "LV " + (state.level + 1),
    hearts,
    score: state.score,
    streak: state.streak >= 5 ? state.streak : 0,
    nearMissCount: state.nearMissCount,
    ammo: state.ammo,
    maxAmmo,
    ammoPips,
    fireColor,
    fireDisabled: state.ammo <= 0,
    fireVisible: playing,
    tutorialPulse: !!(state.tutorial && state.tutorial.step === 2 && playing),
    zoomed: state.zoomed && playing,
    comboBadge: tier ? { label: tier.label, color: tier.color } : null,
    debtBarsVisible: playing && state.runMods !== null && state.blocked > 0,
    debtBars: [0,1,2,3].map(i => ({
      pct: state.debt[i] / 100,
      color: state.paletteRef[i] ? state.paletteRef[i].hex : "#ffffff",
      dominant: state.nowMs < state.debtDominantUntil[i]
    }))
  };
}