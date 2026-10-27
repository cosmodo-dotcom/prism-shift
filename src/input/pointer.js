// =============================================================
//  Prism Shift — input/pointer.js
//  Pointer/touch input. Uses input.pointerAimDelta (single-frame)
//  so it doesn't conflict with held keyboard aimDelta.
// =============================================================

export function setupPointer(opts) {
  const {
    canvas, fireButton, input, getMode,
    getCountdown, onCancelCountdown, onFire
  } = opts;

  function onCanvasPointerDown(e) {
    if (getMode() !== "playing") return;

    if (getCountdown() > 0) {
      onCancelCountdown && onCancelCountdown();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const halfW = rect.width / 2;
    input.pointerAimDelta = x < halfW ? -1 : 1;
  }

  function onFirePointerDown(e) {
    e.preventDefault();
    input.fire = true;
    onFire && onFire();
  }
  function onFireClick(e) {
    e.preventDefault();
    fireButton.blur();
  }

  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  if (fireButton) {
    fireButton.addEventListener("pointerdown", onFirePointerDown);
    fireButton.addEventListener("click", onFireClick);
  }

  return function detach() {
    canvas.removeEventListener("pointerdown", onCanvasPointerDown);
    if (fireButton) {
      fireButton.removeEventListener("pointerdown", onFirePointerDown);
      fireButton.removeEventListener("click", onFireClick);
    }
  };
}