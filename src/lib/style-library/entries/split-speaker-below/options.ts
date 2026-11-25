import { booleanOption, numberOption } from "../../format/option-builders";
import { backdropOptions } from "../../shared/backdrop/backdrop-options";

/** Defaults are the measured values of the Ep. 15 edit (`look.ts`, `splitBox`). */
export const splitOptions = {
  ...backdropOptions("frosted"),
  speakerScale: numberOption({
    label: "Speaker size",
    default: 0.82,
    min: 0.5,
    max: 1,
    step: 0.01,
    unit: "ratio",
  }),
  speakerTop: numberOption({
    label: "Speaker top edge",
    default: 1000,
    min: 700,
    max: 1500,
    unit: "px",
  }),
  speakerHeadroom: numberOption({
    label: "Speaker headroom",
    help: "The row of the take that sits at the top of the speaker card. Raise it to crop closer to the face.",
    default: 280,
    min: 0,
    max: 900,
    unit: "px",
  }),
  cornerRadius: numberOption({
    label: "Corner radius",
    default: 48,
    min: 0,
    max: 120,
    unit: "px",
  }),
  edgeLine: booleanOption({
    label: "Edge line",
    help: "A 1.5 px white line inside the speaker card at 16%.",
    default: true,
  }),
  visualTop: numberOption({
    label: "Visual top edge",
    default: 210,
    min: 60,
    max: 600,
    unit: "px",
  }),
  visualInset: numberOption({
    label: "Visual side margin",
    default: 40,
    min: 0,
    max: 200,
    unit: "px",
  }),
  seamGap: numberOption({
    label: "Gap above the speaker",
    default: 20,
    min: 0,
    max: 120,
    unit: "px",
  }),
} as const;

export type SplitOptionSpecs = typeof splitOptions;
