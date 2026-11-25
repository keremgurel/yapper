import type { StyleRule } from "../../format/style-definition";

export const splitRules: StyleRule[] = [
  {
    rule: "The speaker is scaled to 0.82 with its top edge at y 1000 and 48 px top corners. The visual gets a 1000 x 770 box at (40, 210).",
    why: "The measured values of the reference edit.",
  },
  {
    rule: "Hard edges, with a 1.5 px white line inside the speaker card at 16%. No feathered or faded edges on any backdrop.",
    why: "A correction made in review on 22 November 2026.",
  },
  {
    rule: "The layout cuts in whole. Only the visual animates: a 0.15 s rise in and a 0.1 s exit.",
    why: "Captions sit on the seam, and a layout that travels makes them slide.",
  },
  {
    rule: "Across one video, alternate between the blurred take and the dotted grid. Glass cards go on the blur and plain screenshots on the dots.",
  },
  {
    rule: "The blurred take is a blurred, darkened copy of the same take, made with a plain filter and never with backdrop-filter.",
    why: "Headless Chrome renders backdrop-filter differently from frame to frame, which shows as flicker.",
  },
  {
    rule: "A backdrop you bring yourself (a colour, an image, a clip) is darkened by the same amount as the blurred take.",
    why: "Added for the library so white captions on the seam stay readable. The reference edit only used the blur and the dots.",
  },
];
