export type StudioIcon =
  | "share"
  | "calendar"
  | "library"
  | "layers"
  | "record"
  | "scissors"
  | "dictionary"
  | "send";

export interface StudioNavItem {
  title: string;
  href: string;
  description: string;
  icon: StudioIcon;
}

/**
 * The Studio workflow, in the order a creator moves through it: collect
 * inspiration, shape it in the library, record, edit, then post. Poster is the
 * last step, where a finished cut goes out and gets scheduled. This drives the
 * primary sidebar group, the header dropdown, and the marketing homepage.
 */
export const studioFlowNav: StudioNavItem[] = [
  {
    title: "Inspiration",
    href: "/studio/inspiration",
    description:
      "Save clips from creators you like and turn them into video ideas.",
    icon: "library",
  },
  {
    title: "Content Library",
    href: "/studio/library",
    description:
      "Your pipeline: shape ideas into scripts and track them to posted.",
    icon: "layers",
  },
  {
    title: "Recorder",
    href: "/studio/recorder",
    description: "Record a take, with your script on the teleprompter.",
    icon: "record",
  },
  {
    title: "Editor",
    href: "/studio/editor",
    description: "Cut words, fillers, and silences by editing the transcript.",
    icon: "scissors",
  },
  {
    title: "Poster",
    href: "/studio/poster",
    description: "Post a finished cut and see everything on your calendar.",
    icon: "send",
  },
];

/**
 * The supporting surfaces that sit beneath the workflow: plumbing you set up
 * once and rarely touch, not steps you move through. Rendered as a muted second
 * group so the main flow stays uncluttered.
 */
export const studioUtilityNav: StudioNavItem[] = [
  {
    title: "Dictionary",
    href: "/studio/dictionary",
    description: "Teach captions the names and vocabulary you use.",
    icon: "dictionary",
  },
  {
    title: "Connections",
    href: "/studio/connections",
    description:
      "Connect your platform accounts once, so posting can go straight out.",
    icon: "share",
  },
];

/** Every Studio surface, flow first then utility. For menus that list them all. */
export const studioNav: StudioNavItem[] = [
  ...studioFlowNav,
  ...studioUtilityNav,
];
