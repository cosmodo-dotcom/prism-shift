// =============================================================
//  Prism Shift — renderers/canvas2d/draw.js
//  Paints a scene object onto a 2D canvas.
//  READ-ONLY. Never touches state, never uses Math.random().
// =============================================================

import { COMBO_TIERS, COLOR_SHAPES, POWERUP_TYPES } from "../../core/tuning.js";

const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * Paint a full frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene   - from core/scene.js buildScene()
 * @param {number} W       - canvas CSS width
 * @param {number} H       - canvas CSS height
 * @param {object} opts    - { lowQuality: boolean }
 */
export function draw(ctx, scene, W, H, opts) {
  opts = opts || {};
  const lowQuality = !!opts.lowQuality;

  // Background
  drawBackground(ctx, scene, W, H);

  // Shake wrapper
  ctx.save();
  ctx.translate(scene.shake.x, scene.shake.y);

  // Primary elements (draw order matters)
  drawShield(ctx, scene, lowQuality);
  drawOrb(ctx, scene, lowQuality);
  drawCannon(ctx, scene, lowQuality);

  // Near-miss arcs
  drawNearMisses(ctx, scene);

  // Shards
  for (let i = 0; i < scene.shards.length; i++) {
    drawShard(ctx, scene.shards[i], lowQuality);
  }

  // Powerups
  for (let i = 0; i < scene.powerups.length; i++) {
    drawPowerup(ctx, scene.powerups[i]);
  }

  // Bubbles
  for (let i = 0; i < scene.bubbles.length; i++) {
    drawBubble(ctx, scene.bubbles[i], lowQuality);
  }

  // Hint arrow (points to nearest shard if idle)
  drawHintArrow(ctx, scene);

  // Particles
  drawParticles(ctx, scene);

  // Shockwaves
  drawShockwaves(ctx, scene);

  // Floaters
  drawFloaters(ctx, scene, lowQuality);

  // Combo label
  drawComboLabel(ctx, scene, lowQuality);

  // Countdown
  drawCountdown(ctx, scene, lowQuality);

  // Intro (LEVEL N)
  drawIntro(ctx, scene, lowQuality);

  // Banners
  drawBanners(ctx, scene, W, H, lowQuality);

  // Tutorial text
  drawTutorial(ctx, scene, lowQuality);

  // Coaching tip
  drawCoachingTip(ctx, scene, lowQuality);

  // Death diagnosis
  drawDeathDiagnosis(ctx, scene, lowQuality);

  ctx.restore();

  // Screen overlays (outside shake wrapper)
  drawFlash(ctx, scene, W, H);
  drawPerfectFlash(ctx, scene, W, H);
  drawComboWash(ctx, scene, W, H);
  drawGlitch(ctx, scene, W, H, lowQuality);
  drawBloom(ctx, scene, W, H, lowQuality);
  drawVignette(ctx, scene, W, H);
  drawLowLifeWarning(ctx, scene, W, H);
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND
// ─────────────────────────────────────────────────────────────

function drawBackground(ctx, scene, W, H) {
  const { cx, cy, escalation, escalationTier } = scene;

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
  bg.addColorStop(0, "#141428");
  bg.addColorStop(1, "#05050a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawNebula(ctx, scene);

  if (escalation > 0.05) {
    const tierCol = escalationTier >= 0 ? COMBO_TIERS[escalationTier].color : "#5aa0ff";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = escalation * 0.10;
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    wash.addColorStop(0, tierCol);
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawNebula(ctx, scene) {
  // The nebula is not in the scene — it's ambient decoration.
  // The renderer generates a few soft blobs procedurally, seeded by cx/cy
  // so it's deterministic per frame.
  const { cx, cy, W, H, escalation } = scene;
  const count = 5;
  for (let i = 0; i < count; i++) {
    const seed = (i + 1) * 1.7;
    const x = W * ((Math.sin(seed) * 0.5 + 0.5) + Math.sin(scene.t * 0.1 + seed) * 0.05);
    const y = H * ((Math.cos(seed * 1.3) * 0.5 + 0.5) + Math.cos(scene.t * 0.08 + seed) * 0.05);
    const r = Math.max(W, H) * (0.3 + ((seed * 0.13) % 0.3));
    const hue = (seed * 47) % 360 + escalation * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue},70%,55%,${0.05 + escalation * 0.04})`);
    g.addColorStop(1, `hsla(${hue},70%,55%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ─────────────────────────────────────────────────────────────
// SHIELD
// ─────────────────────────────────────────────────────────────

function drawShield(ctx, scene, lowQuality) {
  const s = scene.shield;
  const { cx, cy, R, sectors, redTint, escalation, failed } = s;
  const escGlow = 1 + escalation * 0.6;

  // Outer glow arc per sector
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < sectors.length; i++) {
    const color = sectors[i].color;
    const a0 = sectors[i].startAngle;
    const a1 = sectors[i].endAngle;
    const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.25);
    glow.addColorStop(0, `rgba(${color.rgb.join(",")},0)`);
    glow.addColorStop(0.6, `rgba(${color.rgb.join(",")},${0.25 * escGlow})`);
    glow.addColorStop(1, `rgba(${color.rgb.join(",")},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.25, a0, a1);
    ctx.lineWidth = R * (lowQuality ? 0.4 : 0.5);
    ctx.strokeStyle = glow;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // Main arc per sector
  for (let j = 0; j < sectors.length; j++) {
    const sec = sectors[j];
    const col = sec.color;
    const wobble = Math.sin(scene.t * 10 + j) * 0.02 * (1 + escalation * 2);
    const s0 = sec.startAngle + wobble;
    const s1 = sec.endAngle - wobble * 2;
    const flash = sec.flash;
    const immune = sec.immune;

    ctx.beginPath();
    ctx.arc(cx, cy, R, s0 + 0.02, s1 - 0.02);
    ctx.lineWidth = (lowQuality ? 10 : 14) + flash * (lowQuality ? 3 : 4);
    ctx.strokeStyle = immune ? "#6ee7ff" : col.hex;
    ctx.shadowColor = redTint > 0 ? "#ff5a7a" : (immune ? "#6ee7ff" : col.hex);
    ctx.shadowBlur = lowQuality ? 0 : ((22 + 8 * Math.sin(scene.t * 3) + flash * 40 + (redTint > 0 ? redTint * 30 : 0)) * escGlow);
    ctx.lineCap = "round";
    ctx.stroke();

    if (redTint > 0) {
      ctx.globalAlpha = redTint * 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, R, s0 + 0.02, s1 - 0.02);
      ctx.lineWidth = (lowQuality ? 10 : 14) + flash * (lowQuality ? 3 : 4);
      ctx.strokeStyle = "#ff5a7a";
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // White rim
    ctx.beginPath();
    ctx.arc(cx, cy, R, s0 + 0.03, s1 - 0.03);
    ctx.lineWidth = (lowQuality ? 2 : 3) + flash * (lowQuality ? 4 : 6);
    ctx.strokeStyle = `rgba(255,255,255,${0.85 + flash * 0.15})`;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Outer thin ring
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, s0 + 0.05, s1 - 0.05);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.stroke();

    // Color label (small text inside arc)
    const midAngle = (s0 + s1) / 2;
    const lx = cx + Math.cos(midAngle) * (R - 26);
    const ly = cy + Math.sin(midAngle) * (R - 26);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = col.hex;
    ctx.font = "800 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(col.name, lx, ly);
    ctx.restore();
  }

  // Failed sector flash
  if (failed) {
    ctx.save();
    ctx.globalAlpha = failed.alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, R, failed.startAngle + 0.02, failed.endAngle - 0.02);
    ctx.lineWidth = lowQuality ? 14 : 22;
    ctx.strokeStyle = "#ff2a4a";
    ctx.shadowColor = "#ff2a4a";
    ctx.shadowBlur = lowQuality ? 0 : 30;
    ctx.stroke();
    ctx.restore();
  }

  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────
// ORB
// ─────────────────────────────────────────────────────────────

function drawOrb(ctx, scene, lowQuality) {
  const o = scene.orb;
  const { cx, cy, radius: orbR, skin, escalation, adrenalineMix } = o;
  const t = scene.t;

  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, orbR * 2.2);
  bloom.addColorStop(0, `rgba(${skin.glow.join(",")},${0.35 + escalation * 0.2})`);
  bloom.addColorStop(1, `rgba(${skin.glow.join(",")},0)`);
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, orbR * 2.2, 0, TAU);
  ctx.fill();

  // Adrenaline halo
  if (adrenalineMix > 0.05) {
    const hb = (Math.sin(t * 6) * 0.5 + 0.5) * adrenalineMix;
    ctx.save();
    ctx.globalAlpha = hb * 0.5;
    ctx.strokeStyle = "#ff5a7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR * (1.4 + hb * 0.3), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // Sweep highlight
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.6);
  const sweep = ctx.createLinearGradient(-orbR, 0, orbR, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.18)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.beginPath();
  ctx.arc(0, 0, orbR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Body
  const og = ctx.createRadialGradient(cx - orbR * 0.3, cy - orbR * 0.3, 0, cx, cy, orbR);
  og.addColorStop(0, skin.inner);
  og.addColorStop(0.3, skin.mid);
  og.addColorStop(0.65, skin.outer);
  og.addColorStop(1, skin.core);
  ctx.beginPath();
  ctx.arc(cx, cy, orbR, 0, TAU);
  ctx.fillStyle = og;
  ctx.fill();

  // Specular
  ctx.beginPath();
  ctx.arc(cx - orbR * 0.35, cy - orbR * 0.35, orbR * 0.25, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();

  // Rim
  ctx.beginPath();
  ctx.arc(cx, cy, orbR, 0, TAU);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();

  // Rainbow ring
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.4 + escalation * 0.4;
  ctx.strokeStyle = `hsl(${(t * 40 + escalation * 180) % 360},100%,70%)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, orbR + 4, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// CANNON
// ─────────────────────────────────────────────────────────────

function drawCannon(ctx, scene, lowQuality) {
  const c = scene.cannon;
  const bc = c.color;
  const recoil = c.recoil;
  const aligned = c.aimed;
  const t = scene.t;
  const ca = c.angle;
  const cx = c.cx, cy = c.cy, R = c.R;

  const barrelLen = R * 0.62;
  const barrelW = 16;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ca);

  // Aim guide dashed line
  ctx.save();
  ctx.globalAlpha = aligned ? 0.5 : 0.18;
  ctx.strokeStyle = bc.hex;
  ctx.lineWidth = aligned ? 2 : 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(barrelLen + 10, 0);
  ctx.lineTo(barrelLen + 90, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Under-barrel color beam
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beam = ctx.createLinearGradient(0, 0, barrelLen, 0);
  beam.addColorStop(0, `rgba(${bc.rgb.join(",")},0)`);
  beam.addColorStop(1, `rgba(${bc.rgb.join(",")},0.35)`);
  ctx.strokeStyle = beam;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(barrelLen, 0);
  ctx.stroke();
  ctx.restore();

  // Recoil pushback
  ctx.translate(-recoil, 0);

  // Breech
  ctx.save();
  ctx.fillStyle = "#1a2530";
  ctx.strokeStyle = bc.hex;
  ctx.lineWidth = 2;
  ctx.shadowColor = bc.hex;
  ctx.shadowBlur = lowQuality ? 0 : 12;
  ctx.beginPath();
  ctx.moveTo(-18, -12);
  ctx.lineTo(6, -14);
  ctx.lineTo(10, 0);
  ctx.lineTo(6, 14);
  ctx.lineTo(-18, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Barrel
  const bg = ctx.createLinearGradient(0, -barrelW / 2, 0, barrelW / 2);
  bg.addColorStop(0, "rgba(80,100,120,1)");
  bg.addColorStop(0.5, "rgba(30,42,54,1)");
  bg.addColorStop(1, "rgba(10,18,26,1)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(6, -barrelW / 2);
  ctx.lineTo(barrelLen, -barrelW / 2 + 3);
  ctx.lineTo(barrelLen, barrelW / 2 - 3);
  ctx.lineTo(6, barrelW / 2);
  ctx.closePath();
  ctx.fill();

  // Barrel highlight
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, -barrelW / 2 + 2);
  ctx.lineTo(barrelLen - 2, -barrelW / 2 + 4);
  ctx.stroke();

  // Color rim
  ctx.strokeStyle = bc.hex;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = bc.hex;
  ctx.shadowBlur = lowQuality ? 0 : 10;
  ctx.beginPath();
  ctx.moveTo(barrelLen, -barrelW / 2 + 3);
  ctx.lineTo(barrelLen, barrelW / 2 - 3);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Muzzle brake (2 rings)
  ctx.fillStyle = "#25323e";
  ctx.strokeStyle = bc.hex;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(barrelLen - 4, -barrelW / 2 - 2, 6, barrelW + 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(barrelLen + 2, -barrelW / 2 + 1, 4, barrelW - 2);
  ctx.fill();
  ctx.stroke();

  // Muzzle flash
  if (c.flash > 0) {
    const mf = c.flash;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flashG = ctx.createRadialGradient(barrelLen + 6, 0, 0, barrelLen + 6, 0, 44 * mf);
    flashG.addColorStop(0, `rgba(255,255,255,${mf})`);
    flashG.addColorStop(0.4, `rgba(${bc.rgb.join(",")},${mf * 0.8})`);
    flashG.addColorStop(1, `rgba(${bc.rgb.join(",")},0)`);
    ctx.fillStyle = flashG;
    ctx.beginPath();
    ctx.arc(barrelLen + 6, 0, 44 * mf, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${mf * 0.9})`;
    ctx.lineWidth = 2;
    for (let fs = 0; fs < 6; fs++) {
      const fa = (fs / 6) * TAU;
      const fl = 24 * mf;
      ctx.beginPath();
      ctx.moveTo(barrelLen + 4, 0);
      ctx.lineTo(barrelLen + 4 + Math.cos(fa) * fl, Math.sin(fa) * fl);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Turret base
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fillStyle = "#0e1822";
  ctx.fill();
  ctx.strokeStyle = bc.hex;
  ctx.lineWidth = 2;
  ctx.shadowColor = bc.hex;
  ctx.shadowBlur = lowQuality ? 0 : 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Rivets
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let rv = 0; rv < 6; rv++) {
    const ra = (rv / 6) * TAU;
    ctx.beginPath();
    ctx.arc(Math.cos(ra) * 10, Math.sin(ra) * 10, 1.3, 0, TAU);
    ctx.fill();
  }

  // Colorblind glyph
  if (c.colorblind && bc) {
    ctx.save();
    ctx.rotate(-ca);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(COLOR_SHAPES[bc.name] || "", 0, 0.5);
    ctx.restore();
  }

  // Aim-lock ring
  if (aligned) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 10);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// NEAR MISSES
// ─────────────────────────────────────────────────────────────

function drawNearMisses(ctx, scene) {
  for (let i = 0; i < scene.nearMisses.length; i++) {
    const m = scene.nearMisses[i];
    ctx.globalAlpha = m.life * 0.4;
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, m.dist, m.angle - 0.15, m.angle + 0.15);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ─────────────────────────────────────────────────────────────
// SHARD
// ─────────────────────────────────────────────────────────────

function drawShard(ctx, sh, lowQuality) {
  const { x, y, angle, color, baseSizeMul, spawnFade, comboBoost,
          isBoss, isPurge, hp, maxHp, hasColorB, colorB, bossPhase,
          trail, colorblind, colorShape } = sh;
  const rgb = color.rgb;

  // Trail
  for (let i = 0; i < trail.length; i++) {
    const tr = trail[i];
    const tt = i / Math.max(1, trail.length);
    ctx.globalAlpha = tt * (0.28 + comboBoost * 0.4) * spawnFade;
    ctx.fillStyle = color.hex;
    const sz = (1 + comboBoost * 0.8) * baseSizeMul;
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y - 6 * tt * sz);
    ctx.lineTo(tr.x - 14 * tt * sz, tr.y);
    ctx.lineTo(tr.x, tr.y + 6 * tt * sz);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Body
  const spawnScale = 0.4 + 0.6 * spawnFade;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(spawnScale, spawnScale);
  ctx.globalAlpha = spawnFade;

  // Halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 * baseSizeMul);
  halo.addColorStop(0, `rgba(${rgb.join(",")},${0.5 * spawnFade})`);
  halo.addColorStop(1, `rgba(${rgb.join(",")},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 30 * baseSizeMul, 0, TAU);
  ctx.fill();

  // Body gradient
  const w = 16 * baseSizeMul;
  const h = 10 * baseSizeMul;
  const g = ctx.createLinearGradient(-w, -h, w, h);
  g.addColorStop(0, `rgba(${rgb.join(",")},1)`);
  g.addColorStop(0.5, `rgba(${rgb.join(",")},0.85)`);
  g.addColorStop(1, `rgba(${rgb.join(",")},0.5)`);
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(-w * 0.55, h);
  ctx.lineTo(-w * 0.55, -h);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.shadowColor = color.hex;
  ctx.shadowBlur = lowQuality ? 0 : 18;
  ctx.fill();

  // Inner highlight
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(-w * 0.2, h * 0.5);
  ctx.lineTo(-w * 0.2, -h * 0.5);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.shadowBlur = 0;
  ctx.fill();

  // Colorblind symbol
  if (colorblind) {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.font = "bold " + Math.round(11 * baseSizeMul) + "px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(colorShape, 0, 0.5);
  }

  // Boss HP ring
  if (isBoss && hp > 0) {
    ctx.rotate(-angle);
    ctx.beginPath();
    ctx.arc(0, 0, 32 * baseSizeMul, -Math.PI / 2, -Math.PI / 2 + (hp / maxHp) * TAU);
    ctx.strokeStyle = "#ffdd5a";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffdd5a";
    ctx.shadowBlur = lowQuality ? 0 : 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (hp < maxHp && hasColorB) {
      ctx.beginPath();
      ctx.arc(0, 0, 38 * baseSizeMul, 0, TAU);
      ctx.strokeStyle = colorB.hex;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 * spawnFade;
      ctx.stroke();
      ctx.globalAlpha = spawnFade;
    }
  }

  // Purge dashed ring
  if (isPurge) {
    ctx.rotate(-angle);
    ctx.beginPath();
    ctx.arc(0, 0, 28 * baseSizeMul, 0, TAU);
    ctx.strokeStyle = "#ffdd5a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// POWERUP
// ─────────────────────────────────────────────────────────────

function drawPowerup(ctx, pw) {
  const { x, y, type, wob, radius } = pw;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, TAU);
  ctx.strokeStyle = type.hex;
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(wob * 1.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, type.hex);
  g.addColorStop(1, "rgba(10,10,20,0.7)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#0a0a12";
  ctx.font = "800 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type.glyph, x, y + 1);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// BUBBLE
// ─────────────────────────────────────────────────────────────

function drawBubble(ctx, b, lowQuality) {
  const rgb = b.color.rgb;
  const r = b.radius;
  const lifeT = Math.max(0, Math.min(1, b.life / 0.5));

  // Trail
  for (let i = 0; i < b.trail.length; i++) {
    const tr = b.trail[i];
    const tt = i / Math.max(1, b.trail.length);
    ctx.globalAlpha = tt * 0.18 * lifeT;
    ctx.fillStyle = b.color.hex;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, r * (0.4 + tt * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Halo
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r * 1.6);
  halo.addColorStop(0, `rgba(${rgb.join(",")},${0.28 * lifeT})`);
  halo.addColorStop(1, `rgba(${rgb.join(",")},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Body
  const bodyGrad = ctx.createRadialGradient(
    b.x - r * 0.35, b.y - r * 0.35, r * 0.1,
    b.x, b.y, r
  );
  bodyGrad.addColorStop(0, `rgba(255,255,255,${0.18 * lifeT})`);
  bodyGrad.addColorStop(0.55, `rgba(${rgb.join(",")},${0.10 * lifeT})`);
  bodyGrad.addColorStop(1, `rgba(${rgb.join(",")},${0.02 * lifeT})`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.fill();

  // Colored rim
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.strokeStyle = b.color.hex;
  ctx.globalAlpha = 0.85 * lifeT;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = b.color.hex;
  ctx.shadowBlur = lowQuality ? 0 : 16;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner rim
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.78, -Math.PI * 0.9, Math.PI * 0.1);
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * lifeT})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Specular
  const spec = ctx.createRadialGradient(
    b.x - r * 0.4, b.y - r * 0.4, 0,
    b.x - r * 0.38, b.y - r * 0.38, r * 0.24
  );
  spec.addColorStop(0, `rgba(255,255,255,${0.85 * lifeT})`);
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(b.x - r * 0.38, b.y - r * 0.38, r * 0.22, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// HINT ARROW
// ─────────────────────────────────────────────────────────────

function drawHintArrow(ctx, scene) {
  // The old draw showed a hint arrow if no block for >6s.
  // We don't have lastBlockAt in the scene; skip for now.
  // (The next step can add scene.hintArrow if we want it back.)
}

// ─────────────────────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────────────────────

function drawParticles(ctx, scene) {
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < scene.particles.length; i++) {
    const p = scene.particles[i];
    const lt = p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, lt);
    ctx.fillStyle = p.color;
    if (p.angular) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(p.size * lt, 0);
      ctx.lineTo(-p.size * lt * 0.5, p.size * lt * 0.6);
      ctx.lineTo(-p.size * lt * 0.5, -p.size * lt * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lt, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// SHOCKWAVES
// ─────────────────────────────────────────────────────────────

function drawShockwaves(ctx, scene) {
  if (scene.shockwaves.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < scene.shockwaves.length; i++) {
    const s = scene.shockwaves[i];
    const alpha = (s.life / s.maxLife) * 0.9;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3 * (s.life / s.maxLife);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// FLOATERS
// ─────────────────────────────────────────────────────────────

function drawFloaters(ctx, scene, lowQuality) {
  for (let i = 0; i < scene.floaters.length; i++) {
    const f = scene.floaters[i];
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "center";
    ctx.shadowColor = f.color;
    ctx.shadowBlur = lowQuality ? 0 : 10;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// COMBO LABEL
// ─────────────────────────────────────────────────────────────

function drawComboLabel(ctx, scene, lowQuality) {
  const cl = scene.comboLabel;
  if (!cl) return;
  ctx.globalAlpha = cl.alpha;
  ctx.fillStyle = cl.color;
  ctx.font = "900 " + cl.size + "px system-ui";
  ctx.textAlign = "center";
  ctx.shadowColor = cl.color;
  ctx.shadowBlur = lowQuality ? 0 : 25;
  ctx.fillText(cl.label, cl.cx, cl.cy);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// COUNTDOWN
// ─────────────────────────────────────────────────────────────

function drawCountdown(ctx, scene, lowQuality) {
  const c = scene.countdown;
  if (!c) return;
  ctx.globalAlpha = c.alpha;
  ctx.fillStyle = "#fff";
  ctx.font = "900 80px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#5aa0ff";
  ctx.shadowBlur = lowQuality ? 0 : 30;
  ctx.fillText(c.text, c.cx, c.cy);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// INTRO (LEVEL N)
// ─────────────────────────────────────────────────────────────

function drawIntro(ctx, scene, lowQuality) {
  const intro = scene.intro;
  if (!intro) return;
  ctx.globalAlpha = intro.alpha;
  ctx.fillStyle = "#fff";
  ctx.font = "900 34px system-ui";
  ctx.textAlign = "center";
  ctx.shadowColor = "#5aa0ff";
  ctx.shadowBlur = lowQuality ? 0 : 20;
  ctx.fillText(intro.text, intro.cx, intro.cy);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────────
// BANNERS
// ─────────────────────────────────────────────────────────────

function drawBanners(ctx, scene, W, H, lowQuality) {
  for (let i = 0; i < scene.banners.length; i++) {
    const b = scene.banners[i];
    const ba = Math.min(1, b.life * 3);
    const bw = Math.min(W * 0.8, 340);
    const bh = b.sub ? 58 : 38;
    const bx = b.cx - bw / 2;
    const by = b.y || H * 0.22;

    ctx.save();
    ctx.globalAlpha = ba;
    ctx.fillStyle = "rgba(10,10,20,0.78)";

    // Rounded rect
    const rr = 8;
    ctx.beginPath();
    ctx.moveTo(bx + rr, by);
    ctx.lineTo(bx + bw - rr, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rr);
    ctx.lineTo(bx + bw, by + bh - rr);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rr, by + bh);
    ctx.lineTo(bx + rr, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rr);
    ctx.lineTo(bx, by + rr);
    ctx.quadraticCurveTo(bx, by, bx + rr, by);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = lowQuality ? 0 : 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff";
    ctx.font = "900 17px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.cx, by + (b.sub ? 20 : bh / 2));
    if (b.sub) {
      ctx.font = "800 11px system-ui";
      ctx.fillStyle = b.color;
      ctx.fillText(b.sub, b.cx, by + 40);
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// TUTORIAL TEXT
// ─────────────────────────────────────────────────────────────

function drawTutorial(ctx, scene, lowQuality) {
  const tut = scene.tutorial;
  if (!tut) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = lowQuality ? 0 : 14;

  const { step, cx, cy } = tut;

  if (step === 0) {
    ctx.fillStyle = "#ffdd5a";
    ctx.shadowColor = "#ffdd5a";
    ctx.font = "900 20px system-ui";
    ctx.fillText("PLEASE ROTATE", cx, cy);
    ctx.font = "800 12px system-ui";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Tap left/right · Arrow keys · A/D", cx, cy + 24);
  } else if (step === 1) {
    ctx.fillStyle = "#5affa0";
    ctx.shadowColor = "#5affa0";
    ctx.font = "900 20px system-ui";
    ctx.fillText("MATCH THE COLOR", cx, cy);
    ctx.font = "800 12px system-ui";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Rotate until the colored arc covers the shard", cx, cy + 24);
  } else if (step === 2) {
    ctx.fillStyle = "#6ee7ff";
    ctx.shadowColor = "#6ee7ff";
    ctx.font = "900 20px system-ui";
    ctx.fillText("NOW FIRE THE CANNON", cx, cy);
    ctx.font = "800 12px system-ui";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Tap FIRE · Press F or Space", cx, cy + 24);
  } else if (step === 3) {
    ctx.fillStyle = "#5affa0";
    ctx.shadowColor = "#5affa0";
    ctx.font = "900 32px system-ui";
    ctx.fillText("GO!", cx, cy - 90);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// COACHING TIP
// ─────────────────────────────────────────────────────────────

function drawCoachingTip(ctx, scene, lowQuality) {
  const tip = scene.coachingTip;
  if (!tip) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = lowQuality ? 0 : 12;
  const alpha = Math.min(1, tip.ttl / 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffdd5a";
  ctx.shadowColor = "#ffdd5a";
  ctx.font = "900 14px system-ui";
  ctx.fillText("WATCH THE COLOR", tip.cx, tip.cy);
  ctx.font = "800 11px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(
    "Your shield is " + tip.shieldColorName + " · that shard is " + tip.shardColorName,
    tip.cx, tip.cy + 20
  );
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// DEATH DIAGNOSIS
// ─────────────────────────────────────────────────────────────

function drawDeathDiagnosis(ctx, scene, lowQuality) {
  const d = scene.deathDiagnosis;
  if (!d) return;
  const pw = Math.min(scene.W * 0.85, 340);
  const ph = 110;
  const px = d.cx - pw / 2;
  const py = d.cy;

  ctx.save();
  ctx.globalAlpha = d.alpha * 0.9;
  ctx.fillStyle = "rgba(10,10,20,0.92)";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "#ff5a7a";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ff5a7a";
  ctx.shadowBlur = lowQuality ? 0 : 20;
  ctx.strokeRect(px, py, pw, ph);
  ctx.shadowBlur = 0;

  ctx.globalAlpha = d.alpha;
  ctx.fillStyle = "#ff5a7a";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WHY YOU DIED", d.cx, py + 18);

  const cy = py + 55;
  ctx.font = "900 14px system-ui";
  ctx.fillStyle = d.shardColor.hex;
  ctx.fillText(d.shardColor.name, d.cx - 80, cy);
  ctx.fillStyle = "#fff";
  ctx.font = "900 22px system-ui";
  ctx.fillText("≠", d.cx, cy);
  ctx.fillStyle = d.shieldColor.hex;
  ctx.font = "900 14px system-ui";
  ctx.fillText(d.shieldColor.name, d.cx + 80, cy);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "700 9px system-ui";
  ctx.fillText("SHARD", d.cx - 80, cy + 18);
  ctx.fillText("SHIELD", d.cx + 80, cy + 18);

  ctx.fillStyle = "#ffdd5a";
  ctx.font = "700 10px system-ui";
  ctx.fillText("Rotate the shield BEFORE the shard reaches you", d.cx, py + ph - 12);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// SCREEN OVERLAYS
// ─────────────────────────────────────────────────────────────

function drawFlash(ctx, scene, W, H) {
  if (scene.flash <= 0.01) return;
  ctx.globalAlpha = scene.flash * 0.4;
  ctx.fillStyle = "#ff5a7a";
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.globalAlpha = 1;
}

function drawPerfectFlash(ctx, scene, W, H) {
  if (scene.perfectFlash <= 0.02) return;
  ctx.globalAlpha = scene.perfectFlash * 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.globalAlpha = 1;
}

function drawComboWash(ctx, scene, W, H) {
  const cl = scene.comboLabel;
  if (!cl) return;
  const pulseA = (cl.pulse / 0.7) * 0.15;
  ctx.globalAlpha = pulseA;
  ctx.fillStyle = cl.color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function drawGlitch(ctx, scene, W, H, lowQuality) {
  if (scene.glitch <= 0.06 || lowQuality) return;
  try {
    const abAlpha = Math.min(0.35, scene.glitch);
    const shift = Math.round(3 * abAlpha * 10);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = abAlpha * 0.4;
    ctx.fillStyle = "rgba(255,80,80,0.08)";
    ctx.fillRect(-shift, 0, W + shift, H);
    ctx.fillStyle = "rgba(80,220,255,0.08)";
    ctx.fillRect(shift, 0, W, H);
    ctx.restore();
  } catch (e) {}
}

function drawBloom(ctx, scene, W, H, lowQuality) {
  if (lowQuality) return;
  let bloom = 0;
  if (scene.perfectFlash > 0.02) bloom += scene.perfectFlash * 0.5;
  if (scene.flash > 0.05) bloom += scene.flash * 0.35;
  if (scene.hud.comboBadge) bloom += 0.04 + Math.sin(scene.t * 8) * 0.015;
  if (bloom <= 0.005) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bg = ctx.createRadialGradient(
    scene.cx, scene.cy, scene.shield.R * 0.4,
    scene.cx, scene.cy, Math.max(W, H) * 0.7
  );
  bg.addColorStop(0, `rgba(90,160,255,${bloom * 0.25})`);
  bg.addColorStop(0.5, `rgba(255,255,255,${bloom * 0.06})`);
  bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx, scene, W, H) {
  const vg = ctx.createRadialGradient(
    scene.cx, scene.cy, Math.min(W, H) * 0.3,
    scene.cx, scene.cy, Math.max(W, H) * 0.75
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawLowLifeWarning(ctx, scene, W, H) {
  if (scene.lowLifeWarning <= 0) return;
  const la = (scene.lowLifeWarning / 3) * (0.3 + 0.2 * Math.sin(scene.t * 8));
  ctx.globalAlpha = la;
  ctx.fillStyle = "#ff5a7a";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}