// =============================================================
//  Prism Shift — ui/dom/upgrades.js
//  Compact, non-interactive collection of run upgrades.
// =============================================================

import { RARITY_COLOR, UPGRADES } from "../../core/tuning.js";
import { paintIcon } from "../../renderers/canvas2d/sprites.js";

export function createUpgradeCollection() {
  const root = document.getElementById("upgradeCollection");
  let lastCollection = "";

  return {
    update(runUpgrades) {
      const counts = new Map();
      for (const id of runUpgrades) counts.set(id, (counts.get(id) || 0) + 1);

      const upgrades = UPGRADES.filter(upgrade => counts.has(upgrade.id));
      const signature = upgrades.map(upgrade => upgrade.id + ":" + counts.get(upgrade.id)).join("|");
      if (signature === lastCollection) return;
      lastCollection = signature;

      root.replaceChildren();
      root.hidden = upgrades.length === 0;
      for (const upgrade of upgrades) {
        const count = counts.get(upgrade.id);
        const tile = document.createElement("div");
        tile.className = "upgradeIcon";
        tile.setAttribute("role", "img");
        tile.setAttribute("aria-label", upgrade.name + ", applied " + count + (count === 1 ? " time" : " times"));

        const icon = document.createElement("canvas");
        paintIcon(icon, upgrade.icon, RARITY_COLOR[upgrade.rarity] || "#9affc4");
        icon.setAttribute("aria-hidden", "true");
        tile.appendChild(icon);

        const badge = document.createElement("span");
        badge.className = "upgradeCount";
        badge.textContent = String(count);
        badge.setAttribute("aria-hidden", "true");
        tile.appendChild(badge);
        root.appendChild(tile);
      }
    }
  };
}
