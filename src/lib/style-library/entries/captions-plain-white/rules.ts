import type { StyleRule } from "../../format/style-definition";

export const captionRules: StyleRule[] = [
  { rule: "Two or three words at a time." },
  { rule: "Inter 800 at 50 px, white, with a barely visible shadow." },
  {
    rule: "A 3-frame fade and an 8 px rise, nothing else. No colour highlights, bounce or emoji.",
  },
  {
    rule: "Captions sit under the chin (y 1430) and jump to the seam during a split (y 1005 in the reference edit). The layout says where its seam is.",
    why: "The split cuts in whole, so the captions change place on the same frame and never travel.",
  },
  {
    rule: "A caption closes at the end of a sentence and carries no sentence punctuation. Marks inside a word stay, as in $1,200.",
    why: "Read off the approved reference captions. It was never stated as a rule.",
  },
];
