import {
  mediaOption,
  numberOption,
  textOption,
} from "../../format/option-builders";

export const coverContent = {
  lead: textOption({
    label: "Line above the title",
    default: "",
    maxLength: 24,
  }),
  title: textOption({
    label: "Series title",
    default: "Your series title",
    maxLength: 32,
  }),
  episode: textOption({ label: "Episode", default: "Ep. 1", maxLength: 12 }),
  frame: mediaOption({
    label: "Frame of the speaker",
    help: "Pick a frame between words: eyes open, mouth closed. A frame grabbed mid-word looks bad even when the pose seems fine.",
    accepts: ["image"],
  }),
  frameWidth: numberOption({
    label: "Frame zoom",
    help: "Width the frame is drawn at inside the 982 px card.",
    default: 1100,
    min: 982,
    max: 2400,
    unit: "px",
  }),
  frameX: numberOption({
    label: "Frame shift across",
    default: -59,
    min: -1400,
    max: 0,
    unit: "px",
  }),
  frameY: numberOption({
    label: "Frame shift down",
    default: -330,
    min: -3000,
    max: 0,
    unit: "px",
  }),
} as const;

export type CoverContentSpecs = typeof coverContent;
