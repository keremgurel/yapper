import { defineStyle } from "../../format/style-definition";
import { SAMPLE_FRAME } from "../../samples/sample-take";
import { interFont } from "../../shared/ink";
import { coverContent } from "./content";
import { coverOptions } from "./options";
import { coverRules } from "./rules";
import { SeriesCover } from "./SeriesCover";

export const seriesCover = defineStyle({
  id: "covers.series",
  version: 1,
  name: "Series cover",
  category: "covers",
  weight: "produced",
  summary:
    "The cover every episode of a series shares: the title in an outlined box on a dot grid, the speaker in a rounded card.",
  output: "still",
  layer: "frame",
  fonts: [interFont([700]), interFont([400], true)],
  options: coverOptions,
  content: coverContent,
  rules: coverRules,
  preview: {
    durationS: 0,
    posterS: 0,
    content: {
      lead: "Learning",
      title: "Guitar in 90 days",
      episode: "Day 12",
      frame: SAMPLE_FRAME,
      // Framed for the sample still: full width of the card, face a little above the middle.
      frameWidth: 982,
      frameX: 0,
      frameY: -90,
    },
  },
  Component: SeriesCover,
});
