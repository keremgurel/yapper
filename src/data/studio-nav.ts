export type StudioIcon =
  | "home"
  | "share"
  | "calendar"
  | "library"
  | "layers"
  | "record"
  | "scissors"
  | "dictionary"
  | "send"
  | "zap"
  | "brain"
  | "storage";

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

const home: StudioNavItem = {
  title: "Home",
  href: "/studio/home",
  description: "Channel performance, top content, and today's ideas.",
  icon: "home",
};

const inspiration: StudioNavItem = {
  title: "Idea bank",
  href: "/studio/ideas",
  description:
    "Drop a link or a voice note. We keep your words and build the idea.",
  icon: "library",
};

const brain: StudioNavItem = {
  title: "Brain",
  href: "/studio/brain",
  description:
    "What you make, who it is for, and why. Everything we write reads this first.",
  icon: "brain",
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
  description: "Open the native Mac editor for fast, local video editing.",
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

const automations: StudioNavItem = {
  title: "Automations",
  href: "/studio/automations",
  description:
    "Post once and let Yapper cross-post it to your other platforms.",
  icon: "zap",
};

const dictionary: StudioNavItem = {
  title: "Dictionary",
  href: "/studio/dictionary",
  description: "Teach captions the names and vocabulary you use.",
  icon: "dictionary",
};

const connections: StudioNavItem = {
  title: "Connections",
  href: "/studio/connections",
  description:
    "Connect your platform accounts once, so posting can go straight out.",
  icon: "share",
};

const storage: StudioNavItem = {
  title: "Storage",
  href: "/studio/storage",
  description:
    "See what is using space, your plan limit, and what to clean up.",
  icon: "storage",
};

/**
 * The Studio sidebar, grouped by what you are doing: Lab is where ideas come
 * from, Studio is where you make the video, Press is where it goes out, and
 * Settings is one-time plumbing. This drives the sidebar's labeled sections;
 * the flat lists below are derived for the header and homepage.
 */
export const studioNavGroups: StudioNavGroup[] = [
  { label: "", items: [home] },
  { label: "Lab", items: [brain, inspiration, contentLibrary] },
  { label: "Studio", items: [recorder, editor] },
  { label: "Press", items: [poster, calendar, automations] },
  { label: "Settings", items: [storage, dictionary, connections] },
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
