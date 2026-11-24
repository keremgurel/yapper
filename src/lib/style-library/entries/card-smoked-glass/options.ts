import {
  booleanOption,
  colorOption,
  numberOption,
} from "../../format/option-builders";

/** Defaults are the Ep. 15 glass (`look.ts`, `glass`) and its float position (`Stage.tsx`). */
export const glassOptions = {
  tint: colorOption({ label: "Tint", default: "#161618" }),
  tintOpacity: numberOption({
    label: "Tint strength",
    help: "Kept high on purpose: the card does not blur what is behind it, so the tint has to carry the text.",
    default: 0.72,
    min: 0.4,
    max: 1,
    step: 0.02,
    unit: "ratio",
  }),
  cornerRadius: numberOption({
    label: "Corner radius",
    default: 40,
    min: 0,
    max: 80,
    unit: "px",
  }),
  borderOpacity: numberOption({
    label: "Border strength",
    default: 0.16,
    min: 0,
    max: 0.5,
    step: 0.02,
    unit: "ratio",
  }),
  sheen: booleanOption({
    label: "Top sheen",
    help: "A faint light gradient and a highlight along the top edge.",
    default: true,
  }),
  shadow: booleanOption({ label: "Shadow", default: true }),
  scale: numberOption({
    label: "Size",
    help: "1 is the size used over a full-frame speaker. Go larger when the card has a split's visual box to itself.",
    default: 1,
    min: 0.6,
    max: 2,
    step: 0.05,
    unit: "ratio",
  }),
  top: numberOption({
    label: "Distance from the top",
    help: "Used when the card floats over the speaker. Inside a split the layout places it.",
    default: 250,
    min: 80,
    max: 900,
    unit: "px",
  }),
} as const;

export type GlassOptionSpecs = typeof glassOptions;
