// =============================================================
//  Prism Shift — core/rng.js
//  Instance-based seeded RNG. Replaces the old global
//  rand/pick/installSeededRng/restoreRng monkey-patch.
//
//  Algorithm: mulberry32. This is the exact algorithm the
//  original index.html used inside makeSeededRng, so daily
//  runs port byte-for-byte. Do not change it.
// =============================================================

/**
 * Create a seeded RNG instance.
 * Same seed → same sequence, forever, across every platform.
 * @param {number} seed - Any integer. Will be coerced to uint32.
 * @returns {{ next: () => number, rand: (a:number,b:number)=>number, pick: (arr:any[])=>any }}
 */
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return {
    // Raw [0, 1) float. The whole algorithm in one function.
    next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // Uniform float in [a, b).
    rand(a, b) {
      return a + this.next() * (b - a);
    },
    // Uniform choice from an array.
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
  };
}

/**
 * Create an unseeded RNG instance.
 * Seed is drawn from crypto.getRandomValues when available,
 * else from Date.now() + Math.random().
 * This is what the game uses for non-daily runs.
 */
export function createRng() {
  let seed;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    seed = buf[0];
  } else {
    seed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  }
  return createSeededRng(seed);
}

/**
 * Hash a string to a uint32, for turning "prism-2026-10-23"
 * into a deterministic daily seed. FNV-1a. Identical to the
 * hashDateKey() in the original index.html so old daily runs
 * still reproduce.
 */
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}