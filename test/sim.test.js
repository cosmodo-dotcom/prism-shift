// =============================================================
//  Prism Shift — test/sim.test.js
//  Headless verification harness. Proves the extraction is
//  faithful and the simulation is deterministic.
//
//  Run: node test/sim.test.js
// =============================================================

import * as S from "../src/core/state.js";
import * as Sim from "../src/core/simulation.js";
import * as R from "../src/core/rules.js";
import * as Rng from "../src/core/rng.js";
import { PALETTES, UPGRADES } from "../src/core/tuning.js";

// ─────────────────────────────────────────────────────────────
// HARNESS
// ─────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    process.stdout.write(".");
  } else {
    fail++;
    failures.push(name + (extra ? " — " + extra : ""));
    process.stdout.write("F");
  }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, `got ${a}, expected ${e}`);
}
function near(name, actual, expected, eps) {
  ok(name, Math.abs(actual - expected) < (eps || 1e-6),
     `got ${actual}, expected ≈${expected}`);
}
function section(name) {
  if (pass + fail > 0) process.stdout.write("\n");
  process.stdout.write("  " + name + " ");
}

// ─────────────────────────────────────────────────────────────
// BOOT HELPER
// ─────────────────────────────────────────────────────────────

function boot(opts) {
  opts = opts || {};
  const meta = S.createMeta();
  const state = S.createState();
  state.metaRef = meta;
  state.paletteRef = PALETTES.neon;
  state.layout = {
    W: opts.W || 400,
    H: opts.H || 400,
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
  state.nowMs = 1000;
  state.rng = Rng.createSeededRng(opts.seed || 42);
  Sim.startRun(state, meta, { tutorial: false });
  state.countdown = 0;
  return { state, meta };
}

/** Advance one tick, updating nowMs. */
function step(state, input) {
  state.nowMs += 16;
  return Sim.tick(state, 0.016, input || {});
}

/** Collect all events returned across many ticks. */
function collectEvents(state, ticks, inputFn) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    if (state.mode === "gameover") break;
    const ev = step(state, inputFn ? inputFn(i, state) : {});
    for (const e of ev) events.push(e);
  }
  return events;
}

// ─────────────────────────────────────────────────────────────
// BOTS
// ─────────────────────────────────────────────────────────────

/** A bot that never moves and never fires. Should die eventually. */
function idleBot(i, state) {
  return {};
}

/**
 * A bot that aims perfectly at the nearest shard AND fires every
 * N ticks. Bypasses shield lerp by snapping shieldAngle = targetAngle.
 */
