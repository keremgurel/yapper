import type { StyleRule } from "../../format/style-definition";

export const glassRules: StyleRule[] = [
  {
    rule: "One surface for every card in a video: a dark tint at 72%, a thin white border at 16%, a soft shadow and 40 px corners.",
  },
  {
    rule: "The card does not use backdrop-filter. The tint is nearly opaque instead.",
    why: "Headless Chrome renders that blur differently from frame to frame and it flickers. A mostly opaque tint keeps every frame identical whatever moves behind the card.",
  },
  {
    rule: "White text, two greys for secondary text, red #FF7A6B for cost and green #5BE3A0 for value. Nothing else.",
  },
  {
    rule: "It enters with a short rise, a small scale-up and a fade on one ease curve (0.22, 1, 0.36, 1). The exit is faster than the entrance.",
  },
  {
    rule: "Use the card for a number said once. Where a real screenshot, recording or ad exists, show that instead of a drawn graphic.",
    why: "Invented overlay graphics are kept to a minimum on purpose.",
  },
];
