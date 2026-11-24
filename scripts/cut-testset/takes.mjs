/**
 * The 24 takes: each script recorded four times, by different voices and in
 * different conditions, with the mistakes dealt in a different order. The
 * voices are the Mac's built-in ones, picked for their accents.
 */
const VOICES = [
  { id: "Samantha", accent: "US" },
  { id: "Daniel", accent: "UK" },
  { id: "Karen", accent: "Australian" },
  { id: "Rishi", accent: "Indian" },
  { id: "Moira", accent: "Irish" },
  { id: "Tessa", accent: "South African" },
  { id: "Tara", accent: "Indian" },
  { id: "Aman", accent: "Indian" },
];

/** How the recording differs from a clean studio take. */
export const CONDITIONS = {
  clean: { label: "Clean", rate: 175, filter: null },
  phone: {
    label: "Phone microphone",
    rate: 175,
    filter: "highpass=f=300,lowpass=f=3400,acompressor=threshold=-18dB:ratio=3",
  },
  noisy: { label: "Noisy room", rate: 175, filter: "noise" },
  fast: { label: "Fast talker, quiet", rate: 215, filter: "volume=-14dB" },
};

const SCRIPTS = ["week", "squat", "launch", "pasta", "savings", "spanish"];
const CONDITION_IDS = Object.keys(CONDITIONS);

export const TAKES = SCRIPTS.flatMap((script, s) =>
  CONDITION_IDS.map((condition, c) => {
    const voice = VOICES[(s * 3 + c * 2 + (c > 1 ? 1 : 0)) % VOICES.length];
    return {
      id: `${script}-${condition}`,
      script,
      condition,
      voice: voice.id,
      accent: voice.accent,
      seed: 1000 + s * 10 + c,
    };
  }),
);

/**
 * One long session: all six scripts in a row, with the mistakes dealt
 * differently from the short takes. About seven minutes and 48 lines, to check
 * the cut holds up when a take is long and messy. Each script appears once: a
 * script delivered twice in one take is a retake of the whole thing, and the
 * edit model rightly removes the first.
 */
export const LONG_TAKE = {
  id: "long-clean",
  script: "all",
  condition: "clean",
  voice: "Samantha",
  accent: "US",
  parts: SCRIPTS.map((script, index) => ({ script, seed: 5000 + index })),
};
