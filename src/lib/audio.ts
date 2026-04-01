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

// Slot reel tick — sharp, dry click like a playing card in spokes
// This fires every 80ms during the spin. No tone, just a crisp snap.
export function playSlotTick(pitch = 800) {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Ultra-short noise snap — the flap hitting the reel stop
    const len = 0.006;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // Decaying impulse, not steady noise
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = pitch;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(hp).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + len);
  } catch {
    // Audio not available
  }
}

// Slot spin start — silent, the rapid ticks handle the sound
export function playSlotSpin() {
  // intentionally silent — the playSlotTick rapid-fire IS the spin sound
}

// Slot landing — just a single satisfying thud, nothing else
export function playSlotLand() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // One firm clunk — reel locks into place
    noiseBlip(ac, t, 0.025, 300, 1, 0.13, "lowpass");
  } catch {
    // Audio not available
  }
}

// Lever pull — mechanical ratchet click, like pulling a real slot lever
export function playLeverCreak() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Ratchet click — same character as the slot ticks but slightly heavier
    const len = 0.008;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(hp).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + len);

    // Low thud body — gives it weight
    noiseBlip(ac, t, 0.012, 300, 1.5, 0.05, "lowpass");
  } catch {
    // Audio not available
  }
}

// Timer end — rapid clickity burst that decelerates, then a soft chime
export function playTimerEnd() {
  try {
    const ac = getAudioCtx();
    const t = ac.currentTime;

    // Rapid decelerating clicks — same texture as slot ticks
    const clicks = 8;
    for (let i = 0; i < clicks; i++) {
      const delay = i * (0.04 + i * 0.008); // accelerating gaps
      const len = 0.006;
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1000 + i * 100;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.1, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + len);
      src.connect(hp).connect(gain).connect(ac.destination);
      src.start(t + delay);
      src.stop(t + delay + len);
    }

    // Soft finishing chime after the clicks
    const chimeDelay = 0.5;
    const chime = ac.createOscillator();
    const chimeGain = ac.createGain();
    chime.type = "sine";
    chime.frequency.value = 880;
    chimeGain.gain.setValueAtTime(0.06, t + chimeDelay);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + chimeDelay + 0.5);
    chime.connect(chimeGain).connect(ac.destination);
    chime.start(t + chimeDelay);
    chime.stop(t + chimeDelay + 0.5);
  } catch {
    // Audio not available
  }
}
