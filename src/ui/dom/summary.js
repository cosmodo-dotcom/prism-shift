// =============================================================
//  Prism Shift — ui/dom/summary.js
//  Post-run summary: stats grid, upgrades, shard award,
//  watch-ad-for-double, leaderboard, retry button.
// =============================================================

import { UPGRADES, RARITY_COLOR } from "../../core/tuning.js";
import { paintIcon } from "../../renderers/canvas2d/sprites.js";

export function createSummary(opts) {
  const { meta, onRetry, onShop, onDoubleShards, getLeaderboard } = opts;

  const els = {
    root: document.getElementById("summary"),
    title: document.getElementById("sumTitle"),
    stats: document.getElementById("sumStats"),
    diag: document.getElementById("sumDiag"),
    upgrades: document.getElementById("sumUpgrades"),
    shards: document.getElementById("sumShards"),
    doubleBtn: document.getElementById("sumDouble"),
    leaderboard: document.getElementById("sumLeaderboard"),
    best: document.getElementById("sumBest"),
    shopBtn: document.getElementById("sumShopBtn"),
    retryBtn: document.getElementById("sumBtn")
  };

  // Double button is managed by us, not the caller
  let doubleUsed = false;
  let doubleEarned = 0;

  els.retryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onRetry();
  });
  els.shopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onShop();
  });
  els.doubleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (doubleUsed) return;
    doubleUsed = true;
    els.doubleBtn.disabled = true;
    els.doubleBtn.textContent = "Loading ad…";
    setTimeout(() => {
      onDoubleShards(doubleEarned);
      els.shards.textContent = "◆ +" + (doubleEarned * 2) + " shards";
      els.best.textContent =
        "Best: " + (meta.bestScore || 0).toLocaleString() +
        "  ·  Total: " + (meta.shards || 0).toLocaleString();
      els.doubleBtn.textContent = "✓ Doubled!";
    }, 1800);
  });

  function renderLeaderboard() {
    const runs = getLeaderboard();
    if (!runs || runs.length === 0) {
      els.leaderboard.innerHTML = "";
      return;
    }
    let html = '<div class="lbTitle">Local Top 10</div>';
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const isTop = i === 0;
      let dateStr = "";
      try {
        const d = new Date(r.date);
        dateStr = (d.getMonth() + 1) + "/" + d.getDate();
      } catch (e) {}
      html += '<div class="lbRow' + (isTop ? " top" : "") + '">' +
        '<span class="rk">#' + (i + 1) + '</span>' +
        '<span class="sc">' + r.score.toLocaleString() + '</span>' +
        '<span class="dt">' + dateStr + '</span>' +
        '</div>';
    }
    els.leaderboard.innerHTML = html;
  }

  return {
    /**
     * Show the summary.
     * @param {object} opts
     * @param {number} opts.score
     * @param {number} opts.level         - 0-based (will display as level+1 if needed)
     * @param {number} opts.blocked
     * @param {number} opts.bestCombo
     * @param {number} opts.perfectBlocks
     * @param {number} opts.nearMissCount
     * @param {number} opts.durationMs
     * @param {Array<string>} opts.runUpgrades
     * @param {object|null} opts.deathDiagnosis
     * @param {number} opts.earnedShards
     * @param {boolean} opts.wasBest
     * @param {boolean} opts.almostBest
     */
    show(opts) {
      // Title
      if (opts.wasBest) {
        els.title.textContent = "New Best!";
        els.title.style.color = "";
      } else if (opts.almostBest) {
        els.title.textContent = "Almost Had It!";
        els.title.style.color = "#ffdd5a";
      } else {
        els.title.textContent = "Run Over";
        els.title.style.color = "";
      }

      // Time string
      const duration = Math.round(opts.durationMs / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const timeStr = mins + ":" + (secs < 10 ? "0" : "") + secs;

      // Stats grid
      els.stats.innerHTML =
        '<div class="stat"><span class="k">Score</span><span class="v">' + opts.score.toLocaleString() + '</span></div>' +
        '<div class="stat"><span class="k">Time</span><span class="v">' + timeStr + '</span></div>' +
        '<div class="stat"><span class="k">Blocks</span><span class="v">' + opts.blocked + '</span></div>' +
        '<div class="stat"><span class="k">Best Combo</span><span class="v">×' + opts.bestCombo + '</span></div>' +
        '<div class="stat"><span class="k">Perfect</span><span class="v">' + opts.perfectBlocks + '</span></div>' +
        '<div class="stat"><span class="k">Near Miss</span><span class="v">' + opts.nearMissCount + '</span></div>';

      // Death diagnosis
      if (opts.deathDiagnosis) {
        const dc = opts.deathDiagnosis;
        els.diag.innerHTML =
          '<div class="dTitle">Why You Died</div>' +
          '<div class="dRow">' +
            '<div class="dCol"><div style="color:' + dc.shardColor.hex + '">' + dc.shardColor.name + '</div><div class="lbl">SHARD</div></div>' +
            '<div class="neq">≠</div>' +
            '<div class="dCol"><div style="color:' + dc.shieldColor.hex + '">' + dc.shieldColor.name + '</div><div class="lbl">SHIELD</div></div>' +
          '</div>' +
          '<div class="dHint">Rotate the shield before the shard reaches you</div>';
        els.diag.classList.add("active");
      } else {
        els.diag.classList.remove("active");
        els.diag.innerHTML = "";
      }

      // Upgrades
      if (!opts.runUpgrades || opts.runUpgrades.length === 0) {
        els.upgrades.innerHTML =
          '<div style="color:var(--c-text-muted);font-size:11px;letter-spacing:2px;text-transform:uppercase;">No upgrades taken</div>';
      } else {
        els.upgrades.innerHTML = "";
        for (const id of opts.runUpgrades) {
          const found = UPGRADES.find(u => u.id === id);
          if (found) {
            const tile = document.createElement("div");
            tile.className = "u";
            tile.title = found.name;
            tile.setAttribute("aria-label", found.name);

            const iconCanvas = document.createElement("canvas");
            paintIcon(iconCanvas, found.icon, RARITY_COLOR[found.rarity] || "#9affc4");
            tile.appendChild(iconCanvas);
            els.upgrades.appendChild(tile);
          }
        }
      }

      // Shards
      els.shards.textContent = "◆ +" + opts.earnedShards + " shards";
      els.shards.style.opacity = 1;

      // Best line
      els.best.textContent =
        "Best: " + (meta.bestScore || 0).toLocaleString() +
        "  ·  Total: " + (meta.shards || 0).toLocaleString();

      // Double button state
      doubleUsed = false;
      doubleEarned = opts.earnedShards;
      els.doubleBtn.disabled = false;
      els.doubleBtn.textContent = "▶ Watch ad · ×2 shards";
      els.doubleBtn.style.display = opts.earnedShards > 0 ? "block" : "none";

      // Leaderboard
      renderLeaderboard();

      // Show
      els.root.classList.remove("hidden");
    },

    hide() {
      els.root.classList.add("hidden");
    },

    isVisible() {
      return !els.root.classList.contains("hidden");
    }
  };
}