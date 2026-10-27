// =============================================================
//  Prism Shift — platform/web/haptics.js
//  Wraps navigator.vibrate. No-ops on desktop or when unsupported.
// =============================================================

/**
 * Create a haptics adapter.
 * Interface: { vibrate(pattern) }
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true] - allow disabling via user preference
 */
export function createHaptics(opts) {
  opts = opts || {};
  let enabled = opts.enabled !== false;

  const supported = typeof navigator !== "undefined" &&
                    typeof navigator.vibrate === "function";

  return {
    vibrate(pattern) {
      if (!enabled || !supported) return;
      try { navigator.vibrate(pattern); } catch (e) {}
    },

    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    isSupported() { return supported; }
  };
}