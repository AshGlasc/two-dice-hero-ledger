/**
 * Engine de Áudio do Eco dos Caídos.
 * Sons sintetizados via Web Audio API (sem dependência de assets externos que possam falhar)
 * e player HTML5 para trilhas sonoras pré-salvas pelo mestre.
 */

type AudioPrefs = {
  muted: boolean;
  volume: number; // 0.0 a 1.0
};

const PREFS_KEY = "eco_caidos_audio_prefs";

let prefs: AudioPrefs = {
  muted: false,
  volume: 0.7,
};

// Carrega preferências locais do jogador
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.muted === "boolean") prefs.muted = parsed.muted;
      if (typeof parsed.volume === "number") prefs.volume = Math.max(0, Math.min(1, parsed.volume));
    }
  } catch {}
}

const listeners = new Set<(p: AudioPrefs) => void>();
function notify() {
  listeners.forEach((l) => l(prefs));
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }
}

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/* ==========================================================================
   SONS DE AÇÃO
   ========================================================================== */

export function playActionSound(type: "dice" | "critical" | "hit" | "turn") {
  if (prefs.muted || prefs.volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(prefs.volume, now);
  masterGain.connect(ctx.destination);

  switch (type) {
    case "dice": {
      // 3 batidas rápidas imitando dados rolando e assentando
      [0, 0.08, 0.17].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(140 + i * 40, now + delay);
        osc.frequency.exponentialRampToValueAtTime(80, now + delay + 0.06);

        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.25 - i * 0.05, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });
      break;
    }

    case "critical": {
      // Brilho metálico estrondoso e harmônico decisivo
      const freqs = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.8);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.25);
      });
      break;
    }

    case "hit": {
      // Impacto pesado / abafado
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.42);
      break;
    }

    case "turn": {
      // Bipe tático duplo de notificação de turno
      [0, 0.15].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(idx === 0 ? 880 : 1320, now + delay);

        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.16, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.14);
      });
      break;
    }
  }
}

/* ==========================================================================
   AMBIÊNCIAS PROCEDURAIS EM LOOP
   ========================================================================== */

export type AmbienceType = "none" | "rain" | "wind" | "fire" | "electricity";

let activeAmbienceType: AmbienceType = "none";
let ambienceGainNode: GainNode | null = null;
let ambienceSources: { stop: () => void }[] = [];

export function setAmbience(type: AmbienceType, level = 0.5) {
  if (activeAmbienceType === type && ambienceGainNode) {
    const ctx = getAudioContext();
    if (ctx) {
      const vol = prefs.muted ? 0 : prefs.volume * level;
      ambienceGainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    }
    return;
  }

  // Para ambiente anterior
  ambienceSources.forEach((s) => {
    try {
      s.stop();
    } catch {}
  });
  ambienceSources = [];
  activeAmbienceType = type;

  if (type === "none") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const mainGain = ctx.createGain();
  const effectiveVol = prefs.muted ? 0 : prefs.volume * level;
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.linearRampToValueAtTime(effectiveVol, now + 0.5);
  mainGain.connect(ctx.destination);
  ambienceGainNode = mainGain;

  // Gerador de Ruído Branco
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  switch (type) {
    case "rain": {
      // Chuva: filtro passa-baixa e passa-banda constante
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1000, now);
      filter.Q.setValueAtTime(0.7, now);

      whiteNoise.connect(filter);
      filter.connect(mainGain);
      whiteNoise.start(now);
      ambienceSources.push(whiteNoise);
      break;
    }

    case "wind": {
      // Vento: filtro passa-baixa modulado lentamente por LFO
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      filter.Q.setValueAtTime(3.0, now);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.2, now);
      lfoGain.gain.setValueAtTime(250, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      whiteNoise.connect(filter);
      filter.connect(mainGain);
      whiteNoise.start(now);
      lfo.start(now);
      ambienceSources.push(whiteNoise, lfo);
      break;
    }

    case "fire": {
      // Fogo crepitante: passa-baixa + ressonância baixa
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);

      whiteNoise.connect(filter);
      filter.connect(mainGain);
      whiteNoise.start(now);
      ambienceSources.push(whiteNoise);
      break;
    }

    case "electricity": {
      // Eletricidade: zumbido de 60Hz + harmônicos
      const hum = ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.setValueAtTime(60, now);

      const humFilter = ctx.createBiquadFilter();
      humFilter.type = "bandpass";
      humFilter.frequency.setValueAtTime(180, now);

      hum.connect(humFilter);
      humFilter.connect(mainGain);
      hum.start(now);
      ambienceSources.push(hum);
      break;
    }
  }
}

/* ==========================================================================
   TRILHAS PRÉ-SALVAS VIA HTML5 AUDIO
   ========================================================================== */

let bgAudio: HTMLAudioElement | null = null;
let currentTrackUrl = "";

export function syncBackgroundMusic(url: string, playing: boolean, level = 0.5) {
  if (typeof window === "undefined") return;

  if (!bgAudio) {
    bgAudio = new Audio();
    bgAudio.loop = true;
    bgAudio.crossOrigin = "anonymous";
  }

  const effectiveVol = prefs.muted ? 0 : prefs.volume * level;
  bgAudio.volume = effectiveVol;

  if (!playing || !url) {
    if (!bgAudio.paused) bgAudio.pause();
    return;
  }

  if (currentTrackUrl !== url) {
    currentTrackUrl = url;
    bgAudio.src = url;
  }

  if (playing && bgAudio.paused) {
    bgAudio.play().catch(() => {
      // Autoplay bloqueado até interação
    });
  }
}

/* ==========================================================================
   CONTROLES DO USUÁRIO
   ========================================================================== */

export function setMuted(muted: boolean) {
  prefs.muted = muted;
  notify();
  if (ambienceGainNode && audioCtx) {
    ambienceGainNode.gain.setTargetAtTime(muted ? 0 : prefs.volume, audioCtx.currentTime, 0.1);
  }
  if (bgAudio) {
    bgAudio.volume = muted ? 0 : prefs.volume;
  }
}

export function setVolume(volume: number) {
  prefs.volume = Math.max(0, Math.min(1, volume));
  notify();
  if (ambienceGainNode && audioCtx && !prefs.muted) {
    ambienceGainNode.gain.setTargetAtTime(prefs.volume, audioCtx.currentTime, 0.1);
  }
  if (bgAudio && !prefs.muted) {
    bgAudio.volume = prefs.volume;
  }
}

export function getAudioPrefs(): AudioPrefs {
  return { ...prefs };
}

export function subscribeAudioPrefs(callback: (p: AudioPrefs) => void) {
  listeners.add(callback);
  callback(prefs);
  return () => {
    listeners.delete(callback);
  };
}

