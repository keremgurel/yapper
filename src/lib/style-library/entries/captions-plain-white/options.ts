import {
  booleanOption,
  colorOption,
  enumOption,
  numberOption,
} from "../../format/option-builders";

/** Defaults are the Ep. 15 captions (`Captions.tsx`): Inter 800 at 50 px, under the chin. */
export const captionOptions = {
  maxWords: numberOption({
    label: "Words at a time",
    default: 3,
    min: 1,
    max: 5,
    step: 1,
    unit: "words",
  }),
  fontSize: numberOption({
    label: "Size",
    default: 50,
    min: 36,
    max: 84,
    unit: "px",
  }),
  weight: enumOption({
    label: "Weight",
    default: "800",
    choices: [
      { value: "600", label: "Semibold" },
      { value: "700", label: "Bold" },
      { value: "800", label: "Extra bold" },
    ],
  }),
  color: colorOption({ label: "Colour", default: "#FFFFFF" }),
  shadow: booleanOption({
    label: "Faint shadow",
    help: "Barely visible. It keeps white text readable on a bright frame without looking outlined.",
    default: true,
  }),
  y: numberOption({
    label: "Height",
    help: "The middle of the first line. Under the chin on a full frame. A split moves captions to its seam unless you set this yourself.",
    default: 1430,
    min: 300,
    max: 1750,
    unit: "px",
  }),
  sideMargin: numberOption({
    label: "Side margin",
    default: 90,
    min: 40,
    max: 240,
    unit: "px",
  }),
} as const;

export type CaptionOptionSpecs = typeof captionOptions;
