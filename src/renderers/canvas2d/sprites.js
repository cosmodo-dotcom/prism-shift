// =============================================================
//  Prism Shift — renderers/canvas2d/sprites.js
//  Small canvas painters for shop previews and upgrade icons.
//  All pure: draw into a canvas, return nothing.
// =============================================================

// ─────────────────────────────────────────────────────────────
// ICONS
// 18 small 36x36 SVG-ish line-art icons drawn with canvas primitives.
//  Used in the upgrade inventory and summary.
// ─────────────────────────────────────────────────────────────

const ICONS = {
  split: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c;
    g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(6, 18); g.lineTo(30, 6); g.stroke();
    g.beginPath(); g.moveTo(6, 18); g.lineTo(30, 18); g.stroke();
    g.beginPath(); g.moveTo(6, 18); g.lineTo(30, 30); g.stroke();
    function head(x, y, ang) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-5, -3); g.lineTo(-5, 3);
      g.closePath(); g.fill();
      g.restore();
    }
    head(30, 6, -0.4); head(30, 18, 0); head(30, 30, 0.4);
  },
  mag: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c;
    g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round";
    g.strokeRect(10, 6, 16, 26);
    g.fillRect(13, 10, 3, 8);
    g.fillRect(20, 10, 3, 8);
    g.clearRect(16, 28, 4, 4);
    g.strokeRect(16, 28, 4, 4);
  },
  reload: function (g, c) {
    g.strokeStyle = c; g.lineWidth = 2.4; g.lineCap = "round";
    g.beginPath();
    g.arc(18, 18, 10, -0.3, Math.PI * 1.55);
    g.stroke();
    g.beginPath();
    g.moveTo(24, 6); g.lineTo(30, 12); g.lineTo(24, 16);
    g.stroke();
  },
  score: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(18, 4); g.lineTo(32, 18); g.lineTo(18, 32); g.lineTo(4, 18);
    g.closePath(); g.stroke();
    g.beginPath();
    g.moveTo(18, 11); g.lineTo(25, 18); g.lineTo(18, 25); g.lineTo(11, 18);
    g.closePath(); g.fill();
  },
  near: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.arc(18, 18, 12, -1.1, 0.2); g.stroke();
    g.beginPath(); g.arc(18, 18, 7, -0.9, 0.1); g.stroke();
    g.beginPath(); g.arc(26, 12, 2.2, 0, Math.PI * 2); g.fill();
  },
  vital: function (g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(18, 30);
    g.bezierCurveTo(4, 20, 4, 8, 12, 8);
    g.bezierCurveTo(16, 8, 18, 12, 18, 14);
    g.bezierCurveTo(18, 12, 20, 8, 24, 8);
    g.bezierCurveTo(32, 8, 32, 20, 18, 30);
    g.closePath(); g.fill();
  },
  ricochet: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    g.moveTo(4, 28); g.lineTo(14, 14); g.lineTo(22, 22); g.lineTo(32, 8);
    g.stroke();
    g.beginPath(); g.moveTo(0, 6); g.lineTo(36, 6); g.stroke();
    g.beginPath(); g.moveTo(30, 8); g.lineTo(32, 8); g.lineTo(32, 10); g.fill();
  },
  chain: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c;
    g.lineWidth = 2; g.lineCap = "round";
    const cx = 18, cy = 18;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
      g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
  },
  auto: function (g, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(20, 3); g.lineTo(8, 20); g.lineTo(16, 20);
    g.lineTo(14, 33); g.lineTo(28, 15); g.lineTo(20, 15);
    g.closePath(); g.fill();
  },
  immunity: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(18, 4); g.lineTo(30, 9);
    g.lineTo(30, 18);
    g.quadraticCurveTo(30, 28, 18, 32);
    g.quadraticCurveTo(6, 28, 6, 18);
    g.lineTo(6, 9); g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(12, 18); g.lineTo(17, 23); g.lineTo(25, 13);
    g.stroke();
  },
  prismdrop: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(18, 4); g.lineTo(28, 10); g.lineTo(28, 22);
    g.lineTo(18, 30); g.lineTo(8, 22); g.lineTo(8, 10);
    g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(18, 4); g.lineTo(18, 30); g.stroke();
    g.beginPath(); g.moveTo(8, 10); g.lineTo(28, 22); g.stroke();
    g.beginPath(); g.moveTo(28, 10); g.lineTo(8, 22); g.stroke();
  },
  chroma: function (g, c) {
    g.strokeStyle = c; g.lineWidth = 2;
    g.beginPath(); g.arc(18, 18, 12, -Math.PI * 0.9, -Math.PI * 0.1); g.stroke();
    g.beginPath(); g.arc(18, 18, 12, -Math.PI * 0.05, Math.PI * 0.45); g.stroke();
    g.beginPath(); g.arc(18, 18, 12, Math.PI * 0.55, Math.PI * 0.95); g.stroke();
    g.beginPath(); g.arc(18, 18, 7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = c;
    g.beginPath(); g.arc(18, 5, 2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(30, 22, 2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(6, 22, 2, 0, Math.PI * 2); g.fill();
  },
  slowmo: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath();
    g.moveTo(9, 5); g.lineTo(27, 5);
    g.lineTo(18, 18);
    g.lineTo(27, 31); g.lineTo(9, 31);
    g.lineTo(18, 18); g.closePath(); g.stroke();
    g.beginPath();
    g.moveTo(12, 8); g.lineTo(24, 8); g.lineTo(18, 15); g.closePath(); g.fill();
  },
  chain3: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round";
    const cx = 18, cy = 18;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      g.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
      g.stroke();
    }
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + k * Math.PI / 5;
      const r = (k % 2 === 0) ? 5 : 2;
      if (k === 0) g.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      else g.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }
    g.closePath(); g.fill();
  },
  glass: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath();
    g.moveTo(18, 5); g.lineTo(31, 28); g.lineTo(5, 28); g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(18, 5); g.lineTo(16, 16); g.lineTo(22, 18); g.lineTo(18, 28);
    g.stroke();
    g.globalAlpha = 0.5;
    g.beginPath(); g.moveTo(14, 20); g.lineTo(12, 26); g.stroke();
    g.globalAlpha = 1;
  },
  storm: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round";
    const cx = 18, cy = 18;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r1 = (i % 2 === 0) ? 4 : 2;
      const r2 = (i % 2 === 0) ? 14 : 9;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
  },
  echo: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.arc(18, 18, 13, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(18, 18, 8, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(18, 18, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(18, 5, 2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(31, 18, 2, 0, Math.PI * 2); g.fill();
  },
  singularity: function (g, c) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
    g.beginPath();
    g.arc(18, 18, 12, 0, Math.PI * 1.4);
    g.stroke();
    g.beginPath();
    g.arc(18, 18, 8, Math.PI, Math.PI * 2.5);
    g.stroke();
    g.beginPath();
    g.arc(18, 18, 4, 0, Math.PI * 1.6);
    g.stroke();
    g.beginPath(); g.arc(18, 18, 2.2, 0, Math.PI * 2); g.fill();
  }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — paint an upgrade icon
// ─────────────────────────────────────────────────────────────

/**
 * Paint an upgrade icon onto a canvas.
 * @param {HTMLCanvasElement} canvasEl - the target canvas
 * @param {string} id                  - the upgrade's `icon` field
 * @param {string} color               - the stroke color (rarity color)
 */
export function paintIcon(canvasEl, id, color) {
  const cssW = 36, cssH = 36;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width = cssW * dpr;
  canvasEl.height = cssH * dpr;
  const g = canvasEl.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);

  const drawFn = ICONS[id];
  if (!drawFn) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(18, 18, 8, 0, Math.PI * 2);
    g.fill();
    return;
  }
  drawFn(g, color);
}

