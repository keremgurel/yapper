import { defineStyle } from "../../format/style-definition";
import { SAMPLE_TAKE } from "../../samples/sample-take";
import { interFont } from "../../shared/ink";
import { takeContent } from "../../shared/take-content";
import { splitOptions } from "./options";
import { splitRules } from "./rules";
import { SplitSpeakerBelow } from "./SplitSpeakerBelow";

export const splitSpeakerBelow = defineStyle({
  id: "splits.speaker-below",
  version: 1,
  name: "Speaker below",
  category: "splits",
  weight: "produced",
  summary:
    "The speaker shrinks into a card at the bottom and a visual takes the top, on a blurred take, a dotted grid or your own backdrop.",
  output: "video",
  layer: "frame",
  fonts: [interFont([600, 700, 800])],
  options: splitOptions,
  content: takeContent,
  slots: {
    visual: {
      label: "Top visual",
      accepts: ["cards", "overlays"],
    },
  },
  // Straddles the seam: 1005 against a speaker top of 1000 in Ep. 15.
  captionY: (options) => options.speakerTop + 5,
  rules: splitRules,
  preview: {
    durationS: 4,
    posterS: 2,
    content: { take: SAMPLE_TAKE },
    slots: {
      visual: {
        styleId: "cards.smoked-glass",
        options: { scale: 1.5 },
        content: {
          label: "Signups this week",
          value: "1,284",
          detail: "Up from 960 last week",
        },
      },
    },
  },
  Component: SplitSpeakerBelow,
});
