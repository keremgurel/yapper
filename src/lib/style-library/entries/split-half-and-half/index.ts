import { defineStyle } from "../../format/style-definition";
import { SAMPLE_CLIP, SAMPLE_TAKE } from "../../samples/sample-take";
import { interFont } from "../../shared/ink";
import { takeContent } from "../../shared/take-content";
import { halfOptions } from "./options";
import { SplitHalfAndHalf } from "./SplitHalfAndHalf";

export const splitHalfAndHalf = defineStyle({
  id: "splits.half-and-half",
  version: 1,
  name: "Half and half",
  category: "splits",
  weight: "native",
  summary:
    "The camera fills the bottom half, cropped to fit, and a picture, clip or card takes the top half.",
  output: "video",
  layer: "frame",
  fonts: [interFont([600, 700, 800])],
  options: halfOptions,
  content: takeContent,
  slots: {
    top: { label: "Top half", accepts: ["overlays", "cards"] },
  },
  // Just under the seam, on the camera: the top half may be a white screenshot.
  captionY: (options) => options.splitAt + 48,
  rules: [
    {
      rule: "The camera is cropped to fill its half. The take's own shape is not kept.",
      why: "By design: the camera fills its half, so the video's own shape is not kept.",
    },
    {
      rule: "Two hard-edged halves. No rounded card, no gap and no feathered edge by default.",
      why: "Carried over from the hard-edge rule of the other split. Not yet checked against a reference for this layout.",
    },
    {
      rule: "Captions sit just under the seam, on the camera half.",
      why: "The top half is often a white screenshot, and white captions across the seam lose their top edge on it.",
    },
    {
      rule: "The top half is one area with one thing in it: a clip, a screenshot or a card.",
    },
  ],
  preview: {
    durationS: 4,
    posterS: 2,
    content: { take: SAMPLE_TAKE },
    slots: {
      top: { styleId: "overlays.media", content: { src: SAMPLE_CLIP } },
    },
  },
  Component: SplitHalfAndHalf,
});
