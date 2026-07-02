/** The /tools layer: free, keyless tool pages that rank for high-intent queries
 * and double as live demos of the product. Each funnels toward the create loop.
 * (Structure/IA lives here; visuals use the shared sg-* design system.) */
export type Tool = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  category: "Scripting" | "Delivery" | "Editing";
  cta: string;
};

export const tools: Tool[] = [
  {
    slug: "words-per-minute",
    title: "Words per minute calculator",
    tagline: "How long will your script take to say?",
    description:
      "Paste a script to get its spoken length, or plan how many words fit a target time, at slow, conversational, or fast pace.",
    href: "/tools/words-per-minute",
    category: "Scripting",
    cta: "Open calculator",
  },
  {
    slug: "teleprompter",
    title: "Free teleprompter recorder",
    tagline: "Read your script while you record",
    description:
      "A TikTok-style recorder with your script scrolling over the camera at a pace you set. Record, retake, then edit. No sign-up.",
    href: "/record",
    category: "Delivery",
    cta: "Start recording",
  },
  {
    slug: "editor",
    title: "Edit video by editing the transcript",
    tagline: "Cut words, remove silences, add captions",
    description:
      "The in-browser editor: trim by deleting words, auto-remove pauses, one-click clean up, and burn in captions. Runs entirely on your device.",
    href: "/studio/editor",
    category: "Editing",
    cta: "Open the editor",
  },
];
