import { defineStyle } from "../../format/style-definition";
import { interFont } from "../../shared/ink";
import { glassContent } from "./content";
import { glassOptions } from "./options";
import { glassRules } from "./rules";
import { SmokedGlassCard } from "./SmokedGlassCard";

export const smokedGlassCard = defineStyle({
  id: "cards.smoked-glass",
  version: 1,
  name: "Smoked glass",
  category: "cards",
  weight: "produced",
  summary:
    "A dark glass card for a number said once, floating above the speaker or sitting inside a split.",
  output: "video",
  layer: "overlay",
  fonts: [interFont([600, 700, 800])],
  options: glassOptions,
  content: glassContent,
  rules: glassRules,
  preview: {
    durationS: 3.5,
    posterS: 1.8,
    content: { value: "−$40 a month", tone: "cost" },
  },
  Component: SmokedGlassCard,
});
