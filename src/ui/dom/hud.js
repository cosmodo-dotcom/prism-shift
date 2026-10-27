// =============================================================
//  Prism Shift — ui/dom/hud.js
//  Updates the top-of-screen HUD from scene.hud.
//  Reads:  scene.hud
//  Writes: #level, #hearts, #score, #streak, #shardBadge,
//          #nearMisses, #comboTierBadge, #zoomBadge,
//          #fire, #fireAmmo, .count, #debtBars, .debtBar
// =============================================================

export function createHUD() {
  const els = {
    level: document.getElementById("level"),
    hearts: document.getElementById("hearts"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    shardBadge: document.getElementById("shardBadge"),
    nearMisses: document.getElementById("nearMisses"),
    comboTierBadge: document.getElementById("comboTierBadge"),
    zoomBadge: document.getElementById("zoomBadge"),
    fire: document.getElementById("fire"),
    fireAmmo: document.getElementById("fireAmmo"),
    fireCount: document.querySelector("#fire .count"),
    debtBars: document.getElementById("debtBars")
  };

  // Cache last values so we only touch the DOM when something changed.
  let last = {
    level: "",
    hearts: "",
    score: -1,
    streak: -1,
    shard: "",
    nearMiss: "",
    comboTier: null,
    zoom: false,
    ammo: -1,
    maxAmmo: -1,
    fireDisabled: null,
    fireVisible: null,
    fireColor: "",
    tutorialPulse: null,
    debtVisible: null
  };

  // Build the 4 debt bar elements once
  els.debtBars.innerHTML = "";
  const debtBarEls = [];
  for (let i = 0; i < 4; i++) {
    const bar = document.createElement("div");
    bar.className = "debtBar";
    const fill = document.createElement("div");
    fill.className = "fill";
    bar.appendChild(fill);
    els.debtBars.appendChild(bar);
    debtBarEls.push({ bar, fill });
  }

  return {
    /**
     * Update from a scene object.
     * @param {object} scene - from core/scene.js
     * @param {number} shardBalance - meta.shards (for the shard badge)
     */
    update(scene, shardBalance) {
      const h = scene.hud;

      // Level
      if (h.level !== last.level) {
        els.level.textContent = h.level;
        last.level = h.level;
      }

      // Hearts
      if (h.hearts !== last.hearts) {
        els.hearts.textContent = h.hearts;
        last.hearts = h.hearts;
      }

      // Score
      if (h.score !== last.score) {
        els.score.textContent = h.score.toLocaleString();
        last.score = h.score;
      }

      // Streak
      if (h.streak !== last.streak) {
        if (h.streak > 0) {
          els.streak.textContent = "STREAK ×" + h.streak + " · +50%";
          els.streak.style.opacity = 1;
        } else {
          els.streak.style.opacity = 0;
        }
        last.streak = h.streak;
      }

      // Shard badge
      const shardText = "◆ " + (shardBalance || 0).toLocaleString();
      if (shardText !== last.shard) {
        els.shardBadge.textContent = shardText;
        last.shard = shardText;
      }
      // Near misses
      const nearText = "NEAR ×" + h.nearMissCount;
      if (nearText !== last.nearMiss) {
        els.nearMisses.textContent = nearText;
        last.nearMiss = nearText;
      }
      els.nearMisses.classList.toggle("active", h.fireVisible);

      // Combo tier badge
      const tierLabel = h.comboBadge ? h.comboBadge.label : "";
      const tierColor = h.comboBadge ? h.comboBadge.color : "";
      if (tierLabel !== (last.comboTier && last.comboTier.label)) {
        if (h.comboBadge) {
          els.comboTierBadge.textContent = "◆ " + h.comboBadge.label + " ◆";
          els.comboTierBadge.style.color = h.comboBadge.color;
          els.comboTierBadge.classList.add("active");
        } else {
          els.comboTierBadge.classList.remove("active");
        }
        last.comboTier = h.comboBadge;
      }

      // Zoom badge
      if (h.zoomed !== last.zoom) {
        els.zoomBadge.classList.toggle("active", h.zoomed);
        last.zoom = h.zoomed;
      }

      // Ammo / fire button
      if (h.ammo !== last.ammo || h.maxAmmo !== last.maxAmmo) {
        // Rebuild pips only when counts change
        let pips = "";
        for (let i = 0; i < h.maxAmmo; i++) {
          pips += '<div class="pip' + (i < h.ammo ? " filled" : "") + '"></div>';
        }
        els.fireAmmo.innerHTML = pips;
        els.fireCount.textContent = h.ammo;
        last.ammo = h.ammo;
        last.maxAmmo = h.maxAmmo;
      }

      if (h.fireDisabled !== last.fireDisabled) {
        els.fire.disabled = h.fireDisabled;
        last.fireDisabled = h.fireDisabled;
      }

      if (h.fireVisible !== last.fireVisible) {
        els.fire.classList.toggle("visible", h.fireVisible);
        last.fireVisible = h.fireVisible;
      }

      const fireColor = h.fireColor ? h.fireColor.hex : "";
      if (fireColor !== last.fireColor) {
        if (h.fireColor) {
          els.fire.style.setProperty("--fire-color", h.fireColor.hex);
          els.fire.style.background = "radial-gradient(circle at 35% 30%, #ffffff, " + h.fireColor.hex + ")";
          els.fire.classList.toggle("ready", h.ammo > 0);
        }
        last.fireColor = fireColor;
      }

      if (h.tutorialPulse !== last.tutorialPulse) {
        els.fire.classList.toggle("tutorial-pulse", !!h.tutorialPulse);
        last.tutorialPulse = h.tutorialPulse;
      }

      // Debt bars
      if (h.debtBarsVisible !== last.debtVisible) {
        els.debtBars.classList.toggle("active", h.debtBarsVisible);
        last.debtVisible = h.debtBarsVisible;
      }
      if (h.debtBarsVisible) {
        for (let i = 0; i < 4; i++) {
          const { bar, fill } = debtBarEls[i];
          const info = h.debtBars[i];
          fill.style.width = (info.pct * 100) + "%";
          fill.style.background = info.color;
          fill.style.color = info.color;
          bar.classList.toggle("dominant", info.dominant);
          bar.style.color = info.dominant ? info.color : "";
        }
      }
    },

    /** Expose the DOM elements (the adapter may need #fire for input). */
    elements: els
  };
}