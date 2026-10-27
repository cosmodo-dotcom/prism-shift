// =============================================================
//  Prism Shift — ui/dom/overlay.js
//  The start/pause screen. Shows a title, body text, and buttons.
// =============================================================

export function createOverlay(opts) {
  const { meta, onStart, onResume, onDaily, onShop, isDailyAttemptedToday } = opts;

  const els = {
    overlay: document.getElementById("overlay"),
    title: document.getElementById("ovTitle"),
    text: document.getElementById("ovText"),
    btn: document.getElementById("ovBtn"),
    sub: document.getElementById("ovSub"),
    dailyBtn: document.getElementById("ovDailyBtn"),
    shopBtn: document.getElementById("ovShopBtn"),
    shopShards: document.getElementById("ovShopShards")
  };

  let mode = "menu"; // "menu" | "paused"

  els.btn.addEventListener("click", () => {
    if (mode === "paused") onResume();
    else onStart();
  });
  els.dailyBtn.addEventListener("click", () => {
    onDaily();
    updateDailyBtn();
  });
  els.shopBtn.addEventListener("click", onShop);

  function updateDailyBtn() {
    if (isDailyAttemptedToday()) {
      els.dailyBtn.disabled = true;
      els.dailyBtn.textContent = "◎ Daily Done";
    } else {
      els.dailyBtn.disabled = false;
      els.dailyBtn.textContent = "◎ Daily Prism";
    }
  }

  function updateShopShards() {
    els.shopShards.textContent = (meta.shards || 0).toLocaleString();
  }

  return {
    showMenu() {
      mode = "menu";
      els.title.textContent = "Ready?";
      els.text.innerHTML =
        "Rotate the shield to aim the cannon.<br>" +
        "Fire a <b>capture bubble</b> in the sector's color to pop matching shards.<br>" +
        "Every <b>10 blocks or 10,000 points</b>, automatically gain a random run upgrade. Earn <b>◆ shards</b> to unlock skins and perks.";
      els.btn.textContent = "START";
      els.sub.textContent =
        "Best: " + (meta.bestScore || 0).toLocaleString() +
        " · Arrows / A-D / tap to aim · F or Space to fire";
      els.overlay.classList.remove("hidden");
      updateDailyBtn();
      updateShopShards();
    },

    showPause() {
      mode = "paused";
      els.title.textContent = "Paused";
      els.text.innerHTML = "Take your time.";
      els.btn.textContent = "RESUME";
      els.sub.textContent = "";
      els.overlay.classList.remove("hidden");
    },

    hide() {
      els.overlay.classList.add("hidden");
    },

    /** Refresh the shard count (called when meta changes). */
    refreshShards: updateShopShards,

    /** Whether the overlay is currently visible. */
    isVisible() {
      return !els.overlay.classList.contains("hidden");
    }
  };
}