function makePerfectBot(opts) {
  opts = opts || {};
  const fireEvery = opts.fireEvery || 10;
  return function (i, state) {
    const n = R.currentSectors(state);
    const arc = (Math.PI * 2) / n;

    // Aim at nearest shard
    let nearest = null, nearestDist = Infinity;
    for (const sh of state.shards) {
      if (sh.alive && sh.dist < nearestDist) {
        nearestDist = sh.dist;
        nearest = sh;
      }
    }
    if (nearest) {
      const pal = state.paletteRef;
      const colorIdx = pal.findIndex(c => c.name === nearest.color.name);
      if (colorIdx >= 0) {
        // targetAngle that puts the colorIdx sector over nearest.angle
        const wantAngle = nearest.angle - colorIdx * arc - arc / 2;
        const diff = Math.atan2(
          Math.sin(wantAngle - state.targetAngle),
          Math.cos(wantAngle - state.targetAngle)
        );
        state.targetAngle += diff;
        state.shieldAngle = state.targetAngle;
      }
    }
    return { fire: i % fireEvery === 0 };
  };
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 1 — baseline invariants
// ─────────────────────────────────────────────────────────────

function testBaseline() {
  section("baseline invariants");
  const { state, meta } = boot({ seed: 1234 });

  eq("mode is playing", state.mode, "playing");
  eq("level is 0", state.level, 0);
  eq("score is 0", state.score, 0);
  eq("lives is 2", state.lives, 2);
  eq("ammo is 2", state.ammo, 2);
  eq("blocked is 0", state.blocked, 0);
  eq("shards empty", state.shards.length, 0);
  eq("bubbles empty", state.bubbles.length, 0);
  eq("particles empty", state.particles.length, 0);
  eq("floaters empty", state.floaters.length, 0);
  ok("runMods present", state.runMods !== null);
  ok("rng present", typeof state.rng.next === "function");
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 2 — determinism
// ─────────────────────────────────────────────────────────────

function testDeterminism() {
  section("determinism");

  function runToState(seed, ticks, fireEvery) {
    const { state } = boot({ seed });
    const bot = makePerfectBot({ fireEvery });
    const events = [];
    for (let i = 0; i < ticks; i++) {
      if (state.mode === "gameover") break;
      const ev = step(state, bot(i, state));
      for (const e of ev) events.push(e);
    }
    return {
      score: state.score,
      blocked: state.blocked,
      lives: state.lives,
      level: state.level,
      shardsLen: state.shards.length,
      bubblesLen: state.bubbles.length,
      particlesLen: state.particles.length,
      mode: state.mode,
      eventCount: events.length
    };
  }

  const a = runToState(42, 500, 10);
  const b = runToState(42, 500, 10);
  eq("same seed → same score", a.score, b.score);
  eq("same seed → same blocks", a.blocked, b.blocked);
  eq("same seed → same lives", a.lives, b.lives);
  eq("same seed → same level", a.level, b.level);
  eq("same seed → same shards", a.shardsLen, b.shardsLen);
  eq("same seed → same bubbles", a.bubblesLen, b.bubblesLen);
  eq("same seed → same particles", a.particlesLen, b.particlesLen);
  eq("same seed → same mode", a.mode, b.mode);
  eq("same seed → same event count", a.eventCount, b.eventCount);

  const c = runToState(43, 500, 10);
  ok("different seed → different trajectory",
     a.score !== c.score || a.blocked !== c.blocked || a.shardsLen !== c.shardsLen);
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 3 — idle bot dies
// ─────────────────────────────────────────────────────────────

function testIdleBotDies() {
  section("idle bot dies");

  const { state } = boot({ seed: 555 });
  let ticks = 0;
  for (let i = 0; i < 60000; i++) {
    if (state.mode === "gameover") break;
    step(state, idleBot(i, state));
    ticks++;
  }
  eq("mode is gameover", state.mode, "gameover");
  eq("lives 0", state.lives, 0);
  ok("died within 60000 ticks", ticks < 60000, `survived ${ticks}`);
  ok("took at least 100 ticks to die", ticks >= 100, `died too fast: ${ticks}`);
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 4 — perfect bot thrives
// ─────────────────────────────────────────────────────────────

function testPerfectBot() {
  section("perfect bot");

  const { state } = boot({ seed: 777 });
  const bot = makePerfectBot({ fireEvery: 8 });

  let ticks = 0;
  for (let i = 0; i < 5000; i++) {
    if (state.mode === "gameover") break;
    step(state, bot(i, state));
    ticks++;
  }

  ok("survived at least 2000 ticks", ticks >= 2000, `survived ${ticks}`);
  ok("scored at least 5000", state.score >= 5000, `score ${state.score}`);
  ok("blocked at least 30", state.blocked >= 30, `blocked ${state.blocked}`);
  ok("still alive", state.lives > 0, `lives ${state.lives}`);
  console.log(`\n    survived ${ticks} ticks · score ${state.score} · blocked ${state.blocked} · level ${state.level}`);
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 5 — NaN hygiene
// ─────────────────────────────────────────────────────────────

function testNaNHygiene() {
  section("NaN hygiene");

  const { state } = boot({ seed: 9001 });
  const bot = makePerfectBot({ fireEvery: 7 });

  let allFinite = true;
  let firstNonFinite = null;

  for (let i = 0; i < 2000 && state.mode !== "gameover"; i++) {
    step(state, bot(i, state));

    // Check critical numeric fields
    const fields = [
      "score", "lives", "combo", "streak", "blocked",
      "shieldAngle", "targetAngle", "cannonAngle",
      "ammo", "reloadTimer", "fireCooldown", "zoomLevel",
      "spawnTimer", "powerTimer", "timeScale",
      "shardSpeedBase", "shardSpeedTarget",
      "escalation", "adrenalineMix",
      "shake", "shakeX", "shakeY", "flash", "glitch"
    ];
    for (const f of fields) {
      if (!Number.isFinite(state[f])) {
        allFinite = false;
        if (!firstNonFinite) firstNonFinite = f + " = " + state[f] + " at tick " + i;
      }
    }

    // Check shards
    for (const sh of state.shards) {
      if (!Number.isFinite(sh.angle) || !Number.isFinite(sh.dist) || !Number.isFinite(sh.speed)) {
        allFinite = false;
        if (!firstNonFinite) firstNonFinite = "shard field NaN at tick " + i;
      }
    }

    // Check bubbles
    for (const b of state.bubbles) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.life)) {
        allFinite = false;
        if (!firstNonFinite) firstNonFinite = "bubble field NaN at tick " + i;
      }
    }

    // Check debt array
    for (let di = 0; di < 4; di++) {
      if (!Number.isFinite(state.debt[di])) {
        allFinite = false;
        if (!firstNonFinite) firstNonFinite = "debt[" + di + "] NaN at tick " + i;
      }
    }
  }

  ok("no NaN or Infinity in critical fields", allFinite, firstNonFinite || "");
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 6 — long soak
// ─────────────────────────────────────────────────────────────

function testLongSoak() {
  section("long soak");

  const { state } = boot({ seed: 31337 });
  const bot = makePerfectBot({ fireEvery: 6 });

  let ticks = 0;
  let maxShardsSeen = 0;
  let maxParticlesSeen = 0;
  let maxBubblesSeen = 0;

  for (let i = 0; i < 20000; i++) {
    if (state.mode === "gameover") break;
    step(state, bot(i, state));
    ticks++;
    if (state.shards.length > maxShardsSeen) maxShardsSeen = state.shards.length;
    if (state.particles.length > maxParticlesSeen) maxParticlesSeen = state.particles.length;
    if (state.bubbles.length > maxBubblesSeen) maxBubblesSeen = state.bubbles.length;

    // Guard: no runaway arrays
    if (state.shards.length > 200) {
      ok("shard count bounded", false, "at tick " + i + " shards=" + state.shards.length);
      return;
    }
    if (state.particles.length > 2000) {
      ok("particle count bounded", false, "at tick " + i + " particles=" + state.particles.length);
      return;
    }
  }

  ok("survived 20000 ticks or reached gameover",
     ticks >= 500 || state.mode === "gameover",
     `ticks=${ticks} mode=${state.mode}`);
  ok("shard count bounded", maxShardsSeen < 200, `max=${maxShardsSeen}`);
  ok("particle count bounded", maxParticlesSeen < 2000, `max=${maxParticlesSeen}`);
  ok("bubble count bounded", maxBubblesSeen < 50, `max=${maxBubblesSeen}`);
  console.log(`\n    ${ticks} ticks · max shards ${maxShardsSeen} · max particles ${maxParticlesSeen} · max bubbles ${maxBubblesSeen}`);
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 7 — upgrade rewards apply automatically without pausing
// ─────────────────────────────────────────────────────────────

function testAutomaticUpgrades() {
  section("automatic upgrades");

  const { state } = boot({ seed: 1010 });
  const bot = makePerfectBot({ fireEvery: 5 });
  let rewards = 0;
  let hintCount = 0;

  for (let i = 0; i < 5000 && state.mode !== "gameover"; i++) {
    const upgradesBefore = state.runUpgrades.length;
    step(state, bot(i, state));
    if (state.runUpgrades.length > upgradesBefore) {
      rewards++;
      eq("reward does not pause gameplay", state.mode, "playing");
      eq("reward is applied immediately", state.runUpgrades.length, upgradesBefore + 1);
    }
    if (state.floaters.some(f => f.text === "UPGRADE AUTO-APPLIED")) hintCount++;
    if (rewards >= 3) break;
  }

  ok("at least 3 rewards granted", rewards >= 3, `granted ${rewards}`);
  ok("first reward hint is shown", hintCount > 0);
  eq("first reward hint marked shown", state._upgradeHintShown, true);

  const capped = boot({ seed: 1011 }).state;
  const pendingUpgrade = UPGRADES.find(upgrade => upgrade.id === "mag");
  capped.runUpgrades = UPGRADES
    .filter(upgrade => upgrade.id !== pendingUpgrade.id)
    .flatMap(upgrade => Array(upgrade.maxStacks || 1).fill(upgrade.id));
  capped.runUpgrades.push(...Array(pendingUpgrade.maxStacks).fill(pendingUpgrade.id));
  eq("exhausted upgrades respect stack caps",
    R.rollUpgradeRewards(capped, 1).length, 0);
}

// ─────────────────────────────────────────────────────────────────
// SCENARIO 8 — daily determinism (byte-for-byte reproducibility)
// ─────────────────────────────────────────────────────────────────

function testDailyDeterminism() {
  section("daily determinism");

  // Simulate the daily seed pipeline
  const dateString = "prism-2026-10-23";
  const seed = Rng.hashString(dateString);

  function runDaily() {
    const { state } = boot({ seed });
    const bot = makePerfectBot({ fireEvery: 9 });
    const events = [];
    for (let i = 0; i < 1500 && state.mode !== "gameover"; i++) {
      const ev = step(state, bot(i, state));
      for (const e of ev) events.push(e.type);
    }
    return {
      score: state.score,
      blocked: state.blocked,
      lives: state.lives,
      level: state.level,
      eventHash: events.join(",")
    };
  }

  const a = runDaily();
  const b = runDaily();
  eq("daily score reproducible", a.score, b.score);
  eq("daily blocks reproducible", a.blocked, b.blocked);
  eq("daily lives reproducible", a.lives, b.lives);
  eq("daily level reproducible", a.level, b.level);
  eq("daily event sequence identical", a.eventHash, b.eventHash);

  // Sanity: a different date produces a different run
  const seed2 = Rng.hashString("prism-2026-10-24");
  function runDaily2() {
    const { state } = boot({ seed: seed2 });
    const bot = makePerfectBot({ fireEvery: 9 });
    for (let i = 0; i < 1500 && state.mode !== "gameover"; i++) {
      step(state, bot(i, state));
    }
    return { score: state.score, blocked: state.blocked };
  }
  const c = runDaily2();
  ok("different date → different run",
     a.score !== c.score || a.blocked !== c.blocked);
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 9 — end of run produces shards
// ─────────────────────────────────────────────────────────────

function testEndRunShards() {
  section("end of run");

  const { state, meta } = boot({ seed: 8888 });
  state.score = 5000;
  state.level = 2;
  state.blocked = 20;
  state.runUpgrades = ["mag", "split"];
  state.nearMissCount = 10;
  state.perfectBlocks = 4;
  state.lives = 0;
  state.mode = "playing";

  const ev = Sim.endRun(state);

  eq("mode is gameover", state.mode, "gameover");
  const gameOverEvent = ev.find(e => e.type === "gameOver");
  ok("gameOver event emitted", !!gameOverEvent);
  ok("earned shards computed", gameOverEvent.earned > 0, `earned=${gameOverEvent.earned}`);
  ok("has death sfx", ev.some(e => e.type === "sfx" && e.name === "death"));
  ok("has vibrate event", ev.some(e => e.type === "vibrate"));
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 10 — startRun / startLevel idempotence
// ─────────────────────────────────────────────────────────────

function testStartIdempotence() {
  section("start idempotence");

  const { state, meta } = boot({ seed: 1 });
  state.score = 9999;
  state.lives = 4;
  state.shards.push({ alive: true, angle: 0, dist: 100, color: PALETTES.neon[0] });

  Sim.startRun(state, meta, { tutorial: false });
  eq("score reset", state.score, 0);
  eq("lives reset to 2", state.lives, 2);
  eq("shards cleared", state.shards.length, 0);
  eq("mode playing", state.mode, "playing");
  eq("level 0", state.level, 0);

  // Second startRun should also reset cleanly
  state.score = 5555;
  Sim.startRun(state, meta, { tutorial: false });
  eq("second startRun: score reset", state.score, 0);
  eq("second startRun: mode playing", state.mode, "playing");
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 11 — no forbidden tokens in core
// ─────────────────────────────────────────────────────────────

async function testNoForbiddenTokens() {
  section("core purity");

  const fs = await import("fs");
  const path = await import("path");

  const coreFiles = [
    "tuning.js",
    "rng.js",
    "state.js",
    "rules.js",
    "spawn.js",
    "scene.js",
    "simulation.js"
  ];
  const forbidden = [
    "document.",
    "window.",
    "navigator.",
    "localStorage.",
    "sessionStorage.",
    "AudioContext",
    "requestAnimationFrame",
    "ctx."
  ];

  for (const file of coreFiles) {
    const fullPath = path.join(process.cwd(), "src", "core", file);
    let src;
    try {
      src = fs.readFileSync(fullPath, "utf8");
    } catch (e) {
      ok(file + " readable", false, e.message);
      continue;
    }
    let clean = true;
    const found = [];
    for (const token of forbidden) {
      if (src.includes(token)) {
        // Allow mentions in comments (lines starting with //)
        const lines = src.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
          if (line.includes(token)) {
            clean = false;
            found.push(token);
            break;
          }
        }
      }
    }
    ok(file + " clean of platform globals", clean, found.join(", "));
  }
}

// ─────────────────────────────────────────────────────────────
// SCENARIO 12 — performance sanity
// ─────────────────────────────────────────────────────────────

function testPerformance() {
  section("performance");

  const { state } = boot({ seed: 4242 });
  const bot = makePerfectBot({ fireEvery: 6 });

  const t0 = Date.now();
  let ticks = 0;
  for (let i = 0; i < 10000; i++) {
    if (state.mode === "gameover") break;
    step(state, bot(i, state));
    ticks++;
  }
  const elapsed = Date.now() - t0;
  const perTick = elapsed / ticks;
  const estFps = 1000 / perTick;

  ok("runs 10000 ticks in < 5000ms", elapsed < 5000, `took ${elapsed}ms`);
  ok("tick time supports 60fps", perTick < 16.6, `${perTick.toFixed(3)}ms/tick`);
  console.log(`\n    ${ticks} ticks in ${elapsed}ms · ${perTick.toFixed(3)}ms/tick · ~${Math.round(estFps)}fps headroom`);
}

// ─────────────────────────────────────────────────────────────
// RUN ALL
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Prism Shift — Simulation Test Suite");
  console.log("  " + "=".repeat(45));

  testBaseline();
  testDeterminism();
  testIdleBotDies();
  testPerfectBot();
  testNaNHygiene();
  testLongSoak();
  testAutomaticUpgrades();
  testDailyDeterminism();
  testEndRunShards();
  testStartIdempotence();
  await testNoForbiddenTokens();
  testPerformance();

  console.log("\n  " + "=".repeat(45));
  console.log(`  ${pass} passed · ${fail} failed`);
  if (fail > 0) {
    console.log("\n  Failures:");
    for (const f of failures) console.log("    ✗ " + f);
  }
  console.log("");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(2);
});