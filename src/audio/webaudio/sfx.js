// =============================================================
//  Prism Shift — audio/webaudio/sfx.js
//  The SFX table: what each game event sounds like.
//  Consumes engine.js. Exposes playEvent() for the adapter.
// =============================================================

import {
  playTone, playNoise, panFromAngle, noteFreq,
  PENTA, COLOR_SEMITONE, setMuted, isMuted
} from "./engine.js";

export { setMuted, isMuted };

const SFX = {
  block(combo, angle) {
    combo = combo || 0;
    const step = combo % 5;
    const oct = Math.floor(combo / 5);
    const freq = noteFreq(PENTA[step] + oct * 12 + 12);
    const pan = panFromAngle(angle);
    playTone(freq, 0.18, "sine", 0.10, freq * 1.4, { pan, reverbAmount: 0.6 });
    playNoise(0.035, 0.05, "bandpass", 4000, 6000, pan);
  },

  perfect() {
    playTone(1046, 0.09, "sine", 0.10, 1568, { reverbAmount: 0.7 });
    setTimeout(() => playTone(1318, 0.18, "triangle", 0.10, 2093, { reverbAmount: 0.9 }), 70);
  },

  whoosh() {
    playNoise(0.15, 0.05, "lowpass", 400, 200, 0);
  },

  boss() {
    playTone(110, 0.5, "sawtooth", 0.16, 116, { reverbAmount: 0.4 });
    setTimeout(() => playTone(220, 0.5, "square", 0.10, 233), 200);
  },

  bossPhase() {
    playTone(330, 0.2, "square", 0.10, 165);
    setTimeout(() => playTone(220, 0.3, "sawtooth", 0.10, 110), 120);
  },

  hit(angle) {
    playTone(180, 0.28, "sine", 0.16, 60, { pan: panFromAngle(angle), reverbAmount: 0.5 });
    playNoise(0.22, 0.14, "lowpass", 3000, 200, 0);
  },

  fire(colorName) {
    const semi = COLOR_SEMITONE[colorName] !== undefined ? COLOR_SEMITONE[colorName] : 0;
    const base = noteFreq(semi + 24);
    playTone(base, 0.10, "sine", 0.07, base * 0.6, { reverbAmount: 0.5 });
    playNoise(0.03, 0.05, "highpass", 1800, 0, 0);
  },

  miss() {
    playTone(220, 0.10, "square", 0.05, 140);
  },

  bubblePop(angle) {
    playTone(880, 0.08, "sine", 0.07, 1320, { pan: panFromAngle(angle), reverbAmount: 0.6 });
    playNoise(0.05, 0.03, "bandpass", 2400, 3200, panFromAngle(angle));
  },

  bubbleWrong() {
    playTone(300, 0.10, "triangle", 0.05, 180);
  },

  powerup() {
    playTone(520, 0.18, "sine", 0.10, 1040, { reverbAmount: 0.8 });
    playNoise(0.12, 0.04, "bandpass", 3000, 6000, 0);
  },

  death() {
    playTone(320, 0.5, "sawtooth", 0.18, 40, { reverbAmount: 0.8 });
    playNoise(0.4, 0.10, "lowpass", 2000, 100, 0);
  },

  milestone() {
    playTone(440, 0.22, "triangle", 0.10, 880, { reverbAmount: 0.9 });
    setTimeout(() => playTone(1760, 0.25, "sine", 0.08, 1760), 120);
  },

  pick() {
    playTone(523, 0.10, "triangle", 0.10, 784, { reverbAmount: 0.7 });
    setTimeout(() => playTone(784, 0.14, "triangle", 0.10, 1046, { reverbAmount: 0.8 }), 90);
  },

  buy() {
    playTone(660, 0.10, "triangle", 0.10, 880, { reverbAmount: 0.7 });
    setTimeout(() => playTone(880, 0.12, "triangle", 0.10, 1320), 80);
    setTimeout(() => playTone(1320, 0.18, "sine", 0.10, 1760, { reverbAmount: 0.9 }), 160);
  },

  deny() {
    playTone(220, 0.12, "square", 0.06, 110);
  },

  shard() {
    playTone(1046, 0.10, "sine", 0.07, 1568, { reverbAmount: 0.8 });
  },

  near(angle) {
    playTone(1320, 0.05, "sine", 0.03, 1760, { pan: panFromAngle(angle), reverbAmount: 0.3 });
  },

  dominant() {
    playTone(440, 0.20, "triangle", 0.12, 660, { reverbAmount: 0.6 });
    setTimeout(() => playTone(660, 0.25, "triangle", 0.12, 880, { reverbAmount: 0.7 }), 100);
    playTone(55, 0.35, "sine", 0.10);
  },

  riser() {
    playTone(70, 0.9, "sine", 0.10, 180, { reverbAmount: 0.5 });
    playTone(140, 0.9, "sawtooth", 0.03, 360);
  },

  purge() {
    playTone(330, 0.3, "sawtooth", 0.14, 990, { reverbAmount: 0.6 });
    setTimeout(() => playTone(660, 0.3, "triangle", 0.12, 1320, { reverbAmount: 0.8 }), 140);
  },

  adrenaline() {
    playTone(220, 0.4, "sine", 0.14, 440, { reverbAmount: 0.7 });
    setTimeout(() => playTone(70, 0.15, "sine", 0.16, 45), 0);
    setTimeout(() => playTone(330, 0.5, "triangle", 0.14, 660, { reverbAmount: 0.8 }), 180);
    setTimeout(() => playTone(65, 0.15, "sine", 0.14, 42), 380);
  }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — event dispatch
// ─────────────────────────────────────────────────────────────

/**
 * Dispatch a single event returned by simulation.tick().
 * Also handles a few event types that aren't SFX (vibrate) so the
 * adapter only needs one dispatch function.
 *
 * @param {object} event - { type, name?, angle?, combo?, pattern?, colorName? }
 */
export function playEvent(event) {
  if (!event) return;

  if (event.type === "sfx") {
    const fn = SFX[event.name];
    if (!fn) return;
    switch (event.name) {
      case "block":        fn(event.combo, event.angle); break;
      case "hit":          fn(event.angle); break;
      case "fire":         fn(event.colorName); break;
      case "near":         fn(event.angle); break;
      case "bubblePop":    fn(event.angle); break;
      case "bubbleWrong":  fn(); break;
      default:             fn(); break;
    }
  } else if (event.type === "vibrate") {
    if ("vibrate" in navigator) {
      try { navigator.vibrate(event.pattern); } catch (e) {}
    }
  }
}

/**
 * Dispatch a batch of events. Convenience for adapters that get
 * an events array from tick().
 */
export function playEvents(events) {
  if (!events) return;
  for (let i = 0; i < events.length; i++) playEvent(events[i]);
}

/**
 * The heartbeat sound plays when lives === 1. The adapter calls
 * this once per frame with dt; the timer is internal to this module.
 */
let heartbeatTimer = 0;
export function tickHeartbeat(dt, lives, mode) {
  if (lives > 1 || mode !== "playing" || isMuted()) return;
  heartbeatTimer -= dt;
  if (heartbeatTimer <= 0) {
    playTone(70, 0.12, "sine", 0.14, 50, { reverbAmount: 0.3 });
    setTimeout(() => playTone(60, 0.14, "sine", 0.10, 45, { reverbAmount: 0.3 }), 130);
    heartbeatTimer = 1.0;
  }
}