// =============================================================
//  Prism Shift — platform/web/clock.js
//  Monotonic time source. Wraps performance.now() with a fallback.
//  Returns milliseconds.
// =============================================================

/**
 * Create a clock adapter.
 * Interface: { now() -> number (ms since an arbitrary origin) }
 */
export function createClock() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return {
      now() { return performance.now(); }
    };
  }
  // Very old browsers or Node fallback
  const origin = Date.now();
  return {
    now() { return Date.now() - origin; }
  };
}