import { enumOption, textOption } from "../../format/option-builders";

export const glassContent = {
  label: textOption({ label: "Label", default: "", maxLength: 40 }),
  value: textOption({ label: "Value", default: "", maxLength: 24 }),
  detail: textOption({ label: "Detail", default: "", maxLength: 60 }),
  tone: enumOption({
    label: "Value colour",
    help: "Red is for cost and green is for value. Everything else stays white.",
    default: "neutral",
    choices: [
      { value: "neutral", label: "White" },
      { value: "cost", label: "Cost (red)" },
      { value: "value", label: "Value (green)" },
    ],
  }),
} as const;

export type GlassContentSpecs = typeof glassContent;
