// =============================================================
//  Prism Shift — audio/webaudio/engine.js
//  Low-level WebAudio plumbing. No knowledge of game events.
//  Provides: ensureAudio, playTone, playNoise, panFromAngle,
//  noteFreq, setMuted/isMuted.
// =============================================================

let audioCtx = null;
let audioMaster = null;
let audioReverb = null;
let audioReverbSend = null;
let muted = false;

// Exposed for sfx.js to compute note frequency
export const PENTA = [0, 3, 5, 7, 10];
export const COLOR_SEMITONE = { RED: 0, BLUE: 3, GREEN: 7, YELLOW: 10 };

export function noteFreq(semitoneFromA3) {
  return 220 * Math.pow(2, semitoneFromA3 / 12);
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

// ─────────────────────────────────────────────────────────────
// Context + reverb
// ─────────────────────────────────────────────────────────────

function makeReverbImpulse(ac, seconds, decay) {
  const rate = ac.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function ensureAudio() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();

    audioMaster = audioCtx.createGain();
    audioMaster.gain.value = 0.9;
    audioMaster.connect(audioCtx.destination);

    audioReverb = audioCtx.createConvolver();
    audioReverb.buffer = makeReverbImpulse(audioCtx, 0.6, 3.2);
    audioReverbSend = audioCtx.createGain();
    audioReverbSend.gain.value = 0.16;
    audioReverbSend.connect(audioReverb);
    audioReverb.connect(audioMaster);
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

// ─────────────────────────────────────────────────────────────
// Core emitters
// ─────────────────────────────────────────────────────────────

/**
 * Play a single oscillator note.
 * @param {number} freq    - start frequency in Hz
 * @param {number} dur     - duration in seconds
 * @param {string} type    - 'sine'|'sawtooth'|'square'|'triangle'
 * @param {number} gainPeak- peak volume (0..1)
 * @param {number} [slideTo] - if given, exponential pitch glide target
 * @param {object} [opts]  - { pan, reverb, reverbAmount }
 */
export function playTone(freq, dur, type, gainPeak, slideTo, opts) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  opts = opts || {};
  try {
    if (ac.state === "suspended") ac.resume();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const panner = ac.createStereoPanner ? ac.createStereoPanner() : null;

    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, slideTo),
        ac.currentTime + dur
      );
    }
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak || 0.12, ac.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

    let tail = gain;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan || 0));
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(audioMaster);

    if (opts.reverb !== false) {
      const send = ac.createGain();
      send.gain.value = opts.reverbAmount !== undefined ? opts.reverbAmount : 0.5;
      tail.connect(send);
      send.connect(audioReverbSend);
    }

    osc.connect(gain);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  } catch (e) {}
}

/**
 * Play a filtered noise burst.
 * @param {number} dur
 * @param {number} gainPeak
 * @param {string} filterType - 'lowpass'|'highpass'|'bandpass'
 * @param {number} freq       - filter cutoff at start
 * @param {number} [slideTo]  - cutoff glide target
 * @param {number} [pan]
 */
export function playNoise(dur, gainPeak, filterType, freq, slideTo, pan) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = ac.createBufferSource();
    src.buffer = buf;

    const filt = ac.createBiquadFilter();
    filt.type = filterType || "bandpass";
    filt.frequency.setValueAtTime(freq || 1000, ac.currentTime);
    filt.Q.value = 1.2;
    if (slideTo) {
      filt.frequency.exponentialRampToValueAtTime(
        Math.max(20, slideTo),
        ac.currentTime + dur
      );
    }

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak || 0.1, ac.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

    const panner = ac.createStereoPanner ? ac.createStereoPanner() : null;
    src.connect(filt);
    filt.connect(gain);
    let tail = gain;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(audioMaster);

    const send = ac.createGain();
    send.gain.value = 0.3;
    tail.connect(send);
    send.connect(audioReverbSend);

    src.start();
    src.stop(ac.currentTime + dur + 0.02);
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Stereo helper
// ─────────────────────────────────────────────────────────────

export function panFromAngle(angle) {
  if (typeof angle !== "number") return 0;
  return Math.max(-0.8, Math.min(0.8, Math.cos(angle)));
}