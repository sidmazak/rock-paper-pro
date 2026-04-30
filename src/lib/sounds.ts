// Lightweight WebAudio sound engine — no external assets.
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const w = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
};

function playTone(t: Tone) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + (t.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = t.type ?? "sine";
  osc.frequency.setValueAtTime(t.freq, now);
  if (t.slideTo)
    osc.frequency.exponentialRampToValueAtTime(t.slideTo, now + t.duration);
  const peak = t.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t.duration);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + t.duration + 0.05);
}

export const sfx = {
  tick: () =>
    playTone({ freq: 660, duration: 0.08, type: "square", gain: 0.08 }),
  go: () => {
    playTone({ freq: 880, duration: 0.18, type: "triangle", gain: 0.12 });
    playTone({
      freq: 1320,
      duration: 0.18,
      type: "sine",
      gain: 0.08,
      delay: 0.05,
    });
  },
  click: () =>
    playTone({ freq: 520, duration: 0.06, type: "triangle", gain: 0.1 }),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      playTone({
        freq: f,
        duration: 0.18,
        type: "triangle",
        gain: 0.12,
        delay: i * 0.07,
      }),
    );
  },
  lose: () => {
    playTone({
      freq: 300,
      duration: 0.25,
      slideTo: 120,
      type: "sawtooth",
      gain: 0.1,
    });
  },
  draw: () => {
    playTone({ freq: 440, duration: 0.12, type: "sine", gain: 0.1 });
    playTone({
      freq: 440,
      duration: 0.12,
      type: "sine",
      gain: 0.1,
      delay: 0.15,
    });
  },
  miss: () => {
    playTone({
      freq: 200,
      duration: 0.18,
      slideTo: 90,
      type: "square",
      gain: 0.1,
    });
  },
};

// Resume audio on first user interaction (browsers require gesture).
export function primeAudio() {
  getCtx();
}
