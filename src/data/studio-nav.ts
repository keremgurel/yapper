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
 */
export const studioNav: StudioNavItem[] = [
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
];
