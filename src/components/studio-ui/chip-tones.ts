/**
 * The tone vocabulary every chip draws from. Hues carry fixed meanings
 * (docs/studio-design-language.md section 5); nothing outside this set may
 * color a chip.
 *
 * Foreground mixes the hue with `--sg-text` instead of hand-picking a pair per
 * theme: `--sg-text` is near-black in light and near-white in dark, so one
 * class yields a darkened hue on light tints and a lightened hue on dark tints
 * without any `dark:` variant.
 *
 * Every class is written out in full, never assembled from a token name at
 * runtime. Tailwind only emits CSS for candidates it can find as literal text
 * in the source, so a template-built `bg-[color-mix(...var(${token})...)]`
 * produces no rule at all and the chip silently renders untinted. The same
 * constraint is documented on `gridTemplate` in `src/lib/content/columns.ts`.
 */
export type ChipTone =
  | "neutral"
  | "cyan"
  | "violet"
  | "green"
  | "pink"
  | "yellow";

interface ToneClasses {
  /** Tinted background for the tint variant. */
  bg: string;
  /** Readable text on that tint, both themes. */
  fg: string;
  /** Solid fill for the dot variant's marker. */
  dot: string;
}

export const CHIP_TONES: Record<ChipTone, ToneClasses> = {
  neutral: {
    bg: "bg-muted",
    fg: "text-muted-foreground",
    dot: "bg-[color:var(--sg-ink-400)]",
  },
  cyan: {
    bg: "bg-[color-mix(in_oklab,var(--sg-cyan-500)_16%,transparent)]",
    fg: "text-[color-mix(in_oklab,var(--sg-cyan-500)_62%,var(--sg-text))]",
    dot: "bg-[color:var(--sg-cyan-500)]",
  },
  violet: {
    bg: "bg-[color-mix(in_oklab,var(--sg-violet-500)_16%,transparent)]",
    fg: "text-[color-mix(in_oklab,var(--sg-violet-500)_62%,var(--sg-text))]",
    dot: "bg-[color:var(--sg-violet-500)]",
  },
  green: {
    bg: "bg-[color-mix(in_oklab,var(--sg-green-500)_16%,transparent)]",
    fg: "text-[color-mix(in_oklab,var(--sg-green-500)_62%,var(--sg-text))]",
    dot: "bg-[color:var(--sg-green-500)]",
  },
  pink: {
    bg: "bg-[color-mix(in_oklab,var(--sg-pink-500)_16%,transparent)]",
    fg: "text-[color-mix(in_oklab,var(--sg-pink-500)_62%,var(--sg-text))]",
    dot: "bg-[color:var(--sg-pink-500)]",
  },
  // Yellow leans harder on the text token: pure yellow text is unreadable on a
  // light tint.
  yellow: {
    bg: "bg-[color-mix(in_oklab,var(--sg-yellow-500)_16%,transparent)]",
    fg: "text-[color-mix(in_oklab,var(--sg-yellow-500)_48%,var(--sg-text))]",
    dot: "bg-[color:var(--sg-yellow-500)]",
  },
};
