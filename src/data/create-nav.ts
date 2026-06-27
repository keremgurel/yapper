export type CreateIcon = "library" | "lightbulb" | "record" | "scissors";

export interface CreateNavItem {
  title: string;
  href: string;
  description: string;
  icon: CreateIcon;
  step: string;
}

/** The Phase 2 creation flow: Inspiration → Ideas → Record → Edit. */
export const createNav: CreateNavItem[] = [
  {
    title: "Inspiration",
    href: "/inspiration",
    description:
      "Save YouTube, TikTok, and Instagram clips into pillar folders.",
    icon: "library",
    step: "Collect",
  },
  {
    title: "Ideas",
    href: "/ideation",
    description: "Turn a saved clip into a hook, key points, and a takeaway.",
    icon: "lightbulb",
    step: "Plan",
  },
  {
    title: "Record",
    href: "/training/random-topic-generator",
    description: "Practice and record a clean take with a timer and camera.",
    icon: "record",
    step: "Record",
  },
  {
    title: "Studio",
    href: "/studio",
    description:
      "Edit by editing the transcript — cut words, fillers, silences.",
    icon: "scissors",
    step: "Edit",
  },
];

/** Just the standalone tools (Record lives in the practice flow). */
export const createTools = createNav.filter((i) => i.icon !== "record");
