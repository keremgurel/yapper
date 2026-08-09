export type CoverPreset = "paper" | "ink" | "sunset";
export type CoverPosition = "top" | "center" | "bottom";

/** The cover image a post ships with, kept separate from its captions: one
 * cover serves every platform, the captions do not. */
export interface CoverDraft {
  headline: string;
  preset: CoverPreset;
  position: CoverPosition;
}

/**
 * Each preset twice: once as Tailwind for the on-screen proof, once as canvas
 * stops in `render-cover.ts` for the exported PNG. Written out in full because
 * Tailwind only emits CSS for classes it can find as literal text.
 */
export const COVER_PRESETS: Record<
  CoverPreset,
  { label: string; shell: string; card: string }
> = {
  paper: {
    label: "Paper",
    shell: "bg-[linear-gradient(145deg,#e9e4db,#b9c0bd)]",
    card: "bg-white text-black",
  },
  ink: {
    label: "Ink",
    shell: "bg-[radial-gradient(circle_at_30%_10%,#373737,#090909_68%)]",
    card: "bg-black text-white",
  },
  sunset: {
    label: "Sunset",
    shell:
      "bg-[radial-gradient(circle_at_18%_10%,#ffbd75,transparent_38%),linear-gradient(160deg,#a83525,#27111c_72%)]",
    card: "bg-white text-black",
  },
};

export function defaultCover(title: string): CoverDraft {
  return { headline: title, preset: "paper", position: "top" };
}
