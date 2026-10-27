// =============================================================
//  Prism Shift — input/keyboard.js
//  Maps keyboard events to the { aimDelta, fire } input object.
//
//  Both aimDelta and fire are single-frame pulses: they are set
//  on keydown and MUST be reset by the adapter after every tick.
//  This matches the original game's behavior where one keypress
//  = one sector step, and holding a key relies on OS autorepeat.
// =============================================================

/**
 * Attach keyboard listeners.
 *
 * @param {object} opts
 * @param {object}   opts.input        - mutable { aimDelta, fire } object
 * @param {function} opts.onFire       - called on F / Space keydown (optional)
 * @param {function} opts.onPause      - called on P / Esc (optional)
 * @param {function} opts.onShopClose  - called on Escape while in shop (optional)
 * @param {function} opts.getMode      - returns the current state.mode
 * @returns {function} detach - call to remove listeners
 */
export function setupKeyboard(opts) {
  const {
    input, onFire, onPause, onShopClose, getMode
  } = opts;

  function onKeyDown(e) {
    // Ignore modifier-key combos (browser shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const mode = getMode ? getMode() : "playing";

    // ── Shop: Escape closes
    if (mode === "shop") {
      if (e.key === "Escape") {
        if (onShopClose) onShopClose();
        e.preventDefault();
        return;
      }
    }

    // ── Paused: Escape/P resumes
    if (mode === "paused") {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (onPause) onPause();
        e.preventDefault();
        return;
      }
    }

    // ── Playing: P/Escape pauses
    if (mode === "playing" && (e.key === "Escape" || e.key === "p" || e.key === "P")) {
      if (onPause) onPause();
      e.preventDefault();
      return;
    }

    // ── Fire: F or Space
    if (e.key === "f" || e.key === "F" || e.key === " ") {
      // Don't fire from Space if a button has focus
      // (avoids double-fire when the FIRE button was last clicked)
      if (e.key === " " && document.activeElement &&
          document.activeElement.tagName === "BUTTON") {
        e.preventDefault();
        return;
      }
      input.fire = true;
      if (onFire) onFire();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // ── Aim (only while playing)
    if (mode !== "playing" && mode !== "transition") return;

    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      input.aimDelta = -1;
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      input.aimDelta = 1;
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", onKeyDown);

  return function detach() {
    window.removeEventListener("keydown", onKeyDown);
  };
}