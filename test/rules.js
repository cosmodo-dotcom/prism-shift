// test/rules.test.js — run with: node test/rules.test.js
import * as R from "../src/core/rules.js";
import * as S from "../src/core/state.js";

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? "  ✓" : "  ✗", name, ok ? "" : `→ ${actual} ≠ ${expected}`);
  ok ? pass++ : fail++;
}

function makeState() {
  const s = S.createState();
  s.metaRef = { equipped: { shield: "neon", orb: "prism" } };
  s.runMods = S.defaultMods();
  s.cachedColors = 4;
  s.shieldAngle = 0;
  return s;
}

// ── Sector math
console.log("sector geometry:");
{
  const s = makeState();
  eq("sectors", R.currentSectors(s), 4);
  eq("arc ≈ π/2", Math.abs(R.sectorArc(s) - Math.PI / 2) < 1e-9, true);
  eq("index at 0", R.sectorIndexAt(s, 0), 0);
  eq("index at π/4", R.sectorIndexAt(s, Math.PI / 4), 1);
  eq("index at π/2", R.sectorIndexAt(s, Math.PI / 2 + 0.01), 1);
  eq("index at π", R.sectorIndexAt(s, Math.PI), 2);
  eq("index at 3π/2", R.sectorIndexAt(s, 3 * Math.PI / 2), 3);
  eq("index at 2π (wraps to 0)", R.sectorIndexAt(s, 2 * Math.PI), 0);
}

// ── Color lookup
console.log("color lookup:");
{
  const s = makeState();
  eq("color at 0", R.colorAt(s, 0).name, "RED");
  eq("color at π/2", R.colorAt(s, Math.PI / 2 + 0.01).name, "BLUE");
  eq("color at π", R.colorAt(s, Math.PI).name, "GREEN");
  eq("color at 3π/2", R.colorAt(s, 3 * Math.PI / 2).name, "YELLOW");
}

// ── Cannon aim
console.log("cannon aim:");
{
  const s = makeState();
  s.targetAngle = Math.PI;
  eq("cannon color", R.cannonColor(s).name, "GREEN");
  eq("cannon sector", R.cannonSectorIndex(s), 2);
}

// ── Combo tiers
console.log("combo tiers:");
{
  const s = makeState();
  eq("tier @0", R.currentComboTier(s), -1);
  s.combo = 3;  eq("tier @3", R.currentComboTier(s), -1);  // still below tier 5
  s.combo = 5;  eq("tier @5", R.currentComboTier(s), 2);
  s.combo = 8;  eq("tier @8", R.currentComboTier(s), 1);
  s.combo = 12; eq("tier @12", R.currentComboTier(s), 0);
  s.combo = 999; eq("tier @999", R.currentComboTier(s), 0);
}

// ── Ammo
console.log("ammo:");
{
  const s = makeState();
  eq("base ammo", R.currentMaxAmmo(s), 2);
  s.runMods.ammoBonus = 3;
  eq("+3 ammo", R.currentMaxAmmo(s), 5);
}

// ── Score
console.log("score:");
{
  const s = makeState();
  s.score = 0; s.scoreFromRun = 0;
  eq("plain 100", R.addScore(s, 100), 100);
  eq("state.score", s.score, 100);
  eq("state.scoreFromRun", s.scoreFromRun, 100);

  s.runMods.scoreMult = 1.5;
  eq("1.5x 100", R.addScore(s, 100), 150);

  s.adrenaline = true;
  eq("1.5x × 2 (adrenaline) 100", R.addScore(s, 100), 300);
}

// ── Debt
console.log("debt:");
{
  const s = makeState();
  s.debt[0] = 0;
  const ev1 = R.addDebt(s, "RED", 30, 1000);
  eq("30 → no event", ev1.length, 0);
  eq("debt[0]=30", s.debt[0], 30);

  const ev2 = R.addDebt(s, "RED", 50, 2000);
  eq("+50 crosses 70 → dominant event", ev2.map(e => e.type), ["debtDominant"]);
  eq("debt[0]=80", s.debt[0], 80);
  eq("dominant until 32000", s.debtDominantUntil[0], 2000 + 30 * 1000);

  const ev3 = R.addDebt(s, "RED", 100, 3000);
  eq("past max → purge event", ev3.map(e => e.type), ["purgeQueued"]);
  eq("debt[0] clamped to 100", s.debt[0], 100);
  eq("purgeQueue has 1", s.purgeQueue.length, 1);

  // Second call shouldn't double-queue
  const ev4 = R.addDebt(s, "RED", 100, 3500);
  eq("double purge prevented", ev4.length, 0);
  eq("purgeQueue still 1", s.purgeQueue.length, 1);

  R.drainDebt(s, "RED", 200);
  eq("drain clamps to 0", s.debt[0], 0);
}

// ── isColorDominant
console.log("dominant check:");
{
  const s = makeState();
  s.debtDominantUntil[0] = 5000;
  eq("at 3000 → dominant", R.isColorDominant(s, "RED", 3000), true);
  eq("at 6000 → not dominant", R.isColorDominant(s, "RED", 6000), false);
  eq("unknown color → false", R.isColorDominant(s, "PURPLE", 3000), false);
}

// ── Milestone
console.log("milestone:");
{
  const s = makeState();
  s.score = 4000;
  s.nextMilestone = 4000;
  s.lives = 2;
  const r1 = R.bumpMilestoneIfDue(s);
  eq("milestone bumped", r1.bumped, true);
  eq("lives granted", r1.livesGranted, 1);
  eq("lives now 3", s.lives, 3);
  eq("next milestone 8000", s.nextMilestone, 8000);

  // At max lives, milestone should still bump but not grant a life
  s.score = 8000; s.lives = 99;
  const r2 = R.bumpMilestoneIfDue(s);
  eq("bumped again", r2.bumped, true);
  eq("no lives at cap", r2.livesGranted, 0);
}

// ── Run shards
console.log("calculateRunShards:");
{
  const s = makeState();
  s.score = 1000;   // 1000/50 = 20
  s.level = 2;      // (2+1)*5 = 15
  s.runUpgrades = []; // 0
  s.blocked = 10;   // 20
  s.nearMissCount = 0;
  s.perfectBlocks = 0;
  // total = 20 + 15 + 0 + 20 = 55, no best bonus
  eq("no best", R.calculateRunShards(s, 9999), 55);

  // With best bonus
  eq("best bonus +25", R.calculateRunShards(s, 500), 80);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);