// ─────────────────────────────────────────────────────────────
// PUBLIC — paint a shield skin preview
// ─────────────────────────────────────────────────────────────

/**
 * Paint a 4-arc shield preview onto a canvas.
 * @param {HTMLCanvasElement} canvasEl
 * @param {Array<{hex:string}>} palette - the palette to draw (4 colors)
 */
export function paintShieldPreview(canvasEl, palette) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const S = 42;
  canvasEl.width = S * dpr;
  canvasEl.height = S * dpr;
  const g = canvasEl.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2;
  const R = S * 0.36;
  const arc = Math.PI * 2 / 4;
  for (let i = 0; i < 4; i++) {
    const a0 = i * arc;
    g.beginPath();
    g.arc(cx, cy, R, a0 + 0.04, a0 + arc - 0.04);
    g.lineWidth = 5;
    g.strokeStyle = palette[i].hex;
    g.shadowColor = palette[i].hex;
    g.shadowBlur = 6;
    g.lineCap = "round";
    g.stroke();
  }
  g.shadowBlur = 0;

  // Center orb
  g.beginPath();
  g.arc(cx, cy, R * 0.4, 0, Math.PI * 2);
  const og = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, R * 0.4);
  og.addColorStop(0, "#fff");
  og.addColorStop(1, palette[0].hex);
  g.fillStyle = og;
  g.fill();
}

// ─────────────────────────────────────────────────────────────
// PUBLIC — paint an orb skin preview
// ─────────────────────────────────────────────────────────────

/**
 * Paint a small orb swatch.
 * @param {HTMLCanvasElement} canvasEl
 * @param {{inner:string, mid:string, outer:string, core:string}} skin
 */
export function paintOrbPreview(canvasEl, skin) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const S = 42;
  canvasEl.width = S * dpr;
  canvasEl.height = S * dpr;
  const g = canvasEl.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2, R = S * 0.34;
  const og = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
  og.addColorStop(0, skin.inner);
  og.addColorStop(0.3, skin.mid);
  og.addColorStop(0.65, skin.outer);
  og.addColorStop(1, skin.core);
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = og;
  g.fill();

  // Specular
  g.beginPath();
  g.arc(cx - R * 0.35, cy - R * 0.35, R * 0.22, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fill();
}