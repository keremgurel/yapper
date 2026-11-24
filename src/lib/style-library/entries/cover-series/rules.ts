import type { StyleRule } from "../../format/style-definition";

export const coverRules: StyleRule[] = [
  {
    rule: "Every cover in a series is the same layout, so the grid of a profile reads as one show.",
    why: "The cover was measured off an earlier episode's cover instead of being redesigned.",
  },
  {
    rule: "Black background with a dense dot grid: 15 px spacing, dots at 30% white.",
  },
  {
    rule: "The lead line in white at 80 px, then a #222222 box with a 3 px gold #E2B33C outline holding the series title at 108 px. The episode sits under the box on the right in light italics.",
  },
  {
    rule: "The frame of the speaker fills a rounded card below, 982 x 1280 with 50 px corners.",
  },
  {
    rule: "Pick the frame by measurement instead of by eye. Score candidates on face capture quality, eyes open, mouth closed, a slight smile and symmetry, and take the best one.",
    why: "A frame grabbed mid-word looks bad even when the pose seems fine.",
  },
  {
    rule: "A title too long for 108 px shrinks to stay on one line.",
    why: "Added for the library. The reference title fits at full size.",
  },
];
