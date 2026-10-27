// =============================================================
//  Prism Shift — ui/dom/shop.js
//  Full shop: 3 tabs (skins/perks/mods), item list, purchase.
//  Reads:  SHOP_ITEMS, PALETTES, ORB_SKINS from tuning
//  Calls back: onBuy(item), onEquip(item), onClose()
// =============================================================

import { SHOP_ITEMS, PALETTES, ORB_SKINS } from "../../core/tuning.js";
import { paintShieldPreview, paintOrbPreview } from "../../renderers/canvas2d/sprites.js";

export function createShop(opts) {
  const { meta, onBuy, onEquip, onClose } = opts;

  const els = {
    root: document.getElementById("shop"),
    shards: document.getElementById("shopShards"),
    tabs: document.getElementById("shopTabs"),
    list: document.getElementById("shopList"),
    close: document.getElementById("shopCloseBtn")
  };

  let currentTab = "skins";
  const TABS = [
    { id: "skins", label: "Skins" },
    { id: "perks", label: "Perks" },
    { id: "mods",  label: "Mods" }
  ];

  els.close.addEventListener("click", () => onClose());

  function renderTabs() {
    els.tabs.innerHTML = "";
    for (const t of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shopTab" + (currentTab === t.id ? " active" : "");
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        currentTab = t.id;
        renderTabs();
        renderList();
      });
      els.tabs.appendChild(btn);
    }
  }

  function makeRow(item) {
    const owned = !!meta.owned[item.id];
    let unlocked = true;
    if (item.unlockAt) {
      if (item.unlockAt.type === "score") {
        unlocked = meta.maxScoreSingleRun >= item.unlockAt.value;
      } else if (item.unlockAt.type === "runs") {
        unlocked = meta.runs >= item.unlockAt.value;
      }
    }
    const canAfford = (meta.shards || 0) >= item.price;

    const isEquipped =
      (item.sub === "shield" && meta.equipped.shield === item.preview) ||
      (item.sub === "orb" && meta.equipped.orb === item.preview);

    const row = document.createElement("div");
    row.className = "shopItem" +
      (owned ? " owned" : "") +
      (!unlocked ? " locked" : "");

    // Swatch
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    if (item.sub === "shield") {
      const pv = document.createElement("canvas");
      paintShieldPreview(pv, PALETTES[item.preview]);
      swatch.appendChild(pv);
    } else if (item.sub === "orb") {
      const ov = document.createElement("canvas");
      paintOrbPreview(ov, ORB_SKINS[item.preview]);
      swatch.appendChild(ov);
    } else if (item.cat === "perks") {
      swatch.textContent = "✦";
      swatch.style.color = "#9affc4";
      swatch.style.background = "rgba(154,255,196,0.08)";
    } else if (item.cat === "mods") {
      swatch.textContent = "⚔";
      swatch.style.color = "#ff8ad0";
      swatch.style.background = "rgba(255,138,208,0.08)";
    }
    row.appendChild(swatch);

    // Info
    const info = document.createElement("div");
    info.className = "info";
    const nameHtml = '<div class="name">' + item.name + '</div>';
    let descHtml = '<div class="desc">' + item.desc + '</div>';
    if (!unlocked) {
      const req = item.unlockAt.type === "score"
        ? "Score " + item.unlockAt.value.toLocaleString() + " in a single run"
        : "Play " + item.unlockAt.value + " runs";
      descHtml = '<div class="desc" style="color:#ff8ad0;">🔒 ' + req + '</div>';
    }
    info.innerHTML = nameHtml + descHtml;
    row.appendChild(info);

    // Action button
    const action = document.createElement("button");
    action.type = "button";
    action.className = "action";

    if (!unlocked) {
      action.classList.add("cant");
      action.textContent = "Locked";
    } else if (owned) {
      if (item.sub === "shield" || item.sub === "orb") {
        if (isEquipped) {
          action.classList.add("equipped");
          action.textContent = "Equipped";
        } else {
          action.classList.add("equip");
          action.textContent = "Equip";
          action.addEventListener("click", () => onEquip(item));
        }
      } else {
        action.classList.add("equipped");
        action.textContent = "Owned";
      }
    } else {
      if (item.price === 0) {
        action.classList.add("buy");
        action.textContent = "Free";
        action.addEventListener("click", () => onBuy(item));
      } else if (canAfford) {
        action.classList.add("buy");
        action.textContent = item.price;
        action.addEventListener("click", () => onBuy(item));
      } else {
        action.classList.add("cant");
        action.textContent = item.price + " ◆";
      }
    }
    row.appendChild(action);

    return row;
  }

  function renderList() {
    els.list.innerHTML = "";
    const items = SHOP_ITEMS.filter(it => it.cat === currentTab);
    for (const item of items) {
      els.list.appendChild(makeRow(item));
    }
  }

  return {
    open() {
      els.root.classList.remove("hidden");
      els.shards.textContent = (meta.shards || 0).toLocaleString();
      renderTabs();
      renderList();
    },

    close() {
      els.root.classList.add("hidden");
    },

    /** Re-render after a purchase or equip (caller updates meta first). */
    refresh() {
      els.shards.textContent = (meta.shards || 0).toLocaleString();
      renderList();
    }
  };
}