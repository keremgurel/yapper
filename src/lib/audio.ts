let ctx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playLuxuryDetent(value: number, min = 30, max = 120) {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const norm = (value - min) / (max - min);

    // Primary detent: short dense thud
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1800 + norm * 400, t);
    osc1.frequency.exponentialRampToValueAtTime(600, t + 0.02);
    gain1.gain.setValueAtTime(0.09, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc1.connect(gain1).connect(ac.destination);
    osc1.start(t);
    osc1.stop(t + 0.04);

    // Body resonance
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 120 + norm * 30;
    gain2.gain.setValueAtTime(0.06, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc2.connect(gain2).connect(ac.destination);
    osc2.start(t);
    osc2.stop(t + 0.06);

    // Metallic ring
    const osc3 = ac.createOscillator();
    const gain3 = ac.createGain();
    osc3.type = "sine";
    osc3.frequency.value = 4200 + norm * 800;
    gain3.gain.setValueAtTime(0.012, t + 0.005);
    gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc3.connect(gain3).connect(ac.destination);
    osc3.start(t + 0.005);
    osc3.stop(t + 0.05);
  } catch {
    // Audio not available
  }
}

export function playSlotTick(pitch = 800) {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  } catch {
    // Audio not available
  }
}

export function playSlotSpin() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.6);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  } catch {
    // Audio not available
  }
}

export function playSlotLand() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    // Heavy clunk
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(150, t);
    osc1.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.connect(gain1).connect(ac.destination);
    osc1.start(t);
    osc1.stop(t + 0.15);
    // Winning chime
    [660, 880, 1100].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, t + 0.08 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 + i * 0.08 + 0.4);
      osc.connect(gain).connect(ac.destination);
      osc.start(t + 0.08 + i * 0.08);
      osc.stop(t + 0.08 + i * 0.08 + 0.4);
    });
  } catch {
    // Audio not available
  }
}

export function playLeverCreak() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.12);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch {
    // Audio not available
  }
}

export function playTimerEnd() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    [392, 523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.6);
      osc.connect(gain).connect(ac.destination);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.6);
    });
  } catch {
    // Audio not available
  }
}
