import { defineStyle } from "../../format/style-definition";
import { SAMPLE_WORDS } from "../../samples/sample-take";
import { interFont } from "../../shared/ink";
import { captionContent } from "./content";
import { captionOptions } from "./options";
import { PlainWhiteCaptions } from "./PlainWhiteCaptions";
import { captionRules } from "./rules";

export const plainWhiteCaptions = defineStyle({
  id: "captions.plain-white",
  version: 1,
  name: "Plain white",
  category: "captions",
  weight: "native",
  summary:
    "Two or three heavy white words at a time under the chin, with a short fade and nothing else.",
  output: "video",
  layer: "overlay",
  fonts: [interFont([600, 700, 800])],
  options: captionOptions,
  content: captionContent,
  rules: captionRules,
  preview: {
    durationS: 6,
    posterS: 2.3,
    content: { words: SAMPLE_WORDS },
  },
  Component: PlainWhiteCaptions,
});
