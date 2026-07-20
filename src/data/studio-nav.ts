export type StudioIcon =
  | "share"
  | "calendar"
  | "library"
  | "layers"
  | "record"
  | "scissors"
  | "send";

export interface StudioNavItem {
  title: string;
  href: string;
  description: string;
  icon: StudioIcon;
}

/** A labeled section of the Studio sidebar. */
export interface StudioNavGroup {
  label: string;
  items: StudioNavItem[];
}

const inspiration: StudioNavItem = {
  title: "Inspiration",
  href: "/studio/inspiration",
  description:
    "Save clips from creators you like and turn them into video ideas.",
  icon: "library",
};

const contentLibrary: StudioNavItem = {
  title: "Content Library",
  href: "/studio/library",
  description:
    "Your pipeline: shape ideas into scripts and track them to posted.",
  icon: "layers",
};

const recorder: StudioNavItem = {
  title: "Recorder",
  href: "/studio/recorder",
  description: "Record a take, with your script on the teleprompter.",
  icon: "record",
};

const editor: StudioNavItem = {
  title: "Editor",
  href: "/studio/editor",
  description: "Cut words, fillers, and silences by editing the transcript.",
  icon: "scissors",
};

const poster: StudioNavItem = {
  title: "Poster",
  href: "/studio/poster",
  description: "Send a finished video out to your platforms.",
  icon: "send",
};

const calendar: StudioNavItem = {
  title: "Calendar",
  href: "/studio/calendar",
  description: "See and plan everything you have scheduled to post.",
  icon: "calendar",
};

const connections: StudioNavItem = {
  title: "Connections",
  href: "/studio/connections",
  description:
    "Connect your platform accounts once, so posting can go straight out.",
  icon: "share",
};

/**
 * The Studio sidebar, grouped by what you are doing: Lab is where ideas come
 * from, Studio is where you make the video, Press is where it goes out, and
 * Settings is one-time plumbing. This drives the sidebar's labeled sections;
 * the flat lists below are derived for the header and homepage.
 */
export const studioNavGroups: StudioNavGroup[] = [
  { label: "Lab", items: [inspiration, contentLibrary] },
  { label: "Studio", items: [recorder, editor] },
  { label: "Press", items: [poster, calendar] },
  { label: "Settings", items: [connections] },
];

/**
 * The create-to-post workflow in order, for the marketing homepage and the flow
 * section. Calendar and Connections are left out: they are surfaces you visit,
 * not steps you move through.
 */
export const studioFlowNav: StudioNavItem[] = [
  inspiration,
  contentLibrary,
  recorder,
  editor,
  poster,
];

/** Every Studio surface, in sidebar order. For menus and active-route matching
 * that need the full list (header dropdown, mobile nav, page-title lookup). */
export const studioNav: StudioNavItem[] = studioNavGroups.flatMap(
  (g) => g.items,
);
