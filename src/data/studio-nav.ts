export type StudioIcon = "library" | "layers" | "record" | "scissors";

export interface StudioNavItem {
  title: string;
  href: string;
  description: string;
  icon: StudioIcon;
}

/**
 * The Studio surfaces, in workflow order. Drives the sidebar, the header
 * dropdown, and the mobile menu from one place.
 *
 * Inspiration and Recorder still point at their pre-move routes; they flip to
 * /studio/inspiration and /studio/recorder when those pages move into the
 * shell (Studio restructure PR 3).
 */
export const studioNav: StudioNavItem[] = [
  {
    title: "Inspiration",
    href: "/inspiration",
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
    href: "/record",
    description: "Record a take, with your script on the teleprompter.",
    icon: "record",
  },
  {
    title: "Editor",
    href: "/studio/editor",
    description: "Cut words, fillers, and silences by editing the transcript.",
    icon: "scissors",
  },
];
