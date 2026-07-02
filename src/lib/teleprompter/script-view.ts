import type { Idea } from "@/lib/inspiration/ideas";

/** What the teleprompter shows while recording. The creator picks this before
 * they start (per the core loop: full script / hook + key points / nothing). */
export type TeleprompterView = "script" | "notes" | "off";

export interface ViewOption {
  view: TeleprompterView;
  label: string;
  desc: string;
}

export const VIEW_OPTIONS: ViewOption[] = [
  {
    view: "script",
    label: "Full script",
    desc: "Read it word for word",
  },
  {
    view: "notes",
    label: "Hook + key points",
    desc: "Hit the beats, stay natural",
  },
  {
    view: "off",
    label: "Nothing",
    desc: "Just the camera — wing it",
  },
];

/** Build the teleprompter text for an idea + chosen view. Returns "" for "off"
 * (and whenever there's nothing to show), so the caller can hide the overlay.
 * "script" falls back to the notes view when no script has been written. */
export function teleprompterText(idea: Idea, view: TeleprompterView): string {
  if (view === "off") return "";
  if (view === "script") {
    const script = idea.script?.trim();
    if (script) return script;
    return notesText(idea); // graceful fallback: no script yet → show the beats
  }
  return notesText(idea);
}

function notesText(idea: Idea): string {
  const hook = idea.hooks.map((h) => h.trim()).find(Boolean);
  const points = idea.points.map((p) => p.trim()).filter(Boolean);
  const lines: string[] = [];
  if (hook) lines.push(hook, "");
  points.forEach((p) => lines.push(`• ${p}`));
  if (idea.cta.trim()) lines.push("", idea.cta.trim());
  return lines.join("\n").trim();
}

/** Whether a view has anything to show for this idea (drives whether we offer
 * the scrolling overlay at all). */
export function hasTeleprompterText(
  idea: Idea,
  view: TeleprompterView,
): boolean {
  return teleprompterText(idea, view).length > 0;
}
