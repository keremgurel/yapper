let ctx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// Generate a short burst of filtered noise (used for ASMR texture)
function noiseBlip(
  ac: AudioContext,
  t: number,
  duration: number,
  freq: number,
  q: number,
  volume: number,
  type: BiquadFilterType = "bandpass"
) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + duration);
}

// ASMR keyboard-switch click for the rotary knob
export function playLuxuryDetent(value: number, min = 30, max = 120) {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const norm = (value - min) / (max - min);

    // Crispy top-end click — like a Cherry MX switch bottoming out
    noiseBlip(ac, t, 0.012, 4000 + norm * 1500, 3, 0.13);

    // Soft tactile thock body
    noiseBlip(ac, t + 0.001, 0.025, 300 + norm * 80, 1.5, 0.08, "lowpass");

    // Tiny resonant ping — the spring inside the switch
    const ping = ac.createOscillator();
    const pingGain = ac.createGain();
    ping.type = "sine";
    ping.frequency.setValueAtTime(6000 + norm * 800, t);
    ping.frequency.exponentialRampToValueAtTime(3000, t + 0.006);
    pingGain.gain.setValueAtTime(0.03, t);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.008);
    ping.connect(pingGain).connect(ac.destination);
    ping.start(t);
    ping.stop(t + 0.008);
  } catch {
    // Audio not available
  }
}

// Slot machine reel flap tick — each symbol passing the window
export function playSlotTick(pitch = 800) {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Short filtered noise pop — plastic flap hitting the stop
    noiseBlip(ac, t, 0.015, pitch, 5, 0.07);

    // Subtle mechanical body
    noiseBlip(ac, t, 0.02, 200, 2, 0.03, "lowpass");
  } catch {
    // Audio not available
  }
}

// Slot machine spin — mechanical whirring reel sound
export function playSlotSpin() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Broadband mechanical whir (filtered noise sweep)
    const dur = 0.5;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + dur);
    filter.Q.value = 2;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + dur);

    // Low rumble of the mechanism
    const rumble = ac.createOscillator();
    const rumbleGain = ac.createGain();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(80, t);
    rumble.frequency.exponentialRampToValueAtTime(40, t + dur);
    rumbleGain.gain.setValueAtTime(0.04, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    rumble.connect(rumbleGain).connect(ac.destination);
    rumble.start(t);
    rumble.stop(t + dur);
  } catch {
    // Audio not available
  }
}

// Slot machine landing — satisfying mechanical clunk + bell ding
export function playSlotLand() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Heavy mechanical clunk — reel locking into place
    noiseBlip(ac, t, 0.04, 400, 1.5, 0.18, "lowpass");
    noiseBlip(ac, t + 0.005, 0.025, 2000, 4, 0.08);

    // Classic slot machine bell ding
    const bell = ac.createOscillator();
    const bellGain = ac.createGain();
    bell.type = "sine";
    bell.frequency.setValueAtTime(2200, t + 0.04);
    bell.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
    bellGain.gain.setValueAtTime(0.1, t + 0.04);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    bell.connect(bellGain).connect(ac.destination);
    bell.start(t + 0.04);
    bell.stop(t + 0.5);

    // Bell overtone for shimmer
    const shimmer = ac.createOscillator();
    const shimmerGain = ac.createGain();
    shimmer.type = "sine";
    shimmer.frequency.value = 4400;
    shimmerGain.gain.setValueAtTime(0.04, t + 0.05);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    shimmer.connect(shimmerGain).connect(ac.destination);
    shimmer.start(t + 0.05);
    shimmer.stop(t + 0.35);
  } catch {
    // Audio not available
  }
}

// Lever ratchet — metallic spring tension as you pull
export function playLeverCreak() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Short metallic ratchet click
    noiseBlip(ac, t, 0.008, 3500, 8, 0.05);

    // Spring tension creak — filtered noise with resonance
    noiseBlip(ac, t + 0.003, 0.04, 800, 6, 0.03, "bandpass");
  } catch {
    // Audio not available
  }
}

// Gentle chime when timer ends
export function playTimerEnd() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.8);
      osc.connect(gain).connect(ac.destination);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.8);
    });
  } catch {
    // Audio not available
  }
}
