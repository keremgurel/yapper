export type SoundEffectId = "pop" | "ding" | "swoosh" | "click";

export interface SoundEffectPreset {
  id: SoundEffectId;
  name: string;
  hint: string;
  duration: number;
}

export const SOUND_EFFECTS: SoundEffectPreset[] = [
  { id: "pop", name: "Pop", hint: "Reveal or callout", duration: 0.22 },
  { id: "ding", name: "Ding", hint: "Success or result", duration: 0.72 },
  {
    id: "swoosh",
    name: "Swoosh",
    hint: "Motion or transition",
    duration: 0.58,
  },
  { id: "click", name: "Click", hint: "Tap or selection", duration: 0.12 },
];

const SAMPLE_RATE = 44_100;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++)
    view.setUint8(offset + i, value.charCodeAt(i));
}

/** Small dependency-free WAVs keep the starter sound library instant/offline. */
export function soundEffectFile(id: SoundEffectId): File {
  const preset =
    SOUND_EFFECTS.find((effect) => effect.id === id) ?? SOUND_EFFECTS[0];
  const length = Math.ceil(preset.duration * SAMPLE_RATE);
  const samples = new Float32Array(length);
  let noise = 0x12345678;

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const p = i / length;
    let value = 0;
    if (id === "pop") {
      const hz = 340 - p * 210;
      value = Math.sin(2 * Math.PI * hz * t) * Math.pow(1 - p, 3.2);
    } else if (id === "ding") {
      const decay = Math.exp(-5.4 * t);
      value =
        (Math.sin(2 * Math.PI * 880 * t) * 0.72 +
          Math.sin(2 * Math.PI * 1320 * t) * 0.28) *
        decay;
    } else if (id === "swoosh") {
      noise = (1664525 * noise + 1013904223) >>> 0;
      const white = (noise / 0xffffffff) * 2 - 1;
      const envelope = Math.sin(Math.PI * p) * (1 - p * 0.35);
      value =
        (white * 0.45 + Math.sin(2 * Math.PI * (150 + p * 720) * t) * 0.25) *
        envelope;
    } else {
      value =
        (Math.sin(2 * Math.PI * 1900 * t) +
          Math.sin(2 * Math.PI * 2700 * t) * 0.35) *
        Math.pow(1 - p, 7);
    }
    samples[i] = Math.max(-1, Math.min(1, value * 0.78));
  }

  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    view.setInt16(44 + i * 2, Math.round(samples[i] * 0x7fff), true);
  }

  return new File([buffer], `${preset.name}.wav`, { type: "audio/wav" });
}

export function previewSoundEffect(id: SoundEffectId): void {
  const url = URL.createObjectURL(soundEffectFile(id));
  const audio = new Audio(url);
  audio.volume = 0.8;
  audio.onended = () => URL.revokeObjectURL(url);
  audio.onerror = () => URL.revokeObjectURL(url);
  void audio.play().catch(() => URL.revokeObjectURL(url));
}
