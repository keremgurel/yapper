import type { ContentBlock } from "@/lib/db/schema";

/** The fields the teleprompter reads. */
export interface PromptSource {
  title?: string;
  hooks: string[];
  /** The item's adaptive body. Legacy rows have their `points` / `example` /
   * `cta` folded into blocks by `normalizeBody` before they get here, so this
   * one field covers both eras. */
  blocks?: ContentBlock[];
  script?: string | null;
}

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
    desc: "Just the camera. Wing it.",
  },
];

/** Build the teleprompter text for an idea + chosen view. Returns "" for "off"
 * (and whenever there's nothing to show), so the caller can hide the overlay.
 * "script" falls back to the notes view when no script has been written. */
export function teleprompterText(
  idea: PromptSource,
  view: TeleprompterView,
): string {
  if (view === "off") return "";
  if (view === "script") {
    const script = idea.script?.trim();
    if (script) return script;
    return notesText(idea); // graceful fallback: no script yet → show the beats
  }
  return notesText(idea);
}

/**
 * The glanceable view: the opening line, then the beats.
 *
 * Section labels are omitted on purpose. This is read at arm's length while
 * talking to a camera, and a heading is the one line you must not accidentally
 * say out loud. `script` blocks are skipped too: they are prose to read
 * verbatim, which is what the "Full script" view is for.
 */
function notesText(idea: PromptSource): string {
  const hook = idea.hooks.map((h) => h.trim()).find(Boolean);
  const lines: string[] = [];
  if (hook) lines.push(hook, "");

  (idea.blocks ?? [])
    .filter((block) => block.kind !== "script")
    .forEach((block) => {
      const items = (block.items ?? []).map((i) => i.trim()).filter(Boolean);
      if (items.length) {
        items.forEach((item) => lines.push(`• ${item}`));
        return;
      }
      const text = (block.text ?? "").trim();
      if (text) lines.push(text, "");
    });

  return lines.join("\n").trim();
}

/** Whether a view has anything to show for this idea (drives whether we offer
 * the scrolling overlay at all). */
export function hasTeleprompterText(
  idea: PromptSource,
  view: TeleprompterView,
): boolean {
  return teleprompterText(idea, view).length > 0;
}
