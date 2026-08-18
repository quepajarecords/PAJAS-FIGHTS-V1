// ============================================================
// PAJAS FIGHTER — audio procedural (WebAudio, sin assets)
// ============================================================

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  try {
    if (!ac) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.02);
}
export function isMuted() { return muted; }

type Wave = OscillatorType;

function tone(wave: Wave, f0: number, f1: number, dur: number, vol: number, when = 0) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, q = 1, when = 0) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

export const sfx = {
  unlock() { ensure(); },
  hit(power = 1) {
    noise(0.09, 0.5, 1600, 0.8);
    tone('square', 240 * power, 70, 0.12, 0.32);
    tone('sawtooth', 120, 45, 0.16, 0.2);
  },
  heavy() {
    noise(0.16, 0.6, 900, 0.7);
    tone('square', 160, 38, 0.22, 0.4);
    noise(0.3, 0.25, 300, 0.6, 0.03);
  },
  block() {
    tone('triangle', 900, 320, 0.07, 0.25);
    noise(0.05, 0.18, 4200, 2);
  },
  whiff() { noise(0.07, 0.12, 2600, 1.4); },
  jump() { tone('square', 180, 520, 0.14, 0.14); },
  land() { noise(0.06, 0.18, 500, 0.8); },
  charge() { tone('sawtooth', 70, 420, 0.34, 0.16); noise(0.3, 0.08, 900, 2); },
  fire() {
    tone('sawtooth', 280, 980, 0.18, 0.24);
    noise(0.22, 0.2, 2400, 1);
    tone('square', 140, 60, 0.25, 0.18);
  },
  projectileHit() {
    noise(0.2, 0.45, 1200, 0.8);
    tone('sawtooth', 500, 60, 0.28, 0.3);
  },
  ko() {
    noise(0.45, 0.6, 350, 0.6);
    tone('square', 200, 30, 0.6, 0.42);
    tone('sawtooth', 90, 24, 0.7, 0.3, 0.05);
  },
  select() { tone('square', 620, 620, 0.06, 0.16); tone('square', 930, 930, 0.07, 0.14, 0.06); },
  back() { tone('square', 400, 220, 0.09, 0.14); },
  start() {
    const n = [262, 330, 392, 523];
    n.forEach((f, i) => tone('square', f, f, 0.1, 0.16, i * 0.08));
  },
  win() {
    const n = [392, 523, 659, 784, 1046];
    n.forEach((f, i) => tone('square', f, f, 0.12, 0.15, i * 0.1));
  },
  tick() { tone('square', 880, 880, 0.04, 0.08); },
  denied() { tone('square', 160, 120, 0.12, 0.16); },
};

// ------------------------------------------------------------
// Música chip-tune minimalista (secuenciador con lookahead)
// ------------------------------------------------------------
let musicTimer: number | null = null;
let musicStep = 0;
let musicNext = 0;
let musicKind: 'title' | 'fight' | null = null;

const FIGHT_BASS = [55, 55, 0, 55, 65.4, 0, 55, 49, 55, 55, 0, 55, 73.4, 65.4, 58.3, 49];
const TITLE_ARP = [220, 261.6, 329.6, 392, 329.6, 261.6, 174.6, 196];

function scheduleStep(step: number, time: number, kind: 'title' | 'fight') {
  if (!ac || !master) return;
  const at = time - ac.currentTime;
  if (kind === 'fight') {
    const f = FIGHT_BASS[step % FIGHT_BASS.length];
    if (f > 0) tone('square', f, f, 0.11, 0.1, at);
    if (step % 2 === 0) noise(0.03, 0.05, 7000, 1, at);
    if (step % 8 === 4) noise(0.08, 0.1, 220, 0.8, at);
    if (step % 16 === 0) tone('sawtooth', 110, 110, 0.4, 0.05, at);
  } else {
    const f = TITLE_ARP[step % TITLE_ARP.length];
    tone('triangle', f, f, 0.22, 0.09, at);
    if (step % 4 === 0) tone('sine', f / 2, f / 2, 0.5, 0.07, at);
  }
}

export function startMusic(kind: 'title' | 'fight') {
  const c = ensure(); if (!c) return;
  stopMusic();
  musicKind = kind;
  musicStep = 0;
  musicNext = c.currentTime + 0.1;
  const stepDur = kind === 'fight' ? 0.135 : 0.24;
  musicTimer = window.setInterval(() => {
    if (!ac || musicKind !== kind) return;
    while (musicNext < ac.currentTime + 0.25) {
      scheduleStep(musicStep, musicNext, kind);
      musicStep++;
      musicNext += stepDur;
    }
  }, 60);
}

export function stopMusic() {
  if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
  musicKind = null;
}
