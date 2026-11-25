import { booleanOption, numberOption } from "../../format/option-builders";
import { backdropOptions } from "../../shared/backdrop/backdrop-options";

/**
 * The camera fills the bottom of the frame, cropped to fit, and the top is one
 * open area. These defaults are a starting point, not measured off an approved
 * reference yet.
 */
export const halfOptions = {
  ...backdropOptions("dots"),
  splitAt: numberOption({
    label: "Where the camera starts",
    help: "960 is the middle of the frame. Lower numbers give the camera more room.",
    default: 960,
    min: 600,
    max: 1400,
    unit: "px",
  }),
  cameraZoom: numberOption({
    label: "Camera zoom",
    help: "1 fits the take to the width. Higher crops closer to the face.",
    default: 1,
    min: 1,
    max: 2,
    step: 0.02,
    unit: "ratio",
  }),
  cameraFocusY: numberOption({
    label: "Camera focus",
    help: "Which part of the take stays in the camera area. 0 is the top, 1 the bottom. Lower it if the chin is cut off.",
    default: 0.3,
    min: 0,
    max: 1,
    step: 0.02,
    unit: "ratio",
  }),
  visualInset: numberOption({
    label: "Margin around the top visual",
    help: "0 lets a picture or clip fill the whole top area.",
    default: 0,
    min: 0,
    max: 160,
    unit: "px",
  }),
  seamLine: booleanOption({
    label: "Line on the seam",
    help: "A thin white line at 16% between the two halves.",
    default: false,
  }),
} as const;

export type HalfOptionSpecs = typeof halfOptions;
