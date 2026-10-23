// Fila de rolagens para o aviso grande na tela de todos.
export type BurstRoll = {
  name: string;
  label: string;
  die1: number;
  die2: number;
  modifier: number;
  total: number;
  difficulty: number | null;
  outcome: string;
};

type Listener = (rolls: BurstRoll[]) => void;
const listeners = new Set<Listener>();
let batch: BurstRoll[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Rolagens que chegam juntas (teste em grupo, iniciativa) aparecem num aviso só. */
export function emitRoll(r: BurstRoll) {
  batch.push(r);
  if (timer) return;
  timer = setTimeout(() => {
    const out = batch;
    batch = [];
    timer = undefined;
    for (const l of listeners) l(out);
  }, 350);
}

export function onRolls(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const SOUND_KEY = "fungo-disco-sound";
export const soundEnabled = () =>
  typeof localStorage === "undefined" || localStorage.getItem(SOUND_KEY) !== "off";
export const setSoundEnabled = (on: boolean) => localStorage.setItem(SOUND_KEY, on ? "on" : "off");

/** Barulho curto de dados batendo na mesa (sintetizado, sem arquivo). */
export function playDiceSound(dramatic: boolean) {
  if (!soundEnabled()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const hit = (at: number, gain: number) => {
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(ctx.destination);
      src.start(ctx.currentTime + at);
    };
    [0, 0.12, 0.2, 0.31, 0.38].forEach((t, i) => hit(t, 0.5 - i * 0.07));
    if (dramatic) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(110, ctx.currentTime + 0.65);
      o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.4);
      g.gain.setValueAtTime(0.25, ctx.currentTime + 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + 0.65);
      o.stop(ctx.currentTime + 1.5);
    }
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    /* sem som */
  }
}
