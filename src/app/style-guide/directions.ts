/** The single Yapper system, shown in two modes. `key` maps to [data-sg-theme]. */
export type ModeKey = "light" | "dark";

export type Mode = {
  key: ModeKey;
  name: string;
  swatches: string[]; // preview dots in the switcher
};

export const MODES: Mode[] = [
  { key: "light", name: "Light", swatches: ["#f4f3f1", "#ff3200", "#201d1d"] },
  { key: "dark", name: "Dark", swatches: ["#0e0d0e", "#ff4a1f", "#f5f3f1"] },
];

/** Brand copy is mode-independent — the identity is one system. */
export const BRAND = {
  name: "Yapper",
  tagline: "A tactile studio for your voice",
  blurb:
    "Aave-grade palette and visibility, orange as our signature, one geo-grotesque typeface, roomy elegant surfaces — and our own yap-creature. Consistent in light and dark.",
};
