import { colorOption, numberOption } from "../../format/option-builders";

/** Defaults are measured off the Ep. 9 cover, scaled to 1080 wide (`Thumbnail.tsx`). */
export const coverOptions = {
  accent: colorOption({
    label: "Outline colour",
    help: "The thin line around the title box. The only colour on the cover.",
    default: "#E2B33C",
  }),
  boxFill: colorOption({ label: "Title box fill", default: "#222222" }),
  background: colorOption({ label: "Background", default: "#050505" }),
  dotSpacing: numberOption({
    label: "Dot spacing",
    default: 15,
    min: 10,
    max: 40,
    unit: "px",
  }),
  dotOpacity: numberOption({
    label: "Dot strength",
    default: 0.3,
    min: 0,
    max: 0.6,
    step: 0.02,
    unit: "ratio",
  }),
  frameRadius: numberOption({
    label: "Photo corner radius",
    default: 50,
    min: 0,
    max: 120,
    unit: "px",
  }),
} as const;

export type CoverOptionSpecs = typeof coverOptions;
